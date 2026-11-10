import { z } from 'zod';
import { ProfileStatus } from '../enums';

export const submitFalLicenseSchema = z.object({
  licenseNumber: z
    .string()
    .trim()
    .regex(/^\d{10,12}$/, 'رقم رخصة فال يجب أن يتكون من 10 إلى 12 رقماً'),
  certificateUrl: z.string().trim().min(1, 'رابط شهادة رخصة فال مطلوب'),
  expiryDate: z
    .string()
    .trim()
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'تاريخ انتهاء رخصة فال يجب أن يكون بصيغة تاريخ صالحة',
    ),
  commercialName: z
    .string()
    .trim()
    .min(3, 'الاسم التجاري يجب ألا يقل عن 3 أحرف')
    .max(100, 'الاسم التجاري يجب ألا يتجاوز 100 حرف'),
  crNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'رقم السجل التجاري يجب أن يتكون من 10 أرقام'),
  supportingDocumentUrls: z.array(z.string().trim().min(1)).max(5, 'لا يمكن إرفاق أكثر من 5 وثائق داعمة').optional().default([]),
});

export const licensingQueueQuerySchema = z.object({
  status: z.nativeEnum(ProfileStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1, 'رقم الصفحة يجب أن يكون 1 على الأقل').default(1),
  limit: z.coerce.number().int().min(1).max(50, 'الحد الأقصى لعدد العناصر هو 50').default(20),
});

export const approveFalLicenseSchema = z.object({
  version: z.number().int().positive('رقم النسخة يجب أن يكون رقماً صحيحاً موجباً'),
});

export const rejectFalLicenseSchema = z.object({
  version: z.number().int().positive('رقم النسخة يجب أن يكون رقماً صحيحاً موجباً'),
  rejectionReason: z
    .string()
    .trim()
    .min(10, 'سبب الرفض يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب الرفض يجب ألا يتجاوز 1000 حرف'),
});

export const forceUnlockFalLicenseSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب فك القفل الإجباري يجب ألا يتجاوز 500 حرف'),
});

