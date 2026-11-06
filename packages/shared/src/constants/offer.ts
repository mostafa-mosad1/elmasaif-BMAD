import { OfferStatus } from '../enums';

// Buyer Offer Intake constants (Story 4.1 / FR-25, BR-11, A-07, FR-14)
export const OFFER_LISTING_NOT_FOUND = 'OFFER_LISTING_NOT_FOUND';
export const OFFER_LISTING_NOT_OFFERABLE = 'OFFER_LISTING_NOT_OFFERABLE';
export const OFFER_PRICE_OUT_OF_RANGE = 'OFFER_PRICE_OUT_OF_RANGE';
export const OFFER_LOW_PRICE_CONFIRMATION_REQUIRED = 'OFFER_LOW_PRICE_CONFIRMATION_REQUIRED';
export const OFFER_ACTIVE_EXISTS = 'OFFER_ACTIVE_EXISTS';
export const OFFER_SELF_SUBMISSION_FORBIDDEN = 'OFFER_SELF_SUBMISSION_FORBIDDEN';
export const OFFER_BUYER_PROFILE_REQUIRED = 'OFFER_BUYER_PROFILE_REQUIRED';

// Declared for Story 4.2's admin/seller offer endpoints; intentionally unused in 4.1.
export const OFFER_NOT_FOUND = 'OFFER_NOT_FOUND';

/** BR-11: an offer below this share of the ask price needs the buyer's explicit acknowledgement. */
export const LOW_PRICE_THRESHOLD_PERCENT = 0.5;

/**
 * An offer is "active" while it is non-terminal AND unexpired. The expiry clause is evaluated
 * against `ClockService.now()` in the service, never against a bare `Date.now()`.
 */
export const ACTIVE_OFFER_STATUSES: readonly OfferStatus[] = [
  OfferStatus.PENDING_ADMIN_REVIEW,
  OfferStatus.SUBMITTED,
  OfferStatus.IN_REVIEW,
  OfferStatus.RELAYED_TO_SELLER,
  OfferStatus.COUNTER_OFFERED,
  OfferStatus.ACCEPTED_BY_SELLER,
  OfferStatus.ACCEPTED_BY_BUYER,
];

export const TERMINAL_OFFER_STATUSES: readonly OfferStatus[] = [
  OfferStatus.REJECTED_BY_SELLER,
  OfferStatus.EXPIRED,
  OfferStatus.WITHDRAWN,
];

export const OFFER_STATUS_LABELS_AR: Record<OfferStatus, string> = {
  [OfferStatus.PENDING_ADMIN_REVIEW]: 'قيد المراجعة الإدارية',
  [OfferStatus.SUBMITTED]: 'مُقدَّم',
  [OfferStatus.IN_REVIEW]: 'قيد المراجعة',
  [OfferStatus.RELAYED_TO_SELLER]: 'عُرض على البائع',
  [OfferStatus.ACCEPTED_BY_SELLER]: 'مقبول من البائع',
  [OfferStatus.REJECTED_BY_SELLER]: 'مرفوض من البائع',
  [OfferStatus.COUNTER_OFFERED]: 'عرض مضاد',
  [OfferStatus.ACCEPTED_BY_BUYER]: 'مقبول من المشتري',
  [OfferStatus.EXPIRED]: 'منتهي الصلاحية',
  [OfferStatus.WITHDRAWN]: 'مسحوب',
};
