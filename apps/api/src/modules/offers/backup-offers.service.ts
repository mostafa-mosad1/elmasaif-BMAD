import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  BACKUP_QUEUE_STATE_ORDER,
  BackupOfferQueueGroup,
  BackupOfferQueueItem,
  BackupOfferQueueQuery,
  BackupOfferQueueState,
  DEFAULT_PAGE_SIZE,
  ListingStatus,
  MAX_PAGE_SIZE,
  OFFER_BACKUP_ALREADY_ACTIVATED,
  OFFER_BACKUP_LISTING_UNAVAILABLE,
  OFFER_BACKUP_NOT_QUEUED,
  OFFER_BACKUP_PRIMARY_DEAL_ACTIVE,
  OFFER_HISTORY_ACTIONS,
  OfferListingSummary,
  OfferStatus,
  OfferThreadSummary,
} from '@elmasaif/shared';
import { OFFER_SUMMARY_INCLUDE, toOfferThreadSummary } from './offer-thread.mapper';
import {
  assertLockHeld,
  buildLockInfo,
  offerNotFound,
  resolveLockHolderNames,
} from './offer-lock';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';

/**
 * FR-27 / OQ-04: queue membership is a *view* over the hand-off state, not a new status.
 * Only an approved backup offer that was never activated is still waiting in line.
 */
const QUEUED_BACKUP_WHERE = {
  isBackup: true,
  status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
  activatedAt: null,
} as const;

