import { z } from 'zod';
import {
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  sessionUserSchema,
  loginSchema,
  verifyStepUpOtpSchema
} from '../schemas/auth.schema';

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpRegisterInput = z.infer<typeof verifyOtpRegisterSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type VerifyStepUpOtpInput = z.input<typeof verifyStepUpOtpSchema>;

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
