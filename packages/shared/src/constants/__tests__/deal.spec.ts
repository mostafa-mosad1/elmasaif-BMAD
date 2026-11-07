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
  // Story 5.3 — admin proof-review vocabulary
  PAYMENT_CLAIMABLE_STATUSES,
  PAYMENT_CORRECTION_GRACE_HOURS,
  PAYMENT_DECIDABLE_STATUSES,
  PAYMENT_FORCE_UNLOCK_REASON_REQUIRED,
  PAYMENT_LOCK_CONFLICT,
  PAYMENT_LOCK_DURATION_MS,
  PAYMENT_LOCK_EXPIRED,
  PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS,
  PAYMENT_LOCK_REQUIRED,
  PAYMENT_NOT_CLAIMABLE,
  PAYMENT_NOT_FOUND,
  PAYMENT_PROOF_NOT_FOUND,
  PAYMENT_PROOF_CLAIMED,
  PAYMENT_PROOF_CONFIRMED,
  PAYMENT_PROOF_REJECTED,
  PAYMENT_MODERATION_RELEASED,
  PAYMENT_LOCK_FORCE_UNLOCKED,
  PAYMENT_REJECTION_NOTE_REQUIRED,
  PAYMENT_SELF_APPROVAL_FORBIDDEN,
} from '../deal';
import { OFFER_LOCK_DURATION_MS, OFFER_LOCK_HEARTBEAT_INTERVAL_MS } from '../offer';
import { LISTING_LOCK_DURATION_MS, LISTING_LOCK_HEARTBEAT_INTERVAL_MS } from '../listing';
import { INQUIRY_LOCK_DURATION_MS, INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS } from '../inquiry';
import { DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS } from '../index';
import { ERROR_FILE_QUARANTINED } from '../storage';
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

/** Story 5.3 / AC-2, AC-3, AC-5, AC-7, AC-10: the admin proof-review vocabulary. */
describe('Admin payment-review vocabulary (Story 5.3)', () => {
  it('exports every admin-facing code with a distinct value', () => {
    const codes = [
      PAYMENT_NOT_FOUND,
      PAYMENT_NOT_CLAIMABLE,
      PAYMENT_LOCK_REQUIRED,
      PAYMENT_LOCK_CONFLICT,
      PAYMENT_LOCK_EXPIRED,
      PAYMENT_FORCE_UNLOCK_REASON_REQUIRED,
      PAYMENT_REJECTION_NOTE_REQUIRED,
      PAYMENT_SELF_APPROVAL_FORBIDDEN,
      PAYMENT_PROOF_NOT_FOUND,
      // The quarantine gate is reused from the storage vocabulary, not re-declared (AC-10).
      ERROR_FILE_QUARANTINED,
    ];

    expect(new Set(codes).size).toBe(codes.length);
    expect(PAYMENT_LOCK_REQUIRED).toBe('PAYMENT_LOCK_REQUIRED');
    expect(PAYMENT_SELF_APPROVAL_FORBIDDEN).toBe('PAYMENT_SELF_APPROVAL_FORBIDDEN');
  });

  it('exports audit log action constants for payment proof review (AC-2, AC-3, AC-7)', () => {
    expect(PAYMENT_PROOF_CLAIMED).toBe('PAYMENT_PROOF_CLAIMED');
    expect(PAYMENT_PROOF_CONFIRMED).toBe('PAYMENT_PROOF_CONFIRMED');
    expect(PAYMENT_PROOF_REJECTED).toBe('PAYMENT_PROOF_REJECTED');
    expect(PAYMENT_MODERATION_RELEASED).toBe('PAYMENT_MODERATION_RELEASED');
    expect(PAYMENT_LOCK_FORCE_UNLOCKED).toBe('PAYMENT_LOCK_FORCE_UNLOCKED');
  });

  it('pins the 15-minute / 5-minute lease identical to every other claim-locked queue (AD-10)', () => {
    expect(PAYMENT_LOCK_DURATION_MS).toBe(15 * 60 * 1000);
    expect(PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(PAYMENT_LOCK_DURATION_MS).toBe(OFFER_LOCK_DURATION_MS);
    expect(PAYMENT_LOCK_DURATION_MS).toBe(LISTING_LOCK_DURATION_MS);
    expect(PAYMENT_LOCK_DURATION_MS).toBe(INQUIRY_LOCK_DURATION_MS);
    expect(PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS).toBe(OFFER_LOCK_HEARTBEAT_INTERVAL_MS);
    expect(PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS).toBe(LISTING_LOCK_HEARTBEAT_INTERVAL_MS);
    expect(PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS).toBe(INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS);
    expect(PAYMENT_LOCK_HEARTBEAT_INTERVAL_MS).toBeLessThan(PAYMENT_LOCK_DURATION_MS);
  });

  it('keeps the claimable set equal to the queue and the decidable set a strict subset (AC-1/AC-3)', () => {
    expect(PAYMENT_CLAIMABLE_STATUSES).toEqual(['PROOF_UPLOADED', 'UNDER_REVIEW']);
    expect(PAYMENT_DECIDABLE_STATUSES).toEqual(['UNDER_REVIEW']);
    for (const status of PAYMENT_DECIDABLE_STATUSES) {
      expect(PAYMENT_CLAIMABLE_STATUSES).toContain(status);
    }
    // A claimable proof is uploadable only while nobody owns the decision yet: `PROOF_UPLOADED`
    // is still the buyer's state, while `UNDER_REVIEW` — the claimed one — never is (FR-30).
    expect(UPLOADABLE_PAYMENT_STATUSES).toContain(DEAL_PAYMENT_STATUS.PROOF_UPLOADED);
    for (const status of PAYMENT_DECIDABLE_STATUSES) {
      expect(UPLOADABLE_PAYMENT_STATUSES).not.toContain(status);
    }
    // Terminal/undecidable rows (AC-2): PENDING, CONFIRMED, REJECTED, EXPIRED stay out.
    expect(PAYMENT_CLAIMABLE_STATUSES).not.toContain(DEAL_PAYMENT_STATUS.PENDING);
    expect(PAYMENT_CLAIMABLE_STATUSES).not.toContain(DEAL_PAYMENT_STATUS.CONFIRMED);
    expect(PAYMENT_CLAIMABLE_STATUSES).not.toContain(DEAL_PAYMENT_STATUS.REJECTED);
    expect(PAYMENT_CLAIMABLE_STATUSES).not.toContain(DEAL_PAYMENT_STATUS.EXPIRED);
  });

  it('points the correction grace at the existing 12-hour platform constant (AC-5)', () => {
    expect(PAYMENT_CORRECTION_GRACE_HOURS).toBe(12);
    expect(PAYMENT_CORRECTION_GRACE_HOURS).toBe(DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS);
  });

  it('does not disturb the 5.2 status vocabulary or its Arabic labels (trap T-8)', () => {
    expect(Object.values(DEAL_PAYMENT_STATUS)).toHaveLength(6);
    for (const status of Object.values(DEAL_PAYMENT_STATUS)) {
      expect(DEAL_PAYMENT_STATUS_LABELS_AR[status]).toBeTruthy();
    }
  });
});
