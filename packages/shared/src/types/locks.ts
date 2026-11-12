/**
 * AD-10: the 15-minute claim lease shared by every admin work queue.
 *
 * Declared once here and projected identically across all 8 operational queues (Story 8.3),
 * so `readLockHolderName` and the countdown banners never have to branch on which record
 * they are looking at.
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

/**
 * Story 8.3 / AD-10 / FR-51: The 8 canonical claimable operational queues.
 */
export type OperationalQueueType =
  | 'LISTING'
  | 'FAL_PROFILE'
  | 'OWNER_REQUEST'
  | 'PAYMENT'
  | 'CONTRACT_FEE'
  | 'CONVERSATION'
  | 'DISPUTE'
  | 'OFFER';

export type OperationalQueueSlug =
  | 'listings'
  | 'licenses'
  | 'fal-profiles'
  | 'owner-requests'
  | 'payments'
  | 'contract-fees'
  | 'conversations'
  | 'inquiries'
  | 'disputes'
  | 'offers';

export type OperationalQueueLockFilterState =
  | 'ALL'
  | 'LOCKED'
  | 'UNLOCKED'
  | 'MY_CLAIMS'
  | 'LOCKED_BY_ME'
  | 'LOCKED_BY_OTHER';

export interface OperationalQueueMetadata {
  queueType: OperationalQueueType;
  slug: OperationalQueueSlug;
  primarySlug: OperationalQueueSlug;
  aliasSlugs: OperationalQueueSlug[];
  labelAr: string;
  descriptionAr: string;
  adminWorkspaceHref: string;
  reviewPermission: string;
  viewPermissions: string[];
  claimPermissions: string[];
}

export interface OperationalQueueItemSummary {
  id: string;
  queue: OperationalQueueType;
  queueType: OperationalQueueType;
  queueSlug: OperationalQueueSlug;
  queueLabelAr?: string;
  referenceCode: string;
  referenceNumber?: string;
  titleAr: string;
  subtitleAr?: string;
  status: string;
  statusLabelAr?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  workspaceHref: string;
  lockInfo: ClaimLockInfo;
}

export interface OperationalQueueCounts {
  queue: OperationalQueueType;
  queueType?: OperationalQueueType;
  queueSlug?: OperationalQueueSlug;
  labelAr?: string;
  descriptionAr?: string;
  adminWorkspaceHref?: string;
  totalOpen: number;
  unlocked: number;
  lockedByMe: number;
  lockedByOther: number;
  totalPending?: number;
  activelyLocked?: number;
  lockedByCurrentAdmin?: number;
  unlockedAvailable?: number;
}

export interface OperationalQueuesHubResponse {
  serverNow?: string;
  serverTimestamp?: string;
  leaseDurationSeconds: number;
  heartbeatIntervalSeconds: number;
  summary?: {
    totalPending: number;
    activelyLocked: number;
    lockedByCurrentAdmin: number;
    unlockedAvailable: number;
  };
  counts: OperationalQueueCounts[];
  queues?: OperationalQueueCounts[];
  items: OperationalQueueItemSummary[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
