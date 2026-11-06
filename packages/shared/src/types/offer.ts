import { ListingStatus, OfferStatus, PropertyType } from '../enums';
import type {
  BackupOfferQueueState,
  OfferHistoryAction,
  OfferRejectionReason,
} from '../constants/offer';
import type { OfferLockInfo } from './locks';

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
 * mapper contract and its SSR specs keep working unchanged. Story 4.3 adds the optional
 * `activatedAt` stamp for an activated backup offer.
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
  activatedAt?: string | null;
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
  activatedAt?: string | null;
}

/** The full negotiation thread returned by `GET /offers/:id`. */
export interface OfferThreadItem extends OfferThreadSummary {
  history: OfferHistoryEntry[];
}

/**
 * Story 4.3 / FR-27, OQ-04: one row of a listing's backup queue. The listing projection is
 * inherited from `OfferThreadSummary.listing` — deliberately not re-declared, and
 * `item.listing.status` stays the single source of the listing's state.
 */
export interface BackupOfferQueueItem extends OfferThreadSummary {
  /** 1 = next in line (oldest approved backup offer first). */
  queuePosition: number;
  queueState: BackupOfferQueueState;
}

/** One listing that currently holds a backup queue, with its ordered offers. */
export interface BackupOfferQueueGroup {
  listing: OfferListingSummary;
  queueState: BackupOfferQueueState;
  items: BackupOfferQueueItem[];
}
