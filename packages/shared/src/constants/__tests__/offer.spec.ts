import { describe, it, expect } from 'vitest';
import {
  ACTIVE_OFFER_STATUSES,
  TERMINAL_OFFER_STATUSES,
  OFFER_STATUS_LABELS_AR,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_ACTIVE_EXISTS,
  OFFER_SELF_SUBMISSION_FORBIDDEN,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_NOT_FOUND,
  OFFER_EXPIRY_HOURS,
  LOW_PRICE_THRESHOLD_PERCENT,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  OfferStatus,
} from '../../index';

describe('Buyer Offer Constants (Story 4.1 / FR-25, BR-11, A-07)', () => {
  it('exposes the structured error codes consumed by the API and the web', () => {
    expect(OFFER_LISTING_NOT_FOUND).toBe('OFFER_LISTING_NOT_FOUND');
    expect(OFFER_LISTING_NOT_OFFERABLE).toBe('OFFER_LISTING_NOT_OFFERABLE');
    expect(OFFER_PRICE_OUT_OF_RANGE).toBe('OFFER_PRICE_OUT_OF_RANGE');
    expect(OFFER_LOW_PRICE_CONFIRMATION_REQUIRED).toBe('OFFER_LOW_PRICE_CONFIRMATION_REQUIRED');
    expect(OFFER_ACTIVE_EXISTS).toBe('OFFER_ACTIVE_EXISTS');
    expect(OFFER_SELF_SUBMISSION_FORBIDDEN).toBe('OFFER_SELF_SUBMISSION_FORBIDDEN');
    expect(OFFER_BUYER_PROFILE_REQUIRED).toBe('OFFER_BUYER_PROFILE_REQUIRED');
    // Declared for Story 4.2's admin/seller endpoints.
    expect(OFFER_NOT_FOUND).toBe('OFFER_NOT_FOUND');
  });

  it('pins the 7-day expiry window (PRD FR-26 OfferExpiryDays)', () => {
    expect(OFFER_EXPIRY_HOURS).toBe(168);
  });

  it('pins the sub-50% low-price threshold (BR-11)', () => {
    expect(LOW_PRICE_THRESHOLD_PERCENT).toBe(0.5);
  });

  it('reuses (does not redefine) the listing price envelope', () => {
    expect(MIN_LISTING_PRICE_SAR).toBe(1);
    expect(MAX_LISTING_PRICE_SAR).toBe(50_000_000);
  });

  it('labels every OfferStatus in Arabic with no gaps', () => {
    const statuses = Object.values(OfferStatus);
    expect(statuses).toHaveLength(10);
    for (const status of statuses) {
      expect(OFFER_STATUS_LABELS_AR[status]).toBeTruthy();
    }
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.PENDING_ADMIN_REVIEW]).toBe('قيد المراجعة الإدارية');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.EXPIRED]).toBe('منتهي الصلاحية');
    expect(OFFER_STATUS_LABELS_AR[OfferStatus.WITHDRAWN]).toBe('مسحوب');
  });

  it('partitions the enum into disjoint active and terminal sets that cover every member', () => {
    const active = new Set(ACTIVE_OFFER_STATUSES);
    const terminal = new Set(TERMINAL_OFFER_STATUSES);

    for (const status of ACTIVE_OFFER_STATUSES) {
      expect(terminal.has(status)).toBe(false);
    }

    const union = new Set([...ACTIVE_OFFER_STATUSES, ...TERMINAL_OFFER_STATUSES]);
    expect(union.size).toBe(Object.values(OfferStatus).length);
    for (const status of Object.values(OfferStatus)) {
      expect(union.has(status)).toBe(true);
    }

    // The intake status must never be treated as terminal, or A-07 stops blocking duplicates.
    expect(active.has(OfferStatus.PENDING_ADMIN_REVIEW)).toBe(true);
    expect(terminal.has(OfferStatus.REJECTED_BY_SELLER)).toBe(true);
    expect(terminal.has(OfferStatus.EXPIRED)).toBe(true);
    expect(terminal.has(OfferStatus.WITHDRAWN)).toBe(true);
  });
});
