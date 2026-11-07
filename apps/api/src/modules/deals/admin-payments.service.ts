import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DEAL_PAYMENT_STATUS,
  DealStatus,
  ERROR_FILE_QUARANTINED,
  PAYMENT_CLAIMABLE_STATUSES,
  PAYMENT_FORCE_UNLOCK_REASON_REQUIRED,
  PAYMENT_LOCK_CONFLICT,
  PAYMENT_LOCK_DURATION_MS,
  PAYMENT_LOCK_FORCE_UNLOCKED,
  PAYMENT_MODERATION_RELEASED,
  PAYMENT_NOT_CLAIMABLE,
  PAYMENT_PROOF_CLAIMED,
  PAYMENT_PROOF_CONFIRMED,
  PAYMENT_PROOF_NOT_FOUND,
  PAYMENT_PROOF_REJECTED,
  PAYMENT_REJECTION_NOTE_REQUIRED,
  PAYMENT_SELF_APPROVAL_FORBIDDEN,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { DealCompletionService } from './deal-completion.service';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import {
  assertLockHeld,
  buildLockInfo,
  paymentNotFound,
  resolveLockHolderNames,
} from './payment-lock';
import {
  toAdminPaymentDetail,
  toAdminPaymentQueueItem,
} from './payment-review.mapper';

