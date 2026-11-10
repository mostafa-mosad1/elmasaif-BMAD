import { DealStatus, PaymentType } from '../enums';
import type { StatusBadgeVariant } from '../types/ui';
import {
  DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS,
  DEAL_PAYMENT_DEADLINE_HOURS,
  PLATFORM_COMMISSION_PERCENTAGE,
} from './index';

/*
 * Deal binding constants (Story 5.1 / FR-28, FR-29, BR-02, BR-07, AD-3, AD-4).
 */

// Final-approval refusal codes — shared so the API, the web hint table and the specs agree.
export const DEAL_ALREADY_ACTIVE_FOR_LISTING = 'DEAL_ALREADY_ACTIVE_FOR_LISTING';
export const DEAL_SELLER_PAYOUT_REQUIRED = 'DEAL_SELLER_PAYOUT_REQUIRED';
export const DEAL_LISTING_UNAVAILABLE = 'DEAL_LISTING_UNAVAILABLE';

/**
 * BR-07 / AD-4: the statuses that make a listing "already under deal".
 *
 * This is the exact complement of the terminal set, and it must stay in lock-step with the SQL
 * predicate of the `deal_single_active_listing` partial index
 * (`apps/api/prisma/sql/deal-invariants.sql`), which is written as `NOT IN (terminal…)` precisely
 * so a future non-terminal status is covered automatically. The index — not this list — is the
 * real guarantee; this list only drives the friendly pre-check and the account/payout guards.
 */
export const ACTIVE_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.AWAITING_PAYMENT_PROOF,
  DealStatus.UNDER_ADMIN_AUDIT,
  DealStatus.PAYMENT_REJECTED,
  DealStatus.DISPUTED,
];

/** BR-07 / AD-4: a deal in one of these statuses no longer blocks a second deal for the listing. */
export const TERMINAL_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.COMPLETED,
  DealStatus.CANCELLED,
  DealStatus.TERMINATED,
];

/**
 * OQ-02: 2.5 % + 0 SAR today. Both are frozen into the Deal row at creation and are therefore
 * immutable afterwards, so changing them never rewrites history (Story 8.6 makes them
 * configurable — `DEFAULT_*` are the fallbacks that apply until then).
 */
export const DEFAULT_COMMISSION_RATE = PLATFORM_COMMISSION_PERCENTAGE;
export const DEFAULT_FIXED_COMMISSION_SAR = '0.00';
export const DEFAULT_PAYMENT_WINDOW_HOURS = DEAL_PAYMENT_DEADLINE_HOURS;

// Human-facing identifiers. `DL-yyyyMMdd-XXXXXXXXXX` is the internal number, `ELM-XXXXXXXXXX-C`
// the code the buyer types into a bank transfer (UX journey 1: `ELM-408-C`).
export const DEAL_NUMBER_PREFIX = 'DL';
export const DEAL_REFERENCE_PREFIX = 'ELM';
export const DEAL_REFERENCE_SUFFIX = 'C';
export const DEAL_SHORT_CODE_LENGTH = 10;

/*
 * Story 5.2 — the buyer payment plan (FR-29, FR-30, NFR-13, UX-DR4, UX-DR5).
 */

// Buyer-facing refusal codes. Shared so the API, the web hint table and the specs agree.
export const DEAL_NOT_FOUND = 'DEAL_NOT_FOUND';
export const DEAL_NOT_PARTY = 'DEAL_NOT_PARTY';
export const DEAL_BUYER_PROFILE_REQUIRED = 'DEAL_BUYER_PROFILE_REQUIRED';
export const DEAL_TERMINAL = 'DEAL_TERMINAL';
export const DEAL_PAYMENT_DEADLINE_PASSED = 'DEAL_PAYMENT_DEADLINE_PASSED';
export const DEAL_PAYMENT_REVIEW_COMPLETE = 'DEAL_PAYMENT_REVIEW_COMPLETE';
export const DEAL_PAYMENT_TYPE_INVALID = 'DEAL_PAYMENT_TYPE_INVALID';
export const DEAL_IDENTITY_REQUIRED = 'DEAL_IDENTITY_REQUIRED';
export const DEAL_PLATFORM_ACCOUNT_UNAVAILABLE = 'DEAL_PLATFORM_ACCOUNT_UNAVAILABLE';
export const DEAL_PAYMENT_PROOF_REQUIRED = 'DEAL_PAYMENT_PROOF_REQUIRED';
export const DEAL_PAYMENT_PROOF_TOO_LARGE = 'DEAL_PAYMENT_PROOF_TOO_LARGE';
export const DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE = 'DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE';
export const DEAL_PAYMENT_PROOF_INFECTED = 'DEAL_PAYMENT_PROOF_INFECTED';
export const DEAL_PAYMENT_PROOF_NOT_FOUND = 'DEAL_PAYMENT_PROOF_NOT_FOUND';
export const DEAL_PAYMENT_PROOF_SCAN_FAILED = 'DEAL_PAYMENT_PROOF_SCAN_FAILED';

