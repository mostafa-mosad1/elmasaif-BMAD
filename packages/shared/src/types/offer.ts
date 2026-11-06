import { ListingStatus, OfferStatus, PropertyType } from '../enums';

/**
 * Light listing projection carried by every offer row (Story 4.1 / FR-25, FR-59). Names are
 * pre-resolved to Arabic by the API so the client never needs the geo lookups.
 */
export interface OfferListingSummary {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityName: string | null;
  districtName: string | null;
  askPrice: number;
  areaSquareMeters: number;
  status: ListingStatus;
}

/**
 * Buyer offer projection (Story 4.1 / FR-25). Declared once in `packages/shared` and consumed
 * by both the API and the web app (AR-10/AD-1) — money is a `number`, instants are ISO strings.
 */
export interface OfferItem {
  id: string;
  listingId: string;
  status: OfferStatus;
  offerPrice: number;
  askPrice: number;
  isBackup: boolean;
  isLowPrice: boolean;
  note: string | null;
  expiresAt: string;
  createdAt: string;
  listing: OfferListingSummary;
}
