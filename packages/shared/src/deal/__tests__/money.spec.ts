import { describe, it, expect } from 'vitest';
import {
  computeCommissionHalalas,
  computeDealAmounts,
  formatHalalas,
  parseRateToMicros,
  parseSarToHalalas,
} from '../money';

describe('Deal money helpers (Story 5.1 / FR-29, BR-02)', () => {
  describe('parseSarToHalalas', () => {
    it('accepts every shape Prisma Decimal.toString() produces', () => {
      expect(parseSarToHalalas('3000000')).toBe(300_000_000n);
      expect(parseSarToHalalas('3000000.00')).toBe(300_000_000n);
      expect(parseSarToHalalas('3000000.5')).toBe(300_000_050n);
      expect(parseSarToHalalas('0.00')).toBe(0n);
      expect(parseSarToHalalas(0)).toBe(0n);
    });

    it('refuses to silently truncate or accept junk', () => {
      expect(() => parseSarToHalalas('1.005')).toThrow(/at most 2 decimal places/);
      expect(() => parseSarToHalalas('١٢٣')).toThrow(/non-negative decimal/);
      expect(() => parseSarToHalalas('-5.00')).toThrow(/non-negative decimal/);
      expect(() => parseSarToHalalas('1e6')).toThrow(/non-negative decimal/);
      expect(() => parseSarToHalalas('')).toThrow(/non-negative decimal/);
    });
  });

  describe('formatHalalas', () => {
    it('always emits exactly two decimals', () => {
      expect(formatHalalas(300_000_000n)).toBe('3000000.00');
      expect(formatHalalas(5n)).toBe('0.05');
      expect(formatHalalas(0n)).toBe('0.00');
      expect(formatHalalas(300_000_050n)).toBe('3000000.50');
    });

    it('round-trips through parseSarToHalalas', () => {
      for (const text of ['0.00', '30.86', '1234.56', '3000000.00']) {
        expect(formatHalalas(parseSarToHalalas(text))).toBe(text);
      }
    });
  });

  describe('parseRateToMicros', () => {
    it('maps the fraction and its Decimal(5,4) snapshot form to the same micros', () => {
      expect(parseRateToMicros(0.025)).toBe(25_000n);
      expect(parseRateToMicros('0.025')).toBe(25_000n);
      expect(parseRateToMicros('0.0250')).toBe(25_000n);
      expect(parseRateToMicros('1')).toBe(1_000_000n);
    });

    it('rejects a rate finer than the stored scale', () => {
      expect(() => parseRateToMicros('0.0250001')).toThrow(/at most 6 decimal places/);
    });
  });

  describe('computeCommissionHalalas (round-half-up at 2 dp)', () => {
    it('is exact for the largest Decimal(12,2) price', () => {
      // 9_999_999_999.99 × 2.5 % = 249_999_999.99975 → 250_000_000.00
      const price = parseSarToHalalas('9999999999.99');
      expect(
        formatHalalas(computeCommissionHalalas(price, 25_000n, 0n)),
      ).toBe('250000000.00');
    });

    it('adds the fixed fee on top of the rounded percentage', () => {
      // 1,000.00 × 2.5 % = 25.00, plus a 10.00 flat fee (1_000 halalas) → 35.00.
      const price = parseSarToHalalas('1000.00');
      expect(
        formatHalalas(computeCommissionHalalas(price, 25_000n, 1_000n)),
      ).toBe('35.00');
    });
  });

  describe('computeDealAmounts', () => {
    it('reproduces the UX journey: 3,000,000 → 75,000 → 3,075,000', () => {
      expect(
        computeDealAmounts({
          dealPrice: '3000000.00',
          commissionRate: 0.025,
          fixedCommission: '0.00',
        }),
      ).toEqual({
        finalDealPrice: '3000000.00',
        finalCommission: '75000.00',
        fixedCommission: '0.00',
        finalTotal: '3075000.00',
      });
    });

    it('rounds 1,234.56 × 2.5 % = 30.864 half-up to 30.86', () => {
      expect(
        computeDealAmounts({
          dealPrice: '1234.56',
          commissionRate: '0.025',
          fixedCommission: '0.00',
        }),
      ).toEqual({
        finalDealPrice: '1234.56',
        finalCommission: '30.86',
        fixedCommission: '0.00',
        finalTotal: '1265.42',
      });
    });

    it('keeps a zero price and a zero fixed fee at 0.00', () => {
      expect(
        computeDealAmounts({
          dealPrice: '0.00',
          commissionRate: '0.025',
          fixedCommission: '0.00',
        }),
      ).toEqual({
        finalDealPrice: '0.00',
        finalCommission: '0.00',
        fixedCommission: '0.00',
        finalTotal: '0.00',
      });
    });

    it('never loses precision that a float would (0.1 + 0.2 territory)', () => {
      expect(
        computeDealAmounts({
          dealPrice: '0.10',
          commissionRate: '0.025',
          fixedCommission: '0.20',
        }),
      ).toEqual({
        finalDealPrice: '0.10',
        finalCommission: '0.20',
        fixedCommission: '0.20',
        finalTotal: '0.30',
      });
    });

    it('keeps totalAmount = dealPrice + platformCommission for every case', () => {
      const cases: Array<[string, string]> = [
        ['3000000.00', '0.025'],
        ['1.00', '0.025'],
        ['9999999999.99', '0.0250'],
        ['250000.50', '0.0125'],
      ];
      for (const [price, rate] of cases) {
        const amounts = computeDealAmounts({
          dealPrice: price,
          commissionRate: rate,
          fixedCommission: '0.00',
        });
        expect(parseSarToHalalas(amounts.finalTotal)).toBe(
          parseSarToHalalas(amounts.finalDealPrice) +
            parseSarToHalalas(amounts.finalCommission),
        );
      }
    });
  });
});
