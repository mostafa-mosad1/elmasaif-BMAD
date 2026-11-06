import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_ALREADY_ACTIVE_FOR_LISTING,
  DEAL_LISTING_UNAVAILABLE,
  DEAL_SELLER_PAYOUT_REQUIRED,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  DealBinding,
  DealStatus,
  ListingStatus,
  OFFER_ALREADY_EXPIRED,
  OFFER_HISTORY_ACTIONS,
  OFFER_INVALID_STATE_TRANSITION,
  OfferStatus,
  buildDealNumber,
  buildDealReferenceCode,
  computeDealAmounts,
  getSaudiBankName,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { assertLockHeld, offerNotFound } from '../offers/offer-lock';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import { toDealBinding } from './deal-binding.mapper';

/**
 * Display-name select only — an offer payload must never carry a mobile number, email or IBAN.
 * The listing is re-read under its own row lock in step 4, so this include exists purely so the
 * offer read is self-describing for future readers of the method.
 */
const BINDING_INCLUDE = {
  listing: { select: { id: true, status: true, sellerProfileId: true } },
} as const;

/** The three listing columns the binding actually consumes. */
const LISTING_SELECT = {
  id: true,
  status: true,
  sellerProfileId: true,
} as const;

/**
 * Story 5.1 / FR-28, FR-29, BR-02, BR-07, AD-3, AD-4, AD-10, AD-11: binds an agreed offer into an
 * immutable `Deal`.
 *
 * This is the first (and, in this story, only) write path into `deals`, so every column default is
 * treated as unproven: `status`, `createdAt`, `paymentDeadline` and both human-facing identifiers
 * are all written explicitly.
 */
