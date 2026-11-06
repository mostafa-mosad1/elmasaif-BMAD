import { NotFoundException } from '@nestjs/common';
import {
  type ClaimLockInfo,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

/**
 * The offer module's binding of the shared AD-10 claim lease (Story 4.4 extracted the single
 * implementation into `common/locks/claim-lock.ts`).
 *
 * The exported names and signatures are unchanged on purpose: `AdminOffersService`,
 * `BackupOffersService` and their specs keep importing exactly what they imported before, and
 * only the underlying implementation moved. `Offer` and `ListingInquiry` therefore cannot drift
 * apart on lazy expiry.
 */

type LockableOffer = ClaimLockableRecord;

const OFFER_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: OFFER_LOCK_REQUIRED,
    message: 'يجب استلام مهمة الوساطة قبل اتخاذ قرار على العرض',
  },
  conflict: {
    code: OFFER_LOCK_CONFLICT,
    message: 'قفل الوساطة مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ قرار',
  },
  expired: {
    code: OFFER_LOCK_EXPIRED,
    message: 'انتهت مهلة قفل الوساطة (15 دقيقة). يرجى إعادة استلام المهمة',
  },
};

/** AD-10 projection for one offer row. */
export function buildLockInfo(
  offer: LockableOffer,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  return buildClaimLockInfo(offer, now, currentAdminId, adminNameMap);
}

/** Throws `OFFER_LOCK_REQUIRED` / `_CONFLICT` / `_EXPIRED` in that order. */
export function assertLockHeld(offer: any, adminId: string, now: Date): void {
  assertClaimLockHeld(offer, adminId, now, OFFER_LOCK_CODES);
}

/** One query for every active holder name in a queue page. */
export async function resolveLockHolderNames(
  client: any,
  offers: any[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, offers, now);
}

/** The one `OFFER_NOT_FOUND` shape used by every offer endpoint. */
export function offerNotFound(): NotFoundException {
  return new NotFoundException({
    code: OFFER_NOT_FOUND,
    message: 'العرض المطلوب غير موجود',
  });
}
