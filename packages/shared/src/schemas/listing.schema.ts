import { z } from 'zod';
import { PropertyType, DocumentVisibility, ListingStatus } from '../enums';
import { saudiIbanSchema } from './index';
import {
  MAX_LISTING_FILE_SIZE_BYTES,
  MIN_LISTING_PHOTOS,
  MAX_LISTING_PHOTOS,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  SAUDI_BOUNDS,
} from '../constants/listing';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

export const listingPhotoItemSchema = z.object({
  fileUrl: z.string().min(1, 'رابط الصورة مطلوب'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'نوع ملف الصورة غير مدعوم (يجب أن يكون JPEG, PNG, أو WebP)' }),
  }),
  fileSize: z.number().int().positive().max(MAX_LISTING_FILE_SIZE_BYTES, 'حجم الصورة يتجاوز الحد الأقصى (10 ميجابايت)'),
  isPrimary: z.boolean().default(false),
});

export const listingDocumentItemSchema = z.object({
  documentType: z.enum(['TITLE_DEED', 'OWNER_AUTHORIZATION', 'FLOOR_PLAN', 'COMMERCIAL_REGISTRATION', 'OTHER'], {
    errorMap: () => ({ message: 'نوع المستند غير صالح' }),
  }),
  fileUrl: z.string().min(1, 'رابط المستند مطلوب'),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'نوع ملف المستند غير مدعوم' }),
  }),
  fileSize: z.number().int().positive().max(MAX_LISTING_FILE_SIZE_BYTES, 'حجم المستند يتجاوز الحد الأقصى (10 ميجابايت)'),
  visibility: z.nativeEnum(DocumentVisibility, {
    errorMap: () => ({ message: 'تصنيف خصوصية المستند غير صالح' }),
  }),
});

export const createListingSchema = z
  .object({
    title: z.string().trim().min(5, 'عنوان العقار يجب ألا يقل عن 5 أحرف').max(150, 'عنوان العقار يجب ألا يتجاوز 150 حرفاً'),
    description: z.string().trim().min(10, 'وصف العقار يجب ألا يقل عن 10 أحرف').max(3000, 'وصف العقار يجب ألا يتجاوز 3000 حرف'),
    propertyType: z.nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'نوع العقار غير صالح' }),
    }),
    cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
    districtId: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة'),
    // Optional legacy text fields during transition
    city: z.string().optional(),
    district: z.string().optional(),
    streetName: z.string().trim().max(150).optional().nullable(),
    latitude: z.number().min(SAUDI_BOUNDS.minLat, 'خط العرض خارج النطاق الجغرافي للمملكة العربية السعودية').max(SAUDI_BOUNDS.maxLat, 'خط العرض خارج النطاق الجغرافي للمملكة العربية السعودية'),
    longitude: z.number().min(SAUDI_BOUNDS.minLng, 'خط الطول خارج النطاق الجغرافي للمملكة العربية السعودية').max(SAUDI_BOUNDS.maxLng, 'خط الطول خارج النطاق الجغرافي للمملكة العربية السعودية'),
    askPrice: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'السعر المطلوب غير صحيح (أرقام عشرية صحيحة)'),
      ])
      .pipe(z.coerce.number())
      .refine(
        (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
        {
          message: `السعر المطلوب يجب أن يكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
        },
      ),
    areaSquareMeters: z
      .number()
      .positive('المساحة يجب أن تكون أكبر من صفر')
      .max(10_000_000, 'المساحة تتجاوز الحد الأقصى المسموح'),
    bedrooms: z.number().int().min(0).max(100).optional().nullable(),
    yearBuilt: z
      .number()
      .int()
      .min(1900, 'سنة البناء غير صالحة')
      .max(new Date().getFullYear() + 1, 'سنة البناء لا يمكن أن تكون في المستقبل البعيد')
      .optional()
      .nullable(),
    payoutIban: saudiIbanSchema,
    photos: z
      .array(listingPhotoItemSchema)
      .min(MIN_LISTING_PHOTOS, `يجب رفع ${MIN_LISTING_PHOTOS} صور على الأقل`)
      .max(MAX_LISTING_PHOTOS, `الحد الأقصى للصور هو ${MAX_LISTING_PHOTOS} صورة`),
    documents: z
      .array(listingDocumentItemSchema)
      .min(1, 'يجب إرفاق مستند رسمي واحد على الأقل'),
  })
  // Explicitly strip any bathrooms input per BR-13 (bathrooms strictly omitted from data model)
  .transform(({ ...data }: any) => {
    delete data.bathrooms;
    return data;
  });

export const listingModerationQueueQuerySchema = z.object({
  status: z
    .nativeEnum(ListingStatus, {
      errorMap: () => ({ message: 'حالة المراجعة غير صالحة' }),
    })
    .optional()
    .default(ListingStatus.PENDING_REVIEW),
  page: z.coerce.number().int().min(1, 'رقم الصفحة يجب أن يكون 1 أو أكثر').optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE, `الحد الأقصى لعدد العناصر هو ${MAX_PAGE_SIZE}`)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
  cityId: z.string().uuid('معرف المدينة غير صالح').optional(),
  propertyType: z
    .nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'نوع العقار غير صالح' }),
    })
    .optional(),
});

export const approveListingSchema = z.object({
  version: z.number().int().positive('رقم النسخة (version) مطلوب للتأكد من عدم تعارض التعديلات'),
  notes: z.string().trim().max(1000, 'الملاحظات يجب ألا تتجاوز 1000 حرف').optional(),
});

export const rejectListingSchema = z.object({
  version: z.number().int().positive('رقم النسخة (version) مطلوب للتأكد من عدم تعارض التعديلات'),
  rejectionReason: z
    .string()
    .trim()
    .min(10, 'سبب الرفض يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب الرفض يجب ألا يتجاوز 1000 حرف'),
});

export const forceUnlockListingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب فك القفل الإجباري يجب ألا يتجاوز 500 حرف'),
});

export const createPriceSuggestionSchema = z.object({
  suggestedPrice: z
    .union([
      z.number(),
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'السعر المقترح غير صحيح (أرقام عشرية صحيحة)'),
    ])
    .pipe(z.coerce.number())
    .refine(
      (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
      {
        message: `السعر المقترح يجب أن يكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
      },
    ),
  reason: z
    .string()
    .trim()
    .min(10, 'سبب ومبررات اقتراح السعر يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب ومبررات اقتراح السعر يجب ألا يتجاوز 1000 حرف'),
});

export const respondPriceSuggestionSchema = z.object({
  sellerResponseNote: z
    .string()
    .trim()
    .max(1000, 'ملاحظة البائع يجب ألا تتجاوز 1000 حرف')
    .optional(),
});



