import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  OFFER_ALREADY_EXPIRED,
  OFFER_EXPIRY_HOURS,
  OFFER_FORCE_UNLOCK_REASON_REQUIRED,
  OFFER_HISTORY_ACTIONS,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_DURATION_MS,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
  OfferLockInfo,
  OfferQueueQuery,
  OfferStatus,
  OfferThreadItem,
  OfferThreadSummary,
  TERMINAL_OFFER_STATUSES,
} from '@elmasaif/shared';
import {
  OFFER_SUMMARY_INCLUDE,
  OFFER_THREAD_INCLUDE,
  toOfferThreadSummary,
} from './offer-thread.mapper';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';

/**
 * AC#9: the mediable statuses — an offer is in the queue exactly while the platform owes the
 * conversation a decision (relay it to the seller, or relay the seller's counter to the buyer).
 */
const AWAITING_MEDIATION_STATUSES: readonly OfferStatus[] = [
  OfferStatus.PENDING_ADMIN_REVIEW,
  OfferStatus.COUNTER_OFFERED,
];

export interface AdminOfferQueueResponse {
  items: OfferThreadSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type AdminOfferThread = OfferThreadItem & { lockInfo: OfferLockInfo };

interface MediationDecision {
  allowedFrom: readonly OfferStatus[];
  toStatus: OfferStatus;
  historyAction: string;
  auditAction: string;
  /** `false` for a rejection: killing an already-expired offer is still a valid decision. */
  requiresUnexpired?: boolean;
  rejectionReason?: string | null;
  rejectionNote?: string | null;
  invalidStateMessage: string;
}

/**
 * Administrative mediation queue for offers (Story 4.2 / FR-26, `Offers.Review`, AD-10, AD-12).
 *
 * `Offer` is one of the 8 claim-locked queues: a 15-minute lease, lazy expiry, an explicit
 * `POST` claim (never a `GET`), and the lock released on decision commit. Two things are
 * deliberately stricter than the listings moderation queue:
 *
 * - the claim is a **conditional `updateMany`** (`count === 0` ⇒ conflict) instead of a
 *   read-then-update, so two admins racing for the same offer cannot both win;
 * - `relay-to-seller` / `relay-to-buyer` / `reject` re-validate the lease **inside** the
 *   transaction, so a decision taken on a lock that expired meanwhile is never committed.
 *
 * Every transition writes `OfferHistory` (with `actorAdminId`) and `AuditLog` in the same
 * `prisma.$transaction`, behind a `FOR UPDATE` row lock on the offer.
 */
@Injectable()
export class AdminOffersService {
  private readonly logger = new Logger(AdminOffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /** `GET /admin/offers` — offers awaiting a mediation decision, oldest first (AC#9). */
  async getQueue(
    query: OfferQueueQuery,
    currentAdminId: string,
  ): Promise<AdminOfferQueueResponse> {
    const now = this.clockService.now();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * limit;

    const where = query.status
      ? { status: query.status }
      : { status: { in: [...AWAITING_MEDIATION_STATUSES] as any } };

    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: OFFER_SUMMARY_INCLUDE as any,
      }),
      this.prisma.offer.count({ where }),
    ]);

    // One lookup for every holder name — never an N+1 per row.
    const adminNameMap = await this.resolveLockHolderNames(offers, now);

    return {
      items: (offers as any[]).map((offer) => ({
        ...(toOfferThreadSummary(offer, {
          includeHistory: false,
        }) as OfferThreadSummary),
        lockInfo: this.buildLockInfo(offer, now, currentAdminId, adminNameMap),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** `GET /admin/offers/:id` — one mediated thread plus its lock state (additive read). */
  async getOffer(offerId: string, currentAdminId: string): Promise<AdminOfferThread> {
    const now = this.clockService.now();

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: OFFER_THREAD_INCLUDE as any,
    });
    if (!offer) {
      throw this.notFound();
    }

    const adminNameMap = await this.resolveLockHolderNames([offer], now);

    return {
      ...(toOfferThreadSummary(offer, {
        includeHistory: true,
      }) as OfferThreadItem),
      lockInfo: this.buildLockInfo(offer, now, currentAdminId, adminNameMap),
    };
  }

  /**
   * `POST /admin/offers/:id/claim` — acquires or extends the 15-minute mediation lease.
   * The conditional `UPDATE` is the conflict signal (AD-10); there is no read-then-write race.
   */
  async claimOffer(offerId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + OFFER_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) {
        throw this.notFound();
      }

      if (!AWAITING_MEDIATION_STATUSES.includes(offer.status)) {
        throw new BadRequestException({
          code: OFFER_INVALID_STATE_TRANSITION,
          message: 'لا يمكن استلام مهمة الوساطة إلا للعروض التي بانتظار قرار الإدارة',
        });
      }

      const { count } = await tx.offer.updateMany({
        where: {
          id: offerId,
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
        },
      });

      if (count === 0) {
        const holder = await this.loadLockHolder(tx, offer.lockedByAdminId);
        const lockInfo = this.buildLockInfo(
          offer,
          now,
          admin.id,
          holder ? new Map([[holder.id, holder.name]]) : undefined,
        );
        throw new ConflictException({
          code: OFFER_LOCK_CONFLICT,
          message: `هذا العرض قيد الوساطة حالياً بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`,
          lockInfo,
          details: { lockInfo },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_MODERATION_CLAIMED',
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            lockedByAdminId: admin.id,
            lockedByAdminName: admin.fullName,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
          },
        },
      });

      this.logger.log(`Offer ${offerId} claimed for mediation by admin ${admin.id}`);
      return {
        id: offerId,
        status: offer.status,
        lockInfo: this.buildLockInfo(
          { lockedByAdminId: admin.id, lockedAt: now, lockExpiresAt },
          now,
          admin.id,
          new Map([[admin.id, admin.fullName]]),
        ),
      };
    });
  }

  /** `POST /admin/offers/:id/heartbeat` — renews the caller's own lease by 15 minutes. */
  async heartbeatOffer(offerId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + OFFER_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) {
        throw this.notFound();
      }

      this.assertLockHeld(offer, admin.id, now);

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { lockExpiresAt },
      });

      return {
        id: updated.id,
        status: updated.status,
        lockInfo: this.buildLockInfo(
          updated,
          now,
          admin.id,
          new Map([[admin.id, admin.fullName]]),
        ),
      };
    });
  }

  /** `POST /admin/offers/:id/release` — hands the lease back without a decision. */
  async releaseOffer(offerId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) {
        throw this.notFound();
      }

      this.assertLockHeld(offer, admin.id, now);

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_MODERATION_RELEASED',
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            releasedByAdminId: admin.id,
            releasedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Offer ${offerId} mediation lease released by admin ${admin.id}`);
      return {
        id: updated.id,
        status: updated.status,
        lockInfo: this.buildLockInfo(updated, now, admin.id),
      };
    });
  }

  /** `POST /admin/offers/:id/force-unlock` — `Tasks.ForceUnlock` + a documented reason (AD-10). */
  async forceUnlockOffer(
    offerId: string,
    admin: AuthenticatedAdminActor,
    reason: string,
  ) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException({
        code: OFFER_FORCE_UNLOCK_REASON_REQUIRED,
        message: 'يجب إدخال سبب معتمد لإلغاء قفل الوساطة (5 أحرف على الأقل)',
      });
    }

    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) {
        throw this.notFound();
      }

      const previousLockHolderId = offer.lockedByAdminId ?? null;

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_MODERATION_FORCE_UNLOCKED',
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            previousLockHolderId,
            reason: trimmedReason,
            unlockedByAdminId: admin.id,
            unlockedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.warn(
        `Offer ${offerId} mediation lease force-unlocked by admin ${admin.id} (previous holder: ${previousLockHolderId ?? 'none'})`,
      );
      return {
        id: updated.id,
        status: updated.status,
        lockInfo: this.buildLockInfo(updated, now, admin.id),
      };
    });
  }

  /** `POST /admin/offers/:id/relay-to-seller` — AC#1: `PENDING_ADMIN_REVIEW` → `RELAYED_TO_SELLER`. */
  async relayToSeller(offerId: string, admin: AuthenticatedAdminActor) {
    return this.applyDecision(offerId, admin, {
      allowedFrom: [OfferStatus.PENDING_ADMIN_REVIEW],
      toStatus: OfferStatus.RELAYED_TO_SELLER,
      historyAction: OFFER_HISTORY_ACTIONS.RELAYED_TO_SELLER,
      auditAction: 'OFFER_RELAYED_TO_SELLER',
      invalidStateMessage:
        'لا يمكن إرسال العرض إلى البائع إلا إذا كان بانتظار مراجعة الإدارة',
    });
  }

  /** `POST /admin/offers/:id/relay-to-buyer` — AC#4: `COUNTER_OFFERED` → `RELAYED_TO_BUYER`. */
  async relayToBuyer(offerId: string, admin: AuthenticatedAdminActor) {
    return this.applyDecision(offerId, admin, {
      allowedFrom: [OfferStatus.COUNTER_OFFERED],
      toStatus: OfferStatus.RELAYED_TO_BUYER,
      historyAction: OFFER_HISTORY_ACTIONS.RELAYED_TO_BUYER,
      auditAction: 'OFFER_RELAYED_TO_BUYER',
      invalidStateMessage:
        'لا يمكن إرسال العرض المضاد إلى المشتري إلا إذا كان بانتظار قرار الإدارة',
    });
  }

  /** `POST /admin/offers/:id/reject` — AC#6: mediated terms refused with a mandatory reason. */
  async rejectOffer(offerId: string, admin: AuthenticatedAdminActor, reason: string) {
    const trimmedReason = (reason ?? '').trim();

    return this.applyDecision(offerId, admin, {
      allowedFrom: [OfferStatus.PENDING_ADMIN_REVIEW, OfferStatus.COUNTER_OFFERED],
      toStatus: OfferStatus.REJECTED_BY_ADMIN,
      historyAction: OFFER_HISTORY_ACTIONS.REJECTED_BY_ADMIN,
      auditAction: 'OFFER_REJECTED_BY_ADMIN',
      requiresUnexpired: false,
      rejectionReason: trimmedReason,
      rejectionNote: trimmedReason,
      invalidStateMessage:
        'لا يمكن رفض هذا العرض إدارياً في حالته الحالية',
    });
  }

  // ---- internals -----------------------------------------------------------

  private async applyDecision(
    offerId: string,
    admin: AuthenticatedAdminActor,
    decision: MediationDecision,
  ): Promise<AdminOfferThread> {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      // AD-4/AD-11: row lock first. `offers.id` is a `text` column — cast to `text`, never
      // `uuid`, or Postgres raises `42883` (Story 4.1's runtime 500).
      await tx.$queryRaw`SELECT "id" FROM "offers" WHERE "id" = ${offerId}::text FOR UPDATE`;

      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        include: OFFER_THREAD_INCLUDE as any,
      });
      if (!offer) {
        throw this.notFound();
      }

      // AD-10: validate the lease in-transaction so a stale decision cannot commit.
      this.assertLockHeld(offer, admin.id, now);

      if (!decision.allowedFrom.includes(offer.status)) {
        throw new ConflictException({
          code: OFFER_INVALID_STATE_TRANSITION,
          message: decision.invalidStateMessage,
        });
      }

      if (
        decision.requiresUnexpired !== false &&
        offer.expiresAt &&
        new Date(offer.expiresAt).getTime() <= now.getTime()
      ) {
        throw new ConflictException({
          code: OFFER_ALREADY_EXPIRED,
          message: 'انتهت مدة صلاحية هذا العرض، ولا يمكن اتخاذ قرار وساطة بشأنه',
        });
      }

      const isTerminalTarget = TERMINAL_OFFER_STATUSES.includes(decision.toStatus);
      const data: any = {
        status: decision.toStatus,
        version: { increment: 1 },
        // "Lock is released on decision commit" (AD-10).
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      };

      // AC#11: the 7-day clock measures the current round, not the original submission.
      if (!isTerminalTarget) {
        data.expiresAt = new Date(now.getTime() + OFFER_EXPIRY_HOURS * 3_600_000);
      }
      if (decision.rejectionReason !== undefined) {
        data.rejectionReason = decision.rejectionReason;
      }
      if (decision.rejectionNote !== undefined) {
        data.rejectionNote = decision.rejectionNote;
      }

      const updated = await tx.offer.update({ where: { id: offerId }, data });

      await tx.offerHistory.create({
        data: {
          offerId,
          actorAdminId: admin.id,
          action: decision.historyAction,
          priceSnapshot: Number(offer.offerPrice),
          notes: decision.rejectionNote ?? null,
          roundNumber: Number(offer.negotiationRound ?? 0),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: decision.auditAction,
          entityType: 'Offer',
          entityId: offerId,
          payload: {
            fromStatus: offer.status,
            toStatus: decision.toStatus,
            price: Number(offer.offerPrice),
            round: Number(offer.negotiationRound ?? 0),
            adminName: admin.fullName,
            at: now.toISOString(),
            ...(decision.rejectionReason
              ? { reason: decision.rejectionReason }
              : {}),
          },
        },
      });

      // TODO(8.8): notify the seller/buyer that the mediated terms moved (no Notification model).
      const refreshed =
        (await tx.offer.findUnique({
          where: { id: offerId },
          include: OFFER_THREAD_INCLUDE as any,
        })) ?? { ...offer, ...updated };

      this.logger.log(
        `Offer ${offerId} ${decision.auditAction} by admin ${admin.id}`,
      );

      return {
        ...(toOfferThreadSummary(refreshed, {
          includeHistory: true,
        }) as OfferThreadItem),
        lockInfo: this.buildLockInfo(refreshed, now, admin.id),
      };
    });
  }

  /**
   * Mirrors `AdminListingsService.buildLockInfo`: reads an expired lease as unlocked (lazy
   * expiry), so a dead lock never blocks the queue view.
   */
  private buildLockInfo(
    offer: {
      lockedByAdminId?: string | null;
      lockedAt?: Date | string | null;
      lockExpiresAt?: Date | string | null;
    },
    now: Date,
    currentAdminId: string,
    adminNameMap?: Map<string, string>,
  ): OfferLockInfo {
    const expiresAt = offer.lockExpiresAt ? new Date(offer.lockExpiresAt) : null;
    const lockedAt = offer.lockedAt ? new Date(offer.lockedAt) : null;
    const isActivelyLocked = Boolean(
      offer.lockedByAdminId && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!isActivelyLocked || !offer.lockedByAdminId || !expiresAt) {
      return {
        isLocked: false,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: null,
        lockedByAdminName: null,
        lockedAt: null,
        lockExpiresAt: null,
        remainingSeconds: 0,
      };
    }

    const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

    return {
      isLocked: true,
      isLockedByCurrentAdmin: offer.lockedByAdminId === currentAdminId,
      lockedByAdminId: offer.lockedByAdminId,
      lockedByAdminName: adminNameMap?.get(offer.lockedByAdminId) ?? null,
      lockedAt: lockedAt ? lockedAt.toISOString() : null,
      lockExpiresAt: expiresAt.toISOString(),
      remainingSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  /**
   * Order matters and mirrors `heartbeatListingLock`: "nothing held" → "someone else holds it"
   * → "mine but expired". Callers get one deterministic code per situation.
   */
  private assertLockHeld(offer: any, adminId: string, now: Date): void {
    if (!offer.lockedByAdminId) {
      throw new ConflictException({
        code: OFFER_LOCK_REQUIRED,
        message: 'يجب استلام مهمة الوساطة قبل اتخاذ قرار على العرض',
      });
    }
    if (offer.lockedByAdminId !== adminId) {
      throw new ConflictException({
        code: OFFER_LOCK_CONFLICT,
        message: 'قفل الوساطة مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ قرار',
      });
    }
    if (!offer.lockExpiresAt || new Date(offer.lockExpiresAt).getTime() <= now.getTime()) {
      throw new ConflictException({
        code: OFFER_LOCK_EXPIRED,
        message: 'انتهت مهلة قفل الوساطة (15 دقيقة). يرجى إعادة استلام المهمة',
      });
    }
  }

  private async resolveLockHolderNames(
    offers: any[],
    now: Date,
  ): Promise<Map<string, string>> {
    const ids = Array.from(
      new Set(
        offers
          .filter(
            (offer) =>
              offer.lockedByAdminId &&
              offer.lockExpiresAt &&
              new Date(offer.lockExpiresAt).getTime() > now.getTime(),
          )
          .map((offer) => offer.lockedByAdminId as string),
      ),
    );
    if (ids.length === 0) return new Map();

    const holders = await this.prisma.adminUser.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, username: true },
    });

    return new Map(
      (holders as any[]).map((holder) => [holder.id, holder.fullName || holder.username]),
    );
  }

  private async loadLockHolder(
    tx: any,
    adminId?: string | null,
  ): Promise<{ id: string; name: string } | null> {
    if (!adminId) return null;
    const holder = await tx.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, fullName: true, username: true },
    });
    if (!holder) return null;
    return { id: holder.id, name: holder.fullName || holder.username };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: OFFER_NOT_FOUND,
      message: 'العرض المطلوب غير موجود',
    });
  }
}
