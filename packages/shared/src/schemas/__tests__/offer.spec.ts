import { describe, it, expect } from 'vitest';
import {
  submitOfferSchema,
  offerListQuerySchema,
  counterOfferSchema,
  rejectOfferSchema,
  adminRejectOfferSchema,
  offerQueueQuerySchema,
  backupOfferQueueQuerySchema,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
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

describe('counterOfferSchema — mediated counter-offer (Story 4.2 / FR-26, FR-55)', () => {
  it('accepts a numeric price and a 2-decimal string price', () => {
    expect(counterOfferSchema.parse({ counterPrice: 1200000 }).counterPrice).toBe(1200000);
    expect(counterOfferSchema.parse({ counterPrice: '1200000.50' }).counterPrice).toBe(
      1200000.5,
    );
  });

  it('keeps the [1, 50,000,000] SAR envelope', () => {
    expect(counterOfferSchema.safeParse({ counterPrice: 1 }).success).toBe(true);
    expect(counterOfferSchema.safeParse({ counterPrice: 50_000_000 }).success).toBe(true);
    expect(counterOfferSchema.safeParse({ counterPrice: 0 }).success).toBe(false);
    expect(counterOfferSchema.safeParse({ counterPrice: 50_000_001 }).success).toBe(false);
  });

  it('rejects a non-numeric price string', () => {
    expect(counterOfferSchema.safeParse({ counterPrice: 'abc' }).success).toBe(false);
    expect(counterOfferSchema.safeParse({ counterPrice: '' }).success).toBe(false);
  });

  it('treats the round note as optional/nullable and caps it at 500 characters', () => {
    expect(counterOfferSchema.safeParse({ counterPrice: 1000, note: null }).success).toBe(true);
    expect(counterOfferSchema.safeParse({ counterPrice: 1000, note: 'ملاحظة' }).success).toBe(
      true,
    );
    expect(
      counterOfferSchema.safeParse({ counterPrice: 1000, note: 'ا'.repeat(500) }).success,
    ).toBe(true);
    expect(
      counterOfferSchema.safeParse({ counterPrice: 1000, note: 'ا'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('rejectOfferSchema — structured seller refusal (Story 4.2 / FR-55)', () => {
  it('accepts every allowed structured reason', () => {
    for (const reason of [
      'PRICE_TOO_LOW',
      'FINANCING_UNAVAILABLE',
      'PROPERTY_UNAVAILABLE',
      'TERMS_MISMATCH',
      'OTHER',
    ] as const) {
      const payload =
        reason === 'OTHER'
          ? { reason, note: 'السبب تفصيلي هنا بالكامل' }
          : { reason };
      expect(rejectOfferSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('rejects an unknown reason', () => {
    const result = rejectOfferSchema.safeParse({ reason: 'BECAUSE' });
    expect(result.success).toBe(false);
  });

  it('requires a note of at least 10 characters when the reason is OTHER', () => {
    expect(rejectOfferSchema.safeParse({ reason: 'OTHER' }).success).toBe(false);
    expect(rejectOfferSchema.safeParse({ reason: 'OTHER', note: 'قصير' }).success).toBe(false);
    expect(
      rejectOfferSchema.safeParse({ reason: 'OTHER', note: 'ا'.repeat(10) }).success,
    ).toBe(true);
  });

  it('keeps the note optional for every other reason', () => {
    expect(rejectOfferSchema.safeParse({ reason: 'PRICE_TOO_LOW' }).success).toBe(true);
    expect(
      rejectOfferSchema.safeParse({ reason: 'PRICE_TOO_LOW', note: null }).success,
    ).toBe(true);
  });
});

describe('adminRejectOfferSchema — administrative veto (Story 4.2 / AC#6)', () => {
  it('requires a reason between 5 and 500 characters', () => {
    expect(adminRejectOfferSchema.safeParse({ reason: 'أقل' }).success).toBe(false);
    expect(adminRejectOfferSchema.safeParse({ reason: 'غير مطابق' }).success).toBe(true);
    expect(adminRejectOfferSchema.safeParse({ reason: 'ا'.repeat(500) }).success).toBe(true);
    expect(adminRejectOfferSchema.safeParse({ reason: 'ا'.repeat(501) }).success).toBe(false);
  });
});

describe('offerQueueQuerySchema — admin mediation queue (Story 4.2 / AC#9)', () => {
  it('defaults page/limit to the shared pagination constants', () => {
    const parsed = offerQueueQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsed.status).toBeUndefined();
  });

  it('coerces string page/limit from the query string', () => {
    const parsed = offerQueueQuerySchema.parse({ page: '2', limit: '50' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it('accepts an OfferStatus filter and rejects an unknown one', () => {
    expect(
      offerQueueQuerySchema.safeParse({ status: OfferStatus.COUNTER_OFFERED }).success,
    ).toBe(true);
    expect(offerQueueQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });

  it('rejects page < 1 and limit above the shared maximum', () => {
    expect(offerQueueQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(offerQueueQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('backupOfferQueueQuerySchema — admin backup queue (Story 4.3 / AC#1)', () => {
  it('defaults page/limit to the shared pagination constants', () => {
    const parsed = backupOfferQueueQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsed).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE });
  });

  it('coerces string page/limit from the query string', () => {
    const parsed = backupOfferQueueQuerySchema.parse({ page: '2', limit: '50' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it('accepts the maximum limit and rejects anything above it', () => {
    expect(
      backupOfferQueueQuerySchema.parse({ limit: String(MAX_PAGE_SIZE) }).limit,
    ).toBe(MAX_PAGE_SIZE);
    expect(backupOfferQueueQuerySchema.safeParse({ limit: String(MAX_PAGE_SIZE + 1) }).success).toBe(
      false,
    );
    expect(backupOfferQueueQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('ignores any status filter — queue membership is not an operator choice', () => {
    const parsed = backupOfferQueueQuerySchema.parse({ status: 'CLOSED_BACKUP' });
    expect(parsed).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE });
  });
});
