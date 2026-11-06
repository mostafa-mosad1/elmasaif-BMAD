import { InquiryAuthorRole, InquiryStatus } from '../enums';
import type { InquiryAwaitingParty } from '../types/inquiry';
import type { StatusBadgeVariant } from '../types/ui';

// Mediated listing inquiry error codes (Story 4.4 / FR-35, FR-51, AD-10)
export const INQUIRY_LISTING_NOT_FOUND = 'INQUIRY_LISTING_NOT_FOUND';
export const INQUIRY_LISTING_NOT_INQUIRABLE = 'INQUIRY_LISTING_NOT_INQUIRABLE';
export const INQUIRY_SELF_SUBMISSION_FORBIDDEN = 'INQUIRY_SELF_SUBMISSION_FORBIDDEN';
export const INQUIRY_BUYER_PROFILE_REQUIRED = 'INQUIRY_BUYER_PROFILE_REQUIRED';
export const INQUIRY_SELLER_PROFILE_REQUIRED = 'INQUIRY_SELLER_PROFILE_REQUIRED';
export const INQUIRY_NOT_FOUND = 'INQUIRY_NOT_FOUND';
export const INQUIRY_NOT_PARTY = 'INQUIRY_NOT_PARTY';
export const INQUIRY_INVALID_STATE_TRANSITION = 'INQUIRY_INVALID_STATE_TRANSITION';
export const INQUIRY_MESSAGE_TOO_LONG = 'INQUIRY_MESSAGE_TOO_LONG';
export const INQUIRY_CLOSED = 'INQUIRY_CLOSED';
export const INQUIRY_CLOSE_REASON_REQUIRED = 'INQUIRY_CLOSE_REASON_REQUIRED';
export const INQUIRY_ATTACHMENT_LIMIT_EXCEEDED = 'INQUIRY_ATTACHMENT_LIMIT_EXCEEDED';
export const INQUIRY_ATTACHMENT_NOT_FOUND = 'INQUIRY_ATTACHMENT_NOT_FOUND';
export const INQUIRY_ATTACHMENT_NOT_OWNED = 'INQUIRY_ATTACHMENT_NOT_OWNED';
export const INQUIRY_ATTACHMENT_NOT_CLEAN = 'INQUIRY_ATTACHMENT_NOT_CLEAN';
export const INQUIRY_LOCK_REQUIRED = 'INQUIRY_LOCK_REQUIRED';
export const INQUIRY_LOCK_CONFLICT = 'INQUIRY_LOCK_CONFLICT';
export const INQUIRY_LOCK_EXPIRED = 'INQUIRY_LOCK_EXPIRED';
export const INQUIRY_FORCE_UNLOCK_REASON_REQUIRED = 'INQUIRY_FORCE_UNLOCK_REASON_REQUIRED';
export const INQUIRY_FORCE_UNLOCK_REASON_MISSING = 'INQUIRY_FORCE_UNLOCK_REASON_MISSING';

/** AC-2: a buyer may attach at most five files to one inquiry message. */
export const MAX_INQUIRY_ATTACHMENTS = 5;

/** AC-1: the inquiry body bounds enforced by the Zod schema and re-checked by the service. */
export const INQUIRY_MESSAGE_MIN_LENGTH = 1;
export const INQUIRY_MESSAGE_MAX_LENGTH = 2000;

/** The optional subject line shown in the queue rows. */
export const INQUIRY_SUBJECT_MAX_LENGTH = 200;

/** AD-10: the conversation-queue lease length, matching the other claim-locked queues. */
export const INQUIRY_LOCK_DURATION_MS = 15 * 60 * 1000;

/** AD-10: the workspace renews its claim at this cadence. */
export const INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The statuses that put a thread in the admin conversation queue — exactly the states where the
 * platform owes the conversation a relay. Kept out of the controller so the API and the UI can
 * never disagree about queue membership.
 */
