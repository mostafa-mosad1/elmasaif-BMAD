import { OfferStatus } from '../enums';

// Buyer Offer Intake constants (Story 4.1 / FR-25, BR-11, A-07, FR-14)
export const OFFER_LISTING_NOT_FOUND = 'OFFER_LISTING_NOT_FOUND';
export const OFFER_LISTING_NOT_OFFERABLE = 'OFFER_LISTING_NOT_OFFERABLE';
export const OFFER_PRICE_OUT_OF_RANGE = 'OFFER_PRICE_OUT_OF_RANGE';
export const OFFER_LOW_PRICE_CONFIRMATION_REQUIRED = 'OFFER_LOW_PRICE_CONFIRMATION_REQUIRED';
export const OFFER_ACTIVE_EXISTS = 'OFFER_ACTIVE_EXISTS';
export const OFFER_SELF_SUBMISSION_FORBIDDEN = 'OFFER_SELF_SUBMISSION_FORBIDDEN';
export const OFFER_BUYER_PROFILE_REQUIRED = 'OFFER_BUYER_PROFILE_REQUIRED';

// Negotiation / mediation error codes (Story 4.2 / FR-26, FR-55, AD-10)
export const OFFER_NOT_FOUND = 'OFFER_NOT_FOUND';
export const OFFER_NOT_PARTY = 'OFFER_NOT_PARTY';
export const OFFER_SELLER_PROFILE_REQUIRED = 'OFFER_SELLER_PROFILE_REQUIRED';
export const OFFER_INVALID_STATE_TRANSITION = 'OFFER_INVALID_STATE_TRANSITION';
export const OFFER_ALREADY_EXPIRED = 'OFFER_ALREADY_EXPIRED';
export const OFFER_MAX_ROUNDS_REACHED = 'OFFER_MAX_ROUNDS_REACHED';
export const OFFER_COUNTER_PRICE_OUT_OF_RANGE = 'OFFER_COUNTER_PRICE_OUT_OF_RANGE';
export const OFFER_REJECTION_REASON_REQUIRED = 'OFFER_REJECTION_REASON_REQUIRED';
export const OFFER_REJECTION_NOTE_REQUIRED = 'OFFER_REJECTION_NOTE_REQUIRED';
export const OFFER_LOCK_REQUIRED = 'OFFER_LOCK_REQUIRED';
export const OFFER_LOCK_CONFLICT = 'OFFER_LOCK_CONFLICT';
export const OFFER_LOCK_EXPIRED = 'OFFER_LOCK_EXPIRED';
export const OFFER_FORCE_UNLOCK_REASON_REQUIRED = 'OFFER_FORCE_UNLOCK_REASON_REQUIRED';

// Backup offer pipeline error codes (Story 4.3 / FR-27, OQ-04)
export const OFFER_BACKUP_NOT_QUEUED = 'OFFER_BACKUP_NOT_QUEUED';
export const OFFER_BACKUP_ALREADY_ACTIVATED = 'OFFER_BACKUP_ALREADY_ACTIVATED';
export const OFFER_BACKUP_PRIMARY_DEAL_ACTIVE = 'OFFER_BACKUP_PRIMARY_DEAL_ACTIVE';
export const OFFER_BACKUP_LISTING_UNAVAILABLE = 'OFFER_BACKUP_LISTING_UNAVAILABLE';

/** BR-11: an offer below this share of the ask price needs the buyer's explicit acknowledgement. */
export const LOW_PRICE_THRESHOLD_PERCENT = 0.5;

/**
 * FR-26 / FR-55: negotiation stops after this many counter-offer rounds. The cap applies
 * identically to buyer and seller counters; accepting is always still allowed at the cap.
 */
export const MAX_COUNTER_ROUNDS = 5;

/** AD-10: the offer mediation lease length, matching the listing moderation queue. */
export const OFFER_LOCK_DURATION_MS = 15 * 60 * 1000;

/** AD-10: the mediation workspace renews its claim at this cadence. */
export const OFFER_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

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
  OfferStatus.RELAYED_TO_BUYER,
  OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
];

