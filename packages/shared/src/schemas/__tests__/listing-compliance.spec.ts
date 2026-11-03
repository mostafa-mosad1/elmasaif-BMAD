import { describe, it, expect } from 'vitest';
import {
  ListingStatus,
  SuspensionCategory,
  LISTING_ARCHIVE_BLOCKED_RESERVED,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS,
  LISTING_NOT_ARCHIVED,
  LISTING_NOT_SUSPENDED,
  LISTING_ALREADY_BLOCKED,
  LISTING_PERMANENTLY_BLOCKED,
  LISTING_COMPLIANCE_REASON_REQUIRED,
  LISTING_COMPLIANCE_SUSPENDED,
  archiveListingSchema,
  suspendListingSchema,
  blockListingSchema,
  unsuspendListingSchema,
  LISTING_STATUS_LABELS_AR,
  SUSPENSION_CATEGORY_LABELS_AR,
} from '../../index';

describe('Listing Compliance & Archiving Schemas and Constants (Story 2.6)', () => {
  describe('Constants and Enums', () => {
    it('defines ARCHIVED, SUSPENDED, and BLOCKED on ListingStatus enum', () => {
      expect(ListingStatus.ARCHIVED).toBe('ARCHIVED');
      expect(ListingStatus.SUSPENDED).toBe('SUSPENDED');
      expect(ListingStatus.BLOCKED).toBe('BLOCKED');
    });

    it('exports all compliance and archiving error codes', () => {
      expect(LISTING_ARCHIVE_BLOCKED_RESERVED).toBe('LISTING_ARCHIVE_BLOCKED_RESERVED');
      expect(LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL).toBe('LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL');
      expect(LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS).toBe('LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS');
      expect(LISTING_NOT_ARCHIVED).toBe('LISTING_NOT_ARCHIVED');
      expect(LISTING_NOT_SUSPENDED).toBe('LISTING_NOT_SUSPENDED');
      expect(LISTING_ALREADY_BLOCKED).toBe('LISTING_ALREADY_BLOCKED');
      expect(LISTING_PERMANENTLY_BLOCKED).toBe('LISTING_PERMANENTLY_BLOCKED');
      expect(LISTING_COMPLIANCE_REASON_REQUIRED).toBe('LISTING_COMPLIANCE_REASON_REQUIRED');
      expect(LISTING_COMPLIANCE_SUSPENDED).toBe('LISTING_COMPLIANCE_SUSPENDED');
    });

    it('defines Arabic labels for new statuses and suspension categories', () => {
      expect(LISTING_STATUS_LABELS_AR[ListingStatus.ARCHIVED]).toBe('مؤرشف');
      expect(LISTING_STATUS_LABELS_AR[ListingStatus.SUSPENDED]).toBe('معلق للامتثال');
      expect(LISTING_STATUS_LABELS_AR[ListingStatus.BLOCKED]).toBe('محظور');

      expect(SUSPENSION_CATEGORY_LABELS_AR[SuspensionCategory.MISLEADING_SPECIFICATIONS]).toBeDefined();
      expect(SUSPENSION_CATEGORY_LABELS_AR[SuspensionCategory.INVALID_FAL_LICENSE]).toBeDefined();
      expect(SUSPENSION_CATEGORY_LABELS_AR[SuspensionCategory.UNAUTHORIZED_BROKERAGE]).toBeDefined();
      expect(SUSPENSION_CATEGORY_LABELS_AR[SuspensionCategory.FRAUD_SUSPICION]).toBeDefined();
      expect(SUSPENSION_CATEGORY_LABELS_AR[SuspensionCategory.OTHER]).toBeDefined();
    });
  });

  describe('archiveListingSchema', () => {
    it('accepts empty object or undefined reason', () => {
      const parsed1 = archiveListingSchema.parse({});
      expect(parsed1.reason).toBeUndefined();

      const parsed2 = archiveListingSchema.parse({ reason: undefined });
      expect(parsed2.reason).toBeUndefined();
    });

    it('accepts valid reason up to 500 characters and trims whitespace', () => {
      const reason = '  العقار لم يعد متاحاً للبيع حالياً وتم تأجيل الصفقة  ';
      const parsed = archiveListingSchema.parse({ reason });
      expect(parsed.reason).toBe('العقار لم يعد متاحاً للبيع حالياً وتم تأجيل الصفقة');
    });

    it('rejects reason exceeding 500 characters', () => {
      const longReason = 'a'.repeat(501);
      const result = archiveListingSchema.safeParse({ reason: longReason });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500');
      }
    });
  });

  describe('suspendListingSchema', () => {
    it('validates a compliant suspension payload with category', () => {
      const payload = {
        complianceReason: 'مخالفة واضحة في رقم رخصة فال المقدمة مع الإعلان',
        suspensionCategory: SuspensionCategory.INVALID_FAL_LICENSE,
      };
      const parsed = suspendListingSchema.parse(payload);
      expect(parsed.complianceReason).toBe(payload.complianceReason);
      expect(parsed.suspensionCategory).toBe(SuspensionCategory.INVALID_FAL_LICENSE);
    });

    it('validates a compliant suspension payload without optional category', () => {
      const payload = {
        complianceReason: 'إيقاف تحفظي للاشتباه في بيانات الموقع الجغرافي',
      };
      const parsed = suspendListingSchema.parse(payload);
      expect(parsed.complianceReason).toBe(payload.complianceReason);
      expect(parsed.suspensionCategory).toBeUndefined();
    });

    it('rejects complianceReason shorter than 10 characters', () => {
      const result = suspendListingSchema.safeParse({ complianceReason: 'قصيرة' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10');
      }
    });

    it('rejects complianceReason longer than 1000 characters', () => {
      const result = suspendListingSchema.safeParse({ complianceReason: 'x'.repeat(1001) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000');
      }
    });

    it('rejects invalid suspensionCategory', () => {
      const result = suspendListingSchema.safeParse({
        complianceReason: 'سبب إيقاف تفصيلي ومكتمل الشروط',
        suspensionCategory: 'NOT_A_CATEGORY' as any,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('blockListingSchema', () => {
    it('validates a valid permanent blocking payload', () => {
      const payload = {
        blockingReason: 'مخالفة جسيمة متكررة وانتحال صفة مالك العقار برقم هوية مزور',
        violationCode: 'VIO-FAL-098',
      };
      const parsed = blockListingSchema.parse(payload);
      expect(parsed.blockingReason).toBe(payload.blockingReason);
      expect(parsed.violationCode).toBe('VIO-FAL-098');
    });

    it('validates blocking payload without optional violationCode', () => {
      const payload = {
        blockingReason: 'احتيال عقاري مثبت بموجب قرار الهيئة العامة للعقار',
      };
      const parsed = blockListingSchema.parse(payload);
      expect(parsed.blockingReason).toBe(payload.blockingReason);
      expect(parsed.violationCode).toBeUndefined();
    });

    it('rejects blockingReason shorter than 10 characters', () => {
      const result = blockListingSchema.safeParse({ blockingReason: 'حظر' });
      expect(result.success).toBe(false);
    });

    it('rejects violationCode shorter than 3 or longer than 50 characters', () => {
      expect(blockListingSchema.safeParse({
        blockingReason: 'سبب حظر نهائي كافي ومطابق للمواصفات',
        violationCode: 'AB',
      }).success).toBe(false);

      expect(blockListingSchema.safeParse({
        blockingReason: 'سبب حظر نهائي كافي ومطابق للمواصفات',
        violationCode: 'A'.repeat(51),
      }).success).toBe(false);
    });
  });

  describe('unsuspendListingSchema', () => {
    it('validates a valid resolution notes payload', () => {
      const payload = {
        resolutionNotes: 'تم التحقق من تجديد رخصة فال وتطابق بيانات الصك الإلكتروني بنجاح',
      };
      const parsed = unsuspendListingSchema.parse(payload);
      expect(parsed.resolutionNotes).toBe(payload.resolutionNotes);
    });

    it('rejects resolutionNotes shorter than 10 characters', () => {
      const result = unsuspendListingSchema.safeParse({ resolutionNotes: 'تم الحل' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10');
      }
    });

    it('rejects resolutionNotes exceeding 1000 characters', () => {
      const result = unsuspendListingSchema.safeParse({ resolutionNotes: 'y'.repeat(1001) });
      expect(result.success).toBe(false);
    });
  });
});

