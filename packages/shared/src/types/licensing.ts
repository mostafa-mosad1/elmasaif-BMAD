import { z } from 'zod';
import {
  submitFalLicenseSchema,
  licensingQueueQuerySchema,
  approveFalLicenseSchema,
  rejectFalLicenseSchema,
  forceUnlockFalLicenseSchema,
} from '../schemas/licensing.schema';
import { ProfileStatus } from '../enums';
import { ClaimLockInfo } from './locks';

export type SubmitFalLicenseInput = z.infer<typeof submitFalLicenseSchema>;
export type LicensingQueueQuery = z.infer<typeof licensingQueueQuerySchema>;
export type ApproveFalLicenseInput = z.infer<typeof approveFalLicenseSchema>;
export type RejectFalLicenseInput = z.infer<typeof rejectFalLicenseSchema>;
export type ForceUnlockFalLicenseInput = z.infer<typeof forceUnlockFalLicenseSchema>;

export type FalLockInfo = ClaimLockInfo;

export interface FalLicenseQueueItem {
  id: string;
  licenseNumber: string;
  commercialName: string | null;
  crNumber: string | null;
  expiryDate: string;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
  applicantName: string;
  applicantPhone: string;
  applicantNationalId: string | null;
  lockInfo: FalLockInfo;
}

export interface FalLicenseDetailResponse {
  id: string;
  profileId: string;
  licenseNumber: string;
  commercialName: string | null;
  crNumber: string | null;
  expiryDate: string;
  status: ProfileStatus;
  rejectionReason: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  certificateUrl: string;
  certificateDownloadUrl?: string;
  supportingDocumentUrls: string[];
  supportingDocumentDownloadUrls?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  applicant: {
    id: string;
    fullName: string;
    phoneNumber: string;
    nationalId: string | null;
    createdAt: string;
  };
  lockInfo: FalLockInfo;
}

