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
  MAX_LISTING_PRICE_SAR,
  MIN_LISTING_PRICE_SAR,
  OFFER_ACTIVE_EXISTS,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_EXPIRY_HOURS,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_SELF_SUBMISSION_FORBIDDEN,
  ListingStatus,
  OfferItem,
  OfferListQuery,
  OfferStatus,
  ProfileStatus,
  SubmitOfferInput,
  UserRole,
} from '@elmasaif/shared';

/** FR-25 / FR-14: offers are only accepted on a live listing. */
const OFFERABLE_LISTING_STATUSES: readonly ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
];

/**
 * Buyer offer intake + own-offer visibility (Story 4.1 / FR-25, A-07, BR-11). The offer is
 * parked in `PENDING_ADMIN_REVIEW`; the seller relay, counter rounds and the admin queue are
 * Story 4.2, and backup-queue activation is Story 4.3.
 *
 * Every guardrail is enforced here rather than in the UI (NFR1): the price envelope, the
 * sub-50 % acknowledgement, the offerable-listing state and the one-active-offer-per-buyer
 * rule all live server-side, and the submission is audited inside the same transaction.
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
          action: 'OFFER_SUBMITTED',
          priceSnapshot: price,
          notes: dto.note ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'OFFER_SUBMITTED',
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

      // TODO(4.2): relay to seller / admin mediation queue (`Offers.Review`).
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

  // ---- helpers -------------------------------------------------------------

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
      expiresAt: this.toIso(offer.expiresAt) as string,
      createdAt: this.toIso(offer.createdAt) as string,
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

  private toIso(value: unknown): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }
}
