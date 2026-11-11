import {
  type ClaimLockInfo,
  CONTRACT_FEE_LOCK_CONFLICT,
  CONTRACT_FEE_LOCK_EXPIRED,
  CONTRACT_FEE_LOCK_REQUIRED,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

export type LockableContractFeePayment = ClaimLockableRecord;

export const CONTRACT_FEE_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: CONTRACT_FEE_LOCK_REQUIRED,
    message: 'يجب استلام مهمة تدقيق إشعار رسوم العقد قبل اتخاذ إجراء',
  },
  conflict: {
    code: CONTRACT_FEE_LOCK_CONFLICT,
    message: 'قفل تدقيق إشعار رسوم العقد مملوك لمشرف آخر؛ يجب إلغاء القفل قبل اتخاذ إجراء',
  },
  expired: {
    code: CONTRACT_FEE_LOCK_EXPIRED,
    message: 'انتهت مهلة قفل تدقيق إشعار رسوم العقد (15 دقيقة). يرجى إعادة استلام المهمة',
  },
};

export function buildLockInfo(
  payment: LockableContractFeePayment,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  return buildClaimLockInfo(payment, now, currentAdminId, adminNameMap);
}

export function assertLockHeld(payment: LockableContractFeePayment, adminId: string, now: Date): void {
  assertClaimLockHeld(payment, adminId, now, CONTRACT_FEE_LOCK_CODES);
}

export async function resolveLockHolderNames(
  client: any,
  records: LockableContractFeePayment[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, records, now);
}

