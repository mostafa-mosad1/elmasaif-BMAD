import { z } from 'zod';
import {
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  sessionUserSchema,
  loginSchema,
  verifyStepUpOtpSchema,
  switchRoleSchema,
  userProfileSummarySchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  initiatePhoneChangeSchema,
  verifyPhoneChangeOtpSchema,
  resendPhoneChangeOtpSchema,
  adminPhoneChangeSchema,
  updateUserProfileSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema
} from '../schemas/auth.schema';

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpRegisterInput = z.infer<typeof verifyOtpRegisterSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type VerifyStepUpOtpInput = z.input<typeof verifyStepUpOtpSchema>;
export type SwitchRoleInput = z.infer<typeof switchRoleSchema>;
export type UserProfileSummary = z.infer<typeof userProfileSummarySchema>;

// Password Recovery & Change Types (Story 1.6)
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface ForgotPasswordResponse {
  code: string;
  message: string;
  data: {
    resendAvailableInSeconds: number;
  };
  requestId?: string;
}

export interface VerifyResetOtpResponse {
  code: string;
  message: string;
  data: {
    resetToken: string;
    expiresInSeconds: number;
  };
  requestId?: string;
}

export interface WorkspaceNavigationItem {
  title: string;
  href: string;
  icon?: string;
  badge?: string;
  disabled?: boolean;
}

export interface AuthUserResponse {
  code: string;
  message: string;
  data: {
    user: SessionUser;
  };
  requestId?: string;
}

export interface LoginResponse {
  code: string;
  message: string;
  data: {
    user: SessionUser;
    deletionCancelled?: boolean;
  };
  requestId?: string;
}

export interface StepUpRequiredResponse {
  code: string;
  message: string;
  data: {
    stepUpRequired: true;
    mobileNumber: string;
    stepUpToken: string;
    resendAvailableInSeconds: number;
  };
  requestId?: string;
}

// Phone Change Types (Story 1.7)
export type InitiatePhoneChangeInput = z.infer<typeof initiatePhoneChangeSchema>;
export type VerifyPhoneChangeOtpInput = z.infer<typeof verifyPhoneChangeOtpSchema>;
export type ResendPhoneChangeOtpInput = z.infer<typeof resendPhoneChangeOtpSchema>;
export type AdminPhoneChangeInput = z.infer<typeof adminPhoneChangeSchema>;

export interface InitiatePhoneChangeResponse {
  code: string;
  message: string;
  data: {
    requestId: string;
    oldPhoneNumberMasked: string;
    newPhoneNumberMasked: string;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
  };
  requestId?: string;
}

export interface VerifyPhoneChangeOtpResponse {
  code: string;
  message: string;
  data: {
    requestId: string;
    oldVerified: boolean;
    newVerified: boolean;
    isCompleted: boolean;
  };
  requestId?: string;
}

export interface PhoneChangeCompletionResponse {
  code: string;
  message: string;
  data: {
    mobileNumber: string;
    isCompleted: boolean;
  };
  requestId?: string;
}

// Profile & Email Verification Types (Story 1.8)
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendEmailVerificationInput = z.infer<typeof resendEmailVerificationSchema>;

export interface UpdateUserProfileResponse {
  code: string;
  message: string;
  data: {
    id: string;
    fullName: string;
    email?: string | null;
    pendingEmail?: string | null;
    isEmailPending?: boolean;
    emailVerifiedAt?: string | Date | null;
    hasCommercialNameMismatch?: boolean;
    commercialNameMismatchNotice?: string;
  };
  requestId?: string;
}

export interface VerifyEmailResponse {
  code: string;
  message: string;
  data: {
    email: string;
    emailVerifiedAt: string | Date;
  };
  requestId?: string;
}

export interface ResendEmailVerificationResponse {
  code: string;
  message: string;
  data: {
    resendAvailableInSeconds: number;
  };
  requestId?: string;
}

export interface CancelPendingEmailResponse {
  code: string;
  message: string;
  requestId?: string;
}

