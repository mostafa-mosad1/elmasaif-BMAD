import { describe, expect, it } from 'vitest';
import { moderateReviewSchema } from '../review.schema';

describe('moderateReviewSchema (Story 6.5 / AC-8, FR-52)', () => {
  it('validates valid review moderation payload', () => {
    const valid = {
      isHidden: true,
      reason: 'يحتوي على عبارات مسيئة وغير لائقة',
    };
    const parsed = moderateReviewSchema.parse(valid);
    expect(parsed.isHidden).toBe(true);
    expect(parsed.reason).toBe('يحتوي على عبارات مسيئة وغير لائقة');
  });

  it('allows unhiding (isHidden: false) with valid reason', () => {
    const valid = {
      isHidden: false,
      reason: 'تم التحقق من صحة التقييم وإعادة إتاحته',
    };
    const parsed = moderateReviewSchema.parse(valid);
    expect(parsed.isHidden).toBe(false);
  });

  it('rejects missing isHidden', () => {
    expect(() =>
      moderateReviewSchema.parse({
        reason: 'سبب بدون حالة',
      }),
    ).toThrow();
  });

  it('rejects short reason (less than 3 characters)', () => {
    expect(() =>
      moderateReviewSchema.parse({
        isHidden: true,
        reason: 'لا',
      }),
    ).toThrow();
  });

  it('rejects empty or whitespace-only reason', () => {
    expect(() =>
      moderateReviewSchema.parse({
        isHidden: true,
        reason: '   ',
      }),
    ).toThrow();
  });
});

