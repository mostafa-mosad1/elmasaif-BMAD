import { z } from 'zod';
import {
  PropertyType,
  DocumentVisibility,
  OwnerListingRequestStatus,
} from '../enums';
import {
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  SAUDI_BOUNDS,
  MIN_LISTING_PHOTOS,
  MAX_LISTING_PHOTOS,
  LISTING_OWNER_DEED_REQUIRED,
} from '../constants/listing';
import {
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
  CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
  OWNER_REQUEST_REJECTION_REASON_REQUIRED,
  OWNER_REQUEST_MODIFICATION_NOTES_REQUIRED,
  CONTRACT_SIGNATURE_DATA_REQUIRED,
} from '../constants/contracts';
import { listingPhotoItemSchema, listingDocumentItemSchema } from './listing.schema';
import { saudiIbanSchema } from './index';

export const createOwnerListingRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, 'عنوان العقار يجب ألا يقل عن 5 أحرف')
      .max(150, 'عنوان العقار يجب ألا يتجاوز 150 حرفاً'),
    description: z
      .string()
      .trim()
      .min(10, 'وصف العقار يجب ألا يقل عن 10 أحرف')
      .max(3000, 'وصف العقار يجب ألا يتجاوز 3000 حرف'),
    propertyType: z.nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'نوع العقار غير صالح' }),
    }),
    cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
    districtId: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة'),
    streetName: z.string().trim().max(150).optional().nullable(),
    latitude: z
      .number()
      .min(SAUDI_BOUNDS.minLat, 'خط العرض خارج النطاق الجغرافي للمملكة العربية السعودية')
      .max(SAUDI_BOUNDS.maxLat, 'خط العرض خارج النطاق الجغرافي للمملكة العربية السعودية'),
    longitude: z
      .number()
      .min(SAUDI_BOUNDS.minLng, 'خط الطول خارج النطاق الجغرافي للمملكة العربية السعودية')
      .max(SAUDI_BOUNDS.maxLng, 'خط الطول خارج النطاق الجغرافي للمملكة العربية السعودية'),
    askPrice: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'السعر المطلوب غير صحيح (أرقام عشرية صحيحة)'),
      ])
      .pipe(z.coerce.number())
      .refine(
        (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
        {
          message: `السعر المطلوب يجب أن يكون بين ${MIN_LISTING_PRICE_SAR.toLocaleString()} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
        },
      ),
    areaSquareMeters: z
      .number()
      .positive('مساحة العقار يجب أن تكون قيمة موجبة')
      .max(10_000_000, 'مساحة العقار غير منطقية'),
    bedrooms: z.number().int().min(0).max(100).optional().nullable(),
    yearBuilt: z
      .number()
      .int()
      .min(1900, 'سنة البناء غير صالحة')
      .max(new Date().getFullYear() + 5, 'سنة البناء غير صالحة')
      .optional()
      .nullable(),
    payoutIban: saudiIbanSchema,
    titleDeedNumber: z
      .string()
      .trim()
      .min(1, 'رقم صك الملكية مطلوب')
      .max(50, 'رقم صك الملكية يجب ألا يتجاوز 50 حرفاً'),
    photos: z
      .array(listingPhotoItemSchema)
      .min(MIN_LISTING_PHOTOS, `يجب إرفاق ${MIN_LISTING_PHOTOS} صور على الأقل للعقار`)
      .max(MAX_LISTING_PHOTOS, `لا يمكن إرفاق أكثر من ${MAX_LISTING_PHOTOS} صورة`),
    documents: z
      .array(listingDocumentItemSchema)
      .min(1, 'يجب إرفاق وثيقة صك الملكية الإلكتروني على الأقل')
      .refine(
        (docs) =>
          docs.some(
            (d) =>
              d.documentType === 'TITLE_DEED' &&
              d.visibility === DocumentVisibility.ADMIN_ONLY,
          ),
        {
          message: LISTING_OWNER_DEED_REQUIRED,
          path: ['documents'],
        },
      ),
  });

export const dispatchOwnerContractSchema = z
  .object({
    templateId: z.string().uuid('معرف قالب العقد يجب أن يكون بصيغة UUID صالحة'),
    contractFee: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'قيمة رسوم العقد غير صالحة'),
      ])
      .pipe(z.coerce.number().min(0, 'رسوم العقد يجب ألا تكون سالبة'))
      .default(DEFAULT_OWNER_CONTRACT_FEE_SAR),
    feeOverrideReason: z.string().trim().max(500).optional().nullable(),
    customTerms: z.string().trim().max(5000).optional().nullable(),
  })
  .refine(
    (data) => {
      const fee = Number(data.contractFee);
      if (fee !== DEFAULT_OWNER_CONTRACT_FEE_SAR) {
        return Boolean(data.feeOverrideReason && data.feeOverrideReason.trim().length >= 3);
      }
      return true;
    },
    {
      message: CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
      path: ['feeOverrideReason'],
    },
  );

export const rejectOwnerListingRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, OWNER_REQUEST_REJECTION_REASON_REQUIRED)
    .max(1000, 'سبب الرفض يجب ألا يتجاوز 1000 حرف'),
});

export const requestModificationSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(5, OWNER_REQUEST_MODIFICATION_NOTES_REQUIRED)
    .max(1000, 'ملاحظات التعديل يجب ألا تتجاوز 1000 حرف'),
});

export const forceUnlockOwnerRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'سبب فك القفل الإجباري مطلوب (3 أحرف على الأقل)')
    .max(500, 'سبب فك القفل يجب ألا يتجاوز 500 حرف'),
});

export const ownerRequestsQueueQuerySchema = z.object({
  page: z
    .union([z.number(), z.string()])
    .optional()
    .default(1)
    .pipe(z.coerce.number().int().min(1)),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .default(20)
    .pipe(z.coerce.number().int().min(1).max(100)),
  status: z.nativeEnum(OwnerListingRequestStatus).optional(),
  search: z.string().trim().optional(),
});

export const requestSignatureOtpSchema = z.object({}).optional().default({});

export const signOwnerContractSchema = z.object({
  signatureData: z
    .string()
    .trim()
    .min(10, CONTRACT_SIGNATURE_DATA_REQUIRED)
    .refine((data) => data.startsWith('data:image/'), {
      message: 'بيانات التوقيع يجب أن تكون بصيغة صورة صالحة (data:image/...)',
    }),
  otpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'رمز التحقق يجب أن يتكون من 6 أرقام'),
});


