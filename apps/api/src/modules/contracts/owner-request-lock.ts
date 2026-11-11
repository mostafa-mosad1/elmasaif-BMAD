import {
  type ClaimLockInfo,
  OWNER_REQUEST_LOCK_CONFLICT,
  OWNER_REQUEST_LOCK_EXPIRED,
  OWNER_REQUEST_LOCK_REQUIRED,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

export type LockableOwnerRequest = ClaimLockableRecord;

export const OWNER_REQUEST_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: OWNER_REQUEST_LOCK_REQUIRED,
    message: 'يجب استلام مهمة مراجعة طلب المالك قبل اتخاذ إجراء',
  },
  conflict: {
    code: OWNER_REQUEST_LOCK_CONFLICT,
    message: 'قفل مراجعة طلب المالك مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ إجراء',
  },
  expired: {
    code: OWNER_REQUEST_LOCK_EXPIRED,
    message: 'انتهت مهلة قفل مراجعة طلب المالك (15 دقيقة). يرجى إعادة استلام المهمة',
  },
};

export function buildLockInfo(
  request: LockableOwnerRequest,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  return buildClaimLockInfo(request, now, currentAdminId, adminNameMap);
}

export function assertLockHeld(request: LockableOwnerRequest, adminId: string, now: Date): void {
  assertClaimLockHeld(request, adminId, now, OWNER_REQUEST_LOCK_CODES);
}

export async function resolveLockHolderNames(
  client: any,
  records: LockableOwnerRequest[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, records, now);
}