export const TERMINAL_OFFER_STATUSES: readonly OfferStatus[] = [
  OfferStatus.REJECTED_BY_SELLER,
  OfferStatus.REJECTED_BY_ADMIN,
  OfferStatus.EXPIRED,
  OfferStatus.WITHDRAWN,
  OfferStatus.CLOSED_BACKUP,
  // Story 5.1: the deal now owns the transaction. Terminal, otherwise the winning offer keeps
  // `OFFER_ACTIVE_EXISTS` rejecting the buyer's next offer and stays claimable for mediation.
  OfferStatus.CONVERTED_TO_DEAL,
];

/**
 * FR-26 / AD-7 job #2 — the set the 7-day sweep is allowed to kill. It is `ACTIVE_OFFER_STATUSES`
 * minus `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`: a mutually-agreed offer is *answered*, not
 * unanswered, so it must survive until Story 5.1 binds it into a `Deal` (the same exclusion
 * `demand-expiry-checker` applies to selected proposals). Declared as an explicit literal list
 * rather than computed by filtering, so the sweep's target set is greppable and directly
 * assertable in tests.
 *
 * FR-27 boundary (Story 4.3): a backup offer sitting in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL`
 * is held *in reserve* for as long as the primary transaction runs — it is not awaiting a reply —
 * so it must never be added here: the sweep would silently kill reserve bids on long deals. It
 * leaves the reserve only through admin activation or closure of the winning deal.
 */
export const EXPIRABLE_OFFER_STATUSES: readonly OfferStatus[] = [
  OfferStatus.PENDING_ADMIN_REVIEW,
  OfferStatus.SUBMITTED,
  OfferStatus.IN_REVIEW,
  OfferStatus.RELAYED_TO_SELLER,
  OfferStatus.COUNTER_OFFERED,
  OfferStatus.ACCEPTED_BY_SELLER,
  OfferStatus.ACCEPTED_BY_BUYER,
  OfferStatus.RELAYED_TO_BUYER,
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
  [OfferStatus.RELAYED_TO_BUYER]: 'معروض على المشتري',
  [OfferStatus.REJECTED_BY_ADMIN]: 'مرفوض إدارياً',
  [OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL]: 'معتمد — بانتظار الموافقة النهائية',
  [OfferStatus.CLOSED_BACKUP]: 'مغلق — اكتملت الصفقة الأساسية',
  [OfferStatus.CONVERTED_TO_DEAL]: 'محوَّل إلى صفقة',
};

/**
 * FR-55: the seller's structured rejection reason. Stored in a plain `String?` column (the
 * value is display/analytics only) rather than a new Postgres enum, which keeps `db push`
 * strictly additive.
 */
export const OFFER_REJECTION_REASONS = [
  'PRICE_TOO_LOW',
  'FINANCING_UNAVAILABLE',
  'PROPERTY_UNAVAILABLE',
  'TERMS_MISMATCH',
  'OTHER',
] as const;

export type OfferRejectionReason = (typeof OFFER_REJECTION_REASONS)[number];

export const OFFER_REJECTION_REASON_LABELS_AR: Record<OfferRejectionReason, string> = {
  PRICE_TOO_LOW: 'السعر أقل من المتوقع',
  FINANCING_UNAVAILABLE: 'تعذر التمويل',
  PROPERTY_UNAVAILABLE: 'العقار لم يعد متاحاً',
  TERMS_MISMATCH: 'شروط الصفقة غير متوافقة',
  OTHER: 'سبب آخر',
};

/**
 * UX-DR-10 / UX-DR-13 negotiation timeline action codes. The values are `OFFER_`-prefixed and
 * match the literal rows Story 4.1 already writes (`'OFFER_SUBMITTED'`), so adopting them is a
 * no-op for existing data and for the 4.1 spec assertions.
 */