/**
 * The `payments` partition of a deal carries exactly two slots. `OWNER_CONTRACT_FEE` is a Story 7.3
 * payment type and is never a deal payment — every entry point rejects it with
 * `DEAL_PAYMENT_TYPE_INVALID`.
 */
export const DEAL_PAYMENT_TYPES = [
  PaymentType.PLATFORM_COMMISSION,
  PaymentType.SELLER_PURCHASE_PRICE,
] as const;

export type DealPaymentType = (typeof DEAL_PAYMENT_TYPES)[number];

/**
 * The canonical `Payment.status` vocabulary (the column is a `String` by an earlier decision, so
 * nothing type-checks the write — always assert against this object, never a literal).
 *
 * `PENDING → PROOF_UPLOADED → (5.3) UNDER_REVIEW → CONFIRMED | REJECTED`; `REJECTED` re-enters
 * `PROOF_UPLOADED` on a re-upload; `EXPIRED` is 5.5's terminal timeout state.
 */
export const DEAL_PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROOF_UPLOADED: 'PROOF_UPLOADED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export type DealPaymentStatus = (typeof DEAL_PAYMENT_STATUS)[keyof typeof DEAL_PAYMENT_STATUS];

/**
 * FR-30: the only three states in which the buyer may still upload or replace a receipt. The
 * remaining three are locked while an administrator owns the decision (`UNDER_REVIEW`,
 * `CONFIRMED`) or the window is gone (`EXPIRED`).
 */
export const UPLOADABLE_PAYMENT_STATUSES: readonly DealPaymentStatus[] = [
  DEAL_PAYMENT_STATUS.PENDING,
  DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
  DEAL_PAYMENT_STATUS.REJECTED,
];

/**
 * FR-30 lists exactly three receipt formats. `ALLOWED_UPLOAD_MIME_TYPES` additionally accepts
 * WebP, so a receipt must be re-validated against *this* list before it reaches the storage hook.
 */
export const DEAL_PAYMENT_PROOF_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type DealPaymentProofMimeType = (typeof DEAL_PAYMENT_PROOF_MIME_TYPES)[number];

/** The Arabic name of each payment slot, as printed on the two wire-transfer cards. */
export const DEAL_PAYMENT_TYPE_LABELS_AR: Record<DealPaymentType, string> = {
  [PaymentType.PLATFORM_COMMISSION]: 'سعي المنصة',
  [PaymentType.SELLER_PURCHASE_PRICE]: 'قيمة العقار للبائع',
};

/** Exhaustive on purpose: a new `Payment.status` member breaks `tsc` until it is labelled. */
export const DEAL_PAYMENT_STATUS_LABELS_AR: Record<DealPaymentStatus, string> = {
  [DEAL_PAYMENT_STATUS.PENDING]: 'بانتظار التحويل',
  [DEAL_PAYMENT_STATUS.PROOF_UPLOADED]: 'تم رفع الإيصال - قيد المراجعة',
  [DEAL_PAYMENT_STATUS.UNDER_REVIEW]: 'قيد التدقيق الإداري',
  [DEAL_PAYMENT_STATUS.CONFIRMED]: 'مؤكد',
  [DEAL_PAYMENT_STATUS.REJECTED]: 'مرفوض - يلزم إعادة الرفع',
  [DEAL_PAYMENT_STATUS.EXPIRED]: 'منتهي',
};

