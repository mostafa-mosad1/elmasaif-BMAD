/**
 * AD-10: the 15-minute claim lease shared by every admin work queue.
 *
 * Declared once here and projected identically by the offer queue (Story 4.2) and the inquiry
 * conversation queue (Story 4.4), so `readLockHolderName` and the countdown banners never have
 * to branch on which record they are looking at.
 */
export interface ClaimLockInfo {
  isLocked: boolean;
  isLockedByCurrentAdmin: boolean;
  lockedByAdminId: string | null;
  lockedByAdminName: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  remainingSeconds: number;
}

/** Story 4.2's name for this exact projection — an alias, never a second declaration. */
export type OfferLockInfo = ClaimLockInfo;
