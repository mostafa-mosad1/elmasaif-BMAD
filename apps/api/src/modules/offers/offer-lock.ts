import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  OfferLockInfo,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
} from '@elmasaif/shared';

/**
 * The single AD-10 claim-lease projection for `Offer` (Story 4.3 extraction of Story 4.2's
 * private helpers).
 *
 * `Offer` is one of the 8 claim-locked queues: there must be exactly **one** implementation of
 * the lease semantics, shared by the mediation queue (`AdminOffersService`) and the backup
 * queue (`BackupOffersService`). Duplicating `buildLockInfo` / `assertLockHeld` guarantees the
 * two queues drift apart on lazy expiry — the exact bug AD-10 exists to prevent.
 */

interface LockableOffer {
  lockedByAdminId?: string | null;
  lockedAt?: Date | string | null;
  lockExpiresAt?: Date | string | null;
}

interface AdminUserLookupClient {
  adminUser: { findMany: (args: any) => Promise<any[]> };
}

/**
 * Mirrors `AdminListingsService.buildLockInfo`: reads an expired lease as unlocked (lazy
 * expiry), so a dead lock never blocks the queue view.
 */
export function buildLockInfo(
  offer: LockableOffer,
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
export function assertLockHeld(offer: any, adminId: string, now: Date): void {
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

/**
 * Resolves every active lock holder in **one** query — never an N+1 per queue row. Expired
 * leases are filtered out here so the caller only pays for names it will actually render.
 */
export async function resolveLockHolderNames(
  client: AdminUserLookupClient,
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

  const holders = await client.adminUser.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true, username: true },
  });

  return new Map(
    (holders as any[]).map((holder) => [holder.id, holder.fullName || holder.username]),
  );
}

/** The one `OFFER_NOT_FOUND` shape used by every offer endpoint. */
export function offerNotFound(): NotFoundException {
  return new NotFoundException({
    code: OFFER_NOT_FOUND,
    message: 'العرض المطلوب غير موجود',
  });
}