export interface BackupOfferQueueResponse {
  items: BackupOfferQueueGroup[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CloseBackupOffersMeta {
  reason: 'PRIMARY_DEAL_COMPLETED' | string;
  actorAdminId?: string | null;
  closedAt?: Date;
}

/**
 * AC#2: the queue state is a **pure function of `Listing.status`**, never of `Deal`.
 *
 * This is what makes the "primary deal cancelled (by buyer, by timeout, or rejected)" trigger
 * work the moment Epic 5 reverts `Reserved → Active` (PRD FR-33/FR-34/FR-56) with zero Epic 5
 * code, and it deliberately reads no `Deal` row so Story 5.1's `DealStatus` reconciliation
 * cannot break this story. Derivation is also self-healing: it stays correct after a manual
 * intervention, a data repair, or a replayed job.
 */
export function resolveBackupQueueState(listingStatus: ListingStatus): BackupOfferQueueState {
  switch (listingStatus) {
    case ListingStatus.ACTIVE:
      return 'SURFACED';
    case ListingStatus.RESERVED:
      return 'QUEUED';
    case ListingStatus.SOLD:
      return 'CLOSABLE';
    default:
      return 'FROZEN';
  }
}

/**
 * Backup offer pipeline (Story 4.3 / FR-27, OQ-04, AD-10).
 *
 * Owns three things and nothing else:
 *
 * - the claim-gated read that ranks approved backup offers per listing (oldest first);
 * - the admin activation action, which stamps `Offer.activatedAt` and stops there — no `Deal`
 *   is created (that is Story 5.1's `Deals.FinalApprove`);
 * - the transactional closure primitive Story 5.1 calls inside its completion transaction, plus
 *   the same closure exposed to the `backup-offer-reconciliation` sweep.
 *
 * The lease (`claim` / `heartbeat` / `release` / `force-unlock`) stays on the canonical
 * `/admin/offers/:id/*` routes: `Offer` has exactly one lease implementation (AD-10).
 */
@Injectable()
export class BackupOffersService {
  private readonly logger = new Logger(BackupOffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * `GET /admin/backup-offers` — one group per listing holding a queue (AC#1).
   *
   * `meta.total` counts **listings**, not offers: the unit of work for the operator is a
   * listing whose primary deal status decides what can happen next.
   */
  async getBackupQueue(
    query: BackupOfferQueueQuery,
    currentAdminId: string,
  ): Promise<BackupOfferQueueResponse> {
    const now = this.clockService.now();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * limit;

    // The earliest queued offer per listing, which is also the group's sort key.
    const queueRoots = (await this.prisma.offer.findMany({
      where: QUEUED_BACKUP_WHERE,
      distinct: ['listingId'],
      select: { listingId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })) as Array<{ listingId: string; createdAt: Date | string }>;

    const listingIds = Array.from(new Set(queueRoots.map((root) => root.listingId)));
    if (listingIds.length === 0) {
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const listings = (await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: { city: true, district: true },
    })) as any[];

    const listingById = new Map(listings.map((listing) => [listing.id, listing]));
    const firstQueuedAtByListing = new Map(
      queueRoots.map((root) => [root.listingId, new Date(root.createdAt).getTime()]),
    );

    const orderedGroups = listingIds
      .filter((listingId) => listingById.has(listingId))
      .map((listingId) => {
        const listing = listingById.get(listingId);
        return {
          listing: this.toListingSummary(listing),
          queueState: resolveBackupQueueState(listing.status as ListingStatus),
          firstQueuedAt: firstQueuedAtByListing.get(listingId) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          BACKUP_QUEUE_STATE_ORDER[a.queueState] - BACKUP_QUEUE_STATE_ORDER[b.queueState] ||
          a.firstQueuedAt - b.firstQueuedAt ||
          a.listing.id.localeCompare(b.listing.id),
      );

    const pageGroups = orderedGroups.slice(skip, skip + limit);
    const pageListingIds = pageGroups.map((group) => group.listing.id);

    if (pageListingIds.length === 0) {
      return {
        items: [],
        meta: {
          total: orderedGroups.length,
          page,
          limit,
          totalPages: Math.ceil(orderedGroups.length / limit) || 0,
        },
      };
    }

    // One query for the whole page, ordered deterministically per listing (OQ-04).
    const offers = (await this.prisma.offer.findMany({
      where: { ...QUEUED_BACKUP_WHERE, listingId: { in: pageListingIds } },
      orderBy: [{ listingId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: OFFER_SUMMARY_INCLUDE as any,
    })) as any[];

    const adminNameMap = await resolveLockHolderNames(this.prisma, offers, now);

    const positions = new Map<string, number>();
    for (const listingId of pageListingIds) {
      const listingOffers = offers.filter((offer) => offer.listingId === listingId);
      listingOffers.forEach((offer, index) => positions.set(offer.id, index + 1));
    }

    return {
      items: pageGroups.map((group) => ({
        listing: group.listing,
        queueState: group.queueState,
        items: offers
          .filter((offer) => offer.listingId === group.listing.id)
          .map((offer) => ({
            ...(toOfferThreadSummary(offer, {
              includeHistory: false,
            }) as OfferThreadSummary),
            queuePosition: positions.get(offer.id) ?? 1,
            queueState: group.queueState,
            lockInfo: buildLockInfo(offer, now, currentAdminId, adminNameMap),
          })),
      })),
      meta: {
        total: orderedGroups.length,
        page,
        limit,
        totalPages: Math.ceil(orderedGroups.length / limit) || 0,
      },
    };
  }

  /**
   * `POST /admin/backup-offers/:id/activate` — promotes a surfaced backup offer (AC#3, AC#4).
   *
   * One transaction, two `FOR UPDATE` locks (offer then listing — a stable order so concurrent
   * activations cannot deadlock), in-transaction lease re-validation, then `activatedAt` only:
   * `status`, `expiresAt` and `Listing.status` are untouched and **no `Deal` is created**.
   */
  async activateBackupOffer(
    offerId: string,
    admin: AuthenticatedAdminActor,
  ): Promise<BackupOfferQueueItem> {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any): Promise<BackupOfferQueueItem> => {
      // AD-4: `offers.id` / `listings.id` are `text` columns — cast to `text`, never `uuid`
      // (Story 4.1's `42883` runtime 500).
      await tx.$queryRaw`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE`;

      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: OFFER_SUMMARY_INCLUDE as any,
      });
      if (!offer) {
        throw offerNotFound();
      }

      if (!offer.isBackup || offer.status !== OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL) {
        throw this.conflict(
          OFFER_BACKUP_NOT_QUEUED,
          'لا يمكن تفعيل هذا العرض لأنه ليس عرضاً احتياطياً معتمداً في طابور الانتظار',
        );
      }

      if (offer.activatedAt) {
        throw this.conflict(
          OFFER_BACKUP_ALREADY_ACTIVATED,
          'تم تفعيل هذا العرض الاحتياطي مسبقاً، ولا يمكن تفعيله مرة أخرى',
        );
      }

      await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${offer.listingId}::text FOR UPDATE`;

      const listing = await tx.listing.findUnique({
        where: { id: offer.listingId },
        select: { id: true, status: true },
      });
      const previousListingStatus = (listing?.status ?? null) as ListingStatus | null;
      const queueState = previousListingStatus
        ? resolveBackupQueueState(previousListingStatus)
        : 'FROZEN';

      if (queueState === 'QUEUED') {
        throw this.conflict(
          OFFER_BACKUP_PRIMARY_DEAL_ACTIVE,
          'لا يمكن تفعيل العرض الاحتياطي قبل إقفال الصفقة الأساسية',
        );
      }

      if (queueState !== 'SURFACED') {
        throw this.conflict(
          OFFER_BACKUP_LISTING_UNAVAILABLE,
          'العقار غير متاح حالياً، ولا يمكن تفعيل العرض الاحتياطي عليه',
        );
      }

      // At most one activated candidate per listing (defence in depth — the listing row lock
      // already serialises concurrent activations).
      const alreadyActivated = await tx.offer.findFirst({
        where: { listingId: offer.listingId, isBackup: true, activatedAt: { not: null } },
      });
      if (alreadyActivated && alreadyActivated.id !== offerId) {
        throw this.conflict(
          OFFER_BACKUP_ALREADY_ACTIVATED,
          'يوجد عرض احتياطي مُفعَّل بالفعل على هذا العقار، ولا يمكن تفعيل عرض آخر',
        );
      }

      // AD-10: last, so the operator reads the most actionable error first.
      assertLockHeld(offer, admin.id, now);

      const earlierQueuedCount = await tx.offer.count({
        where: {
          ...QUEUED_BACKUP_WHERE,
          listingId: offer.listingId,
          OR: [
            { createdAt: { lt: offer.createdAt } },
            { createdAt: offer.createdAt, id: { lt: offerId } },
          ],
        },
      });
      const queuePosition = Number(earlierQueuedCount ?? 0) + 1;

      await tx.offer.update({
        where: { id: offerId },
        data: {
          activatedAt: now,
          version: { increment: 1 },
          // "Lock is released on decision commit" (AD-10).
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.offerHistory.create({
        data: {
          offerId,
          actorAdminId: admin.id,
          action: OFFER_HISTORY_ACTIONS.BACKUP_ACTIVATED,
          priceSnapshot: Number(offer.offerPrice),
          notes: null,
          roundNumber: Number(offer.negotiationRound ?? 0),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_BACKUP_ACTIVATED',
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            listingId: offer.listingId,
            queuePosition,
            price: Number(offer.offerPrice),
            previousListingStatus,
            adminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      // `Deals.FinalApprove` binds this activated offer into a Deal — see
      // `DealsService.finalApprove` (Story 5.1). The reserve queue itself stays open until 5.4.
      // TODO(8.8): notify the buyer that their backup offer was activated (no Notification model).

      this.logger.log(
        `Backup offer ${offerId} activated by admin ${admin.id} (position ${queuePosition}, listing ${offer.listingId})`,
      );

      const refreshed =
        (await tx.offer.findUnique({
          where: { id: offerId },
          include: OFFER_SUMMARY_INCLUDE as any,
        })) ?? offer;

      return {
        ...(toOfferThreadSummary(refreshed, {
          includeHistory: false,
        }) as OfferThreadSummary),
        queuePosition,
        queueState: 'SURFACED',
        lockInfo: buildLockInfo({ lockedByAdminId: null }, now, admin.id),
      };
    });
  }

  /**
   * AC#7: closes every approved, never-activated backup offer on a listing (FR-27 / FR-32).
   *
   * **Story 5.1 must pass its own transaction.** A nested client-level `$transaction` runs on a
   * different connection and would deadlock against the row locks the completion transaction
   * already holds. The activated candidate (`activatedAt != null`) is skipped: it is the winning
   * offer and Story 5.1 owns its terminal transition.
   *
   * Idempotent by construction — `QUEUED_BACKUP_WHERE` excludes `CLOSED_BACKUP`, so a second run
   * over an already-closed queue changes nothing.
   */
  async closeRemainingBackupOffersForListing(
    listingId: string,
    meta: CloseBackupOffersMeta,
    tx?: any,
  ): Promise<{ closedCount: number; offerIds: string[] }> {
    const client = tx ?? this.prisma;
    const closedAt = meta.closedAt ?? this.clockService.now();

    const queued = (await client.offer.findMany({
      where: { ...QUEUED_BACKUP_WHERE, listingId },
    })) as any[];

    const offerIds: string[] = [];

    for (const offer of queued) {
      await client.offer.update({
        where: { id: offer.id },
        data: { status: OfferStatus.CLOSED_BACKUP, version: { increment: 1 } },
      });

      await client.offerHistory.create({
        data: {
          offerId: offer.id,
          actorAdminId: meta.actorAdminId ?? null,
          action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED,
          priceSnapshot: Number(offer.offerPrice),
          notes: meta.reason,
          roundNumber: Number(offer.negotiationRound ?? 0),
        },
      });

      await client.auditLog.create({
        data: {
          actorId: meta.actorAdminId ?? 'SYSTEM',
          actorType: meta.actorAdminId ? 'ADMIN' : 'SYSTEM',
          action: 'OFFER_BACKUP_CLOSED',
          entityType: 'Offer',
          entityId: offer.id,
          payload: {
            listingId,
            reason: meta.reason,
            price: Number(offer.offerPrice),
            closedAt: closedAt.toISOString(),
          },
        },
      });

      // TODO(8.8): notify the buyer that their backup offer was closed by the winning deal.
      offerIds.push(offer.id);
    }

    if (offerIds.length > 0) {
      this.logger.log(
        `Closed ${offerIds.length} backup offer(s) on listing ${listingId} (${meta.reason})`,
      );
    }

    return { closedCount: offerIds.length, offerIds };
  }

  // ---- internals -----------------------------------------------------------

  private toListingSummary(listing: any): OfferListingSummary {
    return {
      id: listing.id,
      title: listing.title,
      propertyType: listing.propertyType,
      cityName: listing.city?.nameAr ?? null,
      districtName: listing.district?.nameAr ?? null,
      askPrice: Number(listing.askPrice),
      areaSquareMeters: Number(listing.areaSquareMeters),
      status: listing.status as ListingStatus,
    };
  }

  private conflict(code: string, message: string): ConflictException {
    return new ConflictException({ code, message });
  }
}
