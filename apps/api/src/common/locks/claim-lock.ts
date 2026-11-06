import { ConflictException } from '@nestjs/common';
import type { ClaimLockInfo } from '@elmasaif/shared';

/**
 * The single AD-10 claim-lease implementation, shared by every claim-locked admin queue.
 *
 * Story 4.2/4.3 proved the semantics on the offer queues; Story 4.4 requires the very same
 * 15-minute lease for the conversation queue. Duplicating `buildClaimLockInfo` /
 * `assertClaimLockHeld` would let the two queues drift apart on lazy expiry — the exact bug
 * AD-10 exists to prevent — so the projection and the assertions live here once and each
 * module only supplies its own error codes and Arabic messages.
 */

/** The lock columns every claim-locked row carries. */
export interface ClaimLockableRecord {
  lockedByAdminId?: string | null;
  lockedAt?: Date | string | null;
  lockExpiresAt?: Date | string | null;
}

/** The conflict codes and messages of one queue, so the logic stays generic. */
export interface ClaimLockCodes {
  required: { code: string; message: string };
  conflict: { code: string; message: string };
  expired: { code: string; message: string };
}

interface AdminUserLookupClient {
  adminUser: { findMany: (args: any) => Promise<any[]> };
}

/**
 * Reads an expired lease as unlocked (lazy expiry), so a dead lock never blocks a queue view.
 * Mirrors `AdminListingsService.buildLockInfo`.
 */
export function buildClaimLockInfo(
  record: ClaimLockableRecord,
  now: Date,
  currentAdminId: string,
  adminNameMap?: Map<string, string>,
): ClaimLockInfo {
  const expiresAt = record.lockExpiresAt ? new Date(record.lockExpiresAt) : null;
  const lockedAt = record.lockedAt ? new Date(record.lockedAt) : null;
  const isActivelyLocked = Boolean(
    record.lockedByAdminId && expiresAt && expiresAt.getTime() > now.getTime(),
  );

  if (!isActivelyLocked || !record.lockedByAdminId || !expiresAt) {
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
    isLockedByCurrentAdmin: record.lockedByAdminId === currentAdminId,
    lockedByAdminId: record.lockedByAdminId,
    lockedByAdminName: adminNameMap?.get(record.lockedByAdminId) ?? null,
    lockedAt: lockedAt ? lockedAt.toISOString() : null,
    lockExpiresAt: expiresAt.toISOString(),
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

/**
 * Order matters and mirrors `heartbeatListingLock`: "nothing held" → "someone else holds it"
 * → "mine but expired". Callers get one deterministic code per situation.
 */
export function assertClaimLockHeld(
  record: ClaimLockableRecord,
  adminId: string,
  now: Date,
  codes: ClaimLockCodes,
): void {
  if (!record.lockedByAdminId) {
    throw new ConflictException({ code: codes.required.code, message: codes.required.message });
  }
  if (record.lockedByAdminId !== adminId) {
    throw new ConflictException({ code: codes.conflict.code, message: codes.conflict.message });
  }
  if (!record.lockExpiresAt || new Date(record.lockExpiresAt).getTime() <= now.getTime()) {
    throw new ConflictException({ code: codes.expired.code, message: codes.expired.message });
  }
}

/**
 * Resolves every active lock holder in **one** query — never an N+1 per queue row. Expired
 * leases are filtered out here so the caller only pays for names it will actually render.
 */
export async function resolveClaimLockHolderNames(
  client: AdminUserLookupClient,
  records: ClaimLockableRecord[],
  now: Date,
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(
      records
        .filter(
          (record) =>
            record.lockedByAdminId &&
            record.lockExpiresAt &&
            new Date(record.lockExpiresAt).getTime() > now.getTime(),
        )
        .map((record) => record.lockedByAdminId as string),
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
