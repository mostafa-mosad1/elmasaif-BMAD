import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  ACTIVE_OFFER_STATUSES,
  LOW_PRICE_THRESHOLD_PERCENT,
  MAX_COUNTER_ROUNDS,
  MAX_LISTING_PRICE_SAR,
  MIN_LISTING_PRICE_SAR,
  OFFER_ACTIVE_EXISTS,
  OFFER_ALREADY_EXPIRED,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_COUNTER_PRICE_OUT_OF_RANGE,
  OFFER_EXPIRY_HOURS,
  OFFER_HISTORY_ACTIONS,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_MAX_ROUNDS_REACHED,
  OFFER_NOT_FOUND,
  OFFER_NOT_PARTY,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_REJECTION_NOTE_REQUIRED,
  OFFER_REJECTION_REASON_REQUIRED,
  OFFER_REJECTION_REASONS,
  OFFER_SELLER_PROFILE_REQUIRED,
  OFFER_SELF_SUBMISSION_FORBIDDEN,
  TERMINAL_OFFER_STATUSES,
  CounterOfferInput,
  ListingStatus,
  OfferItem,
  OfferListQuery,
  OfferStatus,
  OfferThreadItem,
  OfferThreadSummary,
  ProfileStatus,
  RejectOfferInput,
  SubmitOfferInput,
  UserRole,
} from '@elmasaif/shared';
import {
  OFFER_SUMMARY_INCLUDE,
  OFFER_THREAD_INCLUDE,
  resolveAwaitingParty,
  toIso,
  toOfferThreadSummary,
} from './offer-thread.mapper';

/** FR-25 / FR-14: offers are only accepted on a live listing. */
const OFFERABLE_LISTING_STATUSES: readonly ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
];

