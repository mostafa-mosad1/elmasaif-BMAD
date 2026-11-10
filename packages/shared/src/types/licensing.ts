import { z } from 'zod';
import {
  submitFalLicenseSchema,
  renewFalLicenseSchema,
  licensingQueueQuerySchema,
  approveFalLicenseSchema,
  rejectFalLicenseSchema,
  forceUnlockFalLicenseSchema,
} from '../schemas/licensing.schema';
import { ProfileStatus } from '../enums';
import { ClaimLockInfo } from './locks';

export type SubmitFalLicenseInput = z.infer<typeof submitFalLicenseSchema>;
export type RenewFalLicenseInput = z.infer<typeof renewFalLicenseSchema>;
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
  isRenewal?: boolean;
  suspendedListingsCount?: number;
  previousExpiryDate?: string | null;
}

export interface SuspendedListingSummary {
  id: string;
  title: string;
  city?: string;
  askPrice?: number | string;
  complianceCategory?: string | null;
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
  isRenewal?: boolean;
  previousExpiryDate?: string | null;
  suspendedListingsCount?: number;
  suspendedListings?: SuspendedListingSummary[];
}

