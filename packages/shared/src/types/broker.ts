import type { ListingSummaryItem } from './listing';

/**
 * Story 6.5: Public Broker Profile & Moderated Reviews (FR-19, FR-52, FR-54, UC-30).
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