/**
 * Buyer offer intake (Story 4.1) plus the mediated counter-offer rounds (Story 4.2 / FR-26,
 * FR-55). Every guardrail is enforced here rather than in the UI (NFR1): the price envelope,
 * the round cap, the state machine, the party check and the per-round expiry. Each mutation
 * runs in one `prisma.$transaction` behind a row lock so two racing responses cannot both win,
 * and writes `OfferHistory` + `AuditLog` alongside the state change.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * `POST /offers` — records a binding purchase offer (FR-25 / UJ-1). Runs inside one
   * interactive transaction that first takes a row lock on the target listing (AD-4), so two
   * concurrent submissions by the same buyer cannot both pass the active-offer check.
   */
  async submitOffer(
    userId: string,
    activeRole: UserRole,
    dto: SubmitOfferInput,
  ): Promise<OfferItem> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    // AD-11: the single time source for the whole submission.
    const now = this.clockService.now();
    const expiresAt = new Date(now.getTime() + OFFER_EXPIRY_HOURS * 3_600_000);

    const { offer, listing } = await this.prisma.$transaction(async (tx: any) => {
      // AD-4: serialise concurrent submissions on the same listing while the checks run.
      // The id columns are `text` in this schema (`String @id @default(uuid())` without
      // `@db.Uuid`), so the parameter is cast to `text` — casting to `uuid` makes Postgres
      // fail with `operator does not exist: text = uuid` (P2010 / 42883).
      await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${dto.listingId}::text FOR UPDATE`;

      const targetListing = await tx.listing.findUnique({
        where: { id: dto.listingId },
        include: { sellerProfile: true, city: true, district: true },
      });
      if (!targetListing) {
        throw new NotFoundException({
          code: OFFER_LISTING_NOT_FOUND,
          message: 'العقار المطلوب غير موجود',
        });
      }

      if (targetListing.sellerProfile?.userId === userId) {
        throw new BadRequestException({
          code: OFFER_SELF_SUBMISSION_FORBIDDEN,
          message: 'لا يمكنك تقديم عرض شراء على عقار تملكه أو تعلنه بنفسك',
        });
      }

      if (!OFFERABLE_LISTING_STATUSES.includes(targetListing.status)) {
        throw new BadRequestException({
          code: OFFER_LISTING_NOT_OFFERABLE,
          message: 'لا يمكن تقديم عرض على العقار في حالته الحالية',
        });
      }

      const price = Number(dto.offerPrice);
      if (
        !Number.isFinite(price) ||
        price < MIN_LISTING_PRICE_SAR ||
        price > MAX_LISTING_PRICE_SAR
      ) {
        throw new BadRequestException({
          code: OFFER_PRICE_OUT_OF_RANGE,
          message: `قيمة العرض يجب أن تكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
        });
      }

      const askPrice = Number(targetListing.askPrice);
      const isLowPrice = price < askPrice * LOW_PRICE_THRESHOLD_PERCENT;
      if (isLowPrice && dto.lowPriceConfirmation !== true) {
        throw new BadRequestException({
          code: OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
          message: 'العرض أقل من نصف سعر الطلب ويستلزم تأكيداً صريحاً من المشتري',
        });
      }

      // FR-27: a RESERVED listing only accepts backup offers.
      const isBackup = targetListing.status === ListingStatus.RESERVED;

      // A-07: at most one non-terminal, unexpired offer per buyer per listing.
      const activeOffers = await tx.offer.count({
        where: {
          listingId: dto.listingId,
          buyerProfileId: profile.id,
          status: { in: [...ACTIVE_OFFER_STATUSES] as any },
          expiresAt: { gt: now },
        },
      });
      if (activeOffers > 0) {
        throw new ConflictException({
          code: OFFER_ACTIVE_EXISTS,
          message: 'لديك عرض نشط بالفعل على هذا العقار',
        });
      }

      const created = await tx.offer.create({
        data: {
          listingId: dto.listingId,
          buyerProfileId: profile.id,
          offerPrice: price,
          status: OfferStatus.PENDING_ADMIN_REVIEW,
          isBackup,
          isLowPrice,
          note: dto.note ?? null,
          expiresAt,
        },
      });

      await tx.offerHistory.create({
        data: {
          offerId: created.id,
          actorProfileId: profile.id,
          action: OFFER_HISTORY_ACTIONS.SUBMITTED,
          priceSnapshot: price,
          notes: dto.note ?? null,
          roundNumber: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: OFFER_HISTORY_ACTIONS.SUBMITTED,
          entityType: 'Offer',
          entityId: created.id,
          payload: {
            listingId: dto.listingId,
            offerPrice: price,
            askPrice,
            isBackup,
            isLowPrice,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      // Story 4.2 mediation now owns the next hop: `POST /admin/offers/:id/relay-to-seller`.
      // TODO(8.8): persist buyer/seller notification (no Notification model exists).

      return { offer: created, listing: targetListing };
    });

    this.logger.log(
      `Offer ${offer.id} submitted on listing ${dto.listingId}${offer.isBackup ? ' (backup)' : ''}`,
    );
    return this.toOfferItem(offer, listing);
  }

  /**
   * `GET /offers/my` — the caller's own offers, newest first (FR-25 / FR-59 buyer surface).
   * Feeds `/app/buyer/offers` and the dashboard counter; `?listingId=` narrows to one listing
   * so the detail screen can detect an existing offer.
   */
  async listMyOffers(
    userId: string,
    activeRole: UserRole,
    query: OfferListQuery,
  ): Promise<{ items: OfferItem[] }> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    const offers = await this.prisma.offer.findMany({
      where: {
        buyerProfileId: profile.id,
        ...(query?.listingId ? { listingId: query.listingId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { listing: { include: { city: true, district: true } } },
    });

    return {
      items: offers.map((offer: any) => this.toOfferItem(offer, offer.listing)),
    };
  }

  // ---- Story 4.2: mediated negotiation (FR-26, FR-55) ----------------------

  /**
   * `GET /offers/received` — the offers sitting on the caller's own listings, newest first
   * (FR-55 seller surface). Scoped by the *active* workspace's MARKETER/OWNER profile, so a
   * provider who owns a listing but is browsing as BUYER cannot reach it (FR-3).
   */
  async listReceivedOffers(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ items: OfferThreadSummary[] }> {
    const profile = await this.resolveSellerProfile(userId, activeRole);

    const offers = await this.prisma.offer.findMany({
      where: { listing: { sellerProfileId: profile.id } },
      orderBy: { createdAt: 'desc' },
      include: OFFER_SUMMARY_INCLUDE as any,
    });

    return {
      items: offers.map(
        (offer: any) =>
          toOfferThreadSummary(offer, { includeHistory: false }) as OfferThreadSummary,
      ),
    };
  }

  /** `GET /offers/:id` — the full thread, visible to either party only (FR-26). */
  async getOfferThread(
    userId: string,
    activeRole: UserRole,
    offerId: string,
  ): Promise<OfferThreadItem> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: OFFER_THREAD_INCLUDE as any,
    });
    if (!offer) {
      throw new NotFoundException({
        code: OFFER_NOT_FOUND,
        message: 'العرض المطلوب غير موجود',
      });
    }

    const profile = await this.resolvePartyProfile(userId, activeRole);
    this.assertParty(offer, profile);

    return toOfferThreadSummary(offer, { includeHistory: true }) as OfferThreadItem;
  }

  /** `POST /offers/:id/accept-by-seller` — mutual agreement (FR-55). */
  async acceptBySeller(
    userId: string,
    activeRole: UserRole,
    offerId: string,
  ): Promise<OfferThreadItem> {
    return this.applyPartyResponse(userId, activeRole, offerId, 'SELLER', {
      expectedStatus: OfferStatus.RELAYED_TO_SELLER,
      nextStatus: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
      action: OFFER_HISTORY_ACTIONS.ACCEPTED_BY_SELLER,
      kind: 'accept',
    });
  }

  /** `POST /offers/:id/reject-by-seller` — structured rejection (FR-55). */
  async rejectBySeller(
    userId: string,
    activeRole: UserRole,
    offerId: string,
    dto: RejectOfferInput,
  ): Promise<OfferThreadItem> {
    const reason = typeof dto?.reason === 'string' ? dto.reason.trim() : '';
    if (!(OFFER_REJECTION_REASONS as readonly string[]).includes(reason)) {
      throw new BadRequestException({
        code: OFFER_REJECTION_REASON_REQUIRED,
        message: 'يجب اختيار سبب رفض من القائمة المعتمدة',
      });
    }
    const note = dto?.note?.trim() ? dto.note.trim() : null;
    if (reason === 'OTHER' && (!note || note.length < 10)) {
      throw new BadRequestException({
        code: OFFER_REJECTION_NOTE_REQUIRED,
        message: 'يجب كتابة سبب الرفض بالتفصيل (10 أحرف على الأقل) عند اختيار «سبب آخر»',
      });
    }

    return this.applyPartyResponse(userId, activeRole, offerId, 'SELLER', {
      expectedStatus: OfferStatus.RELAYED_TO_SELLER,
      nextStatus: OfferStatus.REJECTED_BY_SELLER,
      action: OFFER_HISTORY_ACTIONS.REJECTED_BY_SELLER,
      kind: 'reject',
      reason,
      note,
    });
  }

  /** `POST /offers/:id/counter-by-seller` — mediated counter back through admin (FR-26). */
  async counterBySeller(
    userId: string,
    activeRole: UserRole,
    offerId: string,
    dto: CounterOfferInput,
  ): Promise<OfferThreadItem> {
    return this.applyPartyResponse(userId, activeRole, offerId, 'SELLER', {
      expectedStatus: OfferStatus.RELAYED_TO_SELLER,
      nextStatus: OfferStatus.COUNTER_OFFERED,
      action: OFFER_HISTORY_ACTIONS.COUNTER_BY_SELLER,
      kind: 'counter',
      counterPrice: Number(dto?.counterPrice),
      note: dto?.note?.trim() ? dto.note.trim() : null,
    });
  }

  /**
   * `POST /offers/:id/accept-by-buyer` — the buyer agrees to the relayed counter price, which
   * is mutual agreement and hands the offer to Story 5.1 (FR-26).
   */
  async acceptByBuyer(
    userId: string,
    activeRole: UserRole,
    offerId: string,
  ): Promise<OfferThreadItem> {
    return this.applyPartyResponse(userId, activeRole, offerId, 'BUYER', {
      expectedStatus: OfferStatus.RELAYED_TO_BUYER,
      nextStatus: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
      action: OFFER_HISTORY_ACTIONS.ACCEPTED_BY_BUYER,
      kind: 'accept',
    });
  }

  /** `POST /offers/:id/counter-by-buyer` — next round of the ping-pong (FR-26). */
  async counterByBuyer(
    userId: string,
    activeRole: UserRole,
    offerId: string,
    dto: CounterOfferInput,
  ): Promise<OfferThreadItem> {
    return this.applyPartyResponse(userId, activeRole, offerId, 'BUYER', {
      expectedStatus: OfferStatus.RELAYED_TO_BUYER,
      nextStatus: OfferStatus.COUNTER_OFFERED,
      action: OFFER_HISTORY_ACTIONS.COUNTER_BY_BUYER,
      kind: 'counter',
      counterPrice: Number(dto?.counterPrice),
      note: dto?.note?.trim() ? dto.note.trim() : null,
    });
  }

  // ---- helpers -------------------------------------------------------------

  /**
   * One guarded response transition (FR-26, NFR1). The order is deliberate: row lock → party
   * check → state check → expiry check → round cap → write → history → audit. Nothing is
   * written before every guardrail has passed, so a refused response leaves no trace.
   */
  private async applyPartyResponse(
    userId: string,
    activeRole: UserRole,
    offerId: string,
    side: 'BUYER' | 'SELLER',
    mutation: {
      expectedStatus: OfferStatus;
      nextStatus: OfferStatus;
      action: string;
      kind: 'accept' | 'reject' | 'counter';
      reason?: string;
      note?: string | null;
      counterPrice?: number;
    },
  ): Promise<OfferThreadItem> {
    const profile =
      side === 'BUYER'
        ? await this.resolveBuyerProfile(userId, activeRole)
        : await this.resolveSellerProfile(userId, activeRole);

    // AD-11: the single time source for the whole transition.
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const offer = await this.loadOfferForUpdate(tx, offerId);

      if (side === 'BUYER') {
        this.assertBuyerParty(offer, profile);
      } else {
        this.assertSellerParty(offer, profile);
      }

      if (offer.status !== mutation.expectedStatus) {
        throw new ConflictException({
          code: OFFER_INVALID_STATE_TRANSITION,
          message: 'لا يمكن تنفيذ هذا الإجراء على العرض في حالته الحالية',
        });
      }

      if (new Date(offer.expiresAt).getTime() <= now.getTime()) {
        throw new ConflictException({
          code: OFFER_ALREADY_EXPIRED,
          message: 'انتهت صلاحية العرض ولم يعد ممكناً الرد عليه',
        });
      }

      const currentRound = Number(offer.negotiationRound ?? 0);
      let nextRound = currentRound;
      let price = Number(offer.offerPrice);

      if (mutation.kind === 'counter') {
        if (currentRound >= MAX_COUNTER_ROUNDS) {
          throw new ConflictException({
            code: OFFER_MAX_ROUNDS_REACHED,
            message: `تم الوصول إلى الحد الأقصى لجولات التفاوض (${MAX_COUNTER_ROUNDS} جولات)`,
          });
        }
        const counterPrice = Number(mutation.counterPrice);
        if (
          !Number.isFinite(counterPrice) ||
          counterPrice < MIN_LISTING_PRICE_SAR ||
          counterPrice > MAX_LISTING_PRICE_SAR
        ) {
          throw new BadRequestException({
            code: OFFER_COUNTER_PRICE_OUT_OF_RANGE,
            message: `قيمة العرض المقابل يجب أن تكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
          });
        }
        price = counterPrice;
        nextRound = currentRound + 1;
      }

      const isTerminal = TERMINAL_OFFER_STATUSES.includes(mutation.nextStatus);
      const data: any = {
        status: mutation.nextStatus,
        version: { increment: 1 },
        // "Lock is released on decision commit" (AD-10).
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      };

      // The 7-day clock measures the current round, never the original submission.
      if (!isTerminal) data.expiresAt = this.nextExpiry(now);

      if (mutation.kind === 'counter') {
        data.offerPrice = price;
        data.negotiationRound = { increment: 1 };
        data.rejectionReason = null;
        data.rejectionNote = null;
      } else if (mutation.kind === 'reject') {
        data.rejectionReason = mutation.reason;
        data.rejectionNote = mutation.note ?? null;
      }

      await tx.offer.update({ where: { id: offerId }, data });

      await tx.offerHistory.create({
        data: {
          offerId,
          actorProfileId: profile.id,
          action: mutation.action,
          priceSnapshot: price,
          notes: mutation.note ?? null,
          roundNumber: nextRound,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: mutation.action,
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            fromStatus: offer.status,
            toStatus: mutation.nextStatus,
            price,
            round: nextRound,
            at: now.toISOString(),
          },
        },
      });

      // TODO(8.8): notify the opposite party (no Notification model exists).
      // The SELECTED_PENDING_FINAL_ADMIN_APPROVAL offer is bound into a Deal by
      // `DealsService.finalApprove` (Story 5.1) — never here.

      const refreshed = await tx.offer.findUnique({
        where: { id: offerId },
        include: OFFER_THREAD_INCLUDE as any,
      });

      return toOfferThreadSummary(refreshed ?? offer, {
        includeHistory: true,
      }) as OfferThreadItem;
    });
  }

  /**
   * AD-4: serialise concurrent responses on the same offer. `offers.id` is a `text` column in
   * this schema, so the parameter is cast to `text` — casting to `uuid` makes Postgres fail with
   * `operator does not exist: text = uuid` (P2010 / 42883) and surfaces as a 500.
   */
  private async loadOfferForUpdate(tx: any, offerId: string): Promise<any> {
    await tx.$queryRaw`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE`;

    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: OFFER_THREAD_INCLUDE as any,
    });
    if (!offer) {
      throw new NotFoundException({
        code: OFFER_NOT_FOUND,
        message: 'العرض المطلوب غير موجود',
      });
    }
    return offer;
  }

  private assertSellerParty(offer: any, profile: { id: string }): void {
    if (offer?.listing?.sellerProfileId !== profile.id) {
      throw new ForbiddenException({
        code: OFFER_NOT_PARTY,
        message: 'هذا العرض لا يخص عقاراتك',
      });
    }
  }

  private assertBuyerParty(offer: any, profile: { id: string }): void {
    if (offer?.buyerProfileId !== profile.id) {
      throw new ForbiddenException({
        code: OFFER_NOT_PARTY,
        message: 'هذا العرض لم يقدمه حسابك',
      });
    }
  }

  private assertParty(offer: any, profile: { id: string }): void {
    if (
      offer?.buyerProfileId !== profile.id &&
      offer?.listing?.sellerProfileId !== profile.id
    ) {
      throw new ForbiddenException({
        code: OFFER_NOT_PARTY,
        message: 'لا تملك صلاحية الاطلاع على هذا العرض',
      });
    }
  }

  /**
   * The caller's profile for whichever side of the offer their *active* workspace puts them on
   * (FR-3: a provider must switch workspace before acting as a buyer, and vice versa).
   */
  private async resolvePartyProfile(userId: string, activeRole: UserRole) {
    return activeRole === UserRole.BUYER
      ? this.resolveBuyerProfile(userId, activeRole)
      : this.resolveSellerProfile(userId, activeRole);
  }

  /**
   * The caller's MARKETER/OWNER profile for the active workspace. A user whose active workspace
   * is BUYER gets `OFFER_SELLER_PROFILE_REQUIRED` — that is FR-3 working as intended, not a bug.
   */
  private async resolveSellerProfile(userId: string, activeRole: UserRole) {
    if (activeRole !== UserRole.MARKETER && activeRole !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: OFFER_SELLER_PROFILE_REQUIRED,
        message: 'يلزم تفعيل مساحة الوسيط أو المالك للرد على عروض الشراء',
      });
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: activeRole } },
    });
    if (!profile || profile.status !== ProfileStatus.ACTIVE) {
      throw new ForbiddenException({
        code: OFFER_SELLER_PROFILE_REQUIRED,
        message: 'يلزم وجود ملف وسيط أو مالك نشط للرد على عروض الشراء',
      });
    }
    return profile;
  }

  /** 7 days measured from the *current* transition, not from the original submission. */
  private nextExpiry(now: Date): Date {
    return new Date(now.getTime() + OFFER_EXPIRY_HOURS * 3_600_000);
  }


  /**
   * The caller's BUYER profile. `activeRole` is already constrained to BUYER by
   * `SessionAuthGuard` + `ActiveRoleGuard` + `@RequireRole` (FR-3: a provider must switch
   * workspace first), so any other workspace is rejected as a missing buyer profile.
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
        code: OFFER_BUYER_PROFILE_REQUIRED,
        message: 'يلزم وجود ملف مشتري نشط لتقديم عرض شراء',
      });
    }
    return profile;
  }

  private toOfferItem(offer: any, listing: any): OfferItem {
    return {
      id: offer.id,
      listingId: offer.listingId,
      status: offer.status,
      offerPrice: Number(offer.offerPrice),
      askPrice: listing ? Number(listing.askPrice) : 0,
      isBackup: Boolean(offer.isBackup),
      isLowPrice: Boolean(offer.isLowPrice),
      note: offer.note ?? null,
      expiresAt: toIso(offer.expiresAt) as string,
      createdAt: toIso(offer.createdAt) as string,
      negotiationRound: Number(offer.negotiationRound ?? 0),
      awaitingParty: resolveAwaitingParty(offer.status),
      // Story 4.3: an activated backup offer is legible to the buyer without a notification feed.
      activatedAt: toIso(offer.activatedAt),
      listing: {
        id: listing?.id ?? offer.listingId,
        title: listing?.title ?? '',
        propertyType: listing?.propertyType,
        cityName: listing?.city?.nameAr ?? null,
        districtName: listing?.district?.nameAr ?? null,
        askPrice: listing ? Number(listing.askPrice) : 0,
        areaSquareMeters: listing ? Number(listing.areaSquareMeters) : 0,
        status: listing?.status,
      },
    };
  }

}
