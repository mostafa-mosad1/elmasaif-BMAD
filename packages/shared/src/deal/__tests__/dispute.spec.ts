import { describe, it, expect } from 'vitest';
import {
  cancelDealByBuyerSchema,
  sellerCancelRequestSchema,
  fileDisputeSchema,
  adjudicateDisputeSchema,
} from '../../schemas/dispute';
import {
  DEAL_CANCEL_INVALID_STATE,
  DEAL_CANCEL_PROOF_EXISTS,
  DEAL_CANCEL_NOT_PARTY,
  SELLER_CANCEL_REQUEST_PENDING,
  DISPUTE_PROOF_REQUIRED,
  DISPUTE_ALREADY_OPEN,
  DISPUTE_NOT_FOUND,
  DISPUTE_LOCK_REQUIRED,
  DISPUTE_LOCK_CONFLICT,
  DISPUTE_LOCK_EXPIRED,
  DISPUTE_SELF_ADJUDICATION_FORBIDDEN,
  DISPUTE_ADJUDICATION_INVALID_ACTION,
  DISPUTE_DEADLINE_EXTENSION_REQUIRED,
  DEAL_CANCELLED_BY_BUYER,
  SELLER_CANCELLATION_REQUESTED,
  DEAL_CANCELLED_BY_SELLER,
  SELLER_CANCELLATION_REJECTED,
  DEAL_DISPUTED,
  DEAL_DISPUTE_CLAIMED,
  DEAL_DISPUTE_RESOLVED_COMPLETED,
  DEAL_DISPUTE_RESOLVED_CANCELLED,
  DEAL_DISPUTE_RETURNED_TO_REVIEW,
  DEAL_STATUS_LABELS_AR,
  ACTIVE_DEAL_STATUSES,
  DEAL_ERROR_MESSAGES_AR,
  DISPUTE_STATUS,
  DISPUTE_RESOLUTION_ACTION,
  DISPUTE_LOCK_DURATION_MS,
  DISPUTE_LOCK_HEARTBEAT_INTERVAL_MS,
} from '../../constants/deal';
import { DealStatus } from '../../enums';

