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

export const falLicenseSchema = z.string()
  .regex(/^[0-9]{10}$/, 'رقم رخصة فال العقارية يجب أن يتكون من 10 أرقام');

export * from './geo.schema';
export * from './clock.schema';
export * from './auth.schema';
export * from './identity.schema';
export * from './payout.schema';
export * from './preferences.schema';
export * from './listing.schema';
export * from './offer.schema';
export * from './inquiry.schema';
export * from './deal.schema';
export * from './dispute';
export * from './licensing.schema';

export const otpVerifySchema = z.object({
  mobileNumber: saudiMobileSchema,
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export const uploadPaymentProofSchema = z.object({
  dealId: z.string().uuid(),
  paymentType: z.enum(['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE', 'OWNER_CONTRACT_FEE']),
  bankReferenceCode: z.string().min(3, 'رمز المرجع البنكي مطلوب'),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/, 'المبلغ المدفوع غير صحيح'),
  senderBankName: z.string().min(2, 'اسم البنك المحول منه مطلوب')
});

/**
 * Structured buyer demand submission (Story 3.6 / FR-21, AD-9).
 * Geography is FK-bound to the master tables: `cityId` required UUID, `districtId`
 * optional UUID. Free-text `city`/`districts` are rejected outright. Money mirrors the
 * `createListingSchema` askPrice union + coercion idiom so SAR ranges accept numeric or
 * 2-decimal string input.
 */
export const createDemandSchema = z
  .object({
    propertyType: z.nativeEnum(PropertyType, {
      errorMap: () => ({ message: 'نوع العقار غير صالح' }),
    }),
    cityId: z.string().uuid('معرف المدينة يجب أن يكون بصيغة UUID صالحة'),
    districtId: z
      .string()
      .uuid('معرف الحي يجب أن يكون بصيغة UUID صالحة')
      .optional()
      .nullable(),
    minBudget: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'الميزانية غير صحيحة (أرقام عشرية صحيحة)'),
      ])
      .pipe(z.coerce.number()),
    maxBudget: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'الميزانية غير صحيحة (أرقام عشرية صحيحة)'),
      ])
      .pipe(z.coerce.number()),
    minArea: z.number().positive('المساحة يجب أن تكون أكبر من صفر'),
    maxArea: z.number().positive('المساحة يجب أن تكون أكبر من صفر'),
    notes: z.string().trim().max(1000, 'المواصفات الإضافية يجب ألا تتجاوز 1000 حرف').optional().nullable(),
  })
  .refine((data) => data.maxBudget >= data.minBudget, {
    message: 'الحد الأقصى للميزانية يجب أن يكون أكبر من أو يساوي الحد الأدنى',
    path: ['maxBudget'],
  })
  .refine((data) => data.maxArea >= data.minArea, {
    message: 'الحد الأقصى للمساحة يجب أن يكون أكبر من أو يساوي الحد الأدنى',
    path: ['maxArea'],
  });

/**
 * Buyer demand cancellation (Story 3.6 / FR-58): a non-empty structured reason is
 * mandatory and is recorded on the Demand row plus the AuditLog entry.
 */
export const cancelDemandSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب الإلغاء يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب الإلغاء يجب ألا يتجاوز 500 حرف'),
});

export * from './proposal.schema';
