/**
 * Pure timeout evaluation and post-deadline outcome determination (Story 5.5 / FR-33, BR-07, AD-4, AD-7, AD-11, OQ-13).
 *
 * Every function in this module is pure and deterministic. No implicit clocks (`new Date()`)
 * are called; the current timestamp is always injected by the caller (API ClockService or
 * Worker workerClock).
 */
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_PAYMENT_STATUS,
  PAYMENT_CORRECTION_GRACE_HOURS,
} from '../constants';
import { DealStatus, PaymentType } from '../enums';
import { computeCorrectionWindowExpiresAt } from './payment';

export interface DealTimeoutPaymentInput {
  paymentType: string;
  status: string;
  verifiedAt?: Date | string | null;
}

export interface DealTimeoutEvaluationInput {
  id?: string;
  status: DealStatus | string;
  paymentDeadline: Date | string;
  payments: DealTimeoutPaymentInput[];
  disputes?: Array<{ status: string }>;
}

export type PostDeadlineOutcome =
  | 'BOTH_EXPIRED'
  | 'COMMISSION_CONFIRMED_PRICE_EXPIRED'
  | 'PRICE_CONFIRMED_COMMISSION_EXPIRED'
  | 'PENDING_REVIEW';

/**
 * Gate 1 (FR-36, UC-30): Returns true if the deal has any active (OPEN) dispute.
 * While a dispute is open, automated timeout expiry is frozen.
 */
export function hasActiveDispute(deal: { disputes?: Array<{ status: string }> }): boolean {
  if (!deal.disputes || !Array.isArray(deal.disputes)) return false;
  return deal.disputes.some((d) => d.status === 'OPEN');
}

/**
 * Gate 2 (FR-31, FR-33, UX-DR5): Returns true if ANY payment has proof uploaded or is under review.
 * On-time proof upload pauses automated cancellation until admin review is complete.
 */
export function hasProtectedPaymentProof(payments: Array<{ status: string }>): boolean {
  if (!payments || !Array.isArray(payments)) return false;
  return payments.some(
    (p) =>
      p.status === DEAL_PAYMENT_STATUS.PROOF_UPLOADED ||
      p.status === DEAL_PAYMENT_STATUS.UNDER_REVIEW,
  );
}

/**
 * Gate 3 (FR-31, AD-3, AC-5): Returns true if any rejected payment is currently within
 * its post-deadline 12-hour correction grace period.
 */
export function hasPaymentInGracePeriod(
  payments: Array<{ status: string; verifiedAt?: Date | string | null }>,
  deadline: Date | string,
  currentTime: Date,
  graceHours: number = PAYMENT_CORRECTION_GRACE_HOURS,
): boolean {
  if (!payments || !Array.isArray(payments)) return false;

  return payments.some((payment) => {
    if (payment.status !== DEAL_PAYMENT_STATUS.REJECTED) return false;
    const windowExpiresAt = computeCorrectionWindowExpiresAt(payment, deadline, graceHours);
    if (!windowExpiresAt) return false;
    return currentTime.getTime() < new Date(windowExpiresAt).getTime();
  });
}

/**
 * Evaluates whether a deal has passed its deadline and is eligible for automated timeout cancellation.
 * Checks all 3 protection gates in order:
 * 1. Status must be an active deal status (AWAITING_PAYMENT_PROOF, UNDER_ADMIN_AUDIT, PAYMENT_REJECTED).
 * 2. paymentDeadline <= currentTime.
 * 3. No active dispute.
 * 4. No protected payment proof (PROOF_UPLOADED / UNDER_REVIEW).
 * 5. No payment inside active 12-hour grace period.
 */
export function isDealEligibleForTimeout(
  deal: DealTimeoutEvaluationInput,
  currentTime: Date,
  graceHours: number = PAYMENT_CORRECTION_GRACE_HOURS,
): boolean {
  if (!(ACTIVE_DEAL_STATUSES as readonly string[]).includes(deal.status)) {
    return false;
  }

  const deadlineMs = new Date(deal.paymentDeadline).getTime();
  if (Number.isNaN(deadlineMs) || currentTime.getTime() < deadlineMs) {
    return false;
  }

  if (hasActiveDispute(deal)) {
    return false;
  }

  if (hasProtectedPaymentProof(deal.payments)) {
    return false;
  }

  if (hasPaymentInGracePeriod(deal.payments, deal.paymentDeadline, currentTime, graceHours)) {
    return false;
  }

  return true;
}

/**
 * Maps the post-deadline payment status configuration to the appropriate deal outcome.
 * - BOTH_EXPIRED: Standard timeout cancellation (both payments pending / expired).
 * - COMMISSION_CONFIRMED_PRICE_EXPIRED (OQ-13): Platform fee received, property price timed out; requires refund review.
 * - PRICE_CONFIRMED_COMMISSION_EXPIRED: Property price confirmed, commission missing; requires dispute review.
 * - PENDING_REVIEW: Active proofs awaiting admin audit.
 */
export function evaluatePostDeadlineOutcome(
  payments: Array<{ paymentType: string; status: string }>,
): PostDeadlineOutcome {
  if (hasProtectedPaymentProof(payments)) {
    return 'PENDING_REVIEW';
  }

  const commission = payments.find(
    (p) => p.paymentType === PaymentType.PLATFORM_COMMISSION,
  );
  const price = payments.find(
    (p) => p.paymentType === PaymentType.SELLER_PURCHASE_PRICE,
  );

  const isCommissionConfirmed = commission?.status === DEAL_PAYMENT_STATUS.CONFIRMED;
  const isPriceConfirmed = price?.status === DEAL_PAYMENT_STATUS.CONFIRMED;

  if (isCommissionConfirmed && !isPriceConfirmed) {
    return 'COMMISSION_CONFIRMED_PRICE_EXPIRED';
  }

  if (isPriceConfirmed && !isCommissionConfirmed) {
    return 'PRICE_CONFIRMED_COMMISSION_EXPIRED';
  }

  return 'BOTH_EXPIRED';
}