export const OFFER_HISTORY_ACTIONS = {
  SUBMITTED: 'OFFER_SUBMITTED',
  RELAYED_TO_SELLER: 'OFFER_RELAYED_TO_SELLER',
  ACCEPTED_BY_SELLER: 'OFFER_ACCEPTED_BY_SELLER',
  REJECTED_BY_SELLER: 'OFFER_REJECTED_BY_SELLER',
  COUNTER_BY_SELLER: 'OFFER_COUNTER_BY_SELLER',
  RELAYED_TO_BUYER: 'OFFER_RELAYED_TO_BUYER',
  ACCEPTED_BY_BUYER: 'OFFER_ACCEPTED_BY_BUYER',
  COUNTER_BY_BUYER: 'OFFER_COUNTER_BY_BUYER',
  REJECTED_BY_ADMIN: 'OFFER_REJECTED_BY_ADMIN',
  EXPIRED: 'OFFER_EXPIRED',
  BACKUP_ACTIVATED: 'OFFER_BACKUP_ACTIVATED',
  BACKUP_CLOSED: 'OFFER_BACKUP_CLOSED',
  // Story 5.1: the approved offer became a Deal (`Deals.FinalApprove`).
  CONVERTED_TO_DEAL: 'OFFER_CONVERTED_TO_DEAL',
} as const;

export type OfferHistoryAction =
  (typeof OFFER_HISTORY_ACTIONS)[keyof typeof OFFER_HISTORY_ACTIONS];

export const OFFER_HISTORY_ACTION_LABELS_AR: Record<OfferHistoryAction, string> = {
  OFFER_SUBMITTED: 'تقديم العرض',
  OFFER_RELAYED_TO_SELLER: 'إحالة العرض إلى البائع',
  OFFER_ACCEPTED_BY_SELLER: 'قبول البائع للعرض',
  OFFER_REJECTED_BY_SELLER: 'رفض البائع للعرض',
  OFFER_COUNTER_BY_SELLER: 'عرض مقابل من البائع',
  OFFER_RELAYED_TO_BUYER: 'إحالة العرض المضاد إلى المشتري',
  OFFER_ACCEPTED_BY_BUYER: 'قبول المشتري للعرض',
  OFFER_COUNTER_BY_BUYER: 'عرض مقابل من المشتري',
  OFFER_REJECTED_BY_ADMIN: 'رفض إداري للعرض',
  OFFER_EXPIRED: 'انتهاء صلاحية العرض',
  OFFER_BACKUP_ACTIVATED: 'تفعيل عرض احتياطي',
  OFFER_BACKUP_CLOSED: 'إغلاق عرض احتياطي بعد اكتمال الصفقة الأساسية',
  OFFER_CONVERTED_TO_DEAL: 'تحويل العرض المعتمد إلى صفقة',
};

/** Story 4.3 / OQ-04: display order of the backup queue groups, surfaced first. */
export const BACKUP_QUEUE_STATES = ['SURFACED', 'QUEUED', 'FROZEN', 'CLOSABLE'] as const;

export type BackupOfferQueueState = (typeof BACKUP_QUEUE_STATES)[number];

export const BACKUP_QUEUE_STATE_LABELS_AR: Record<BackupOfferQueueState, string> = {
  SURFACED: 'جاهز للتفعيل',
  QUEUED: 'في الانتظار',
  FROZEN: 'مجمّد — العقار غير متاح',
  CLOSABLE: 'جاهز للإغلاق',
};

/**
 * The single sort key shared by the API and the UI, so the two can never disagree about the
 * order of the groups (FR-27 / OQ-04: the surfaced queue is always read first).
 */
export const BACKUP_QUEUE_STATE_ORDER: Record<BackupOfferQueueState, number> = {
  SURFACED: 0,
  QUEUED: 1,
  FROZEN: 2,
  CLOSABLE: 3,
};

/** UX-DR-10: the «بانتظار» chip shown next to a live offer. */
export const OFFER_AWAITING_PARTY_LABELS_AR = {
  ADMIN: 'بانتظار الإدارة',
  SELLER: 'بانتظار البائع',
  BUYER: 'بانتظار المشتري',
} as const;
