import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { IdentityService } from '../users/identity.service';
import { QuarantineService } from '../storage/quarantine.service';
import { MAX_EXPIRATION_SECONDS, StorageService } from '../storage/storage.service';
import {
  DEAL_BUYER_PROFILE_REQUIRED,
  DEAL_IDENTITY_REQUIRED,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPES,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_TERMINAL,
  DealPaymentProofDownload,
  DealPaymentSlot,
  DealPaymentType,
  DealPaymentView,
  DealStatus,
  DealSummary,
  ERROR_FILE_QUARANTINED,
  PaymentType,
  ProfileStatus,
  TERMINAL_DEAL_STATUSES,
  UserRole,
  dealPaymentTypeSchema,
  isPaymentUploadable,
  uploadDealProofSchema,
  validateDealPaymentProofFile,
} from '@elmasaif/shared';
import { DealProofUploadFile } from './dto/upload-payment-proof.dto';
import { PlatformAccountService } from './platform-account';
import { toDealPaymentSlot, toDealPaymentView, toDealSummary } from './deal-payment.mapper';

/** The listing title is the only listing column the buyer screens render. */
const DEAL_INCLUDE = {
  listing: { select: { id: true, title: true } },
} as const;

const PAYMENT_SELECT = {
  id: true,
  dealId: true,
  paymentType: true,
  amount: true,
  status: true,
  proofFileUrl: true,
  bankReferenceCode: true,
  senderBankName: true,
  uploadedAt: true,
  rejectionReason: true,
} as const;

/** Which frozen deal column funds each leg (FR-29: read, never recompute). */
const SLOT_AMOUNT_FIELD: Record<DealPaymentType, 'platformCommission' | 'dealPrice'> = {
  [PaymentType.PLATFORM_COMMISSION]: 'platformCommission',
  [PaymentType.SELLER_PURCHASE_PRICE]: 'dealPrice',
};

/**
 * Story 5.2 / AC-1, AC-2, AC-4…AC-12, D7: the buyer's deal payment surface.
 *
 * Everything here is scoped to the caller's own buyer profile — the deal is never reachable by
 * id alone. Money is read from the frozen columns (FR-29) and stringified (BR-02); the clock is
 * `ClockService` (AD-11); proofs are quarantined before they are believed (NFR-13 / AD-6).
 *
 * Deliberately absent: admin review (`UNDER_REVIEW`), `CONFIRMED`/`REJECTED` decisions, expiry
 * transitions and any notification dispatch — Stories 5.3, 5.5 and 8.8 own those. This service
 * only ever writes `PROOF_UPLOADED`.
 */
@Injectable()
export class BuyerDealsService {
  private readonly logger = new Logger(BuyerDealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly crypto: CryptoService,
    private readonly platformAccount: PlatformAccountService,
    private readonly identityService: IdentityService,
    private readonly quarantineService: QuarantineService,
    private readonly storageService: StorageService,
  ) {}

  /** `GET /deals/my` — the buyer's own deals, newest first. No payment rows are created here. */
  async listMyDeals(userId: string, activeRole: UserRole): Promise<DealSummary[]> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    const deals = await this.prisma.deal.findMany({
      where: { buyerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { ...DEAL_INCLUDE, payments: { select: PAYMENT_SELECT } },
    });

    return deals.map((deal: any) =>
      toDealSummary(deal, deal.listing?.title, deal.payments ?? []),
    );
  }

