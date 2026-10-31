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
  changePasswordSchema
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
