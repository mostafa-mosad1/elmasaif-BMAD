import { ProposalStatus, PropertyType } from '@elmasaif/shared';

/**
 * Provider/buyer proposal projection returned by `POST /proposals`,
 * `GET /proposals/demand/:id`, `POST /proposals/:id/select`, and the admin queue
 * (Story 3.7 / FR-23, FR-24). Mirrors the API `ProposalItem`. `proposedPrice` arrives
 * as a number (Decimal coerced server-side).
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
 * Light listing summary the buyer sees beside each approved proposal (Story 3.7 / FR-24).
 * A trimmed subset of the API listing projection — no photo presigning on this surface.
 */
export interface ProposalListingSummary {
  id: string;
  title: string;
  propertyType: PropertyType | string;
  cityId: string;
  districtId: string | null;
  cityName: string | null;
  districtName: string | null;
  askPrice: number;
  areaSquareMeters: number;
}

/** A buyer review row: an APPROVED proposal plus its listing summary and provider broker name. */
export interface BuyerProposalItem extends ProposalItem {
  listing: ProposalListingSummary | null;
  providerName: string | null;
}

/**
 * Provider matching-alert row (Story 3.7 / FR-22 / `demand.matched`): a demand summary plus
 * which of the caller's own ACTIVE listings qualified against it. Mirrors the API
 * `MatchingDemandItem`.
 */
export interface MatchingDemandItem {
  demandId: string;
  propertyType: PropertyType | string;
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
