import { describe, it, expect } from 'vitest';
import {
  submitOfferSchema,
  offerListQuerySchema,
  OfferStatus,
} from '../../../src';

const LISTING_UUID = '22222222-2222-2222-2222-222222222222';

const validOffer = {
  listingId: LISTING_UUID,
  offerPrice: 1150000,
};

describe('submitOfferSchema — binding offer intake (Story 4.1 / FR-25)', () => {
  it('accepts a UUID listing with a numeric price', () => {
    const result = submitOfferSchema.safeParse(validOffer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offerPrice).toBe(1150000);
    }
  });

  it('accepts a 2-decimal price string through the listing-price coercion idiom', () => {
    const parsed = submitOfferSchema.parse({ ...validOffer, offerPrice: '1150000.50' });
    expect(parsed.offerPrice).toBe(1150000.5);
  });

  it('rejects a malformed listing UUID', () => {
    const result = submitOfferSchema.safeParse({ ...validOffer, listingId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('معرف العقار غير صالح');
    }
  });

  it('rejects a price of 0 and a price above the 50,000,000 SAR envelope', () => {
    expect(submitOfferSchema.safeParse({ ...validOffer, offerPrice: 0 }).success).toBe(false);
    expect(submitOfferSchema.safeParse({ ...validOffer, offerPrice: 50_000_001 }).success).toBe(
      false,
    );
  });

  it('accepts the envelope boundaries (1 and 50,000,000)', () => {
    expect(submitOfferSchema.safeParse({ ...validOffer, offerPrice: 1 }).success).toBe(true);
    expect(submitOfferSchema.safeParse({ ...validOffer, offerPrice: 50_000_000 }).success).toBe(
      true,
    );
  });

  it('rejects a non-numeric price string', () => {
    const result = submitOfferSchema.safeParse({ ...validOffer, offerPrice: 'abc' });
    expect(result.success).toBe(false);
  });

  it('treats the note as optional/nullable and caps it at 500 characters', () => {
    expect(submitOfferSchema.safeParse({ ...validOffer, note: null }).success).toBe(true);
    expect(submitOfferSchema.safeParse({ ...validOffer, note: 'ملاحظة قصيرة' }).success).toBe(true);
    expect(submitOfferSchema.safeParse({ ...validOffer, note: 'ا'.repeat(500) }).success).toBe(
      true,
    );
    expect(submitOfferSchema.safeParse({ ...validOffer, note: 'ا'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('defaults lowPriceConfirmation to false (BR-11 acknowledgement is opt-in)', () => {
    const parsed = submitOfferSchema.parse(validOffer);
    expect(parsed.lowPriceConfirmation).toBe(false);
    expect(
      submitOfferSchema.parse({ ...validOffer, lowPriceConfirmation: true })
        .lowPriceConfirmation,
    ).toBe(true);
  });
});

describe('offerListQuerySchema — buyer offer list filter (Story 4.1 / FR-25)', () => {
  it('accepts an empty query', () => {
    expect(offerListQuerySchema.safeParse({}).success).toBe(true);
    expect(offerListQuerySchema.safeParse({ listingId: undefined }).success).toBe(true);
  });

  it('accepts an optional listingId UUID and rejects a malformed one', () => {
    expect(offerListQuerySchema.safeParse({ listingId: LISTING_UUID }).success).toBe(true);
    expect(offerListQuerySchema.safeParse({ listingId: 'nope' }).success).toBe(false);
  });

  it('exposes the PENDING_ADMIN_REVIEW intake status on the shared enum', () => {
    expect(OfferStatus.PENDING_ADMIN_REVIEW).toBe('PENDING_ADMIN_REVIEW');
  });
});
