import { describe, it, expect } from 'vitest';
import { buildDealNumber, buildDealReferenceCode, buildDealShortCode } from '../identity';

const DEAL_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('Deal identifiers (Story 5.1 / AC-7)', () => {
  it('derives a 10-character upper-case hex short code from the UUID', () => {
    const short = buildDealShortCode(DEAL_ID);
    expect(short).toBe('A1B2C3D4E5');
    expect(short).toHaveLength(10);
    expect(short).toMatch(/^[0-9A-F]{10}$/);
  });

  it('is stable and collision-resistant per id', () => {
    expect(buildDealShortCode(DEAL_ID)).toBe(buildDealShortCode(DEAL_ID));
    expect(buildDealShortCode(DEAL_ID)).not.toBe(
      buildDealShortCode('ffffffff-0000-4000-8000-000000000001'),
    );
  });

  it('builds ELM-<SHORT>-C', () => {
    expect(buildDealReferenceCode(DEAL_ID)).toBe('ELM-A1B2C3D4E5-C');
  });

  it('builds DL-yyyyMMdd-<SHORT> from the injected clock instant only', () => {
    expect(buildDealNumber(DEAL_ID, new Date('2026-11-06T09:00:00.000Z'))).toBe(
      'DL-20261106-A1B2C3D4E5',
    );
    // A different instant of the same day yields the same number; the next day does not.
    expect(buildDealNumber(DEAL_ID, new Date('2026-11-06T23:59:59.000Z'))).toBe(
      'DL-20261106-A1B2C3D4E5',
    );
    expect(buildDealNumber(DEAL_ID, new Date('2026-11-07T00:00:00.000Z'))).toBe(
      'DL-20261107-A1B2C3D4E5',
    );
  });

  it('zero-pads single digit months and days', () => {
    expect(buildDealNumber(DEAL_ID, new Date('2026-01-05T00:00:00.000Z'))).toBe(
      'DL-20260105-A1B2C3D4E5',
    );
  });

  it('is timezone-independent (components read in UTC)', () => {
    // 2026-11-06T21:30Z is 2026-11-07 in Riyadh; the identifier must not follow the host TZ.
    expect(buildDealNumber(DEAL_ID, new Date('2026-11-06T21:30:00.000Z'))).toBe(
      'DL-20261106-A1B2C3D4E5',
    );
  });
});
