import { describe, it, expect } from 'vitest';
import {
  DEAL_PAYMENT_AMOUNT_SOURCES,
  computeCorrectionWindowExpiresAt,
  isDealPaymentType,
  isPaymentProofUploaded,
  isPaymentUploadable,
  validateDealPaymentProofFile,
} from '../payment';
import {
  DEAL_PAYMENT_PROOF_MIME_TYPES,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPES,
  PAYMENT_CORRECTION_GRACE_HOURS,
  UPLOADABLE_PAYMENT_STATUSES,
} from '../../constants/deal';
import { MAX_FILE_SIZE_BYTES } from '../../constants';

/** Story 5.2 / AC-4, AC-5, AC-6, AC-8: the shared payment-slot rules. */
describe('Deal payment helpers (Story 5.2)', () => {
  describe('isDealPaymentType', () => {
    it('accepts the two legs of the dual wire transfer', () => {
      expect(isDealPaymentType('PLATFORM_COMMISSION')).toBe(true);
      expect(isDealPaymentType('SELLER_PURCHASE_PRICE')).toBe(true);
    });

    it('refuses OWNER_CONTRACT_FEE and anything else (AC-7)', () => {
      expect(isDealPaymentType('OWNER_CONTRACT_FEE')).toBe(false);
      expect(isDealPaymentType('PLATFORM_COMMISION')).toBe(false);
      expect(isDealPaymentType('')).toBe(false);
      expect(isDealPaymentType(null)).toBe(false);
      expect(isDealPaymentType(undefined)).toBe(false);
      expect(isDealPaymentType(42)).toBe(false);
    });
  });

  describe('isPaymentUploadable', () => {
    it('allows exactly the three re-uploadable states', () => {
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.PENDING)).toBe(true);
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.PROOF_UPLOADED)).toBe(true);
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.REJECTED)).toBe(true);
    });

    it('locks the states an administrator owns, and the expired one', () => {
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.UNDER_REVIEW)).toBe(false);
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.CONFIRMED)).toBe(false);
      expect(isPaymentUploadable(DEAL_PAYMENT_STATUS.EXPIRED)).toBe(false);
    });

    it('treats a missing status as not uploadable', () => {
      expect(isPaymentUploadable(null)).toBe(false);
      expect(isPaymentUploadable(undefined)).toBe(false);
      expect(isPaymentUploadable('')).toBe(false);
    });

    it('keeps the uploadable set disjoint from the locked set', () => {
      const locked = [
        DEAL_PAYMENT_STATUS.UNDER_REVIEW,
        DEAL_PAYMENT_STATUS.CONFIRMED,
        DEAL_PAYMENT_STATUS.EXPIRED,
      ];
      expect(UPLOADABLE_PAYMENT_STATUSES.filter((status) => locked.includes(status))).toEqual([]);
    });
  });

  describe('validateDealPaymentProofFile (FR-30)', () => {
    it('accepts the three receipt formats under the size ceiling', () => {
      for (const mimeType of DEAL_PAYMENT_PROOF_MIME_TYPES) {
        expect(validateDealPaymentProofFile({ size: 1024, mimeType })).toBeNull();
      }
      expect(
        validateDealPaymentProofFile({ size: MAX_FILE_SIZE_BYTES, mimeType: 'application/pdf' }),
      ).toBeNull();
    });

    it('requires a non-empty file first', () => {
      expect(validateDealPaymentProofFile(null)).toBe(DEAL_PAYMENT_PROOF_REQUIRED);
      expect(validateDealPaymentProofFile(undefined)).toBe(DEAL_PAYMENT_PROOF_REQUIRED);
      expect(validateDealPaymentProofFile({ size: 0, mimeType: 'application/pdf' })).toBe(
        DEAL_PAYMENT_PROOF_REQUIRED,
      );
    });

    it('rejects anything larger than 10 MB', () => {
      expect(
        validateDealPaymentProofFile({ size: MAX_FILE_SIZE_BYTES + 1, mimeType: 'image/png' }),
      ).toBe(DEAL_PAYMENT_PROOF_TOO_LARGE);
    });

    it('rejects WebP even though the generic storage hook accepts it (trap T-12)', () => {
      expect(validateDealPaymentProofFile({ size: 1024, mimeType: 'image/webp' })).toBe(
        DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
      );
      expect(DEAL_PAYMENT_PROOF_MIME_TYPES).not.toContain('image/webp');
    });

    it('rejects an unknown format', () => {
      expect(validateDealPaymentProofFile({ size: 1024, mimeType: 'text/plain' })).toBe(
        DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
      );
    });
  });

  describe('DEAL_PAYMENT_AMOUNT_SOURCES', () => {
    it('maps the platform leg to the commission and the seller leg to the price', () => {
      expect(DEAL_PAYMENT_AMOUNT_SOURCES).toEqual([
        { paymentType: 'PLATFORM_COMMISSION', amountField: 'platformCommission' },
        { paymentType: 'SELLER_PURCHASE_PRICE', amountField: 'dealPrice' },
      ]);
      expect(DEAL_PAYMENT_AMOUNT_SOURCES.map((slot) => slot.paymentType)).toEqual([
        ...DEAL_PAYMENT_TYPES,
      ]);
    });
  });

  describe('isPaymentProofUploaded', () => {
    it('is true only for an uploaded receipt', () => {
      expect(isPaymentProofUploaded(DEAL_PAYMENT_STATUS.PROOF_UPLOADED)).toBe(true);
      expect(isPaymentProofUploaded(DEAL_PAYMENT_STATUS.PENDING)).toBe(false);
      expect(isPaymentProofUploaded(DEAL_PAYMENT_STATUS.CONFIRMED)).toBe(false);
      expect(isPaymentProofUploaded(null)).toBe(false);
    });
  });

  /** Story 5.3 / AC-5, AD-3: the 12-hour correction window, computed from state only. */
  describe('computeCorrectionWindowExpiresAt', () => {
    const deadline = new Date('2026-11-08T09:00:00.000Z');
    const grace = PAYMENT_CORRECTION_GRACE_HOURS;

    it('returns null for a rejection that landed strictly before the deal deadline', () => {
      expect(
        computeCorrectionWindowExpiresAt(
          {
            status: DEAL_PAYMENT_STATUS.REJECTED,
            verifiedAt: new Date('2026-11-07T09:00:00.000Z'),
          },
          deadline,
          grace,
        ),
      ).toBeNull();
    });

    it('grants exactly one 12-hour window for a rejection at the deadline', () => {
      expect(
        computeCorrectionWindowExpiresAt(
          { status: DEAL_PAYMENT_STATUS.REJECTED, verifiedAt: deadline },
          deadline,
          grace,
        ),
      ).toBe('2026-11-08T21:00:00.000Z');
    });

    it('grants exactly one 12-hour window for a rejection after the deadline', () => {
      expect(
        computeCorrectionWindowExpiresAt(
          {
            status: DEAL_PAYMENT_STATUS.REJECTED,
            verifiedAt: '2026-11-09T02:00:00.000Z',
          },
          deadline,
          grace,
        ),
      ).toBe('2026-11-09T14:00:00.000Z');
    });

    it('is null for every non-rejected status, even with a verifiedAt stamp', () => {
      for (const status of [
        DEAL_PAYMENT_STATUS.PENDING,
        DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
        DEAL_PAYMENT_STATUS.UNDER_REVIEW,
        DEAL_PAYMENT_STATUS.CONFIRMED,
        DEAL_PAYMENT_STATUS.EXPIRED,
      ]) {
        expect(
          computeCorrectionWindowExpiresAt({ status, verifiedAt: deadline }, deadline, grace),
        ).toBeNull();
      }
    });

    it('is null for a rejected row without a decision timestamp (defensive)', () => {
      expect(
        computeCorrectionWindowExpiresAt(
          { status: DEAL_PAYMENT_STATUS.REJECTED, verifiedAt: null },
          deadline,
          grace,
        ),
      ).toBeNull();
      expect(
        computeCorrectionWindowExpiresAt(
          { status: DEAL_PAYMENT_STATUS.REJECTED, verifiedAt: 'not-a-date' },
          deadline,
          grace,
        ),
      ).toBeNull();
    });
  });
});
