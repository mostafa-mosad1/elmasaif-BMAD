import { z } from 'zod';
import { PropertyType } from '../enums';

/**
 * ISO 7064 Mod-97 validation for Saudi IBANs (SA + 22 alphanumeric/digits)
 */
export function validateSaudiIban(iban: string): boolean {
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^SA\d{22}$/.test(cleanIban)) {
    return false;
  }

  // Move first 4 characters to the end: SAxx -> xxSA
  const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);

  // Convert letters to digits: S=28, A=10
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericString += (code - 55).toString();
    } else {
      numericString += char;
    }
  }

  // BigInt mod 97 check
  try {
    return BigInt(numericString) % 97n === 1n;
  } catch {
    return false;
  }
}

export const saudiIbanSchema = z.string()
  .min(24, 'رقم الآيبان السعودي يجب أن يتكون من 24 خانة')
  .max(34, 'رقم الآيبان غير صحيح')
  .refine(validateSaudiIban, {
    message: 'رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)'
  });

export const saudiMobileSchema = z.string()
  .regex(/^(05|5|\+9665)[0-9]{8}$/, 'رقم الجوال السعودي غير صحيح (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام)');

export const saudiNationalIdSchema = z.string()
  .regex(/^[12][0-9]{9}$/, 'رقم الهوية الوطنية / الإقامة يجب أن يتكون من 10 أرقام ويبدأ بـ 1 أو 2');

export const falLicenseSchema = z.string()
  .regex(/^[0-9]{10}$/, 'رقم رخصة فال العقارية يجب أن يتكون من 10 أرقام');

export const loginSchema = z.object({
  usernameOrPhone: z.string().min(3, 'اسم المستخدم أو رقم الجوال مطلوب'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات')
});

export const registerSchema = z.object({
  fullName: z.string().min(3, 'الاسم الكامل مطلوب'),
  mobileNumber: saudiMobileSchema,
  nationalId: saudiNationalIdSchema,
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات تحتوي على حرف ورقم')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'كلمة المرور يجب أن تتضمن حرفاً ورقماً على الأقل')
});

export const otpVerifySchema = z.object({
  mobileNumber: saudiMobileSchema,
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export * from './geo.schema';

export const createListingSchema = z.object({
  title: z.string().min(5, 'عنوان العقار مطلوب').max(150),
  description: z.string().min(20, 'وصف العقار يجب أن يكون وافياً ومفصلاً'),
  propertyType: z.nativeEnum(PropertyType),
  cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
  districtId: z.string().uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة'),
  city: z.string().min(2, 'المدينة مطلوبة').optional(),
  district: z.string().min(2, 'الحي مطلوب').optional(),
  streetName: z.string().optional(),
  latitude: z.number().min(15).max(33),
  longitude: z.number().min(34).max(56),
  askPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'السعر المطلوب غير صحيح (أرقام عشرية صحيحة)'),
  areaSquareMeters: z.number().positive('المساحة يجب أن تكون أكبر من صفر'),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  yearBuilt: z.number().int().min(1950).max(2030).optional(),
  payoutIban: saudiIbanSchema
});

export const submitOfferSchema = z.object({
  listingId: z.string().uuid('معرف العقار غير صالح'),
  offerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'قيمة العرض غير صحيحة')
});

export const counterOfferSchema = z.object({
  counterPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'قيمة العرض المقابل غير صحيحة')
});

export const uploadPaymentProofSchema = z.object({
  dealId: z.string().uuid(),
  paymentType: z.enum(['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE', 'OWNER_CONTRACT_FEE']),
  bankReferenceCode: z.string().min(3, 'رمز المرجع البنكي مطلوب'),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/, 'المبلغ المدفوع غير صحيح'),
  senderBankName: z.string().min(2, 'اسم البنك المحول منه مطلوب')
});

export const createDemandSchema = z.object({
  propertyType: z.nativeEnum(PropertyType),
  city: z.string().min(2, 'المدينة مطلوبة'),
  districts: z.array(z.string()).min(1, 'يجب تحديد حي واحد على الأقل'),
  minBudget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  maxBudget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  minArea: z.number().positive(),
  maxArea: z.number().positive(),
  notes: z.string().max(500).optional()
});