export const DEAL_STATUS_LABELS_AR: Record<DealStatus, string> = {
  [DealStatus.AWAITING_PAYMENT_PROOF]: 'بانتظار إثبات الدفع',
  [DealStatus.UNDER_ADMIN_AUDIT]: 'قيد التدقيق الإداري',
  [DealStatus.PAYMENT_REJECTED]: 'إثبات مرفوض',
  [DealStatus.DISPUTED]: 'متنازع عليها',
  [DealStatus.COMPLETED]: 'مكتملة',
  [DealStatus.CANCELLED]: 'ملغاة',
  [DealStatus.TERMINATED]: 'منتهية',
};

export const DEAL_STATUS_DESCRIPTIONS_AR: Record<DealStatus, string> = {
  [DealStatus.AWAITING_PAYMENT_PROOF]: 'بانتظار قيام المشتري برفع إيصالات السداد البنكي خلال المهلة المحددة',
  [DealStatus.UNDER_ADMIN_AUDIT]: 'الإيصالات مرفوعة وبانتظار اعتماد ومطابقة التدقيق الإداري للمنصة',
  [DealStatus.PAYMENT_REJECTED]: 'تم رفض أحد الإيصالات، والمشتري في مهلة تصحيح لإعادة الرفع',
  [DealStatus.DISPUTED]: 'تم تقديم نزاع رسمي على الصفقة، والمهل الزمنية معلقة لحين البت الإداري',
  [DealStatus.COMPLETED]: 'تم توثيق السداد بالكامل واعتماد الصفقة بنجاح وإتاحة بيانات الإفراغ',
  [DealStatus.CANCELLED]: 'تم إلغاء الصفقة قبل السداد أو لانتهاء المهلة الزمنية',
  [DealStatus.TERMINATED]: 'تم إنهاء الصفقة وإغلاقها بقرار إداري بعد البت في النزاع',
};

/** Same guard as `INQUIRY_STATUS_BADGE_VARIANTS`: exhaustive, never `Record<string, …>`. */
export const DEAL_PAYMENT_STATUS_VARIANTS: Record<DealPaymentStatus, StatusBadgeVariant> = {
  [DEAL_PAYMENT_STATUS.PENDING]: 'pending',
  [DEAL_PAYMENT_STATUS.PROOF_UPLOADED]: 'info',
  [DEAL_PAYMENT_STATUS.UNDER_REVIEW]: 'info',
  [DEAL_PAYMENT_STATUS.CONFIRMED]: 'verified',
  [DEAL_PAYMENT_STATUS.REJECTED]: 'danger',
  [DEAL_PAYMENT_STATUS.EXPIRED]: 'neutral',
};

/*
 * Story 5.3 — the administrative proof-review queue (FR-31, FR-51, AD-10).
 */

// Admin-facing refusal codes — shared so the API, the web hint table and the specs agree.
// The `PAYMENT_LOCK_*` triple mirrors `OFFER_LOCK_*` / `LISTING_LOCK_*` / `INQUIRY_LOCK_*` byte
// for byte; `ERROR_FILE_QUARANTINED` (`constants/storage.ts`) is reused as-is for the preview gate.
export const PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND';
export const PAYMENT_NOT_CLAIMABLE = 'PAYMENT_NOT_CLAIMABLE';
export const PAYMENT_LOCK_REQUIRED = 'PAYMENT_LOCK_REQUIRED';
export const PAYMENT_LOCK_CONFLICT = 'PAYMENT_LOCK_CONFLICT';
export const PAYMENT_LOCK_EXPIRED = 'PAYMENT_LOCK_EXPIRED';
export const PAYMENT_FORCE_UNLOCK_REASON_REQUIRED = 'PAYMENT_FORCE_UNLOCK_REASON_REQUIRED';
export const PAYMENT_REJECTION_NOTE_REQUIRED = 'PAYMENT_REJECTION_NOTE_REQUIRED';
export const PAYMENT_SELF_APPROVAL_FORBIDDEN = 'PAYMENT_SELF_APPROVAL_FORBIDDEN';
export const PAYMENT_PROOF_NOT_FOUND = 'PAYMENT_PROOF_NOT_FOUND';

