import { ListingStatus, OfferStatus, PropertyType } from '../enums';
import type { OfferHistoryAction, OfferRejectionReason } from '../constants/offer';

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

/** UX-DR-10: who the live offer is currently waiting on. `null` for a terminal/hand-off state. */
export type OfferAwaitingParty = 'ADMIN' | 'SELLER' | 'BUYER';

/**
 * Buyer offer projection (Story 4.1 / FR-25). Declared once in `packages/shared` and consumed
 * by both the API and the web app (AR-10/AD-1) — money is a `number`, instants are ISO strings.
 *
 * Story 4.2 adds `negotiationRound` / `awaitingParty` as **optional** fields so 4.1's submit
 * mapper contract and its SSR specs keep working unchanged.
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
  negotiationRound?: number;
  awaitingParty?: OfferAwaitingParty | null;
}

/** UX-DR-10 / UX-DR-13: one entry of the mediation timeline. */
export interface OfferHistoryEntry {
  id: string;
  action: OfferHistoryAction | string;
  actorRole: 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM';
  actorName: string | null;
  priceSnapshot: number | null;
  notes: string | null;
  roundNumber: number | null;
  createdAt: string;
}

/** AD-10: the 15-minute claim lease, projected exactly like `ListingLockInfo`. */
export interface OfferLockInfo {
  isLocked: boolean;
  isLockedByCurrentAdmin: boolean;
  lockedByAdminId: string | null;
  lockedByAdminName: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  remainingSeconds: number;
}

/**
 * Offer thread summary (Story 4.2 / FR-26, FR-55) — everything the negotiation screen and the
 * seller inbox need, with display names only. Mobile numbers, emails and IBANs are never part
 * of this projection: direct seller↔buyer contact stays impossible.
 */
export interface OfferThreadSummary {
  id: string;
  status: OfferStatus;
  offerPrice: number;
  askPrice: number;
  isBackup: boolean;
  isLowPrice: boolean;
  negotiationRound: number;
  maxCounterRounds: number;
  awaitingParty: OfferAwaitingParty | null;
  expiresAt: string;
  createdAt: string;
  buyerName: string | null;
  sellerName: string | null;
  rejectionReason: OfferRejectionReason | string | null;
  rejectionNote: string | null;
  listing: OfferListingSummary;
  lockInfo?: OfferLockInfo;
}

/** The full negotiation thread returned by `GET /offers/:id`. */
export interface OfferThreadItem extends OfferThreadSummary {
  history: OfferHistoryEntry[];
}