export const INQUIRY_QUEUE_STATUSES: readonly InquiryStatus[] = [
  InquiryStatus.PENDING_ADMIN_REVIEW,
  InquiryStatus.SELLER_RESPONDED,
];

/**
 * Claim legality is a superset of queue membership: closing a thread mid-relay, or holding the
 * lease while a relay is in flight, still requires the lease (the same split as Story 4.3).
 */
export const CLAIMABLE_INQUIRY_STATUSES: readonly InquiryStatus[] = [
  InquiryStatus.PENDING_ADMIN_REVIEW,
  InquiryStatus.RELAYED_TO_SELLER,
  InquiryStatus.SELLER_RESPONDED,
  InquiryStatus.RELAYED_TO_BUYER,
];

/** The buyer may open a follow-up from these statuses; the seller only from a relayed state. */
export const BUYER_FOLLOW_UP_STATUSES: readonly InquiryStatus[] = [
  InquiryStatus.PENDING_ADMIN_REVIEW,
  InquiryStatus.RELAYED_TO_BUYER,
];

export const INQUIRY_STATUS_LABELS_AR: Record<InquiryStatus, string> = {
  [InquiryStatus.PENDING_ADMIN_REVIEW]: 'بانتظار الوساطة الإدارية',
  [InquiryStatus.RELAYED_TO_SELLER]: 'أُحيل إلى البائع',
  [InquiryStatus.SELLER_RESPONDED]: 'ردّ البائع — بانتظار الإحالة',
  [InquiryStatus.RELAYED_TO_BUYER]: 'أُحيل الرد إلى المشتري',
  [InquiryStatus.CLOSED]: 'مغلق',
};

/**
 * Exhaustive on purpose: when `InquiryStatus` grows, this map fails to compile — the same
 * guard Story 4.2 uses for offers.
 */
export const INQUIRY_STATUS_BADGE_VARIANTS: Record<InquiryStatus, StatusBadgeVariant> = {
  [InquiryStatus.PENDING_ADMIN_REVIEW]: 'pending',
  [InquiryStatus.RELAYED_TO_SELLER]: 'info',
  [InquiryStatus.SELLER_RESPONDED]: 'pending',
  [InquiryStatus.RELAYED_TO_BUYER]: 'verified',
  [InquiryStatus.CLOSED]: 'neutral',
};

export const INQUIRY_AUTHOR_LABELS_AR: Record<InquiryAuthorRole, string> = {
  [InquiryAuthorRole.BUYER]: 'المشتري',
  [InquiryAuthorRole.SELLER]: 'البائع',
  [InquiryAuthorRole.ADMIN]: 'الإدارة',
};

/** Shown on the thread banner so both parties always know who owes the next step. */
export const INQUIRY_AWAITING_PARTY_LABELS_AR: Record<InquiryAwaitingParty, string> = {
  ADMIN: 'بانتظار الوسيط',
  SELLER: 'بانتظار رد البائع',
  BUYER: 'بانتظار رد المشتري',
};

/** D9: every audit action the inquiry module may emit. */
export const INQUIRY_AUDIT_ACTIONS = {
  SUBMITTED: 'INQUIRY_SUBMITTED',
  MESSAGE_ADDED: 'INQUIRY_MESSAGE_ADDED',
  CONTACT_MASKED: 'INQUIRY_CONTACT_MASKED',
  RELAYED_TO_SELLER: 'INQUIRY_RELAYED_TO_SELLER',
  RELAYED_TO_BUYER: 'INQUIRY_RELAYED_TO_BUYER',
  CLOSED: 'INQUIRY_CLOSED',
  MODERATION_CLAIMED: 'INQUIRY_MODERATION_CLAIMED',
  MODERATION_RELEASED: 'INQUIRY_MODERATION_RELEASED',
  MODERATION_FORCE_UNLOCKED: 'INQUIRY_MODERATION_FORCE_UNLOCKED',
} as const;

export type InquiryAuditAction = (typeof INQUIRY_AUDIT_ACTIONS)[keyof typeof INQUIRY_AUDIT_ACTIONS];