/** Audit log actions for payment proof review (AC-2, AC-3, AC-7). */
export const PAYMENT_PROOF_CLAIMED = 'PAYMENT_PROOF_CLAIMED';
export const PAYMENT_PROOF_CONFIRMED = 'PAYMENT_PROOF_CONFIRMED';
export const PAYMENT_PROOF_REJECTED = 'PAYMENT_PROOF_REJECTED';
export const PAYMENT_MODERATION_RELEASED = 'PAYMENT_MODERATION_RELEASED';
export const PAYMENT_LOCK_FORCE_UNLOCKED = 'PAYMENT_LOCK_FORCE_UNLOCKED';

/** AD-10: the proof-audit lease length, identical to every other claim-locked queue. */
export const PAYMENT_LOCK_DURATION_MS = 15 * 60 * 1000;

/** AD-10: the review workspace renews its claim at this cadence. */
export const PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * AC-1/AC-2: the queue membership and the claimable set are the same two statuses — a proof is
 * in the audit queue exactly while an admin decision is still owed on it. `PENDING` (nothing
 * uploaded), `CONFIRMED`, `REJECTED` and `EXPIRED` (5.5's terminal state) are not claimable.
 */
export const PAYMENT_CLAIMABLE_STATUSES: readonly DealPaymentStatus[] = [
  DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
  DEAL_PAYMENT_STATUS.UNDER_REVIEW,
];

/**
 * D1: `claim` advances `PROOF_UPLOADED → UNDER_REVIEW`, so only `UNDER_REVIEW` rows can carry a
 * Confirmed/Rejected decision. A `PROOF_UPLOADED` decision without a fresh claim is refused.
 */
export const PAYMENT_DECIDABLE_STATUSES: readonly DealPaymentStatus[] = [
  DEAL_PAYMENT_STATUS.UNDER_REVIEW,
];

/** FR-31 / AD-3: one correction window of 12 hours after an at/after-deadline rejection. */
export const PAYMENT_CORRECTION_GRACE_HOURS = DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS;

/*
 * Story 5.4 — Atomic Deal Completion, VAT Invoicing & Ratings (AC-1..AC-5).
 */

// Refusal codes
export const DEAL_NOT_COMPLETED = 'DEAL_NOT_COMPLETED';
export const DEAL_ALREADY_RATED = 'DEAL_ALREADY_RATED';
export const DEAL_RATING_SCORE_INVALID = 'DEAL_RATING_SCORE_INVALID';
export const DEAL_RATING_COMMENT_TOO_LONG = 'DEAL_RATING_COMMENT_TOO_LONG';
export const DEAL_RATING_NOT_PARTY = 'DEAL_RATING_NOT_PARTY';
export const INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND';

// Audit log action constants
export const DEAL_COMPLETED = 'DEAL_COMPLETED';
export const INVOICE_GENERATED = 'INVOICE_GENERATED';
export const RATING_SUBMITTED = 'RATING_SUBMITTED';

/*
 * Story 5.5 — Automated Payment Timeout Worker Job (FR-33, BR-07, AD-4, AD-7, AD-11, OQ-13).
 */
export const DEAL_CANCELLED_BY_TIMEOUT = 'DEAL_CANCELLED_BY_TIMEOUT';
export const PAYMENT_EXPIRED = 'PAYMENT_EXPIRED';
export const NOTIFICATION_DEAL_TIMEOUT_CANCELLED = 'deal.timeout_cancelled';
export const DEAL_CANCEL_REASON_PAYMENT_TIMEOUT = 'PAYMENT_DEADLINE_EXPIRED';

/*
 * Story 5.6 — Pre-Payment Cancellations & Dispute Adjudication (FR-34, FR-36, AD-3, AD-10, UC-29B, UC-29C, UC-46, UC-70C).
 */

// Refusal codes
export const DEAL_CANCEL_INVALID_STATE = 'DEAL_CANCEL_INVALID_STATE';
export const DEAL_CANCEL_PROOF_EXISTS = 'DEAL_CANCEL_PROOF_EXISTS';
export const DEAL_CANCEL_NOT_PARTY = 'DEAL_CANCEL_NOT_PARTY';
export const SELLER_CANCEL_REQUEST_PENDING = 'SELLER_CANCEL_REQUEST_PENDING';
export const SELLER_CANCEL_REQUEST_NOT_FOUND = 'SELLER_CANCEL_REQUEST_NOT_FOUND';
export const DISPUTE_PROOF_REQUIRED = 'DISPUTE_PROOF_REQUIRED';
export const DISPUTE_ALREADY_OPEN = 'DISPUTE_ALREADY_OPEN';
export const DISPUTE_NOT_FOUND = 'DISPUTE_NOT_FOUND';
export const DISPUTE_NOT_CLAIMABLE = 'DISPUTE_NOT_CLAIMABLE';
export const DISPUTE_LOCK_REQUIRED = 'DISPUTE_LOCK_REQUIRED';
export const DISPUTE_LOCK_CONFLICT = 'DISPUTE_LOCK_CONFLICT';
export const DISPUTE_LOCK_EXPIRED = 'DISPUTE_LOCK_EXPIRED';
export const DISPUTE_SELF_ADJUDICATION_FORBIDDEN = 'DISPUTE_SELF_ADJUDICATION_FORBIDDEN';
export const DISPUTE_ADJUDICATION_INVALID_ACTION = 'DISPUTE_ADJUDICATION_INVALID_ACTION';
export const DISPUTE_DEADLINE_EXTENSION_REQUIRED = 'DISPUTE_DEADLINE_EXTENSION_REQUIRED';
export const DISPUTE_FORCE_UNLOCK_REASON_REQUIRED = 'DISPUTE_FORCE_UNLOCK_REASON_REQUIRED';

// Audit log action constants
export const DEAL_CANCELLED_BY_BUYER = 'DEAL_CANCELLED_BY_BUYER';
export const SELLER_CANCELLATION_REQUESTED = 'SELLER_CANCELLATION_REQUESTED';
export const DEAL_CANCELLED_BY_SELLER = 'DEAL_CANCELLED_BY_SELLER';
export const SELLER_CANCELLATION_REJECTED = 'SELLER_CANCELLATION_REJECTED';
export const DEAL_DISPUTED = 'DEAL_DISPUTED';
export const DEAL_DISPUTE_CLAIMED = 'DEAL_DISPUTE_CLAIMED';
export const DEAL_DISPUTE_RESOLVED_COMPLETED = 'DEAL_DISPUTE_RESOLVED_COMPLETED';
export const DEAL_DISPUTE_RESOLVED_CANCELLED = 'DEAL_DISPUTE_RESOLVED_CANCELLED';
export const DEAL_DISPUTE_RETURNED_TO_REVIEW = 'DEAL_DISPUTE_RETURNED_TO_REVIEW';
export const DEAL_DISPUTE_SYSTEM_ESCALATION = 'DEAL_DISPUTE_SYSTEM_ESCALATION';
export const DEAL_DISPUTE_RELEASED = 'DEAL_DISPUTE_RELEASED';
export const DEAL_DISPUTE_FORCE_UNLOCKED = 'DEAL_DISPUTE_FORCE_UNLOCKED';

// Notification event constants
export const NOTIFICATION_DEAL_BUYER_CANCELLED = 'deal.buyer_cancelled';
export const NOTIFICATION_DEAL_SELLER_CANCELLATION_REQUESTED = 'deal.seller_cancellation_requested';
export const NOTIFICATION_DEAL_SELLER_CANCELLED = 'deal.seller_cancelled';
export const NOTIFICATION_DEAL_SELLER_CANCELLATION_REJECTED = 'deal.seller_cancellation_rejected';
export const NOTIFICATION_DEAL_DISPUTED = 'deal.disputed';
export const NOTIFICATION_DEAL_DISPUTE_RESOLVED = 'deal.dispute_resolved';

// Lock timing (AD-10)
export const DISPUTE_LOCK_DURATION_MS = 15 * 60 * 1000;
export const DISPUTE_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// Dispute status and resolution action vocabularies
export const DISPUTE_STATUS = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;

export type DisputeStatus = (typeof DISPUTE_STATUS)[keyof typeof DISPUTE_STATUS];

export const DISPUTE_RESOLUTION_ACTION = {
  COMPLETE: 'COMPLETE',
  CANCEL: 'CANCEL',
  RETURN_TO_REVIEW: 'RETURN_TO_REVIEW',
} as const;

export type DisputeResolutionAction =
  (typeof DISPUTE_RESOLUTION_ACTION)[keyof typeof DISPUTE_RESOLUTION_ACTION];

// Cancellation reason constants
export const DEAL_CANCEL_REASON_BUYER = 'CANCELLED_BY_BUYER';
export const DEAL_CANCEL_REASON_SELLER = 'CANCELLED_BY_SELLER';
export const DEAL_CANCEL_REASON_ADMIN = 'CANCELLED_BY_ADMIN';

/** Arabic error messages for Deal completion, rating, and timeout operations. */
export const DEAL_ERROR_MESSAGES_AR: Record<string, string> = {
  [DEAL_NOT_COMPLETED]: 'الصفقة ليست في حالة اكتمال',
  [DEAL_ALREADY_RATED]: 'تم تقييم هذه الصفقة مسبقاً',
  [DEAL_RATING_SCORE_INVALID]: 'تقييم الصفقة يجب أن يكون بين 1 و 5 نجوم',
  [DEAL_RATING_COMMENT_TOO_LONG]: 'التعليق يجب ألا يتجاوز 500 حرف',
  [DEAL_RATING_NOT_PARTY]: 'يحق لمشتري الصفقة فقط تقديم التقييم',
  [INVOICE_NOT_FOUND]: 'فاتورة الصفقة غير موجودة أو لم تصدر بعد',
  [DEAL_CANCEL_REASON_PAYMENT_TIMEOUT]: 'تم إلغاء الصفقة لانتهاء مهلة السداد',
  [DEAL_CANCEL_INVALID_STATE]: 'لا يمكن إلغاء الصفقة في حالتها الحالية',
  [DEAL_CANCEL_PROOF_EXISTS]: 'لا يمكن الإلغاء بعد رفع إثبات الدفع، يمكنك تقديم نزاع',
  [DEAL_CANCEL_NOT_PARTY]: 'غير مصرح لك بإلغاء هذه الصفقة',
  [SELLER_CANCEL_REQUEST_PENDING]: 'يوجد طلب إلغاء قيد المراجعة الإدارية بالفعل',
  [SELLER_CANCEL_REQUEST_NOT_FOUND]: 'طلب إلغاء البائع غير موجود',
  [DISPUTE_PROOF_REQUIRED]: 'لا يمكن تقديم نزاع قبل رفع إثبات دفع واحد على الأقل',
  [DISPUTE_ALREADY_OPEN]: 'يوجد نزاع مفتوح بالفعل لهذه الصفقة',
  [DISPUTE_NOT_FOUND]: 'النزاع غير موجود',
  [DISPUTE_NOT_CLAIMABLE]: 'النزاع غير متاح للحجز حالياً',
  [DISPUTE_LOCK_REQUIRED]: 'يجب حجز النزاع أولاً قبل اتخاذ القرار',
  [DISPUTE_LOCK_CONFLICT]: 'النزاع محجوز حالياً بواسطة مسؤول آخر',
  [DISPUTE_LOCK_EXPIRED]: 'انتهت مدة حجز النزاع، يرجى إعادة الحجز',
  [DISPUTE_SELF_ADJUDICATION_FORBIDDEN]: 'لا يمكن للمسؤول البت في نزاع هو طرف فيه',
  [DISPUTE_ADJUDICATION_INVALID_ACTION]: 'إجراء البت في النزاع غير صالح',
  [DISPUTE_DEADLINE_EXTENSION_REQUIRED]: 'يلزم تحديد ساعات تمديد المهلة عند إعادة الصفقة للتدقيق',
  [DISPUTE_FORCE_UNLOCK_REASON_REQUIRED]: 'سبب فك الحجز الإجباري مطلوب',
};



