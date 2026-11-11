import { OwnerListingRequestStatus, OwnerContractStatus, PropertyType } from '../enums';
import type { ClaimLockInfo } from './locks';

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
  contractFee: number;
  feeOverrideReason: string | null;
  contractTerms: string;
  status: OwnerContractStatus;
  expiresAt: string;
  createdAt: string;
  signedAt: string | null;
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

