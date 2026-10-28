import { describe, it, expect } from 'vitest';
import {
  advanceClockSchema,
  setClockSchema,
  clockStatusSchema,
  CLOCK_MOCK_DISALLOWED_IN_PRODUCTION,
  STATIC_OTP_DISALLOWED_IN_PRODUCTION
} from '../../index';

describe('Clock Schemas & Constants', () => {
  describe('Constants', () => {
    it('should export correct error code constants', () => {
      expect(CLOCK_MOCK_DISALLOWED_IN_PRODUCTION).toBe('CLOCK_MOCK_DISALLOWED_IN_PRODUCTION');
      expect(STATIC_OTP_DISALLOWED_IN_PRODUCTION).toBe('STATIC_OTP_DISALLOWED_IN_PRODUCTION');
    });
  });

  describe('advanceClockSchema', () => {
    it('should validate valid positive increments', () => {
      expect(advanceClockSchema.safeParse({ hours: 2 }).success).toBe(true);
      expect(advanceClockSchema.safeParse({ minutes: 30 }).success).toBe(true);
      expect(advanceClockSchema.safeParse({ seconds: 45 }).success).toBe(true);
      expect(advanceClockSchema.safeParse({ ms: 500 }).success).toBe(true);
      expect(advanceClockSchema.safeParse({ hours: 1, minutes: 15, seconds: 0, ms: 0 }).success).toBe(true);
    });

    it('should reject empty object with no increments provided', () => {
      const result = advanceClockSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject payload where all increments are zero', () => {
      const result = advanceClockSchema.safeParse({ hours: 0, minutes: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      expect(advanceClockSchema.safeParse({ hours: -1 }).success).toBe(false);
      expect(advanceClockSchema.safeParse({ minutes: -5 }).success).toBe(false);
      expect(advanceClockSchema.safeParse({ seconds: -10 }).success).toBe(false);
      expect(advanceClockSchema.safeParse({ ms: -100 }).success).toBe(false);
    });
  });

  describe('setClockSchema', () => {
    it('should validate valid ISO 8601 date string', () => {
      const result = setClockSchema.safeParse({ isoDate: '2026-10-30T10:00:00.000Z' });
      expect(result.success).toBe(true);
    });

    it('should reject non-ISO date string or malformed date', () => {
      expect(setClockSchema.safeParse({ isoDate: '2026-10-30' }).success).toBe(false);
      expect(setClockSchema.safeParse({ isoDate: 'not-a-date' }).success).toBe(false);
      expect(setClockSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('clockStatusSchema', () => {
    it('should validate complete clock status payload', () => {
      const valid = {
        now: '2026-10-28T14:50:00.000Z',
        realSystemTime: '2026-10-28T14:50:00.000Z',
        isMocked: false,
        offsetMs: 0
      };
      expect(clockStatusSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject missing fields or incorrect types', () => {
      expect(clockStatusSchema.safeParse({ now: '2026-10-28T14:50:00.000Z' }).success).toBe(false);
      expect(clockStatusSchema.safeParse({
        now: '2026-10-28T14:50:00.000Z',
        realSystemTime: '2026-10-28T14:50:00.000Z',
        isMocked: 'not-boolean',
        offsetMs: 0
      }).success).toBe(false);
    });
  });
});
