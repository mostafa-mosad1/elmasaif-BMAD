import { z } from 'zod';
import { PropertyType, DocumentVisibility, ListingStatus, SuspensionCategory, ListingEngagementEventType, ListingSearchSort } from '../enums';
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

/**
 * Public multi-criteria search query for active sale listings (Story 3.1).
 * Mirrors listingModerationQueueQuerySchema style: coerced numbers, UUID filters,
 * nativeEnum filters, Arabic messages, and defaults from shared constants.
 */
export const listingSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(150, 'نص البحث الحر يجب ألا يتجاوز 150 حرفاً')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة').optional(),
  districtId: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة').optional(),
  propertyType: z
    .nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'نوع العقار غير صالح' }),
    })
    .optional(),
  priceMin: z.coerce.number().min(0, 'الحد الأدنى للسعر يجب ألا يكون سالباً').optional(),
  priceMax: z.coerce.number().min(0, 'الحد الأقصى للسعر يجب ألا يكون سالباً').optional(),
  areaMin: z.coerce.number().min(0, 'الحد الأدنى للمساحة يجب ألا يكون سالباً').optional(),
  areaMax: z.coerce.number().min(0, 'الحد الأقصى للمساحة يجب ألا يكون سالباً').optional(),
  bedroomsMin: z.coerce.number().int('عدد الغرف يجب أن يكون عدداً صحيحاً').min(0, 'عدد الغرف يجب ألا يكون سالباً').optional(),
  falOnly: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') return false;
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
      },
      z.boolean(),
    )
    .default(false),
  sort: z
    .nativeEnum(ListingSearchSort, {
      errorMap: () => ({ message: 'تصنيف نتائج البحث غير صالح' }),
    })
    .optional()
    .default(ListingSearchSort.NEWEST),
  page: z.coerce.number().int('رقم الصفحة يجب أن يكون عدداً صحيحاً').min(1, 'رقم الصفحة يجب أن يكون 1 أو أكثر').optional().default(1),
  limit: z.coerce
    .number()
    .int('عدد العناصر في الصفحة يجب أن يكون عدداً صحيحاً')
    .min(1, 'عدد العناصر في الصفحة يجب أن يكون 1 على الأقل')
    .max(MAX_PAGE_SIZE, `الحد الأقصى لعدد العناصر في الصفحة هو ${MAX_PAGE_SIZE}`)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
});

/**
 * Bounding-box query for the interactive clustered map (Story 3.2 / FR-16).
 * Requires sw/ne corner coordinates within Saudi bounds; carries the same
 * optional filter criteria as listingSearchQuerySchema (without page/limit/sort).
 */
