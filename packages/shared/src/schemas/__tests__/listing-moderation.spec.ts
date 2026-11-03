import { describe, it, expect } from 'vitest';
import {
  LISTING_LOCK_DURATION_MINUTES,
  LISTING_LOCK_DURATION_MS,
  LISTING_LOCK_HEARTBEAT_INTERVAL_MS,
  LISTING_LOCK_CONFLICT,
  LISTING_LOCK_REQUIRED,
  LISTING_LOCK_EXPIRED,
  LISTING_VERSION_CONFLICT,
  LISTING_INVALID_STATE_TRANSITION,
  LISTING_REJECTION_REASON_REQUIRED,
  LISTING_FORCE_UNLOCK_REASON_REQUIRED,
  listingModerationQueueQuerySchema,
  approveListingSchema,
  rejectListingSchema,
  forceUnlockListingSchema,
  createPriceSuggestionSchema,
  respondPriceSuggestionSchema,
  PRICE_SUGGESTION_NOT_FOUND,
  PRICE_SUGGESTION_ALREADY_RESPONDED,
  PRICE_SUGGESTION_SAME_AS_CURRENT,
  PRICE_SUGGESTION_REASON_REQUIRED,
  PriceSuggestionStatus,
  ListingStatus,
  PropertyType,
} from '../../index';

