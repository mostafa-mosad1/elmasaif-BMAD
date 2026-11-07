import { NotFoundException } from '@nestjs/common';
import {
  type ClaimLockInfo,
  PAYMENT_LOCK_CONFLICT,
  PAYMENT_LOCK_EXPIRED,
  PAYMENT_LOCK_REQUIRED,
  PAYMENT_NOT_FOUND,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

/**
 * The deal payment module's binding of the shared AD-10 claim lease.
 *
 * Story 5.3 mirrors `offer-lock.ts` and `inquiry-lock.ts` verbatim: the underlying implementation
 * lives in `common/locks/claim-lock.ts`, and this module supplies only the payment-specific
 * codes and Arabic messages so lazy expiry and lease mechanics remain byte-identical across queues.
 */

export type LockablePayment = ClaimLockableRecord;

export const PAYMENT_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: PAYMENT_LOCK_REQUIRED,
    message: 'يجب استلام مهمة التدقيق قبل اتخاذ قرار على إثبات الدفع',
  },
  conflict: {
    code: PAYMENT_LOCK_CONFLICT,
    message: 'قفل التدقيق مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ قرار',
  },
  expired: {
    code: PAYMENT_LOCK_EXPIRED,
    message: 'انتهت مهلة قفل التدقيق (15 دقيقة). يرجى إعادة استلام المهمة',
  },
};

/** AD-10 projection for one payment row. */
export function buildLockInfo(
  payment: LockablePayment,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  return buildClaimLockInfo(payment, now, currentAdminId, adminNameMap);
}

/** Throws `PAYMENT_LOCK_REQUIRED` / `_CONFLICT` / `_EXPIRED` in that order. */
export function assertLockHeld(payment: any, adminId: string, now: Date): void {
  assertClaimLockHeld(payment, adminId, now, PAYMENT_LOCK_CODES);
}

/** One query for every active holder name in a queue page. */
export async function resolveLockHolderNames(
  client: any,
  payments: any[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, payments, now);
}

/** The one `PAYMENT_NOT_FOUND` shape used by every admin payment endpoint. */
export function paymentNotFound(): NotFoundException {
  return new NotFoundException({
    code: PAYMENT_NOT_FOUND,
    message: 'إثبات الدفع المطلوب غير موجود',
  });
}
