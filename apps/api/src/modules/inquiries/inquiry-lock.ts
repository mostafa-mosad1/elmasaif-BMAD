import { NotFoundException } from '@nestjs/common';
import {
  type InquiryLockInfo,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_LOCK_REQUIRED,
  INQUIRY_NOT_FOUND,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

/**
 * The conversation queue's binding of the shared AD-10 claim lease (Story 4.4 / AC-3).
 *
 * Only the codes and Arabic wording differ from the offer queues — the semantics (lazy expiry,
 * 15-minute lease, one holder query per page) come from `common/locks/claim-lock.ts`.
 */

const INQUIRY_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: INQUIRY_LOCK_REQUIRED,
    message: 'يجب استلام المحادثة قبل اتخاذ إجراء عليها',
  },
  conflict: {
    code: INQUIRY_LOCK_CONFLICT,
    message: 'قفل المحادثة مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ إجراء',
  },
  expired: {
    code: INQUIRY_LOCK_EXPIRED,
    message: 'انتهت مهلة قفل المحادثة (15 دقيقة). يرجى إعادة استلامها',
  },
};

/** AD-10 projection for one `ListingInquiry` row. */
export function buildInquiryLockInfo(
  inquiry: ClaimLockableRecord,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): InquiryLockInfo {
  return buildClaimLockInfo(inquiry, now, currentAdminId, adminNameMap);
}

/** Throws `INQUIRY_LOCK_REQUIRED` / `_CONFLICT` / `_EXPIRED` in that order. */
export function assertInquiryLockHeld(
  inquiry: ClaimLockableRecord,
  adminId: string,
  now: Date,
): void {
  assertClaimLockHeld(inquiry, adminId, now, INQUIRY_LOCK_CODES);
}

/** One query for every active holder name on a queue page. */
export async function resolveInquiryLockHolderNames(
  client: any,
  inquiries: ClaimLockableRecord[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, inquiries, now);
}

/** The one `INQUIRY_NOT_FOUND` shape used by every inquiry endpoint. */
export function inquiryNotFound(): NotFoundException {
  return new NotFoundException({
    code: INQUIRY_NOT_FOUND,
    message: 'الاستفسار المطلوب غير موجود',
  });
}
