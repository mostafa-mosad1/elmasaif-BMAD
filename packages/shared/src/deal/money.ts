/**
 * Fixed-point money helpers for the Deal money path (Story 5.1 / FR-29, BR-02).
 *
 * The one rule this module exists to enforce: **no floating point ever touches money**. Every
 * value crosses the boundary as a decimal *string* (`Prisma.Decimal.toString()` returns
 * `'3000000'`, `'3000000.5'`, `'0.00'`), is converted to a scaled bigint, and is only turned back
 * into a string at the very end. `Number()` on a price is a BR-02 defect even when it happens to
 * round correctly for the amount in the test.
 *
 * Mirrors the `masking/` folder shape: one implementation, imported by both the API and the web,
 * so the frozen preview the administrator sees is computed by the exact arithmetic the server
 * stores.
 */

/** SAR has two minor units (halalas). */
const HALALAS_PER_SAR = 100n;

/** Rate scale: 1_000_000 micros == 100 %. Matches `Decimal(5,4)` snapshot precision losslessly. */
const RATE_MICROS = 1_000_000n;

const MONEY_SCALE = 2;
const RATE_SCALE = 6;

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d*))?$/;

/**
 * Parses a non-negative decimal into a scaled bigint. Throws instead of truncating: silently
 * dropping `'1.005'` to `'1.00'` would quietly break BR-02, and Prisma never hands us more than
 * the column scale anyway.
 */
function parseScaled(value: string | number, scale: number, field: string): bigint {
  const text = String(value ?? '').trim();
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) {
    throw new Error(`${field} must be a non-negative decimal, received "${text}"`);
  }

  const [, whole, fraction = ''] = match;
  if (fraction.length > scale) {
    throw new Error(
      `${field} allows at most ${scale} decimal places, received "${text}"`,
    );
  }

  const unit = 10n ** BigInt(scale);
  const paddedFraction = fraction.padEnd(scale, '0');
  return BigInt(whole) * unit + BigInt(paddedFraction === '' ? '0' : paddedFraction);
}

/** `'3000000.00'` → `300000000n` halalas. Accepts the `number` Prisma-adjacent callers hold. */
export function parseSarToHalalas(value: string | number): bigint {
  return parseScaled(value, MONEY_SCALE, 'SAR amount');
}

/** `300000000n` → `'3000000.00'`. Always two decimals, never a float. */
export function formatHalalas(halalas: bigint): string {
  const negative = halalas < 0n;
  const absolute = negative ? -halalas : halalas;
  const whole = absolute / HALALAS_PER_SAR;
  const fraction = absolute % HALALAS_PER_SAR;
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`;
}

/** `'0.025'` → `25000n` micros. Read back from `Decimal(5,4)`, `'0.0250'` also yields `25000n`. */
export function parseRateToMicros(rate: string | number): bigint {
  return parseScaled(rate, RATE_SCALE, 'commission rate');
}

/**
 * Round-half-up at 2 dp: `(price * rate + 0.5) floor`, plus the fixed fee.
 *
 * The `+ RATE_MICROS / 2n` term is what makes 1_234.56 × 2.5 % land on 30.86 rather than 30.864,
 * and because every operand is a bigint the result is exact for any price the `Decimal(12,2)`
 * column can hold.
 */
export function computeCommissionHalalas(
  priceHalalas: bigint,
  rateMicros: bigint,
  fixedHalalas: bigint,
): bigint {
  return (priceHalalas * rateMicros + RATE_MICROS / 2n) / RATE_MICROS + fixedHalalas;
}

export interface DealAmounts {
  /** FinalDealPrice — the agreed price the buyer pays the seller. */
  finalDealPrice: string;
  /** FinalCommission — the platform's cut, rounded half-up at 2 dp. */
  finalCommission: string;
  fixedCommission: string;
  /** FinalTotal — `finalDealPrice + finalCommission`, mirrored by the DB `CHECK`. */
  finalTotal: string;
}

/**
 * FR-29: the frozen financial snapshot, computed once at binding time.
 *
 * Every return value is a 2-dp decimal string, ready to hand to Prisma's `Decimal` column and to
 * the `OfferHistory.priceSnapshot` column, which is why the helper never returns a number.
 */
export function computeDealAmounts(input: {
  dealPrice: string | number;
  commissionRate: string | number;
  fixedCommission: string | number;
}): DealAmounts {
  const priceHalalas = parseSarToHalalas(input.dealPrice);
  const rateMicros = parseRateToMicros(input.commissionRate);
  const fixedHalalas = parseSarToHalalas(input.fixedCommission);
  const commissionHalalas = computeCommissionHalalas(
    priceHalalas,
    rateMicros,
    fixedHalalas,
  );

  return {
    finalDealPrice: formatHalalas(priceHalalas),
    finalCommission: formatHalalas(commissionHalalas),
    fixedCommission: formatHalalas(fixedHalalas),
    finalTotal: formatHalalas(priceHalalas + commissionHalalas),
  };
}
