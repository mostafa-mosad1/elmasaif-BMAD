import { describe, it, expect } from 'vitest';
import {
  SIMILAR_LISTINGS_MAX,
  SIMILAR_LISTINGS_MIN,
  SIMILAR_LISTINGS_PRICE_TOLERANCE,
} from '../listing';

describe('Similar Listings Engine Constants (Story 3.4 / FR-18)', () => {
  it('exposes a hard cap of 6 with an expected density floor of 4', () => {
    expect(SIMILAR_LISTINGS_MAX).toBe(6);
    expect(SIMILAR_LISTINGS_MIN).toBe(4);
  });

  it('defines the ±20% price tolerance band as a ratio', () => {
    expect(SIMILAR_LISTINGS_PRICE_TOLERANCE).toBe(0.2);
    // 3,000,000 SAR baseline → 2.4M .. 3.6M window (matches AC#2 example)
    const base = 3_000_000;
    expect(base * (1 - SIMILAR_LISTINGS_PRICE_TOLERANCE)).toBe(2_400_000);
    expect(base * (1 + SIMILAR_LISTINGS_PRICE_TOLERANCE)).toBe(3_600_000);
  });

  it('keeps the density floor strictly at or below the cap', () => {
    expect(SIMILAR_LISTINGS_MIN).toBeLessThanOrEqual(SIMILAR_LISTINGS_MAX);
  });
});
