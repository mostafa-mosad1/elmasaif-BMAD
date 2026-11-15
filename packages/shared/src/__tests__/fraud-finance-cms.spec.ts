import { describe, it, expect } from 'vitest';
import {
  FraudEventType,
  FraudSeverity,
  FraudStatus,
  CmsPageCategory,
  AnnouncementBannerType,
  FaqCategory,
  NoteEntityType,
} from '../enums';
import {
  AUDIT_ACTION_FRAUD_LOGGED,
  AUDIT_ACTION_FRAUD_RESOLVED,
  AUDIT_ACTION_PENALTY_RECORDED,
  AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED,
  AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED,
  SAUDI_VAT_RATE,
  AUDIT_ACTION_CMS_PAGE_UPDATED,
  AUDIT_ACTION_BANNER_SAVED,
  AUDIT_ACTION_INTERNAL_NOTE_CREATED,
} from '../constants';
import {
  createFraudLogSchema,
  resolveFraudLogSchema,
  financialReportQuerySchema,
  upsertCmsPageSchema,
  upsertBannerSchema,
  upsertFaqItemSchema,
  createInternalNoteSchema,
} from '../schemas';

describe('Story 8.9 Shared Domain Contracts - Fraud, Finance, CMS & Notes', () => {
  describe('Enums & Constants', () => {
    it('should export all Fraud enums and audit constants', () => {
      expect(FraudEventType.REPEATED_REJECTED_PROOFS).toBe('REPEATED_REJECTED_PROOFS');
      expect(FraudEventType.REPEATED_IBAN_CHANGES).toBe('REPEATED_IBAN_CHANGES');
      expect(FraudEventType.MANUAL_SUSPICIOUS_REPORT).toBe('MANUAL_SUSPICIOUS_REPORT');

      expect(FraudSeverity.LOW).toBe('LOW');
      expect(FraudSeverity.CRITICAL).toBe('CRITICAL');

      expect(FraudStatus.OPEN).toBe('OPEN');
      expect(FraudStatus.RESOLVED).toBe('RESOLVED');

      expect(AUDIT_ACTION_FRAUD_LOGGED).toBe('FRAUD_LOGGED');
      expect(AUDIT_ACTION_FRAUD_RESOLVED).toBe('FRAUD_RESOLVED');
      expect(AUDIT_ACTION_PENALTY_RECORDED).toBe('COMPLIANCE_PENALTY_RECORDED');
      expect(AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED).toBe('MARKETER_FRAUD_SUSPENDED');
    });

    it('should export CMS and Notes enums and constants', () => {
      expect(CmsPageCategory.LEGAL_TERMS).toBe('LEGAL_TERMS');
      expect(AnnouncementBannerType.WARNING).toBe('WARNING');
      expect(FaqCategory.BUYER).toBe('BUYER');
      expect(NoteEntityType.LISTING).toBe('LISTING');

      expect(AUDIT_ACTION_CMS_PAGE_UPDATED).toBe('CMS_PAGE_UPDATED');
      expect(AUDIT_ACTION_BANNER_SAVED).toBe('ANNOUNCEMENT_BANNER_SAVED');
      expect(AUDIT_ACTION_INTERNAL_NOTE_CREATED).toBe('INTERNAL_NOTE_CREATED');
      expect(AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED).toBe('FINANCIAL_REPORT_EXPORTED');
      expect(SAUDI_VAT_RATE).toBe(0.15);
    });
  });

  describe('Zod Schemas', () => {
    it('should validate createFraudLogSchema correctly', () => {
      const valid = {
        targetUserId: 'a0000000-0000-0000-0000-000000000001',
        eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
        severity: FraudSeverity.HIGH,
        detectedReasons: ['3 rejected payment proofs within 72h'],
        description: 'Repeatedly uploaded fraudulent payment receipts',
        penaltySar: 500,
        suspendMarketer: true,
      };
      const parsed = createFraudLogSchema.safeParse(valid);
      expect(parsed.success).toBe(true);

      const invalidDesc = {
        ...valid,
        description: 'short',
      };
      expect(createFraudLogSchema.safeParse(invalidDesc).success).toBe(false);

      const emptyReasons = {
        ...valid,
        detectedReasons: [],
      };
      expect(createFraudLogSchema.safeParse(emptyReasons).success).toBe(false);
    });

    it('should validate resolveFraudLogSchema correctly', () => {
      const valid = {
        status: FraudStatus.RESOLVED,
        resolutionNotes: 'Reviewed bank confirmation; issue resolved.',
      };
      expect(resolveFraudLogSchema.safeParse(valid).success).toBe(true);

      const invalidStatus = {
        status: FraudStatus.OPEN,
        resolutionNotes: 'Short',
      };
      expect(resolveFraudLogSchema.safeParse(invalidStatus).success).toBe(false);
    });

    it('should validate financialReportQuerySchema correctly', () => {
      const parsed = financialReportQuerySchema.safeParse({
        page: '2',
        limit: '50',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(2);
        expect(parsed.data.limit).toBe(50);
      }
    });

    it('should validate upsertCmsPageSchema with kebab-case slug', () => {
      const valid = {
        slug: 'terms-of-service',
        title: 'شروط الخدمة',
        category: CmsPageCategory.LEGAL_TERMS,
        content: 'هذه هي الشروط والأحكام الخاصة بالمنصة...',
        isPublished: true,
        displayOrder: 1,
      };
      expect(upsertCmsPageSchema.safeParse(valid).success).toBe(true);

      const invalidSlug = {
        ...valid,
        slug: 'Terms Of Service!',
      };
      expect(upsertCmsPageSchema.safeParse(invalidSlug).success).toBe(false);
    });

    it('should validate upsertBannerSchema correctly', () => {
      const valid = {
        title: 'تنبيه صيانة',
        content: 'سيتم إجراء صيانة مجدولة للمنصة',
        bannerType: AnnouncementBannerType.INFO,
        isActive: true,
      };
      expect(upsertBannerSchema.safeParse(valid).success).toBe(true);
    });

    it('should validate upsertFaqItemSchema correctly', () => {
      const valid = {
        questionAr: 'كيف يتم توثيق الصفقات؟',
        answerAr: 'يتم توثيق الصفقات عبر التحويل البنكي المعتمد وتوقيع العقود.',
        category: FaqCategory.GENERAL,
        displayOrder: 1,
        isPublished: true,
      };
      expect(upsertFaqItemSchema.safeParse(valid).success).toBe(true);
    });

    it('should validate createInternalNoteSchema with 1..1000 char bounds and UUID', () => {
      const valid = {
        entityType: NoteEntityType.LISTING,
        entityId: 'b0000000-0000-0000-0000-000000000002',
        content: 'ملاحظة داخلية للمشرف بخصوص صك الملكية',
      };
      expect(createInternalNoteSchema.safeParse(valid).success).toBe(true);

      const invalidUuid = {
        ...valid,
        entityId: 'not-a-uuid',
      };
      expect(createInternalNoteSchema.safeParse(invalidUuid).success).toBe(false);

      const emptyContent = {
        ...valid,
        content: '',
      };
      expect(createInternalNoteSchema.safeParse(emptyContent).success).toBe(false);
    });
  });
});

