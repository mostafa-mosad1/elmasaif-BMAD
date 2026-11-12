import { z } from 'zod';
import {
  ALL_ADMIN_PERMISSIONS,
  AUTH_CONSENT_REQUIRED,
  AUTH_INVALID_PHONE,
} from '../constants/auth';
import { UserRole, ProfileStatus, AdminRole } from '../enums';

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
  email: z.string().nullable().optional(),
  pendingEmail: z.string().nullable().optional(),
  emailVerifiedAt: z.union([z.date(), z.string()]).nullable().optional(),
  role: z.string().optional(),
  activeRole: z.nativeEnum(UserRole).default(UserRole.BUYER),
  profiles: z.array(userProfileSummarySchema).default([])
}).transform((data) => ({
  ...data,
  role: data.role || data.activeRole
}));

// Password Recovery & Change Schemas (Story 1.6)
export const passwordComplexitySchema = z.string()
  .min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات')
  .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'كلمة المرور يجب أن تتضمن حرفاً ورقماً على الأقل');

export const forgotPasswordSchema = z.object({
  mobileNumber: saudiMobileNormalizedSchema
});

export const verifyResetOtpSchema = z.object({
  mobileNumber: saudiMobileNormalizedSchema,
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'رمز التحدي مطلوب'),
  newPassword: passwordComplexitySchema
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: passwordComplexitySchema
});


// Phone Change Schemas (Story 1.7)
export const initiatePhoneChangeSchema = z.object({
  newMobileNumber: saudiMobileNormalizedSchema
});

export const verifyPhoneChangeOtpSchema = z.object({
  requestId: z.string().uuid('معرف الطلب غير صالح'),
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export const resendPhoneChangeOtpSchema = z.object({
  requestId: z.string().uuid('معرف الطلب غير صالح'),
  target: z.enum(['OLD', 'NEW'])
});

export const adminPhoneChangeSchema = z.object({
  newMobileNumber: saudiMobileNormalizedSchema,
  officialIdVerified: z.literal(true, {
    errorMap: () => ({ message: 'يجب تأكيد التحقق من الهوية الرسمية' })
  }),
  reason: z.string().trim().min(10, 'سبب التحديث الإداري مطلوب (10 أحرف على الأقل)')
});

// Profile & Email Verification Schemas (Story 1.8)
export const updateUserProfileSchema = z.object({
  fullName: z.string().trim().min(3, 'الاسم يجب ألا يقل عن 3 أحرف').max(100, 'الاسم يجب ألا يزيد عن 100 حرف').optional(),
  email: z.string().trim().toLowerCase().email('صيغة البريد الإلكتروني غير صالحة').optional()
}).refine((data) => data.fullName !== undefined || data.email !== undefined, {
  message: 'يجب تقديم حقل واحد على الأقل للتحديث'
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'رمز التحقق مطلوب')
});

export const resendEmailVerificationSchema = z.object({}).optional();

// Account Deletion Schemas (Story 1.9)
export const initiateAccountDeletionSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة')
});

export const confirmAccountDeletionSchema = z.object({
  deletionToken: z.string().min(1, 'رمز التحدي مطلوب'),
  code: z.string().length(6, 'رمز التحقق يجب أن يتكون من 6 أرقام')
});

export const cancelAccountDeletionSchema = z.object({}).optional();

// Isolated Admin Authentication & Password Reset Schemas (Story 8.1)
export const adminLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'اسم المستخدم أو البريد الإلكتروني مطلوب')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 خانات'),
});

export const adminInitiatePasswordResetSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'سبب إعادة تعيين كلمة المرور الإدارية مطلوب (10 أحرف على الأقل)')
    .max(500, 'السبب يجب ألا يتجاوز 500 حرف'),
});

export const adminCompletePasswordResetSchema = z.object({
  token: z.string().trim().min(1, 'رمز إعادة تعيين كلمة المرور مطلوب'),
  newPassword: passwordComplexitySchema,
});

export const adminSessionUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.nativeEnum(AdminRole),
  isActive: z.boolean(),
  deletedAt: z.union([z.date(), z.string()]).nullable().optional(),
  lastLoginAt: z.union([z.date(), z.string()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  hasOperationalHistory: z.boolean().optional(),
  permissions: z.array(z.string()).default([]),
});

// Granular Dynamic RBAC & Super Admin User Management Schemas (Story 8.2)
const validAdminPermissionSchema = z
  .string()
  .refine((val) => ALL_ADMIN_PERMISSIONS.includes(val), {
    message: 'صلاحية إدارية غير معروفة في كتالوج الصلاحيات (Area.Action)',
  });

export const adminCreateStaffRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'اسم المستخدم الإداري يجب ألا يقل عن 3 خانات')
    .max(30, 'اسم المستخدم الإداري يجب ألا يتجاوز 30 خانة')
    .regex(
      /^[a-z0-9_.-]+$/,
      'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام أو نقاط أو شرطات فقط'
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('صيغة البريد الإلكتروني الإداري غير صالحة'),
  fullName: z
    .string()
    .trim()
    .min(3, 'الاسم الكامل للموظف يجب ألا يقل عن 3 أحرف')
    .max(100, 'الاسم الكامل للموظف يجب ألا يتجاوز 100 حرف'),
  role: z.nativeEnum(AdminRole),
  initialPassword: passwordComplexitySchema,
  permissions: z.array(validAdminPermissionSchema).optional(),
});

export const adminUpdateStaffPermissionsRequestSchema = z.object({
  role: z.nativeEnum(AdminRole).optional(),
  fullName: z
    .string()
    .trim()
    .min(3, 'الاسم الكامل للموظف يجب ألا يقل عن 3 أحرف')
    .max(100, 'الاسم الكامل للموظف يجب ألا يتجاوز 100 حرف')
    .optional(),
  permissions: z
    .array(validAdminPermissionSchema)
    .min(1, 'يجب منح صلاحية واحدة على الأقل للموظف'),
  reason: z
    .string()
    .trim()
    .min(3, 'سبب تعديل الصلاحيات مطلوب (3 أحرف على الأقل)')
    .max(500, 'سبب التعديل يجب ألا يتجاوز 500 حرف'),
});

export const adminAccountStatusActionSchema = z.enum([
  'ENABLE',
  'DISABLE',
  'SOFT_DELETE',
]);

export const adminUpdateStaffStatusRequestSchema = z.object({
  action: adminAccountStatusActionSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'سبب تغيير حالة حساب الموظف مطلوب (3 أحرف على الأقل)')
    .max(500, 'السبب يجب ألا يتجاوز 500 حرف'),
});

export const adminHardDeleteStaffRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'سبب الحذف النهائي لحساب الموظف مطلوب (3 أحرف على الأقل)')
    .max(500, 'السبب يجب ألا يتجاوز 500 حرف'),
});

export const adminUpdateUserStatusRequestSchema = z.object({
  action: adminAccountStatusActionSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'سبب تغيير حالة حساب المستخدم مطلوب (3 أحرف على الأقل)')
    .max(500, 'السبب يجب ألا يتجاوز 500 حرف'),
});

export const adminHardDeleteUserRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'سبب الحذف النهائي لحساب المستخدم مطلوب (3 أحرف على الأقل)')
    .max(500, 'السبب يجب ألا يتجاوز 500 حرف'),
});


