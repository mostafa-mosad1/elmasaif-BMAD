import { describe, it, expect } from 'vitest';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_PAYMENT_STATUS,
  DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
  DEAL_CANCELLED_BY_TIMEOUT,
  NOTIFICATION_DEAL_TIMEOUT_CANCELLED,
  PAYMENT_EXPIRED,
} from '../../constants';
import { DealStatus, PaymentType } from '../../enums';
import {
  isDealEligibleForTimeout,
  hasActiveDispute,
  hasProtectedPaymentProof,
  hasPaymentInGracePeriod,
  evaluatePostDeadlineOutcome,
  type DealTimeoutEvaluationInput,
} from '../timeout';

describe('Story 5.5: Deal Timeout & Expiry Evaluation', () => {
  const baseDeadline = new Date('2026-11-08T12:00:00.000Z');
  const pastDeadline = new Date('2026-11-08T12:00:01.000Z');
  const beforeDeadline = new Date('2026-11-08T11:59:59.000Z');

  describe('hasActiveDispute', () => {
    it('returns false when no disputes exist or array is empty', () => {
      expect(hasActiveDispute({})).toBe(false);
      expect(hasActiveDispute({ disputes: [] })).toBe(false);
    });

    it('returns true when any dispute has status OPEN', () => {
      expect(hasActiveDispute({ disputes: [{ status: 'OPEN' }] })).toBe(true);
      expect(
        hasActiveDispute({
          disputes: [{ status: 'RESOLVED' }, { status: 'OPEN' }],
        }),
      ).toBe(true);
    });

    it('returns false when disputes are in terminal states', () => {
      expect(
        hasActiveDispute({
          disputes: [{ status: 'RESOLVED' }, { status: 'CANCELLED' }],
        }),
      ).toBe(false);
    });
  });

  describe('hasProtectedPaymentProof', () => {
    it('returns false for empty payment list', () => {
      expect(hasProtectedPaymentProof([])).toBe(false);
    });

    it('returns true when any payment is PROOF_UPLOADED or UNDER_REVIEW', () => {
      expect(
        hasProtectedPaymentProof([
          { status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED },
          { status: DEAL_PAYMENT_STATUS.PENDING },
        ]),
      ).toBe(true);

      expect(
        hasProtectedPaymentProof([
          { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW },
          { status: DEAL_PAYMENT_STATUS.PENDING },
        ]),
      ).toBe(true);
    });

    it('returns false when payments are PENDING, REJECTED, EXPIRED, or CONFIRMED', () => {
      expect(
        hasProtectedPaymentProof([
          { status: DEAL_PAYMENT_STATUS.PENDING },
          { status: DEAL_PAYMENT_STATUS.REJECTED },
        ]),
      ).toBe(false);

      expect(
        hasProtectedPaymentProof([
          { status: DEAL_PAYMENT_STATUS.CONFIRMED },
          { status: DEAL_PAYMENT_STATUS.EXPIRED },
        ]),
      ).toBe(false);
    });
  });

  describe('hasPaymentInGracePeriod', () => {
    it('returns false when no payments are REJECTED', () => {
      expect(
        hasPaymentInGracePeriod(
          [{ status: DEAL_PAYMENT_STATUS.PENDING }],
          baseDeadline,
          pastDeadline,
        ),
      ).toBe(false);
    });

    it('returns false when rejection verifiedAt occurred strictly BEFORE deadline', () => {
      // Rejection at 10:00 (before deadline 12:00) -> correction window was the deadline itself
      const rejectedPayment = {
        status: DEAL_PAYMENT_STATUS.REJECTED,
        verifiedAt: new Date('2026-11-08T10:00:00.000Z'),
      };
      expect(
        hasPaymentInGracePeriod([rejectedPayment], baseDeadline, pastDeadline),
      ).toBe(false);
    });

    it('returns true when rejection occurred at or after deadline and currentTime < verifiedAt + 12h', () => {
      // Rejection at 12:30 (past deadline 12:00). Grace expires at 00:30 next day.
      const rejectedPayment = {
        status: DEAL_PAYMENT_STATUS.REJECTED,
        verifiedAt: new Date('2026-11-08T12:30:00.000Z'),
      };
      // Test at 14:00 (inside 12h grace window)
      const currentTime = new Date('2026-11-08T14:00:00.000Z');
      expect(
        hasPaymentInGracePeriod([rejectedPayment], baseDeadline, currentTime),
      ).toBe(true);
    });

    it('returns false when rejection occurred at or after deadline and currentTime >= verifiedAt + 12h', () => {
      // Rejection at 12:30. Grace expires at 00:30 next day.
      const rejectedPayment = {
        status: DEAL_PAYMENT_STATUS.REJECTED,
        verifiedAt: new Date('2026-11-08T12:30:00.000Z'),
      };
      // Test at 00:30:01 next day (grace window elapsed)
      const currentTime = new Date('2026-11-09T00:30:01.000Z');
      expect(
        hasPaymentInGracePeriod([rejectedPayment], baseDeadline, currentTime),
      ).toBe(false);
    });
  });

  describe('isDealEligibleForTimeout', () => {
    const validDeal: DealTimeoutEvaluationInput = {
      id: 'deal-123',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: baseDeadline,
      payments: [
        { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PENDING },
        { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    it('returns true when deadline passed and no protection gates trigger', () => {
      expect(isDealEligibleForTimeout(validDeal, pastDeadline)).toBe(true);
    });

    it('returns false when currentTime < paymentDeadline', () => {
      expect(isDealEligibleForTimeout(validDeal, beforeDeadline)).toBe(false);
    });

    it('returns false when deal is not in ACTIVE_DEAL_STATUSES', () => {
      const completedDeal = { ...validDeal, status: DealStatus.COMPLETED };
      expect(isDealEligibleForTimeout(completedDeal, pastDeadline)).toBe(false);

      const cancelledDeal = { ...validDeal, status: DealStatus.CANCELLED };
      expect(isDealEligibleForTimeout(cancelledDeal, pastDeadline)).toBe(false);

      const terminatedDeal = { ...validDeal, status: DealStatus.TERMINATED };
      expect(isDealEligibleForTimeout(terminatedDeal, pastDeadline)).toBe(false);
    });

    it('returns false when deal has active dispute (Gate 1)', () => {
      const disputedDeal = {
        ...validDeal,
        disputes: [{ status: 'OPEN' }],
      };
      expect(isDealEligibleForTimeout(disputedDeal, pastDeadline)).toBe(false);
    });

    it('returns false when deal has payment proof uploaded on time (Gate 2)', () => {
      const dealWithProof = {
        ...validDeal,
        payments: [
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      };
      expect(isDealEligibleForTimeout(dealWithProof, pastDeadline)).toBe(false);
    });

    it('returns false when deal has payment under admin review (Gate 2)', () => {
      const dealWithReview = {
        ...validDeal,
        payments: [
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.UNDER_REVIEW },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      };
      expect(isDealEligibleForTimeout(dealWithReview, pastDeadline)).toBe(false);
    });

    it('returns false when deal has payment in 12-hour grace period (Gate 3)', () => {
      const dealWithGrace = {
        ...validDeal,
        payments: [
          {
            paymentType: PaymentType.PLATFORM_COMMISSION,
            status: DEAL_PAYMENT_STATUS.REJECTED,
            verifiedAt: new Date('2026-11-08T12:15:00.000Z'),
          },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      };
      // 1 hour after rejection
      const currentTime = new Date('2026-11-08T13:15:00.000Z');
      expect(isDealEligibleForTimeout(dealWithGrace, currentTime)).toBe(false);
    });

    it('returns true when rejected payment has exceeded 12-hour grace period', () => {
      const dealPastGrace = {
        ...validDeal,
        payments: [
          {
            paymentType: PaymentType.PLATFORM_COMMISSION,
            status: DEAL_PAYMENT_STATUS.REJECTED,
            verifiedAt: new Date('2026-11-08T12:15:00.000Z'),
          },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      };
      // 13 hours after rejection
      const currentTime = new Date('2026-11-09T01:16:00.000Z');
      expect(isDealEligibleForTimeout(dealPastGrace, currentTime)).toBe(true);
    });
  });

  describe('evaluatePostDeadlineOutcome', () => {
    it('returns BOTH_EXPIRED when both payments are EXPIRED or PENDING', () => {
      expect(
        evaluatePostDeadlineOutcome([
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.EXPIRED },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.EXPIRED },
        ]),
      ).toBe('BOTH_EXPIRED');

      expect(
        evaluatePostDeadlineOutcome([
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PENDING },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.EXPIRED },
        ]),
      ).toBe('BOTH_EXPIRED');
    });

    it('returns COMMISSION_CONFIRMED_PRICE_EXPIRED (OQ-13) when commission is CONFIRMED and price is EXPIRED', () => {
      expect(
        evaluatePostDeadlineOutcome([
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.CONFIRMED },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.EXPIRED },
        ]),
      ).toBe('COMMISSION_CONFIRMED_PRICE_EXPIRED');
    });

    it('returns PRICE_CONFIRMED_COMMISSION_EXPIRED when price is CONFIRMED and commission is EXPIRED', () => {
      expect(
        evaluatePostDeadlineOutcome([
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.EXPIRED },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.CONFIRMED },
        ]),
      ).toBe('PRICE_CONFIRMED_COMMISSION_EXPIRED');
    });

    it('returns PENDING_REVIEW when any payment is PROOF_UPLOADED or UNDER_REVIEW', () => {
      expect(
        evaluatePostDeadlineOutcome([
          { paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED },
          { paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.EXPIRED },
        ]),
      ).toBe('PENDING_REVIEW');
    });
  });
});
