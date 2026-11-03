import { z } from 'zod';
import {
  createListingSchema,
  listingPhotoItemSchema,
  listingDocumentItemSchema,
  listingModerationQueueQuerySchema,
  approveListingSchema,
  rejectListingSchema,
  forceUnlockListingSchema,
} from '../schemas/listing.schema';
import { PropertyType, ListingStatus, DocumentVisibility, ScanStatus, UserRole } from '../enums';

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingPhotoItem = z.infer<typeof listingPhotoItemSchema>;
export type ListingDocumentItem = z.infer<typeof listingDocumentItemSchema>;
export type ListingModerationQueueQuery = z.infer<typeof listingModerationQueueQuerySchema>;
export type ApproveListingInput = z.infer<typeof approveListingSchema>;
export type RejectListingInput = z.infer<typeof rejectListingSchema>;
export type ForceUnlockListingInput = z.infer<typeof forceUnlockListingSchema>;

export interface ListingLockInfo {
  isLocked: boolean;
  isLockedByCurrentAdmin: boolean;
  lockedByAdminId: string | null;
  lockedByAdminName: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  remainingSeconds: number;
}

export interface ModerationQueueItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName: string;
  districtName: string;
  askPrice: number;
  areaSquareMeters: number;
  status: ListingStatus;
  version: number;
  sellerRole: UserRole;
  sellerName: string;
  sellerProfileId: string;
  photoCount: number;
  documentCount: number;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  lockInfo: ListingLockInfo;
}

export interface ModerationQueueResponse {
  items: ModerationQueueItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PropertyDocumentResponse {
  id: string;
  documentType: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  visibility: DocumentVisibility;
  scanStatus: ScanStatus;
  createdAt: string;
}

export interface ListingDetailResponse {
  id: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  streetName?: string | null;
  latitude: number;
  longitude: number;
  askPrice: number | string;
  areaSquareMeters: number;
  bedrooms?: number | null;
  yearBuilt?: number | null;
  status: ListingStatus;
  sellerProfileId: string;
  payoutIban?: string;
  version: number;
  photos: PropertyDocumentResponse[];
  documents: PropertyDocumentResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummaryItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  askPrice: number | string;
  areaSquareMeters: number;
  bedrooms?: number | null;
  status: ListingStatus;
  primaryPhotoUrl?: string;
  createdAt: string;
}

