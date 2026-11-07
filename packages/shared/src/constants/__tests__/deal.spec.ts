import { describe, it, expect } from 'vitest';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_PAYMENT_PROOF_MIME_TYPES,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_STATUS_VARIANTS,
  DEAL_PAYMENT_TYPE_LABELS_AR,
  DEAL_PAYMENT_TYPES,
  DEAL_STATUS_LABELS_AR,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DEAL_IDENTITY_REQUIRED,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_TERMINAL,
  UPLOADABLE_PAYMENT_STATUSES,
} from '../deal';
import { DealStatus } from '../../enums';

/** Story 5.2 / AC-13, trap T-8: every member is labelled, and no set silently drifted. */
describe('Deal payment vocabulary (Story 5.2)', () => {
  it('labels every DealPaymentStatus member in Arabic', () => {
    const statuses = Object.values(DEAL_PAYMENT_STATUS);

    expect(statuses).toHaveLength(6);
    for (const status of statuses) {
      expect(DEAL_PAYMENT_STATUS_LABELS_AR[status]).toBeTruthy();
      expect(DEAL_PAYMENT_STATUS_LABELS_AR[status]).not.toBe(status);
    }
    expect(Object.keys(DEAL_PAYMENT_STATUS_LABELS_AR).sort()).toEqual([...statuses].sort());
  });

  it('labels every DealStatus member in Arabic', () => {
    const statuses = Object.values(DealStatus);

    expect(Object.keys(DEAL_STATUS_LABELS_AR).sort()).toEqual([...statuses].sort());
    for (const status of statuses) {
      expect(DEAL_STATUS_LABELS_AR[status]).toBeTruthy();
    }
  });

  it('gives every payment status a badge variant', () => {
    expect(Object.keys(DEAL_PAYMENT_STATUS_VARIANTS).sort()).toEqual(
      Object.values(DEAL_PAYMENT_STATUS).sort(),
    );
  });

  it('labels both deal payment types, in RTL display order', () => {
    expect(DEAL_PAYMENT_TYPES).toEqual(['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE']);
    expect(DEAL_PAYMENT_TYPE_LABELS_AR.PLATFORM_COMMISSION).toBe('سعي المنصة');
    expect(DEAL_PAYMENT_TYPE_LABELS_AR.SELLER_PURCHASE_PRICE).toBe('قيمة العقار للبائع');
  });

  it('keeps the uploadable set disjoint from the three locked statuses (AC-8)', () => {
    expect(UPLOADABLE_PAYMENT_STATUSES).toEqual(['PENDING', 'PROOF_UPLOADED', 'REJECTED']);

    const locked = ['UNDER_REVIEW', 'CONFIRMED', 'EXPIRED'];
    for (const status of locked) {
      expect(UPLOADABLE_PAYMENT_STATUSES).not.toContain(status);
    }
  });

  it('pins the three receipt formats of FR-30 (WebP excluded)', () => {
    expect([...DEAL_PAYMENT_PROOF_MIME_TYPES]).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
    ]);
  });

  it('does not disturb the Story 5.1 active-status set (trap T-7)', () => {
    expect(ACTIVE_DEAL_STATUSES).toEqual([
      DealStatus.AWAITING_PAYMENT_PROOF,
      DealStatus.UNDER_ADMIN_AUDIT,
      DealStatus.PAYMENT_REJECTED,
    ]);
  });

  it('exposes every buyer-facing refusal code with a distinct value', () => {
    const codes = [
      DEAL_NOT_FOUND,
      DEAL_NOT_PARTY,
      DEAL_TERMINAL,
      DEAL_PAYMENT_DEADLINE_PASSED,
      DEAL_PAYMENT_REVIEW_COMPLETE,
      DEAL_PAYMENT_TYPE_INVALID,
      DEAL_IDENTITY_REQUIRED,
      DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
      DEAL_PAYMENT_PROOF_REQUIRED,
      DEAL_PAYMENT_PROOF_TOO_LARGE,
      DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
      DEAL_PAYMENT_PROOF_INFECTED,
      DEAL_PAYMENT_PROOF_NOT_FOUND,
      DEAL_PAYMENT_PROOF_SCAN_FAILED,
    ];

    expect(new Set(codes).size).toBe(codes.length);
  });
});
