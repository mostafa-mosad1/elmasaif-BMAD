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
  resendEmailVerificationSchema,
  initiateAccountDeletionSchema,
  confirmAccountDeletionSchema,
  cancelAccountDeletionSchema,
  adminLoginSchema,
  adminInitiatePasswordResetSchema,
  adminCompletePasswordResetSchema,
  adminSessionUserSchema,
  adminCreateStaffRequestSchema,
  adminUpdateStaffPermissionsRequestSchema,
  adminUpdateStaffStatusRequestSchema,
  adminHardDeleteStaffRequestSchema,
  adminUpdateUserStatusRequestSchema,
  adminHardDeleteUserRequestSchema,
  adminAccountStatusActionSchema
} from '../schemas/auth.schema';
import { AdminRole, UserRole, VerificationStatus } from '../enums';
import { AdminPermissionGroupMeta } from '../constants/auth';

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

// Account Deletion Types (Story 1.9)
export type InitiateAccountDeletionInput = z.infer<typeof initiateAccountDeletionSchema>;
export type ConfirmAccountDeletionInput = z.infer<typeof confirmAccountDeletionSchema>;
export type CancelAccountDeletionInput = z.infer<typeof cancelAccountDeletionSchema>;

export interface AccountDeletionEligibilityResponse {
  code: string;
  message: string;
  data: {
    eligible: boolean;
    hasTransactionHistory: boolean;
    mode: 'COOLING_OFF' | 'STATUTORY_RETENTION' | 'BLOCKED';
    coolingOffDays?: number;
    message: string;
    blockingReason?: string;
  };
  requestId?: string;
}

export interface InitiateAccountDeletionResponse {
  code: string;
  message: string;
  data: {
    deletionToken: string;
    resendAvailableInSeconds: number;
    maskedMobileNumber: string;
  };
  requestId?: string;
}

export interface ConfirmAccountDeletionResponse {
  code: string;
  message: string;
  data: {
    status: string;
    deletionRequestedAt?: string | Date | null;
    deletionDueAt?: string | Date | null;
    coolingOffDays?: number;
    retainedRecords?: boolean;
  };
  requestId?: string;
}

export interface CancelAccountDeletionResponse {
  code: string;
  message: string;
  requestId?: string;
}

// Isolated Admin Authentication & Password Reset Types (Story 8.1)
export type AdminLoginInput = z.input<typeof adminLoginSchema>;
export type AdminInitiatePasswordResetInput = z.infer<typeof adminInitiatePasswordResetSchema>;
export type AdminCompletePasswordResetInput = z.infer<typeof adminCompletePasswordResetSchema>;
export type AdminSessionUser = z.infer<typeof adminSessionUserSchema>;

export interface AdminLoginResponse {
  code: string;
  message: string;
  data: {
    admin: AdminSessionUser;
    sessionExpiresAt: string | Date;
    inactivityTimeoutHours: number;
  };
  requestId?: string;
}

export interface AdminSessionResponse {
  code: string;
  message: string;
  data: {
    admin: AdminSessionUser;
  };
  requestId?: string;
}

export interface AdminInitiatePasswordResetResponse {
  code: string;
  message: string;
  data: {
    adminId: string;
    email: string;
    expiresInSeconds: number;
    activeSessionsRevoked: boolean;
  };
  requestId?: string;
}

export interface AdminCompletePasswordResetResponse {
  code: string;
  message: string;
  requestId?: string;
}

// Granular Dynamic RBAC & Staff/User Management Types (Story 8.2)
export type AdminAccountStatusAction = z.infer<typeof adminAccountStatusActionSchema>;
export type AdminCreateStaffRequestInput = z.infer<typeof adminCreateStaffRequestSchema>;
export type AdminUpdateStaffPermissionsRequestInput = z.infer<
  typeof adminUpdateStaffPermissionsRequestSchema
>;
export type AdminUpdateStaffStatusRequestInput = z.infer<
  typeof adminUpdateStaffStatusRequestSchema
>;
export type AdminHardDeleteStaffRequestInput = z.infer<
  typeof adminHardDeleteStaffRequestSchema
>;
export type AdminUpdateUserStatusRequestInput = z.infer<
  typeof adminUpdateUserStatusRequestSchema
>;
export type AdminHardDeleteUserRequestInput = z.infer<
  typeof adminHardDeleteUserRequestSchema
>;

export interface AdminProfileDto extends AdminSessionUser {
  isActive: boolean;
  deletedAt?: string | Date | null;
  hasOperationalHistory?: boolean;
}

export interface AdminStaffSummaryDto {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  isActive: boolean;
  deletedAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
  createdAt?: string | Date;
  hasOperationalHistory: boolean;
}

export interface AdminStaffListResponse {
  code: string;
  message: string;
  data: {
    staff: AdminStaffSummaryDto[];
    permissionGroups: AdminPermissionGroupMeta[];
    rolePresets: Record<AdminRole, string[]>;
  };
  requestId?: string;
}

export interface AdminPlatformUserSummaryDto {
  id: string;
  phone: string;
  mobileNumber?: string;
  username?: string;
  fullName: string;
  role: UserRole | string;
  roles?: string[];
  verificationStatus: VerificationStatus | string;
  status?: string;
  isActive: boolean;
  deletedAt?: string | Date | null;
  createdAt: string | Date;
  transactionHistoryCount: number;
}




