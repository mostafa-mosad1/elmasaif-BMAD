import type { ListingSummaryItem } from './listing';
import type { REVIEW_VISIBILITY_FILTERS } from '../schemas/review.schema';

/**
 * Story 6.5 & Story 8.4: Public Broker Profile & Moderated Reviews (FR-19, FR-52, FR-54, UC-30).
 */

export interface RatingDistribution {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
}

export interface BrokerStatsDto {
  averageRating: number | null;
  totalReviews: number;
  completedDealsCount: number;
  activeListingsCount: number;
  ratingDistribution: RatingDistribution;
}

export interface BrokerReviewItemDto {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  rater: {
    maskedName: string;
  };
}

export interface BrokerFalLicenseDto {
  licenseNumber: string;
  status: string;
  expiryDate?: string | null;
}

export interface BrokerPublicProfileDto {
  id: string;
  userId: string;
  commercialName: string;
  fullName: string;
  createdAt: string;
  isFalVerified: boolean;
  falLicense: BrokerFalLicenseDto | null;
  stats: BrokerStatsDto;
  reviews: BrokerReviewItemDto[];
  activeListings: ListingSummaryItem[];
}

/**
 * Story 8.4: Administrative Review Moderation Workspace Contracts (FR-19, FR-52, AD-6, DESIGN.md #9).
 */
export type ReviewVisibilityFilter = (typeof REVIEW_VISIBILITY_FILTERS)[number];

export interface AdminReviewAuditEntryDto {
  id: string;
  action: 'REVIEW_HIDDEN' | 'REVIEW_UNHIDDEN';
  actorId: string | null;
  actorName: string;
  reason: string | null;
  previousIsHidden: boolean | null;
  isHidden: boolean;
  createdAt: string;
  ipAddress: string | null;
}

export interface AdminReviewModerationItemDto {
  id: string;
  dealId: string;
  dealNumber: string;
  dealReferenceCode: string | null;
  listingId: string | null;
  listingTitle: string;
  score: number;
  comment: string | null;
  createdAt: string;
  isHidden: boolean;
  hiddenByAdminId: string | null;
  hiddenByAdminName: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  rater: {
    id: string;
    fullName: string;
    maskedName: string;
  };
  targetBroker: {
    userId: string;
    profileId: string | null;
    fullName: string;
    commercialName: string;
    licenseNumber: string | null;
    isFalVerified: boolean;
    publicAverageRating: number | null;
    publicVisibleReviewsCount: number;
  };
}

export interface AdminReviewModerationDetailDto
  extends AdminReviewModerationItemDto {
  auditTrail: AdminReviewAuditEntryDto[];
}

export interface AdminReviewModerationCountsDto {
  totalReviews: number;
  visibleReviews: number;
  hiddenReviews: number;
  lowScoreVisibleReviews: number;
}

export interface AdminReviewModerationQueueResponseDto {
  serverTimestamp: string;
  counts: AdminReviewModerationCountsDto;
  items: AdminReviewModerationItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminModerateReviewResponseDto {
  review: AdminReviewModerationItemDto;
  updatedBrokerStats: BrokerStatsDto;
  auditEntry: AdminReviewAuditEntryDto;
}
