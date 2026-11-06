import {
  DEAL_NUMBER_PREFIX,
  DEAL_REFERENCE_PREFIX,
  DEAL_REFERENCE_SUFFIX,
  DEAL_SHORT_CODE_LENGTH,
} from '../constants/deal';

/**
 * Human-facing Deal identifiers (Story 5.1 / AC-7).
 *
 * Documented deviation from the UX journey's `ELM-408-C`: the spine has no counter/sequence table
 * and the deal id is a UUID, so the short code is the first 10 hex characters of the UUID. That is
 * ~1.1 × 10^12 states, which makes the `@unique` constraints a safety net rather than a birthday
 * problem, and keeps the reference short enough to type into a bank transfer.
 */

/** `'a1b2c3d4-e5f6-…'` → `'A1B2C3D4E5'`. */
export function buildDealShortCode(id: string): string {
  return id
    .replace(/-/g, '')
    .slice(0, DEAL_SHORT_CODE_LENGTH)
    .toUpperCase();
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * `DL-yyyyMMdd-XXXXXXXXXX`, with the date taken from the caller's `ClockService` instant (AD-11 —
 * never from a fresh `new Date()`, or the deadline and the number could disagree about the day).
 *
 * The components are read in UTC on purpose: the identifier must be identical for every server
 * process regardless of its local timezone.
 */
export function buildDealNumber(id: string, now: Date): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
  const mm = pad2(now.getUTCMonth() + 1);
  const dd = pad2(now.getUTCDate());
  return `${DEAL_NUMBER_PREFIX}-${yyyy}${mm}${dd}-${buildDealShortCode(id)}`;
}

/** `ELM-XXXXXXXXXX-C` — the code the buyer quotes when transferring. */
export function buildDealReferenceCode(id: string): string {
  return `${DEAL_REFERENCE_PREFIX}-${buildDealShortCode(id)}-${DEAL_REFERENCE_SUFFIX}`;
}
