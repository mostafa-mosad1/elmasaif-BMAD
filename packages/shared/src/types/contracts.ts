import { OwnerListingRequestStatus, OwnerContractStatus, PropertyType } from '../enums';
import type { ClaimLockInfo } from './locks';
import type { ContractFeePaymentStatus } from '../constants/contracts';

export interface OwnerListingRequestQueueItem {
  id: string;
  listingId: string | null;
  propertyTitle: string;
  propertyType: PropertyType;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  askPrice: number;
  submissionTimestamp: string;
  ownerLegalName: string;
  maskedMobileNumber: string;
  ownerProfileId: string;
  status: OwnerListingRequestStatus;
  titleDeedNumber: string;
  lockInfo: ClaimLockInfo;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerListingRequestDetailResponse {
  id: string;
  listingId: string | null;
  ownerProfileId: string;
  propertyType: PropertyType;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  streetName: string | null;
  titleDeedNumber: string;
  titleDeedDocumentUrl: string | null;
  status: OwnerListingRequestStatus;
  rejectionReason: string | null;
  modificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  lockInfo: ClaimLockInfo;
  owner: {
    legalName: string;
    maskedMobileNumber: string;
    nationalId?: string | null;
    payoutIban: string;
    isPayoutIbanVerified: boolean;
  };
  listing: {
    id: string;
    title: string;
    description: string;
    askPrice: number;
    areaSquareMeters: number;
    bedrooms?: number | null;
    yearBuilt?: number | null;
    latitude: number;
    longitude: number;
    photos: Array<{ id?: string; fileUrl: string; isPrimary: boolean }>;
    documents: Array<{ id?: string; documentType: string; fileUrl: string; visibility: string }>;
  } | null;
  contract: OwnerContractDetailResponse | null;
}

export interface ContractTemplateItem {
  id: string;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface OwnerContractDetailResponse {
  id: string;
  listingId: string;
  ownerProfileId: string;
  templateId: string | null;
  propertyTitle?: string;
  propertyType?: PropertyType;
  cityName?: string;
  districtName?: string;
  askPrice?: number;
  areaSquareMeters?: number;
  contractFee: number;
  feeOverrideReason: string | null;
  contractTerms: string;
  status: OwnerContractStatus;
  expiresAt: string;
  createdAt: string;
  signedAt: string | null;
  signatureData?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  otpCode?: string | null;
  ownerName?: string;
  ownerMobile?: string;
}

export interface SignOwnerContractInput {
  signatureData: string;
  otpCode: string;
}

export interface SignOwnerContractResult {
  success: boolean;
  contractId: string;
  status: OwnerContractStatus;
  signedAt: string;
  expiresAt: string;
}

export interface RequestSignatureOtpResult {
  success: boolean;
  resendAvailableInSeconds: number;
}

export interface OwnerListingRequestItem {
  id: string;
  listingId: string | null;
  propertyTitle: string;
  propertyType: PropertyType;
  cityName: string;
  districtName: string;
  askPrice: number;
  status: OwnerListingRequestStatus;
  rejectionReason: string | null;
  modificationNotes: string | null;
  createdAt: string;
  contractId: string | null;
  contractStatus: OwnerContractStatus | null;
}

export interface ContractFeePaymentQueueItem {
  id: string;
  ownerContractId: string;
  listingId: string | null;
  propertyTitle: string;
  propertyType: PropertyType;
  ownerLegalName: string;
  maskedMobileNumber: string;
  amount: number;
  status: ContractFeePaymentStatus;
  bankReferenceCode: string | null;
  senderBankName: string | null;
  uploadedAt: string | null;
  lockInfo: ClaimLockInfo;
  createdAt: string;
  expiresAt: string;
}

export interface ContractFeePaymentDetailResponse {
  payment: {
    id: string;
    ownerContractId: string;
    amount: number;
    status: ContractFeePaymentStatus;
    proofFileUrl: string | null;
    bankReferenceCode: string | null;
    senderBankName: string | null;
    uploadedAt: string | null;
    verifiedByAdminId: string | null;
    verifiedAt: string | null;
    rejectionReason: string | null;
    createdAt: string;
  };
  contract: {
    id: string;
    listingId: string;
    contractFee: number;
    feeOverrideReason: string | null;
    contractTerms: string;
    status: OwnerContractStatus;
    expiresAt: string;
    signedAt: string | null;
    signatureData: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  };
  listing: {
    id: string;
    title: string;
    propertyType: PropertyType;
    askPrice: number;
    areaSquareMeters: number;
    cityName: string;
    districtName: string;
    titleDeedNumber: string;
    photos: Array<{ id?: string; fileUrl: string; isPrimary: boolean }>;
  } | null;
  owner: {
    id: string;
    legalName: string;
    maskedMobileNumber: string;
    nationalId?: string | null;
    payoutIban: string;
  };
  lockInfo: ClaimLockInfo;
}

export interface UploadContractFeeProofInput {
  bankReferenceCode?: string | null;
  senderBankName?: string | null;
}

export interface ConfirmContractFeeResult {
  success: boolean;
  paymentId: string;
  contractId: string;
  listingId: string;
  invoiceNumber: string;
  status: string;
}

export interface RejectContractFeeInput {
  reason: string;
}

export interface RejectContractFeeResult {
  success: boolean;
  paymentId: string;
  status: string;
  rejectionReason: string;
}

export interface ForceUnlockContractFeeInput {
  reason: string;
}

export interface ContractFeeQueueQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface OwnerContractFeeStatusResponse {
  id: string;
  ownerContractId: string;
  amount: number;
  status: ContractFeePaymentStatus;
  proofFileUrl: string | null;
  bankReferenceCode: string | null;
  senderBankName: string | null;
  uploadedAt: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  expiresAt: string;
  isContractActive: boolean;
  listingId: string | null;
}


