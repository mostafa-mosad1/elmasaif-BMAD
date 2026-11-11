import { describe, it, expect } from 'vitest';
import {
  createOwnerListingRequestSchema,
  dispatchOwnerContractSchema,
  rejectOwnerListingRequestSchema,
  requestModificationSchema,
  forceUnlockOwnerRequestSchema,
  ownerRequestsQueueQuerySchema,
  requestSignatureOtpSchema,
  signOwnerContractSchema,
  contractFeeQueueQuerySchema,
  uploadContractFeeProofBodySchema,
  rejectContractFeeBodySchema,
  forceUnlockContractFeeSchema,
} from '../contracts.schema';
import {
  PropertyType,
  DocumentVisibility,
  OwnerListingRequestStatus,
} from '../../enums';
import {
  OWNER_REQUEST_REJECTION_REASON_REQUIRED,
  OWNER_REQUEST_MODIFICATION_NOTES_REQUIRED,
  CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
  CONTRACT_SIGNATURE_DATA_REQUIRED,
} from '../../constants/contracts';
import { LISTING_OWNER_DEED_REQUIRED } from '../../constants/listing';

describe('Contracts & Owner Requests Schemas', () => {
  const validIban = 'SA0380000000608010167519';
  const validCityId = '11111111-0000-4000-8000-000000000001';
  const validDistrictId = '22222222-0001-4000-8000-000000000001';
  const validTemplateId = '77777777-0001-4000-8000-000000000001';

  describe('createOwnerListingRequestSchema', () => {
    const validPayload = {
      title: 'فيلا فاخرة للبيع في حي حطين',
      description: 'فيلا بتشطيب مودرن حديث ومساحات واسعة مناسبة للعائلات',
      propertyType: PropertyType.VILLA,
      cityId: validCityId,
      districtId: validDistrictId,
      streetName: 'شارع الأمير تركي',
      latitude: 24.774265,
      longitude: 46.638541,
      askPrice: 2500000,
      areaSquareMeters: 450,
      bedrooms: 5,
      yearBuilt: 2022,
      payoutIban: validIban,
      titleDeedNumber: '123456789012',
      photos: [
        {
          fileUrl: 'https://storage.elmasaif.sa/listings/photo1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024 * 500,
          isPrimary: true,
        },
        {
          fileUrl: 'https://storage.elmasaif.sa/listings/photo2.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024 * 500,
          isPrimary: false,
        },
        {
          fileUrl: 'https://storage.elmasaif.sa/listings/photo3.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024 * 500,
          isPrimary: false,
        },
      ],
      documents: [
        {
          documentType: 'TITLE_DEED',
          fileUrl: 'https://storage.elmasaif.sa/listings/deed.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024 * 1000,
          visibility: DocumentVisibility.ADMIN_ONLY,
        },
      ],
    };

    it('should validate a complete and valid owner listing request', () => {
      const parsed = createOwnerListingRequestSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should fail if title deed document is missing', () => {
      const payloadWithoutDeed = {
        ...validPayload,
        documents: [
          {
            documentType: 'FLOOR_PLAN',
            fileUrl: 'https://storage.elmasaif.sa/listings/plan.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 500,
            visibility: DocumentVisibility.PUBLIC,
          },
        ],
      };
      const result = createOwnerListingRequestSchema.safeParse(payloadWithoutDeed);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe(LISTING_OWNER_DEED_REQUIRED);
      }
    });

    it('should fail if title deed is not classified as ADMIN_ONLY', () => {
      const payloadWithPublicDeed = {
        ...validPayload,
        documents: [
          {
            documentType: 'TITLE_DEED',
            fileUrl: 'https://storage.elmasaif.sa/listings/deed.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 500,
            visibility: DocumentVisibility.PUBLIC,
          },
        ],
      };
      const result = createOwnerListingRequestSchema.safeParse(payloadWithPublicDeed);
      expect(result.success).toBe(false);
    });

    it('should fail if ask price is out of bounds', () => {
      const lowPricePayload = { ...validPayload, askPrice: 0 };
      expect(createOwnerListingRequestSchema.safeParse(lowPricePayload).success).toBe(false);

      const highPricePayload = { ...validPayload, askPrice: 999_000_000_000 };
      expect(createOwnerListingRequestSchema.safeParse(highPricePayload).success).toBe(false);
    });

    it('should fail if payout IBAN is invalid', () => {
      const invalidIbanPayload = { ...validPayload, payoutIban: 'INVALID_IBAN' };
      expect(createOwnerListingRequestSchema.safeParse(invalidIbanPayload).success).toBe(false);
    });
  });

  describe('dispatchOwnerContractSchema', () => {
    it('should validate standard dispatch with default fee', () => {
      const result = dispatchOwnerContractSchema.safeParse({
        templateId: validTemplateId,
        contractFee: DEFAULT_OWNER_CONTRACT_FEE_SAR,
      });
      expect(result.success).toBe(true);
    });

    it('should require feeOverrideReason if fee differs from 1000', () => {
      const result = dispatchOwnerContractSchema.safeParse({
        templateId: validTemplateId,
        contractFee: 500,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe(CONTRACT_FEE_OVERRIDE_REASON_REQUIRED);
      }
    });

    it('should accept fee override when non-empty reason is provided', () => {
      const result = dispatchOwnerContractSchema.safeParse({
        templateId: validTemplateId,
        contractFee: 500,
        feeOverrideReason: 'خصم ترويجي خاص بالمالك',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejectOwnerListingRequestSchema', () => {
    it('should validate valid rejection reason', () => {
      const result = rejectOwnerListingRequestSchema.safeParse({
        reason: 'صك الملكية غير واضح ويحتاج إعادة رفع',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short reason', () => {
      const result = rejectOwnerListingRequestSchema.safeParse({
        reason: 'لا',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe(OWNER_REQUEST_REJECTION_REASON_REQUIRED);
      }
    });
  });

  describe('requestModificationSchema', () => {
    it('should validate valid modification notes', () => {
      const result = requestModificationSchema.safeParse({
        notes: 'يرجى توضيح مساحة البناء الفعلية وتحديث الصور',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty or short notes', () => {
      const result = requestModificationSchema.safeParse({
        notes: 'عدل',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toBe(OWNER_REQUEST_MODIFICATION_NOTES_REQUIRED);
      }
    });
  });

  describe('forceUnlockOwnerRequestSchema', () => {
    it('should validate valid force unlock reason', () => {
      const result = forceUnlockOwnerRequestSchema.safeParse({
        reason: 'المشرف غير متاح والمهمة عاجلة',
      });
      expect(result.success).toBe(true);
    });

    it('should reject too short reason', () => {
      const result = forceUnlockOwnerRequestSchema.safeParse({
        reason: 'ف',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ownerRequestsQueueQuerySchema', () => {
    it('should supply default pagination', () => {
      const result = ownerRequestsQueueQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should parse status filter', () => {
      const result = ownerRequestsQueueQuerySchema.safeParse({
        status: OwnerListingRequestStatus.PENDING,
        page: '2',
        limit: '10',
        search: 'فيلا',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(OwnerListingRequestStatus.PENDING);
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
        expect(result.data.search).toBe('فيلا');
      }
    });
  });

  describe('requestSignatureOtpSchema', () => {
    it('should accept empty or missing object payload', () => {
      const r1 = requestSignatureOtpSchema.safeParse({});
      expect(r1.success).toBe(true);
      const r2 = requestSignatureOtpSchema.safeParse(undefined);
      expect(r2.success).toBe(true);
    });
  });

  describe('signOwnerContractSchema', () => {
    const validSignatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('should validate valid signature data and 6-digit OTP', () => {
      const res = signOwnerContractSchema.safeParse({
        signatureData: validSignatureData,
        otpCode: '123456',
      });
      expect(res.success).toBe(true);
    });

    it('should reject non-data-url signature data', () => {
      const res = signOwnerContractSchema.safeParse({
        signatureData: 'invalid-signature-string',
        otpCode: '123456',
      });
      expect(res.success).toBe(false);
    });

    it('should reject too short or empty signature data', () => {
      const res = signOwnerContractSchema.safeParse({
        signatureData: 'data:',
        otpCode: '123456',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0]?.message).toBe(CONTRACT_SIGNATURE_DATA_REQUIRED);
      }
    });

    it('should reject invalid OTP format', () => {
      const nonDigits = signOwnerContractSchema.safeParse({
        signatureData: validSignatureData,
        otpCode: '12345A',
      });
      expect(nonDigits.success).toBe(false);

      const tooShort = signOwnerContractSchema.safeParse({
        signatureData: validSignatureData,
        otpCode: '12345',
      });
      expect(tooShort.success).toBe(false);

      const tooLong = signOwnerContractSchema.safeParse({
        signatureData: validSignatureData,
        otpCode: '1234567',
      });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('Story 7.3: Contract Fee Payment Schemas', () => {
    describe('contractFeeQueueQuerySchema', () => {
      it('should validate default query parameters', () => {
        const parsed = contractFeeQueueQuerySchema.safeParse({});
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.page).toBe(1);
          expect(parsed.data.limit).toBe(20);
          expect(parsed.data.status).toBe('ALL');
        }
      });

      it('should coerce string numbers for page and limit', () => {
        const parsed = contractFeeQueueQuerySchema.safeParse({
          page: '3',
          limit: '50',
          status: 'PROOF_UPLOADED',
          search: 'فيلا',
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.page).toBe(3);
          expect(parsed.data.limit).toBe(50);
          expect(parsed.data.status).toBe('PROOF_UPLOADED');
          expect(parsed.data.search).toBe('فيلا');
        }
      });

      it('should reject invalid status filter', () => {
        const parsed = contractFeeQueueQuerySchema.safeParse({
          status: 'INVALID_STATUS',
        });
        expect(parsed.success).toBe(false);
      });
    });

    describe('uploadContractFeeProofBodySchema', () => {
      it('should accept valid optional bank reference and sender bank name', () => {
        const parsed = uploadContractFeeProofBodySchema.safeParse({
          bankReferenceCode: 'TXN-987654321',
          senderBankName: 'Al Rajhi Bank',
        });
        expect(parsed.success).toBe(true);
      });

      it('should accept empty payload', () => {
        const parsed = uploadContractFeeProofBodySchema.safeParse({});
        expect(parsed.success).toBe(true);
      });

      it('should reject reference code exceeding 64 characters', () => {
        const parsed = uploadContractFeeProofBodySchema.safeParse({
          bankReferenceCode: 'A'.repeat(65),
        });
        expect(parsed.success).toBe(false);
      });

      it('should reject sender bank name exceeding 100 characters', () => {
        const parsed = uploadContractFeeProofBodySchema.safeParse({
          senderBankName: 'B'.repeat(101),
        });
        expect(parsed.success).toBe(false);
      });
    });

    describe('rejectContractFeeBodySchema', () => {
      it('should accept a valid Arabic rejection reason', () => {
        const parsed = rejectContractFeeBodySchema.safeParse({
          reason: 'الإشعار البنكي غير واضح ولا يظهر رقم الحساب المحول إليه',
        });
        expect(parsed.success).toBe(true);
      });

      it('should reject reasons shorter than 5 characters', () => {
        const parsed = rejectContractFeeBodySchema.safeParse({
          reason: 'رفض',
        });
        expect(parsed.success).toBe(false);
      });

      it('should reject reasons exceeding 500 characters', () => {
        const parsed = rejectContractFeeBodySchema.safeParse({
          reason: 'أ'.repeat(501),
        });
        expect(parsed.success).toBe(false);
      });
    });

    describe('forceUnlockContractFeeSchema', () => {
      it('should accept valid force-unlock reason', () => {
        const parsed = forceUnlockContractFeeSchema.safeParse({
          reason: 'المشرف غير متواجد وتم تجاوز مهلة التدقيق للمهمة',
        });
        expect(parsed.success).toBe(true);
      });

      it('should reject reason shorter than 3 characters', () => {
        const parsed = forceUnlockContractFeeSchema.safeParse({
          reason: 'فك',
        });
        expect(parsed.success).toBe(false);
      });
    });
  });
});