describe('Listing Moderation Constants & Schemas (Story 2.4)', () => {
  describe('Moderation Locking Constants', () => {
    it('defines 15-minute lock duration and 5-minute heartbeat interval', () => {
      expect(LISTING_LOCK_DURATION_MINUTES).toBe(15);
      expect(LISTING_LOCK_DURATION_MS).toBe(15 * 60 * 1000);
      expect(LISTING_LOCK_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
    });

    it('exports all required error codes', () => {
      expect(LISTING_LOCK_CONFLICT).toBe('LISTING_LOCK_CONFLICT');
      expect(LISTING_LOCK_REQUIRED).toBe('LISTING_LOCK_REQUIRED');
      expect(LISTING_LOCK_EXPIRED).toBe('LISTING_LOCK_EXPIRED');
      expect(LISTING_VERSION_CONFLICT).toBe('LISTING_VERSION_CONFLICT');
      expect(LISTING_INVALID_STATE_TRANSITION).toBe('LISTING_INVALID_STATE_TRANSITION');
      expect(LISTING_REJECTION_REASON_REQUIRED).toBe('LISTING_REJECTION_REASON_REQUIRED');
      expect(LISTING_FORCE_UNLOCK_REASON_REQUIRED).toBe('LISTING_FORCE_UNLOCK_REASON_REQUIRED');
    });
  });

  describe('listingModerationQueueQuerySchema', () => {
    it('defaults status to PENDING_REVIEW, page to 1, and limit to 20', () => {
      const parsed = listingModerationQueueQuerySchema.parse({});
      expect(parsed.status).toBe(ListingStatus.PENDING_REVIEW);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });

    it('accepts valid status, pagination, cityId, and propertyType filters', () => {
      const parsed = listingModerationQueueQuerySchema.parse({
        status: ListingStatus.REJECTED,
        page: '2',
        limit: '50',
        cityId: '550e8400-e29b-41d4-a716-446655440000',
        propertyType: PropertyType.VILLA,
      });
      expect(parsed.status).toBe(ListingStatus.REJECTED);
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
      expect(parsed.cityId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(parsed.propertyType).toBe(PropertyType.VILLA);
    });

    it('rejects invalid page or limit', () => {
      expect(() =>
        listingModerationQueueQuerySchema.parse({ page: 0 }),
      ).toThrow();
      expect(() =>
        listingModerationQueueQuerySchema.parse({ limit: 500 }),
      ).toThrow();
    });
  });

  describe('approveListingSchema', () => {
    it('validates positive integer version and optional notes', () => {
      const parsed = approveListingSchema.parse({
        version: 1,
        notes: '  تمت مراجعة الصك ورخصة فال  ',
      });
      expect(parsed.version).toBe(1);
      expect(parsed.notes).toBe('تمت مراجعة الصك ورخصة فال');
    });

    it('rejects non-positive or missing version', () => {
      expect(() => approveListingSchema.parse({})).toThrow();
      expect(() => approveListingSchema.parse({ version: 0 })).toThrow();
      expect(() => approveListingSchema.parse({ version: -1 })).toThrow();
    });
  });

  describe('rejectListingSchema', () => {
    it('validates version and mandatory rejectionReason (>= 10 chars)', () => {
      const parsed = rejectListingSchema.parse({
        version: 2,
        rejectionReason: '  صورة الصك غير واضحة ويرجى إعادة رفعها بدقة عالية  ',
      });
      expect(parsed.version).toBe(2);
      expect(parsed.rejectionReason).toBe('صورة الصك غير واضحة ويرجى إعادة رفعها بدقة عالية');
    });

    it('rejects short rejectionReason (< 10 chars)', () => {
      const result = rejectListingSchema.safeParse({
        version: 1,
        rejectionReason: 'غير واضح',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('سبب الرفض يجب ألا يقل عن 10 أحرف');
      }
    });
  });

  describe('forceUnlockListingSchema', () => {
    it('validates mandatory reason (>= 5 chars)', () => {
      const parsed = forceUnlockListingSchema.parse({
        reason: '  انقطاع اتصال المشرف المناوب  ',
      });
      expect(parsed.reason).toBe('انقطاع اتصال المشرف المناوب');
    });

    it('rejects short reason (< 5 chars)', () => {
      const result = forceUnlockListingSchema.safeParse({
        reason: 'abc',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف');
      }
    });
  });

  describe('Price Suggestion Constants, Enum & Schemas (Story 2.5)', () => {
    it('exports PriceSuggestionStatus enum and error constants', () => {
      expect(PriceSuggestionStatus.PENDING).toBe('PENDING');
      expect(PriceSuggestionStatus.ACCEPTED).toBe('ACCEPTED');
      expect(PriceSuggestionStatus.DECLINED).toBe('DECLINED');
      expect(PriceSuggestionStatus.SUPERSEDED).toBe('SUPERSEDED');
      expect(PRICE_SUGGESTION_NOT_FOUND).toBe('PRICE_SUGGESTION_NOT_FOUND');
      expect(PRICE_SUGGESTION_ALREADY_RESPONDED).toBe('PRICE_SUGGESTION_ALREADY_RESPONDED');
      expect(PRICE_SUGGESTION_SAME_AS_CURRENT).toBe('PRICE_SUGGESTION_SAME_AS_CURRENT');
      expect(PRICE_SUGGESTION_REASON_REQUIRED).toBe('PRICE_SUGGESTION_REASON_REQUIRED');
    });

    it('validates createPriceSuggestionSchema with valid suggestedPrice and reason', () => {
      const parsed = createPriceSuggestionSchema.parse({
        suggestedPrice: 2150000,
        reason: '  متوسط سعر المتر في حي الملقا للفلل المشابهة هو 8,600 ريال بناءً على الصفقات الأخيرة  ',
      });
      expect(parsed.suggestedPrice).toBe(2150000);
      expect(parsed.reason).toBe('متوسط سعر المتر في حي الملقا للفلل المشابهة هو 8,600 ريال بناءً على الصفقات الأخيرة');
    });

    it('accepts numeric string for suggestedPrice in createPriceSuggestionSchema', () => {
      const parsed = createPriceSuggestionSchema.parse({
        suggestedPrice: '1850000.50',
        reason: 'تقييم استرشادي بناءً على موقع العقار وحركة السوق الحالية في المنطقة',
      });
      expect(parsed.suggestedPrice).toBe(1850000.5);
    });

    it('rejects out-of-range suggestedPrice or short reason (< 10 chars) in createPriceSuggestionSchema', () => {
      expect(
        createPriceSuggestionSchema.safeParse({
          suggestedPrice: 0,
          reason: 'سبب وجيه وكافٍ لتعديل السعر المطلوب',
        }).success,
      ).toBe(false);

      expect(
        createPriceSuggestionSchema.safeParse({
          suggestedPrice: 60_000_000,
          reason: 'سبب وجيه وكافٍ لتعديل السعر المطلوب',
        }).success,
      ).toBe(false);

      const shortReason = createPriceSuggestionSchema.safeParse({
        suggestedPrice: 1500000,
        reason: 'قصير',
      });
      expect(shortReason.success).toBe(false);
    });

    it('validates respondPriceSuggestionSchema with optional sellerResponseNote', () => {
      expect(respondPriceSuggestionSchema.parse({})).toEqual({});
      const parsed = respondPriceSuggestionSchema.parse({
        sellerResponseNote: '  موافق على السعر الاسترشادي المقترح لتسريع البيع  ',
      });
      expect(parsed.sellerResponseNote).toBe('موافق على السعر الاسترشادي المقترح لتسريع البيع');
    });
  });
});

