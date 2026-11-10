import { describe, it, expect } from 'vitest';
import {
  submitFalLicenseSchema,
  licensingQueueQuerySchema,
  approveFalLicenseSchema,
  rejectFalLicenseSchema,
  forceUnlockFalLicenseSchema,
} from '../licensing.schema';
import { ProfileStatus } from '../../enums';

describe('Licensing Zod Schemas', () => {
  describe('submitFalLicenseSchema', () => {
    it('accepts valid Fal license submission payload', () => {
      const validPayload = {
        licenseNumber: '1234567890',
        certificateUrl: 'fal/certificates/cert-1.pdf',
        expiryDate: '2028-12-31T23:59:59.000Z',
        commercialName: 'مؤسسة إتمام العقارية',
        crNumber: '1010123456',
        supportingDocumentUrls: ['fal/supporting/doc1.pdf'],
      };

      const result = submitFalLicenseSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.licenseNumber).toBe('1234567890');
        expect(result.data.commercialName).toBe('مؤسسة إتمام العقارية');
      }
    });

    it('accepts 12-digit Fal license number', () => {
      const payload = {
        licenseNumber: '123456789012',
        certificateUrl: 'fal/certificates/cert-1.pdf',
        expiryDate: '2028-12-31',
        commercialName: 'شركة الوساطة الحديثة',
        crNumber: '1010987654',
      };
      const result = submitFalLicenseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects license numbers shorter than 10 digits or longer than 12 digits or non-numeric', () => {
      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '123456789', // 9 digits
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '1010123456',
        }).success,
      ).toBe(false);

      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890123', // 13 digits
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '1010123456',
        }).success,
      ).toBe(false);

      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890A',
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '1010123456',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid Saudi CR number (must be 10 digits)', () => {
      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890',
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '12345',
        }).success,
      ).toBe(false);

      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890',
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '10101234567',
        }).success,
      ).toBe(false);
    });

    it('rejects commercial name shorter than 3 characters', () => {
      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890',
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: '  أ  ',
          crNumber: '1010123456',
        }).success,
      ).toBe(false);
    });

    it('rejects more than 5 supporting document URLs', () => {
      expect(
        submitFalLicenseSchema.safeParse({
          licenseNumber: '1234567890',
          certificateUrl: 'cert.pdf',
          expiryDate: '2028-12-31',
          commercialName: 'مكتب عقار',
          crNumber: '1010123456',
          supportingDocumentUrls: ['1', '2', '3', '4', '5', '6'],
        }).success,
      ).toBe(false);
    });
  });

  describe('licensingQueueQuerySchema', () => {
    it('applies defaults for page and limit', () => {
      const result = licensingQueueQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('parses status and search correctly', () => {
      const result = licensingQueueQuerySchema.safeParse({
        status: ProfileStatus.UNDER_REVIEW,
        search: '1010123456',
        page: '2',
        limit: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(ProfileStatus.UNDER_REVIEW);
        expect(result.data.search).toBe('1010123456');
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it('caps limit at 50', () => {
      const result = licensingQueueQuerySchema.safeParse({
        limit: '100',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('approveFalLicenseSchema', () => {
    it('requires a positive integer version', () => {
      expect(approveFalLicenseSchema.safeParse({ version: 1 }).success).toBe(true);
      expect(approveFalLicenseSchema.safeParse({ version: 0 }).success).toBe(false);
      expect(approveFalLicenseSchema.safeParse({ version: -1 }).success).toBe(false);
      expect(approveFalLicenseSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('rejectFalLicenseSchema', () => {
    it('accepts valid rejection reason (>= 10 chars)', () => {
      const result = rejectFalLicenseSchema.safeParse({
        version: 1,
        rejectionReason: 'شهادة الترخيص المرفقة غير واضحة ويجب إعادة رفعها',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short rejection reasons (< 10 chars trimmed)', () => {
      const result = rejectFalLicenseSchema.safeParse({
        version: 1,
        rejectionReason: 'غير صالح   ',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forceUnlockFalLicenseSchema', () => {
    it('accepts reason >= 5 characters', () => {
      const result = forceUnlockFalLicenseSchema.safeParse({
        reason: 'المشرف غير متصل منذ أكثر من نصف ساعة',
      });
      expect(result.success).toBe(true);
    });

    it('rejects reason < 5 characters', () => {
      const result = forceUnlockFalLicenseSchema.safeParse({
        reason: 'سبب',
      });
      expect(result.success).toBe(false);
    });
  });
});