const PAYMENT_REVIEW_INCLUDE = {
  deal: {
    include: {
      listing: {
        select: {
          title: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
    private readonly dealCompletionService: DealCompletionService,
  ) {}

  /**
   * `GET /api/v1/admin/payments` (AC-1)
   * Lists payment proofs awaiting admin audit (PROOF_UPLOADED, UNDER_REVIEW), oldest-first,
   * paginated, carrying live claim-lock info. Reads never take the lease.
   */
  async getQueue(
    query: { page?: number; limit?: number; status?: string },
    currentAdminId: string,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;
    const now = this.clockService.now();

    const where: any = query.status
      ? { status: query.status }
      : { status: { in: [...PAYMENT_CLAIMABLE_STATUSES] } };

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: PAYMENT_REVIEW_INCLUDE,
      }),
    ]);

    const holderNameMap = await resolveLockHolderNames(this.prisma, payments, now);
    const items = payments.map((p: any) => {
      const lockInfo = buildLockInfo(p, now, currentAdminId, holderNameMap);
      return toAdminPaymentQueueItem(p, p.deal, lockInfo);
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * `GET /api/v1/admin/payments/:id` (AC-1, AC-3)
   * Returns one payment slot detail with live lock info and deal context.
   */
  async getPayment(id: string, currentAdminId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_REVIEW_INCLUDE,
    });
    if (!payment) {
      throw paymentNotFound();
    }

    const now = this.clockService.now();
    const adminIdsToLookup = [payment.lockedByAdminId, payment.verifiedByAdminId].filter(
      (adminId): adminId is string => Boolean(adminId),
    );

    let adminNameMap = new Map<string, string>();
    if (adminIdsToLookup.length > 0) {
      const admins = await this.prisma.adminUser.findMany({
        where: { id: { in: adminIdsToLookup } },
        select: { id: true, fullName: true },
      });
      adminNameMap = new Map(admins.map((a: any) => [a.id, a.fullName]));
    }

    const lockInfo = buildLockInfo(payment, now, currentAdminId, adminNameMap);
    return toAdminPaymentDetail(payment, payment.deal, lockInfo, adminNameMap, now);
  }

  /**
   * `POST /api/v1/admin/payments/:id/claim` (AC-2)
   * Atomically locks one Payment row for 15 minutes. Advances PROOF_UPLOADED → UNDER_REVIEW.
   */
  async claimPayment(id: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + PAYMENT_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      if (!PAYMENT_CLAIMABLE_STATUSES.includes(payment.status as any)) {
        throw new ConflictException({
          code: PAYMENT_NOT_CLAIMABLE,
          message: 'لا يمكن استلام مهمة التدقيق لهذه الدفعة',
        });
      }

      const isActivelyLockedByOther =
        payment.lockedByAdminId &&
        payment.lockedByAdminId !== admin.id &&
        payment.lockExpiresAt &&
        new Date(payment.lockExpiresAt).getTime() > now.getTime();

      if (isActivelyLockedByOther) {
        const holderMap = await resolveLockHolderNames(tx, [payment], now);
        const lockInfo = buildLockInfo(payment, now, admin.id, holderMap);
        throw new ConflictException({
          code: PAYMENT_LOCK_CONFLICT,
          message: `قفل التدقيق مملوك للمشرف ${lockInfo.lockedByAdminName || 'آخر'}؛ يجب إلغاء القفل قبل اتخاذ قرار`,
          lockInfo,
          details: { lockInfo },
        });
      }

      const { count } = await tx.payment.updateMany({
        where: {
          id,
          status: { in: [...PAYMENT_CLAIMABLE_STATUSES] },
          OR: [
            { lockedByAdminId: null },
            { lockExpiresAt: { lt: now } },
            { lockedByAdminId: admin.id },
          ],
        },
        data: {
          lockedByAdminId: admin.id,
          lockedAt: now,
          lockExpiresAt,
          ...(payment.status === DEAL_PAYMENT_STATUS.PROOF_UPLOADED
            ? { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW }
            : {}),
        },
      });

      if (count === 0) {
        const reloaded = await tx.payment.findUnique({ where: { id } });
        if (!reloaded || !PAYMENT_CLAIMABLE_STATUSES.includes(reloaded.status as any)) {
          throw new ConflictException({
            code: PAYMENT_NOT_CLAIMABLE,
            message: 'لا يمكن استلام مهمة التدقيق لهذه الدفعة',
          });
        }
        const holderMap = await resolveLockHolderNames(tx, [reloaded], now);
        const lockInfo = buildLockInfo(reloaded, now, admin.id, holderMap);
        throw new ConflictException({
          code: PAYMENT_LOCK_CONFLICT,
          message: `قفل التدقيق مملوك للمشرف ${lockInfo.lockedByAdminName || 'آخر'}؛ يجب إلغاء القفل قبل اتخاذ قرار`,
          lockInfo,
          details: { lockInfo },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_PROOF_CLAIMED,
          entityType: 'Payment',
          entityId: id,
          payload: {
            dealId: payment.dealId,
            paymentType: payment.paymentType,
            lockedByAdminId: admin.id,
            lockedByAdminName: admin.fullName,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
          },
        },
      });

      this.logger.log(`Payment ${id} claimed for review by admin ${admin.id}`);

      const updated = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      const nameMap = new Map([[admin.id, admin.fullName]]);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id, nameMap),
        nameMap,
        now,
      );
    });
  }

  /**
   * `POST /api/v1/admin/payments/:id/heartbeat` (AC-7)
   * Extends the caller's own lease by 15 minutes.
   */
  async heartbeatPayment(id: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + PAYMENT_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      assertLockHeld(payment, admin.id, now);

      const updated = await tx.payment.update({
        where: { id },
        data: { lockExpiresAt },
        include: PAYMENT_REVIEW_INCLUDE,
      });

      const nameMap = new Map([[admin.id, admin.fullName]]);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id, nameMap),
        nameMap,
        now,
      );
    });
  }

  /**
   * `POST /api/v1/admin/payments/:id/release` (AC-7)
   * Releases the lease without modifying the payment decision/status.
   */
  async releasePayment(id: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      assertLockHeld(payment, admin.id, now);

      const updated = await tx.payment.update({
        where: { id },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
        include: PAYMENT_REVIEW_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_MODERATION_RELEASED,
          entityType: 'Payment',
          entityId: id,
          payload: {
            dealId: payment.dealId,
            paymentType: payment.paymentType,
            releasedByAdminId: admin.id,
            releasedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Payment ${id} audit lease released by admin ${admin.id}`);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id),
        undefined,
        now,
      );
    });
  }

  /**
   * `POST /api/v1/admin/payments/:id/force-unlock` (AC-7)
   * Breaks any administrator's lease with a mandatory reason (≥ 5 chars).
   */
  async forceUnlockPayment(
    id: string,
    admin: AuthenticatedAdminActor,
    reason: string,
  ) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException({
        code: PAYMENT_FORCE_UNLOCK_REASON_REQUIRED,
        message: 'يجب إدخال سبب معتمد لإلغاء قفل التدقيق (5 أحرف على الأقل)',
      });
    }

    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      const previousLockHolderId = payment.lockedByAdminId ?? null;

      const updated = await tx.payment.update({
        where: { id },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
        include: PAYMENT_REVIEW_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_LOCK_FORCE_UNLOCKED,
          entityType: 'Payment',
          entityId: id,
          payload: {
            dealId: payment.dealId,
            paymentType: payment.paymentType,
            previousLockHolderId,
            unlockedByAdminId: admin.id,
            unlockedByAdminName: admin.fullName,
            reason: trimmedReason,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Payment ${id} audit lease force-unlocked by admin ${admin.id}`);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id),
        undefined,
        now,
      );
    });
  }

  /**
   * `POST /api/v1/admin/payments/:id/confirm` (AC-3, AC-4, AC-6)
   * Confirms payment proof, releases lease, sets verifiedAt/verifiedByAdminId.
   * Gated on separation of duties (admin.id !== deal.approvedByAdminId).
   */
  async confirmPayment(id: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      // 3.2 Row-lock discipline: deals.id / payments.id are text — every FOR UPDATE tx.$queryRaw casts ${id}::text, never ::uuid
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${id}::text FOR UPDATE`;

      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      // 3.3 Separation of duties (FR-51): admin who approves deal cannot verify payments
      if (payment.deal.approvedByAdminId && admin.id === payment.deal.approvedByAdminId) {
        throw new ForbiddenException({
          code: PAYMENT_SELF_APPROVAL_FORBIDDEN,
          message: 'لا يحق للمشرف الذي اعتمد الصفقة تدقيق إثبات الدفع لنفس الصفقة',
        });
      }

      // Must hold active lease
      assertLockHeld(payment, admin.id, now);

      // Must be in UNDER_REVIEW state
      if (payment.status !== DEAL_PAYMENT_STATUS.UNDER_REVIEW) {
        throw new ConflictException({
          code: PAYMENT_NOT_CLAIMABLE,
          message: 'لا يمكن تأكيد الدفعة إلا بعد استلام مهمة التدقيق',
        });
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: DEAL_PAYMENT_STATUS.CONFIRMED,
          verifiedByAdminId: admin.id,
          verifiedAt: now,
          rejectionReason: null,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
        include: PAYMENT_REVIEW_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_PROOF_CONFIRMED,
          entityType: 'Payment',
          entityId: id,
          payload: {
            dealId: payment.dealId,
            paymentType: payment.paymentType,
            verifiedByAdminId: admin.id,
            verifiedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Payment ${id} confirmed by admin ${admin.id}`);

      // Story 5.4 / AC-1: Check if all deal payments are now confirmed.
      // If both legs are confirmed, complete the deal atomically within this transaction.
      const dealPayments = await tx.payment.findMany({
        where: { dealId: payment.dealId },
      });
      const allConfirmed =
        dealPayments.length === 2 &&
        dealPayments.every(
          (p: any) =>
            p.status === DEAL_PAYMENT_STATUS.CONFIRMED ||
            (p.id === id && DEAL_PAYMENT_STATUS.CONFIRMED),
        );

      if (allConfirmed) {
        await this.dealCompletionService.completeDealInTransaction(
          payment.dealId,
          admin,
          tx,
        );
      }

      const nameMap = new Map([[admin.id, admin.fullName]]);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id, nameMap),
        nameMap,
        now,
      );
    });
  }

  /**
   * `POST /api/v1/admin/payments/:id/reject` (AC-3, AC-4, AC-6)
   * Rejects payment proof with mandatory reason (5–500 chars), releases lease,
   * moves deal to PAYMENT_REJECTED. Gated on separation of duties.
   */
  async rejectPayment(
    id: string,
    admin: AuthenticatedAdminActor,
    reason: string,
  ) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      throw new BadRequestException({
        code: PAYMENT_REJECTION_NOTE_REQUIRED,
        message: 'سبب الرفض يجب ألا يقل عن 5 أحرف',
      });
    }

    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      // 3.2 Row-lock discipline: deals.id / payments.id are text — every FOR UPDATE tx.$queryRaw casts ${id}::text, never ::uuid
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${id}::text FOR UPDATE`;

      const payment = await tx.payment.findUnique({
        where: { id },
        include: PAYMENT_REVIEW_INCLUDE,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      // 3.4 Separation of duties (FR-51)
      if (payment.deal.approvedByAdminId && admin.id === payment.deal.approvedByAdminId) {
        throw new ForbiddenException({
          code: PAYMENT_SELF_APPROVAL_FORBIDDEN,
          message: 'لا يحق للمشرف الذي اعتمد الصفقة تدقيق إثبات الدفع لنفس الصفقة',
        });
      }

      // Must hold active lease
      assertLockHeld(payment, admin.id, now);

      // Must be in UNDER_REVIEW state
      if (payment.status !== DEAL_PAYMENT_STATUS.UNDER_REVIEW) {
        throw new ConflictException({
          code: PAYMENT_NOT_CLAIMABLE,
          message: 'لا يمكن رفض الدفعة إلا بعد استلام مهمة التدقيق',
        });
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: DEAL_PAYMENT_STATUS.REJECTED,
          verifiedByAdminId: admin.id,
          verifiedAt: now,
          rejectionReason: trimmedReason,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
        include: PAYMENT_REVIEW_INCLUDE,
      });

      // On a REJECT the parent Deal moves to PAYMENT_REJECTED (if currently UNDER_ADMIN_AUDIT or AWAITING_PAYMENT_PROOF)
      if (
        payment.deal.status === DealStatus.UNDER_ADMIN_AUDIT ||
        payment.deal.status === DealStatus.AWAITING_PAYMENT_PROOF
      ) {
        await tx.deal.update({
          where: { id: payment.dealId },
          data: { status: DealStatus.PAYMENT_REJECTED },
        });
        updated.deal.status = DealStatus.PAYMENT_REJECTED;
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_PROOF_REJECTED,
          entityType: 'Payment',
          entityId: id,
          payload: {
            dealId: payment.dealId,
            paymentType: payment.paymentType,
            reason: trimmedReason,
            verifiedByAdminId: admin.id,
            verifiedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Payment ${id} rejected by admin ${admin.id}`);

      const nameMap = new Map([[admin.id, admin.fullName]]);
      return toAdminPaymentDetail(
        updated,
        updated.deal,
        buildLockInfo(updated, now, admin.id, nameMap),
        nameMap,
        now,
      );
    });
  }

  /**
   * `GET /api/v1/admin/payments/:id/proof-url` (AC-9)
   * Generates a 300-second verified presigned download URL for the proof file, gated on CLEAN scan status.
   */
  async getProofDownloadUrl(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });
    if (!payment) {
      throw paymentNotFound();
    }

    if (!payment.proofFileUrl) {
      throw new NotFoundException({
        code: PAYMENT_PROOF_NOT_FOUND,
        message: 'لا يوجد إيصال مرفوع لهذه الدفعة',
      });
    }

    try {
      const downloadUrl = await this.storageService.getVerifiedDownloadUrl(
        payment.proofFileUrl,
        300,
      );
      return {
        downloadUrl,
        expiresInSeconds: 300,
      };
    } catch (err: any) {
      if (
        err instanceof ForbiddenException ||
        (err.message &&
          (err.message.includes('quarantin') ||
            err.message.includes('scan') ||
            err.message.includes('CLEAN')))
      ) {
        throw new ForbiddenException({
          code: ERROR_FILE_QUARANTINED,
          message: 'الملف قيد الحجر الصحي أو لم يجتز الفحص الأمني',
        });
      }

      if (
        err instanceof NotFoundException ||
        (err.message && err.message.includes('not found'))
      ) {
        throw new NotFoundException({
          code: PAYMENT_PROOF_NOT_FOUND,
          message: 'الملف المطلوب غير موجود',
        });
      }

      throw err;
    }
  }
}
