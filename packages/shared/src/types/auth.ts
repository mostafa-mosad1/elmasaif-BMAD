import { z } from 'zod';
import {
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  sessionUserSchema,
  loginSchema,
  verifyStepUpOtpSchema,
  switchRoleSchema,
  userProfileSummarySchema
} from '../schemas/auth.schema';

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpRegisterInput = z.infer<typeof verifyOtpRegisterSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type VerifyStepUpOtpInput = z.input<typeof verifyStepUpOtpSchema>;
export type SwitchRoleInput = z.infer<typeof switchRoleSchema>;
export type UserProfileSummary = z.infer<typeof userProfileSummarySchema>;

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
