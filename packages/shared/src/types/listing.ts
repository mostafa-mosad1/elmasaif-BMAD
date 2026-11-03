import { z } from 'zod';
import {
  createListingSchema,
  listingPhotoItemSchema,
  listingDocumentItemSchema,
  listingModerationQueueQuerySchema,
  approveListingSchema,
  rejectListingSchema,
  forceUnlockListingSchema,
  createPriceSuggestionSchema,
  respondPriceSuggestionSchema,
} from '../schemas/listing.schema';
import {
  PropertyType,
  ListingStatus,
  DocumentVisibility,
  ScanStatus,
  UserRole,
  PriceSuggestionStatus,
} from '../enums';

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingPhotoItem = z.infer<typeof listingPhotoItemSchema>;
export type ListingDocumentItem = z.infer<typeof listingDocumentItemSchema>;
export type ListingModerationQueueQuery = z.infer<typeof listingModerationQueueQuerySchema>;
export type ApproveListingInput = z.infer<typeof approveListingSchema>;
export type RejectListingInput = z.infer<typeof rejectListingSchema>;
export type ForceUnlockListingInput = z.infer<typeof forceUnlockListingSchema>;
export type CreatePriceSuggestionInput = z.infer<typeof createPriceSuggestionSchema>;
export type RespondPriceSuggestionInput = z.infer<typeof respondPriceSuggestionSchema>;

export interface PriceSuggestionItem {
  id: string;
  listingId: string;
  currentAskPrice: number;
  suggestedPrice: number;
  reason: string;
  status: PriceSuggestionStatus;
  suggestedByAdminId: string;
  suggestedByAdminName: string;
  sellerResponseNote: string | null;
  respondedAt: string | null;
  createdAt: string;
}

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
  activePriceSuggestion?: PriceSuggestionItem | null;
  priceSuggestions?: PriceSuggestionItem[];
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
  activePriceSuggestion?: PriceSuggestionItem | null;
  priceSuggestions?: PriceSuggestionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummaryItem {
  id: string;
  title: string;
  description?: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  askPrice: number | string;
  areaSquareMeters: number;
  bedrooms?: number | null;
  yearBuilt?: number | null;
  status: ListingStatus;
  sellerRole?: UserRole;
  isFalVerified?: boolean;
  primaryPhotoUrl?: string | null;
  photoCount?: number;
  photos?: string[];
  rejectionReason?: string | null;
  activePriceSuggestion?: PriceSuggestionItem | null;
  priceSuggestions?: PriceSuggestionItem[];
  createdAt: string;
}

