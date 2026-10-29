import { z } from 'zod';
import { AUTH_CONSENT_REQUIRED, AUTH_INVALID_PHONE } from '../constants/auth';
import { UserRole, ProfileStatus } from '../enums';

export const saudiNationalIdSchema = z.string()
  .regex(/^[12][0-9]{9}$/, 'رقم الهوية الوطنية / الإقامة يجب أن يتكون من 10 أرقام ويبدأ بـ 1 أو 2');

export const saudiMobileNormalizedSchema = z.string()
  .transform((val) => val.replace(/[\s-]/g, ''))
  .pipe(
    z.string().regex(/^(\+966|0)5[0-9]{8}$/, { message: AUTH_INVALID_PHONE })
  )
  .transform((val) => {
    if (val.startsWith('05')) {
      return `+966${val.slice(1)}`;
    }
    return val;
  });

export const registerSchema = z.object({
  fullName: z.string()
    .trim()
    .min(3, 'الاسم الكامل يجب ألا يقل عن 3 أحرف')
    .max(100, 'الاسم الكامل يجب ألا يتجاوز 100 حرف'),
  mobileNumber: saudiMobileNormalizedSchema,
  nationalId: saudiNationalIdSchema,
  password: z.string()
    .min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'كلمة المرور يجب أن تتضمن حرفاً ورقماً على الأقل'),
  username: z.string()
    .min(3, 'اسم المستخدم يجب ألا يقل عن 3 خانات')
    .max(30, 'اسم المستخدم يجب ألا يتجاوز 30 خانة')
    .regex(/^[a-zA-Z0-9_-]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط')
    .optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: AUTH_CONSENT_REQUIRED })
  }),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: AUTH_CONSENT_REQUIRED })
  })
}).transform((data) => ({
  ...data,
  username: data.username && data.username.trim() !== ''
    ? data.username
    : `u_${data.mobileNumber.replace('+', '')}`
}));

export const verifyOtpRegisterSchema = z.object({
  mobileNumber: saudiMobileNormalizedSchema,
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export const resendOtpSchema = z.object({
  mobileNumber: saudiMobileNormalizedSchema
});

export const loginSchema = z.object({
  identifier: z.string()
    .trim()
    .min(3, 'اسم المستخدم أو رقم الجوال يجب ألا يقل عن 3 أحرف')
    .transform((val) => {
      const cleanPhone = val.replace(/[\s-]/g, '');
      if (/^(\+966|0)?5[0-9]{8}$/.test(cleanPhone)) {
        if (cleanPhone.startsWith('+966')) return cleanPhone;
        if (cleanPhone.startsWith('0')) return `+966${cleanPhone.slice(1)}`;
        if (cleanPhone.startsWith('5')) return `+966${cleanPhone}`;
      }
      return val.toLowerCase();
    }),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات'),
  deviceId: z.string().optional(),
  rememberDevice: z.boolean().optional().default(true)
});

export const verifyStepUpOtpSchema = z.object({
  mobileNumber: saudiMobileNormalizedSchema,
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام'),
  stepUpToken: z.string().min(1, 'رمز التحدي مطلوب'),
  deviceId: z.string().optional()
});

export const userProfileSummarySchema = z.object({
  id: z.string(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(ProfileStatus),
  payoutIban: z.string().nullable().optional(),
  falLicenseNumber: z.string().nullable().optional(),
  falStatus: z.nativeEnum(ProfileStatus).nullable().optional(),
  createdAt: z.string().or(z.date()).optional()
});

export const switchRoleSchema = z.object({
  role: z.nativeEnum(UserRole)
});

export const sessionUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobileNumber: z.string(),
  username: z.string(),
  role: z.string().optional(),
  activeRole: z.nativeEnum(UserRole).default(UserRole.BUYER),
  profiles: z.array(userProfileSummarySchema).default([])
}).transform((data) => ({
  ...data,
  role: data.role || data.activeRole
}));