  /**
   * `GET /deals/:id` — the payment screen, with both slots materialized.
   *
   * The platform account is resolved *before* the database is touched: a misconfigured collection
   * IBAN must fail as a 503 without side effects, not after half a page has been built.
   */
  async getDealPayment(
    userId: string,
    activeRole: UserRole,
    dealId: string,
  ): Promise<DealPaymentView> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);
    const account = this.platformAccount.getAccount();
    const now = this.clockService.now();

    const { deal, payments } = await this.prisma.$transaction(async (tx: any) => {
      const row = await tx.deal.findUnique({ where: { id: dealId }, include: DEAL_INCLUDE });
      this.assertOwnership(row, profile.id);

      // D1: the first read of the payment plan is what creates it. `upsert` + the
      // `(dealId, paymentType)` unique key make two concurrent readers idempotent.
      const slots = await this.ensureDealPayments(tx, row);
      return { deal: row, payments: slots };
    });

    return toDealPaymentView(deal, payments, account, this.decryptSellerIban(deal), now);
  }

  /**
   * `POST /deals/:id/payments/:paymentType/proof` — AC-7, AC-8, AC-9, AC-10, AC-11.
   *
   * The step order is the contract (Dev Notes §The upload transaction). One deviation from the
   * identity flow is deliberate: staging and scanning happen **inside** the transaction, because
   * the object key `payments/<dealId>/<paymentId>/…` needs the payment row to exist first, and
   * scanning outside would leave a window where a `Payment` points at a file that later failed.
   */
  async uploadProof(
    userId: string,
    activeRole: UserRole,
    dealId: string,
    rawPaymentType: string,
    file: DealProofUploadFile | undefined,
    body: unknown,
  ): Promise<DealPaymentSlot> {
    const paymentType = this.parsePaymentType(rawPaymentType);
    this.assertProofFile(file);
    const reference = this.parseReferenceBody(body, paymentType);

    const profile = await this.resolveBuyerProfile(userId, activeRole);
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Row lock, then read. `deals.id` is a `text` column: `::text`, never `::uuid` (T-1).
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;
      const deal = await tx.deal.findUnique({ where: { id: dealId }, include: DEAL_INCLUDE });
      this.assertOwnership(deal, profile.id);

      // 2. Terminal → deadline → slot state, in that order.
      if (TERMINAL_DEAL_STATUSES.includes(deal.status as DealStatus)) {
        throw new ConflictException({
          code: DEAL_TERMINAL,
          message: 'لا يمكن رفع إثبات تحويل لصفقة منتهية',
        });
      }
      if (new Date(deal.paymentDeadline).getTime() <= now.getTime()) {
        throw new ConflictException({
          code: DEAL_PAYMENT_DEADLINE_PASSED,
          message: 'انتهت مهلة رفع إثبات التحويل (48 ساعة من اعتماد الصفقة)',
        });
      }

      // 3. Materialize both slots, then read the target one back — the storage key needs its id.
      const slots = await this.ensureDealPayments(tx, deal);
      const payment = slots.find((row: any) => row.paymentType === paymentType);
      if (!isPaymentUploadable(payment?.status)) {
        throw new ConflictException({
          code: DEAL_PAYMENT_REVIEW_COMPLETE,
          message:
            'إثبات هذه الدفعة قيد المراجعة أو تم تأكيده، ولا يمكن استبداله في هذه المرحلة',
        });
      }

      // 4. FR-30 / BR-10: a clean, non-rejected identity document or nothing.
      const identity = await this.identityService.getIdentityStatus(userId);
      if (!identity.canUploadDealPaymentProof) {
        throw new ConflictException({
          code: DEAL_IDENTITY_REQUIRED,
          message: 'أكمل توثيق هويتك قبل رفع إثبات التحويل',
        });
      }

      // 5. Quarantine first, decide after (NFR-13 / AD-6).
      const staged = await this.quarantineService.stageFileForQuarantine({
        filename: file!.originalname,
        mimeType: file!.mimetype,
        fileSize: file!.size,
        buffer: file!.buffer,
        userId,
      });

      let outcome;
      try {
        outcome = await this.quarantineService.scanAndProcess(
          staged.fileObjectId,
          'payments',
          { dealId: deal.id, paymentId: payment.id },
          userId,
        );
      } catch (error: any) {
        // The scanner itself is unavailable. QuarantineService throws a plain-string 403, which
        // `HttpExceptionFilter` would degrade to `FORBIDDEN` (T-14) — so it is re-thrown with an
        // explicit code the web hint table can match.
        this.logger.error(
          `Payment proof scan failed for deal ${deal.id} / payment ${payment.id}: ${error?.message ?? error}`,
        );
        throw new ServiceUnavailableException({
          code: DEAL_PAYMENT_PROOF_SCAN_FAILED,
          message: 'تعذر فحص الملف حالياً. يرجى المحاولة بعد قليل',
        });
      }

      if (!outcome.isClean) {
        throw new BadRequestException({
          code: DEAL_PAYMENT_PROOF_INFECTED,
          message: 'تم رفض الملف لأسباب أمنية. يرجى رفع إيصال آخر',
        });
      }

      // 6. One write per accepted upload: a re-upload replaces the row, never duplicates it (D2).
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
          // D3: the FileObject id, never a URL — presigned links live 300 s (NFR-2).
          proofFileUrl: staged.fileObjectId,
          uploadedAt: now,
          bankReferenceCode: reference.bankReferenceCode ?? null,
          senderBankName: reference.senderBankName ?? null,
          rejectionReason: null,
        },
      });

      // 7. D4: the first proof starts the audit; a re-upload after rejection re-enters it.
      if (
        deal.status === DealStatus.AWAITING_PAYMENT_PROOF ||
        deal.status === DealStatus.PAYMENT_REJECTED
      ) {
        await tx.deal.update({
          where: { id: deal.id },
          data: { status: DealStatus.UNDER_ADMIN_AUDIT, version: { increment: 1 } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'DEAL_PAYMENT_PROOF_UPLOADED',
          entityType: 'Payment',
          entityId: payment.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            paymentType,
            fileObjectId: staged.fileObjectId,
            amount: String(payment.amount),
            replaced: payment.proofFileUrl !== null,
          },
        },
      });

      this.logger.log(
        `Buyer ${userId} uploaded a ${paymentType} proof for deal ${deal.dealNumber} (file ${staged.fileObjectId})`,
      );

      return toDealPaymentSlot(updated);
    });
  }

  /** `GET /deals/:id/payments/:paymentType/proof-url` — AC-12, a 300 s single-use link. */
  async getProofDownloadUrl(
    userId: string,
    activeRole: UserRole,
    dealId: string,
    rawPaymentType: string,
  ): Promise<DealPaymentProofDownload> {
    const paymentType = this.parsePaymentType(rawPaymentType);
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, buyerProfileId: true, payments: { select: PAYMENT_SELECT } },
    });
    this.assertOwnership(deal, profile.id);

    const payment = (deal!.payments ?? []).find((row: any) => row.paymentType === paymentType);
    if (!payment?.proofFileUrl) {
      throw new NotFoundException({
        code: DEAL_PAYMENT_PROOF_NOT_FOUND,
        message: 'لا يوجد إيصال تحويل مرفوع لهذه الدفعة',
      });
    }

    try {
      const downloadUrl = await this.storageService.getVerifiedDownloadUrl(
        payment.proofFileUrl,
        MAX_EXPIRATION_SECONDS,
      );
      return { downloadUrl, expiresInSeconds: MAX_EXPIRATION_SECONDS };
    } catch (error: any) {
      // T-14: `StorageService` throws plain strings, so `ApiError.code` would degrade to
      // `FORBIDDEN` / `NOT_FOUND` and the web hint table would silently miss.
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException({
          code: ERROR_FILE_QUARANTINED,
          message: 'لا يمكن الوصول إلى ملف لم يجتز الفحص الأمني',
        });
      }
      throw new NotFoundException({
        code: DEAL_PAYMENT_PROOF_NOT_FOUND,
        message: 'تعذر العثور على ملف الإيصال، يرجى إعادة رفعه',
      });
    }
  }

  /**
   * The caller's ACTIVE buyer profile. Mirrors `OffersService.resolveBuyerProfile`, but the two
   * refusal cases stay distinct: a user without a buyer profile is `DEAL_BUYER_PROFILE_REQUIRED`,
   * while a deal that belongs to someone else is `DEAL_NOT_PARTY`.
   */
  private async resolveBuyerProfile(userId: string, activeRole: UserRole) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: UserRole.BUYER } },
    });
    if (
      !profile ||
      profile.status !== ProfileStatus.ACTIVE ||
      activeRole !== UserRole.BUYER
    ) {
      throw new ForbiddenException({
        code: DEAL_BUYER_PROFILE_REQUIRED,
        message: 'يلزم وجود ملف مشتري نشط لعرض صفقاتك وإثباتات الدفع',
      });
    }
    return profile;
  }

  /** 404 when the deal does not exist, 403 when it belongs to another buyer. */
  private assertOwnership(deal: any, buyerProfileId: string): void {
    if (!deal) {
      throw new NotFoundException({ code: DEAL_NOT_FOUND, message: 'الصفقة غير موجودة' });
    }
    if (deal.buyerProfileId !== buyerProfileId) {
      throw new ForbiddenException({
        code: DEAL_NOT_PARTY,
        message: 'هذه الصفقة لا تخص حسابك',
      });
    }
  }

  /**
   * D1 / D2: idempotent materialization of the two slots.
   *
   * `update: {}` is load-bearing: a read must never rewrite an existing row, so the upsert can be
   * called from `GET /deals/:id` as well as from the upload transaction (trap T-3 — always the
   * caller's `tx`, never a nested `$transaction`).
   */
  private async ensureDealPayments(tx: any, deal: any): Promise<any[]> {
    const rows: any[] = [];

    for (const paymentType of DEAL_PAYMENT_TYPES) {
      rows.push(
        await tx.payment.upsert({
          where: { dealId_paymentType: { dealId: deal.id, paymentType } },
          create: {
            dealId: deal.id,
            paymentType,
            amount: String(deal[SLOT_AMOUNT_FIELD[paymentType]]),
            status: DEAL_PAYMENT_STATUS.PENDING,
          },
          update: {},
        }),
      );
    }

    return rows;
  }

  /** `:paymentType` arrives as a string; only the two deal legs of `PaymentType` are accepted. */
  private parsePaymentType(rawPaymentType: string): DealPaymentType {
    const parsed = dealPaymentTypeSchema.safeParse(rawPaymentType);
    if (!parsed.success) {
      throw new BadRequestException({
        code: DEAL_PAYMENT_TYPE_INVALID,
        message: 'نوع دفعة الصفقة غير صالح',
      });
    }
    return parsed.data as DealPaymentType;
  }

  /** FR-30: a receipt is a PDF, JPEG or PNG under 10 MB — WebP is explicitly not one (T-12). */
  private assertProofFile(file: DealProofUploadFile | undefined): void {
    const invalid = validateDealPaymentProofFile(
      file ? { size: file.size, mimeType: file.mimetype } : null,
    );
    if (!invalid) return;

    const messages: Record<string, string> = {
      [DEAL_PAYMENT_PROOF_REQUIRED]: 'يجب اختيار ملف إيصال التحويل',
      [DEAL_PAYMENT_PROOF_TOO_LARGE]: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت',
      [DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE]:
        'صيغة الملف غير مدعومة. الصيغ المسموحة: PDF أو JPEG أو PNG',
    };

    throw new BadRequestException({ code: invalid, message: messages[invalid] });
  }

  /**
   * The optional transfer reference fields, validated by the shared schema. The route parameter is
   * merged last so a stray `paymentType` part in the multipart body can never override it.
   */
  private parseReferenceBody(
    body: unknown,
    paymentType: DealPaymentType,
  ): {
    bankReferenceCode?: string;
    senderBankName?: string;
  } {
    const parsed = uploadDealProofSchema.safeParse({ ...(body as object), paymentType });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'بيانات التحويل غير صالحة',
        details: parsed.error.format(),
      });
    }
    return parsed.data;
  }

  /**
   * The seller's plaintext IBAN, for the buyer of this deal only (NFR-3 / trap T-11). A corrupt
   * ciphertext must not blank the screen: the deal still renders with the masked form.
   */
  private decryptSellerIban(deal: any): string {
    try {
      return this.crypto.decrypt(deal.sellerPayoutIbanEncrypted);
    } catch (error: any) {
      this.logger.warn(
        `Could not decrypt the seller payout IBAN for deal ${deal.id}: ${error?.message ?? error}`,
      );
      return deal.sellerPayoutIbanMasked;
    }
  }
}
