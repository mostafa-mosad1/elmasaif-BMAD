import { NotFoundException } from '@nestjs/common';
import {
  type ClaimLockInfo,
  DISPUTE_LOCK_CONFLICT,
  DISPUTE_LOCK_EXPIRED,
  DISPUTE_LOCK_REQUIRED,
  DISPUTE_NOT_FOUND,
} from '@elmasaif/shared';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
  type ClaimLockableRecord,
} from '../../common/locks/claim-lock';

export type LockableDispute = ClaimLockableRecord;

export const DISPUTE_LOCK_CODES: ClaimLockCodes = {
  required: {
    code: DISPUTE_LOCK_REQUIRED,
    message: 'يجب حجز مهمة النزاع أولاً قبل اتخاذ القرار',
  },
  conflict: {
    code: DISPUTE_LOCK_CONFLICT,
    message: 'قفل النزاع محجوز حالياً بواسطة مسؤول آخر',
  },
  expired: {
    code: DISPUTE_LOCK_EXPIRED,
    message: 'انتهت مدة حجز النزاع (15 دقيقة). يرجى إعادة الحجز',
  },
};

export function buildDisputeLockInfo(
  dispute: LockableDispute,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  return buildClaimLockInfo(dispute, now, currentAdminId, adminNameMap);
}

export function assertDisputeLockHeld(dispute: any, adminId: string, now: Date): void {
  assertClaimLockHeld(dispute, adminId, now, DISPUTE_LOCK_CODES);
}

export async function resolveDisputeLockHolderNames(
  client: any,
  disputes: any[],
  now: Date,
): Promise<Map<string, string>> {
  return resolveClaimLockHolderNames(client, disputes, now);
}

export function disputeNotFound(): NotFoundException {
  return new NotFoundException({
    code: DISPUTE_NOT_FOUND,
    message: 'النزاع المطلوب غير موجود',
  });
}

