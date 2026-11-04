import { z } from 'zod';
import {
  createListingSchema,
  listingPhotoItemSchema,
  listingDocumentItemSchema,
  listingModerationQueueQuerySchema,
  listingSearchQuerySchema,
  approveListingSchema,
  rejectListingSchema,
  forceUnlockListingSchema,
  createPriceSuggestionSchema,
  respondPriceSuggestionSchema,
  archiveListingSchema,
  suspendListingSchema,
  blockListingSchema,
  unsuspendListingSchema,
  listingEngagementEventSchema,
  batchListingEngagementSchema,
  listingAnalyticsQuerySchema,
  listingMapQuerySchema,
} from '../schemas/listing.schema';
import {
  PropertyType,
  ListingStatus,
  DocumentVisibility,
  ScanStatus,
  UserRole,
  PriceSuggestionStatus,
  SuspensionCategory,
} from '../enums';

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingPhotoItem = z.infer<typeof listingPhotoItemSchema>;
export type ListingDocumentItem = z.infer<typeof listingDocumentItemSchema>;
export type ListingModerationQueueQuery = z.infer<typeof listingModerationQueueQuerySchema>;
export type ListingSearchQuery = z.infer<typeof listingSearchQuerySchema>;
export type ListingMapQuery = z.infer<typeof listingMapQuerySchema>;
export type ApproveListingInput = z.infer<typeof approveListingSchema>;
export type RejectListingInput = z.infer<typeof rejectListingSchema>;
export type ForceUnlockListingInput = z.infer<typeof forceUnlockListingSchema>;
export type CreatePriceSuggestionInput = z.infer<typeof createPriceSuggestionSchema>;
export type RespondPriceSuggestionInput = z.infer<typeof respondPriceSuggestionSchema>;
export type ArchiveListingInput = z.infer<typeof archiveListingSchema>;
export type SuspendListingInput = z.infer<typeof suspendListingSchema>;
export type BlockListingInput = z.infer<typeof blockListingSchema>;
export type UnsuspendListingInput = z.infer<typeof unsuspendListingSchema>;
export type ListingEngagementEvent = z.infer<typeof listingEngagementEventSchema>;
export type BatchListingEngagementInput = z.infer<typeof batchListingEngagementSchema>;
export type ListingAnalyticsQuery = z.infer<typeof listingAnalyticsQuerySchema>;

export interface ListingAnalyticsSummary {
  listingId: string;
  totalViews: number;
  totalImpressions: number;
  totalFavorites: number;
  offersCount: number;
  conversionRatio: number;
  dailyMetrics: Array<{
    date: string;
    impressions: number;
    detailViews: number;
    favoriteAdds: number;
  }>;
}

export interface AdminGlobalEngagementAnalytics {
  totalActiveListings: number;
  totalLifetimeImpressions: number;
  totalLifetimeViews: number;
  totalLifetimeFavorites: number;
  averageConversionRatio: number;
  topListings: Array<{
    id: string;
    title: string;
    propertyType: string;
    cityName: string;
    askPrice: number;
    views: number;
    favorites: number;
  }>;
  dailyTrends: Array<{
    date: string;
    impressions: number;
    detailViews: number;
    favorites: number;
  }>;
}

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
  complianceReason?: string | null;
  complianceCategory?: string | null;
  complianceActionAt?: string | null;
  complianceOfficerId?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
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

export interface SearchListingsResponse {
  items: ListingSummaryItem[];
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
  complianceReason?: string | null;
  complianceCategory?: string | null;
  complianceActionAt?: string | null;
  complianceOfficerId?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  activePriceSuggestion?: PriceSuggestionItem | null;
  priceSuggestions?: PriceSuggestionItem[];
  totalViews?: number;
  totalImpressions?: number;
  totalFavorites?: number;
  isFavorited?: boolean;
  offersCount?: number;
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
  complianceReason?: string | null;
  complianceCategory?: string | null;
  complianceActionAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  activePriceSuggestion?: PriceSuggestionItem | null;
  priceSuggestions?: PriceSuggestionItem[];
  totalViews?: number;
  totalImpressions?: number;
  totalFavorites?: number;
  isFavorited?: boolean;
  offersCount?: number;
  createdAt: string;
}

/** Lightweight map-point record returned by GET /listings/map (Story 3.2 / FR-16). */
export interface MapListingItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  latitude: number;
  longitude: number;
  askPrice: number;
  areaSquareMeters: number;
  status: ListingStatus;
  isFalVerified?: boolean;
  primaryPhotoUrl?: string | null;
}

/** Response shape for GET /listings/map bounding-box query. */
export interface MapListingsResponse {
  items: MapListingItem[];
}

