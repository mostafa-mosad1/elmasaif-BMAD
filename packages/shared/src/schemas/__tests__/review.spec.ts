import { describe, expect, it } from 'vitest';
import {
  moderateReviewSchema,
  reviewModerationReasonSchema,
  adminReviewQueueQuerySchema,
  REVIEW_MODERATION_MIN_REASON_LENGTH,
  REVIEW_MODERATION_MAX_REASON_LENGTH,
  REVIEW_VISIBILITY_FILTERS,
  REVIEW_NOT_FOUND,
  REVIEW_HIDDEN,
  REVIEW_UNHIDDEN,
  REVIEWS_MODERATION_QUEUE_RETRIEVED,
  REVIEW_MODERATION_DETAIL_RETRIEVED,
} from '../review.schema';

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

describe('Story 8.4 Review Moderation Schemas & Constants (AC-1)', () => {
  it('exports canonical review moderation constants and status codes', () => {
    expect(REVIEW_MODERATION_MIN_REASON_LENGTH).toBe(3);
    expect(REVIEW_MODERATION_MAX_REASON_LENGTH).toBe(500);
    expect(REVIEW_VISIBILITY_FILTERS).toEqual(['ALL', 'VISIBLE', 'HIDDEN']);
    expect(REVIEW_NOT_FOUND).toBe('REVIEW_NOT_FOUND');
    expect(REVIEW_HIDDEN).toBe('REVIEW_HIDDEN');
    expect(REVIEW_UNHIDDEN).toBe('REVIEW_UNHIDDEN');
    expect(REVIEWS_MODERATION_QUEUE_RETRIEVED).toBe('REVIEWS_MODERATION_QUEUE_RETRIEVED');
    expect(REVIEW_MODERATION_DETAIL_RETRIEVED).toBe('REVIEW_MODERATION_DETAIL_RETRIEVED');
  });

  describe('reviewModerationReasonSchema', () => {
    it('accepts a valid trimmed reason between 3 and 500 characters', () => {
      const parsed = reviewModerationReasonSchema.parse({
        reason: '  ألفاظ مسيئة أو تشهير غير نظامي  ',
      });
      expect(parsed.reason).toBe('ألفاظ مسيئة أو تشهير غير نظامي');
    });

    it('rejects missing or < 3 character reasons', () => {
      expect(() => reviewModerationReasonSchema.parse({})).toThrow();
      expect(() => reviewModerationReasonSchema.parse({ reason: 'أب' })).toThrow();
      expect(() => reviewModerationReasonSchema.parse({ reason: '   ' })).toThrow();
    });

    it('rejects reasons exceeding 500 characters', () => {
      expect(() =>
        reviewModerationReasonSchema.parse({
          reason: 'أ'.repeat(501),
        }),
      ).toThrow();
    });
  });

  describe('adminReviewQueueQuerySchema', () => {
    it('applies default visibility ALL, page 1, and limit 20 when empty', () => {
      const parsed = adminReviewQueueQuerySchema.parse({});
      expect(parsed.visibility).toBe('ALL');
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.score).toBeUndefined();
      expect(parsed.lowScoreOnly).toBeUndefined();
    });

    it('parses visibility filter, score 1..5, lowScoreOnly, targetUserId, search, and pagination', () => {
      const parsed = adminReviewQueueQuerySchema.parse({
        visibility: 'HIDDEN',
        score: '2',
        lowScoreOnly: 'true',
        targetUserId: 'user-broker-1',
        search: '  ELM-2026  ',
        page: '3',
        limit: '50',
      });
      expect(parsed.visibility).toBe('HIDDEN');
      expect(parsed.score).toBe(2);
      expect(parsed.lowScoreOnly).toBe(true);
      expect(parsed.targetUserId).toBe('user-broker-1');
      expect(parsed.search).toBe('ELM-2026');
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);
    });

    it('rejects out-of-range star scores (< 1 or > 5) and invalid visibility filters', () => {
      expect(() => adminReviewQueueQuerySchema.parse({ score: 0 })).toThrow();
      expect(() => adminReviewQueueQuerySchema.parse({ score: 6 })).toThrow();
      expect(() => adminReviewQueueQuerySchema.parse({ visibility: 'DELETED' })).toThrow();
      expect(() => adminReviewQueueQuerySchema.parse({ limit: 150 })).toThrow();
    });
  });
});