describe('Story 5.6: Dispute & Cancellation Constants & Vocabularies', () => {
  it('includes DISPUTED on DealStatus enum', () => {
    expect(DealStatus.DISPUTED).toBe('DISPUTED');
  });

  it('includes DealStatus.DISPUTED in ACTIVE_DEAL_STATUSES', () => {
    expect(ACTIVE_DEAL_STATUSES).toContain(DealStatus.DISPUTED);
  });

  it('labels DealStatus.DISPUTED in Arabic', () => {
    expect(DEAL_STATUS_LABELS_AR[DealStatus.DISPUTED]).toBe('متنازع عليها');
  });

  it('exports all refusal codes with unique string values', () => {
    const codes = [
      DEAL_CANCEL_INVALID_STATE,
      DEAL_CANCEL_PROOF_EXISTS,
      DEAL_CANCEL_NOT_PARTY,
      SELLER_CANCEL_REQUEST_PENDING,
      DISPUTE_PROOF_REQUIRED,
      DISPUTE_ALREADY_OPEN,
      DISPUTE_NOT_FOUND,
      DISPUTE_LOCK_REQUIRED,
      DISPUTE_LOCK_CONFLICT,
      DISPUTE_LOCK_EXPIRED,
      DISPUTE_SELF_ADJUDICATION_FORBIDDEN,
      DISPUTE_ADJUDICATION_INVALID_ACTION,
      DISPUTE_DEADLINE_EXTENSION_REQUIRED,
    ];
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(DEAL_ERROR_MESSAGES_AR[code]).toBeTruthy();
    }
  });

  it('exports audit log action constants', () => {
    expect(DEAL_CANCELLED_BY_BUYER).toBe('DEAL_CANCELLED_BY_BUYER');
    expect(SELLER_CANCELLATION_REQUESTED).toBe('SELLER_CANCELLATION_REQUESTED');
    expect(DEAL_CANCELLED_BY_SELLER).toBe('DEAL_CANCELLED_BY_SELLER');
    expect(SELLER_CANCELLATION_REJECTED).toBe('SELLER_CANCELLATION_REJECTED');
    expect(DEAL_DISPUTED).toBe('DEAL_DISPUTED');
    expect(DEAL_DISPUTE_CLAIMED).toBe('DEAL_DISPUTE_CLAIMED');
    expect(DEAL_DISPUTE_RESOLVED_COMPLETED).toBe('DEAL_DISPUTE_RESOLVED_COMPLETED');
    expect(DEAL_DISPUTE_RESOLVED_CANCELLED).toBe('DEAL_DISPUTE_RESOLVED_CANCELLED');
    expect(DEAL_DISPUTE_RETURNED_TO_REVIEW).toBe('DEAL_DISPUTE_RETURNED_TO_REVIEW');
  });

  it('defines dispute status and resolution actions', () => {
    expect(DISPUTE_STATUS.OPEN).toBe('OPEN');
    expect(DISPUTE_STATUS.RESOLVED).toBe('RESOLVED');
    expect(DISPUTE_RESOLUTION_ACTION.COMPLETE).toBe('COMPLETE');
    expect(DISPUTE_RESOLUTION_ACTION.CANCEL).toBe('CANCEL');
    expect(DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW).toBe('RETURN_TO_REVIEW');
  });

  it('defines 15-minute lease and 5-minute heartbeat constants matching AD-10', () => {
    expect(DISPUTE_LOCK_DURATION_MS).toBe(15 * 60 * 1000);
    expect(DISPUTE_LOCK_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe('Story 5.6: Dispute & Cancellation Validation Schemas', () => {
  describe('cancelDealByBuyerSchema', () => {
    it('accepts empty object or optional reason', () => {
      expect(cancelDealByBuyerSchema.safeParse({}).success).toBe(true);
      expect(cancelDealByBuyerSchema.safeParse({ reason: 'Buyer changed mind' }).success).toBe(true);
    });
  });

  describe('sellerCancelRequestSchema', () => {
    it('validates reason length between 10 and 500 characters', () => {
      const tooShort = sellerCancelRequestSchema.safeParse({ reason: 'Short' });
      expect(tooShort.success).toBe(false);

      const valid = sellerCancelRequestSchema.safeParse({
        reason: 'Unable to proceed with property deal due to unexpected title issue',
      });
      expect(valid.success).toBe(true);

      const tooLong = sellerCancelRequestSchema.safeParse({
        reason: 'a'.repeat(501),
      });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('fileDisputeSchema', () => {
    it('validates reason length between 10 and 1000 characters', () => {
      const tooShort = fileDisputeSchema.safeParse({ reason: 'Too short' });
      expect(tooShort.success).toBe(false);

      const valid = fileDisputeSchema.safeParse({
        reason: 'Payment proof submitted does not match the bank reference details provided.',
      });
      expect(valid.success).toBe(true);

      const tooLong = fileDisputeSchema.safeParse({
        reason: 'a'.repeat(1001),
      });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('adjudicateDisputeSchema', () => {
    it('validates COMPLETE action without deadline', () => {
      const valid = adjudicateDisputeSchema.safeParse({
        action: 'COMPLETE',
        notes: 'Proof verified and bank transfer confirmed.',
      });
      expect(valid.success).toBe(true);
    });

    it('validates CANCEL action without deadline', () => {
      const valid = adjudicateDisputeSchema.safeParse({
        action: 'CANCEL',
        notes: 'Dispute verified, listing returned to market.',
      });
      expect(valid.success).toBe(true);
    });

    it('requires newDeadlineHours when action is RETURN_TO_REVIEW', () => {
      const invalid = adjudicateDisputeSchema.safeParse({
        action: 'RETURN_TO_REVIEW',
        notes: 'Requires updated receipt from bank.',
      });
      expect(invalid.success).toBe(false);

      const valid = adjudicateDisputeSchema.safeParse({
        action: 'RETURN_TO_REVIEW',
        notes: 'Requires updated receipt from bank.',
        newDeadlineHours: 48,
      });
      expect(valid.success).toBe(true);
    });
  });
});