@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * `POST /admin/deals/final-approve` — AC-2: one interactive transaction performs the deal
   * insert, the listing reservation, the offer transition, the offer-history row and the audit row,
   * or none of it.
   *
   * The step order below is the contract (see Dev Notes §The binding transaction). In particular
   * the lock order is always offer → listing (trap T-12): this is the only transaction in the repo
   * that locks both tables, and a future story that locks them in the other order would deadlock.
   */
  async finalApprove(
    offerId: string,
    admin: AuthenticatedAdminActor,
  ): Promise<DealBinding> {
    // AD-11: `ClockService` is the only time source — the deadline, `createdAt`, the `yyyyMMdd`
    // in `dealNumber` and the audit `at` all derive from this one value.
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Offer row first. `offers.id` is a `text` column: cast to `text`, never `uuid`, or
      //    Postgres raises `42883` and the endpoint returns an unhandled 500 (trap T-1).
      await tx.$queryRaw`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE`;

      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: BINDING_INCLUDE,
      });
      if (!offer) {
        throw offerNotFound();
      }

      // 2. AD-10: the lease is validated in-transaction so a stale approval cannot commit.
      assertLockHeld(offer, admin.id, now);

      // 3. State, then expiry — in that order, so an offer that was never approved reports the
      //    more useful error.
      if (offer.status !== OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL) {
        throw new ConflictException({
          code: OFFER_INVALID_STATE_TRANSITION,
          message: 'لا يمكن اعتماد الصفقة نهائياً إلا لعرض تم اختياره بانتظار الاعتماد النهائي',
        });
      }

      if (new Date(offer.expiresAt).getTime() <= now.getTime()) {
        throw new ConflictException({
          code: OFFER_ALREADY_EXPIRED,
          message: 'انتهت مدة صلاحية هذا العرض، ولا يمكن اعتماده نهائياً',
        });
      }

      // 4. Listing lock, then re-read it. Same `::text` cast rule as step 1.
      await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${offer.listingId}::text FOR UPDATE`;
      const listing = await tx.listing.findUnique({
        where: { id: offer.listingId },
        select: LISTING_SELECT,
      });
      if (!listing || listing.status !== ListingStatus.ACTIVE) {
        throw new ConflictException({
          code: DEAL_LISTING_UNAVAILABLE,
          message: 'الإعلان لم يعد متاحاً لإتمام الصفقة (قد يكون محجوزاً أو مؤرشفاً أو مبيَعاً)',
        });
      }

      // 5. Friendly pre-check. The partial unique index `deal_single_active_listing` is the real
      //    guarantee; this only turns the common case into a message instead of a `P2002`.
      const existing = await tx.deal.findFirst({
        where: {
          listingId: listing.id,
          status: { in: [...ACTIVE_DEAL_STATUSES] },
        },
        select: { id: true, dealNumber: true },
      });
      if (existing) {
        throw new ConflictException({
          code: DEAL_ALREADY_ACTIVE_FOR_LISTING,
          message: `يوجد بالفعل صفقة نشطة على هذا الإعلان (${existing.dealNumber})`,
          details: existing,
        });
      }

      // 6. Seller payout snapshot source. A seller may hold several accounts, so this is never an
      //    unqualified `findFirst` (trap T-9): the default account wins, then the newest.
      const payout = await tx.payoutAccount.findFirst({
        where: { profileId: listing.sellerProfileId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      if (!payout) {
        throw new ConflictException({
          code: DEAL_SELLER_PAYOUT_REQUIRED,
          message: 'لا يمكن اعتماد الصفقة: على البائع إضافة حساب بنكي للتحصيل أولاً',
        });
      }

      // 7. Money — the shared fixed-point helper only. `String(...)` gets the decimal text out of
      //    Prisma's `Decimal`; `Number()` is a BR-02 defect anywhere in this path (trap T-4).
      const amounts = computeDealAmounts({
        dealPrice: String(offer.offerPrice),
        commissionRate: DEFAULT_COMMISSION_RATE,
        fixedCommission: DEFAULT_FIXED_COMMISSION_SAR,
      });

      // 8. Identifiers are pre-generated so both unique codes land in ONE insert — Prisma's
      //    `@default(uuid())` would only hand the id back after the row exists (AC-7).
      const dealId = randomUUID();
      // TODO(8.6): read the window from the platform settings row.
      const paymentWindowHours = DEFAULT_PAYMENT_WINDOW_HOURS;
      const paymentDeadline = new Date(
        now.getTime() + paymentWindowHours * 3_600_000,
      );

      let deal: any;
      try {
        deal = await tx.deal.create({
          data: {
            id: dealId,
            dealNumber: buildDealNumber(dealId, now),
            dealReferenceCode: buildDealReferenceCode(dealId),
            offerId: offer.id,
            listingId: listing.id,
            buyerProfileId: offer.buyerProfileId,
            sellerProfileId: listing.sellerProfileId,
            dealPrice: amounts.finalDealPrice,
            platformCommission: amounts.finalCommission,
            totalAmount: amounts.finalTotal,
            commissionRateSnapshot: DEFAULT_COMMISSION_RATE.toFixed(4), // '0.0250'
            fixedCommissionSnapshot: amounts.fixedCommission,
            paymentWindowHoursSnapshot: paymentWindowHours,
            sellerPayoutAccountId: payout.id,
            sellerPayoutHolderName: payout.accountHolderName,
            sellerPayoutBankName: this.resolveBankName(payout),
            // D4: already AES-256-GCM at rest — copy the ciphertext, never re-encrypt plaintext.
            sellerPayoutIbanEncrypted: payout.ibanEncrypted,
            sellerPayoutIbanMasked: payout.ibanMasked,
            approvedByAdminId: admin.id,
            status: DealStatus.AWAITING_PAYMENT_PROOF,
            paymentDeadline,
            // T-5: `createdAt` comes from `ClockService`, not the database clock, so
            // `paymentDeadline - createdAt` is exactly 48 h.
            createdAt: now,
          },
        });
      } catch (err: any) {
        // T-11: the pre-check in step 5 cannot see a competitor's in-flight insert. Losing the
        // race surfaces as `P2002` on `deal_single_active_listing`, and it must read as a 409,
        // never a 500 and never two deals.
        if (err?.code === 'P2002') {
          throw new ConflictException({
            code: DEAL_ALREADY_ACTIVE_FOR_LISTING,
            message: 'يوجد بالفعل صفقة نشطة على هذا الإعلان',
          });
        }
        throw err;
      }

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.RESERVED, version: { increment: 1 } },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.CONVERTED_TO_DEAL,
          version: { increment: 1 },
          // "Lock is released on decision commit" (AD-10).
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.offerHistory.create({
        data: {
          offerId: offer.id,
          actorAdminId: admin.id,
          action: OFFER_HISTORY_ACTIONS.CONVERTED_TO_DEAL,
          priceSnapshot: amounts.finalDealPrice, // already a 2-dp string
          notes: `dealReferenceCode=${deal.dealReferenceCode}`,
          roundNumber: Number(offer.negotiationRound ?? 0),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'DEAL_CREATED',
          entityType: 'Deal',
          entityId: deal.id,
          payload: {
            offerId: offer.id,
            listingId: listing.id,
            dealNumber: deal.dealNumber,
            dealReferenceCode: deal.dealReferenceCode,
            dealPrice: amounts.finalDealPrice,
            commission: amounts.finalCommission,
            total: amounts.finalTotal,
            paymentDeadline: paymentDeadline.toISOString(),
            adminName: admin.fullName,
          },
        },
      });

      // 9. Reserve backup offers are deliberately left queued (trap T-6): the reserve queue is
      //    the fallback if this deal is cancelled later, and Story 5.4 owns closing it.

      this.logger.log(
        `Deal ${deal.dealNumber} (${deal.dealReferenceCode}) created from offer ${offer.id} by admin ${admin.id}`,
      );

      return toDealBinding(deal, payout);
    });
  }

  /**
   * AC-5: `sellerPayoutBankName` is nullable, so a payout row without a stored bank name is not a
   * reason to fail the approval — derive it from the (already-encrypted) IBAN instead. A corrupt
   * ciphertext that cannot be decrypted still leaves a valid deal with an unspecified bank name.
   */
  private resolveBankName(payout: any): string | null {
    if (payout.bankName) {
      return payout.bankName;
    }

    try {
      return getSaudiBankName(this.crypto.decrypt(payout.ibanEncrypted));
    } catch (error: any) {
      this.logger.warn(
        `Could not derive the bank name for payout account ${payout.id}: ${error?.message ?? error}`,
      );
      return null;
    }
  }
}
