import { ProposalStatus } from '@elmasaif/shared';

/**
 * Proposal projection returned by provider submission, buyer review, selection, and the
 * admin queue (Story 3.7 / FR-23, FR-24). Deliberately API-local (mirrors `DemandItem`).
 * `proposedPrice` Decimal is emitted as a number (Consistency Conventions).
 */
export interface ProposalItem {
  id: string;
  demandId: string;
  listingId: string;
  providerProfileId: string;
  status: ProposalStatus;
  proposedPrice: number;
  note: string | null;
  rejectReason: string | null;
  selectedAt: string | null;
  createdAt: string;
}

/**
 * Admin review-queue row (Story 3.7 / FR-23): the proposal projection enriched with the
 * light demand/listing summaries and provider broker name the reviewer needs. API-local —
 * mirrors the moderation-queue envelope shape but without the listing-only fields.
 */
export interface ProposalQueueItem extends ProposalItem {
  demandSummary: {
    id: string;
    propertyType: string;
    cityName: string | null;
    maxBudget: number;
  } | null;
  listingSummary: {
    id: string;
    title: string;
    propertyType: string;
    cityName: string | null;
    districtName: string | null;
    askPrice: number;
    areaSquareMeters: number;
  } | null;
  providerName: string | null;
}

export interface ProposalQueueResponse {
  items: ProposalQueueItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * A buyer-facing matching demand for the provider alert surface (Story 3.7 / FR-22):
 * the demand summary plus which of the caller's own ACTIVE listings qualify against it.
 */
export interface MatchingDemandItem {
  demandId: string;
  propertyType: string;
  status: string;
  cityId: string;
  districtId: string | null;
  cityName: string | null;
  districtName: string | null;
  minBudget: number;
  maxBudget: number;
  minArea: number;
  maxArea: number;
  notes: string | null;
  createdAt: string;
  matchedListings: Array<{
    listingId: string;
    title: string;
    askPrice: number;
    areaSquareMeters: number;
  }>;
}