export const listingMapQuerySchema = z
  .object({
    swLat: z.coerce
      .number()
      .min(SAUDI_BOUNDS.minLat, `خط العرض الجنوبي يجب ألا يقل عن ${SAUDI_BOUNDS.minLat}`)
      .max(SAUDI_BOUNDS.maxLat, `خط العرض الجنوبي يجب ألا يتجاوز ${SAUDI_BOUNDS.maxLat}`),
    swLng: z.coerce
      .number()
      .min(SAUDI_BOUNDS.minLng, `خط الطول الغربي يجب ألا يقل عن ${SAUDI_BOUNDS.minLng}`)
      .max(SAUDI_BOUNDS.maxLng, `خط الطول الغربي يجب ألا يتجاوز ${SAUDI_BOUNDS.maxLng}`),
    neLat: z.coerce
      .number()
      .min(SAUDI_BOUNDS.minLat, `خط العرض الشمالي يجب ألا يقل عن ${SAUDI_BOUNDS.minLat}`)
      .max(SAUDI_BOUNDS.maxLat, `خط العرض الشمالي يجب ألا يتجاوز ${SAUDI_BOUNDS.maxLat}`),
    neLng: z.coerce
      .number()
      .min(SAUDI_BOUNDS.minLng, `خط الطول الشرقي يجب ألا يقل عن ${SAUDI_BOUNDS.minLng}`)
      .max(SAUDI_BOUNDS.maxLng, `خط الطول الشرقي يجب ألا يتجاوز ${SAUDI_BOUNDS.maxLng}`),
    q: z
      .string()
      .trim()
      .max(150, 'نص البحث الحر يجب ألا يتجاوز 150 حرفا')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة').optional(),
    districtId: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة').optional(),
    propertyType: z
      .nativeEnum(PropertyType, {
        errorMap: () => ({ message: 'نوع العقار غير صالح' }),
      })
      .optional(),
    priceMin: z.coerce.number().min(0, 'الحد الأدنى للسعر يجب ألا يكون سالباً').optional(),
    priceMax: z.coerce.number().min(0, 'الحد الأقصى للسعر يجب ألا يكون سالباً').optional(),
    areaMin: z.coerce.number().min(0, 'الحد الأدنى للمساحة يجب ألا يكون سالباً').optional(),
    areaMax: z.coerce.number().min(0, 'الحد الأقصى للمساحة يجب ألا يكون سالباً').optional(),
    bedroomsMin: z.coerce.number().int('عدد الغرف يجب أن يكون عدداً صحيحاً').min(0, 'عدد الغرف يجب ألا يكون سالباً').optional(),
    falOnly: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null || value === '') return false;
          if (value === 'true' || value === true) return true;
          if (value === 'false' || value === false) return false;
          return value;
        },
        z.boolean(),
      )
      .default(false),
  })
  .refine((data) => data.neLat > data.swLat, {
    message: 'الحد الشمالي لخط العرض يجب أن يكون أكبر من الحد الجنوبي',
    path: ['neLat'],
  }).refine((data) => data.neLng > data.swLng, {
    message: 'الحد الشرقي لخط الطول يجب أن يكون أكبر من الحد الغربي',
    path: ['neLng'],
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

export const archiveListingSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, 'سبب الأرشفة يجب ألا يتجاوز 500 حرف')
    .optional(),
});

export const suspendListingSchema = z.object({
  complianceReason: z
    .string()
    .trim()
    .min(10, 'سبب الإيقاف يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب الإيقاف يجب ألا يتجاوز 1000 حرف'),
  suspensionCategory: z
    .nativeEnum(SuspensionCategory, {
      errorMap: () => ({ message: 'تصنيف سبب الإيقاف غير صالح' }),
    })
    .optional(),
});

export const blockListingSchema = z.object({
  blockingReason: z
    .string()
    .trim()
    .min(10, 'سبب الحظر يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب الحظر يجب ألا يتجاوز 1000 حرف'),
  violationCode: z
    .string()
    .trim()
    .min(3, 'رمز المخالفة يجب ألا يقل عن 3 أحرف')
    .max(50, 'رمز المخالفة يجب ألا يتجاوز 50 حرفاً')
    .optional(),
});

export const unsuspendListingSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(10, 'ملاحظات المعالجة ورفع الإيقاف يجب ألا تقل عن 10 أحرف')
    .max(1000, 'ملاحظات المعالجة يجب ألا تتجاوز 1000 حرف'),
});

export const listingEngagementEventSchema = z.object({
  listingId: z.string().uuid('معرف العقار يجب أن يكون بصيغة UUID صالحة'),
  eventType: z.nativeEnum(ListingEngagementEventType, {
    errorMap: () => ({ message: 'نوع تفاعل العقار غير صالح' }),
  }),
  count: z
    .number()
    .int()
    .min(1, 'عدد التفاعلات يجب ألا يقل عن 1')
    .max(100, 'الحد الأقصى لدفعة التفاعل هو 100')
    .default(1),
});

export const batchListingEngagementSchema = z.object({
  events: z
    .array(listingEngagementEventSchema)
    .min(1, 'يجب إرسال تفاعل واحد على الأقل في الدفعة')
    .max(50, 'الحد الأقصى للتفاعلات في الدفعة الواحدة هو 50'),
});

export const listingAnalyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1, 'عدد الأيام يجب أن يكون 1 على الأقل')
    .max(90, 'الحد الأقصى للنطاق الزمني هو 90 يوماً')
    .default(30),
});




