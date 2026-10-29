import { z } from 'zod';
import { AUTH_CONSENT_REQUIRED, AUTH_INVALID_PHONE } from '../constants/auth';

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

export const sessionUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobileNumber: z.string(),
  username: z.string(),
  role: z.string()
});
