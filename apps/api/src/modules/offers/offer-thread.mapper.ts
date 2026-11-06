import {
  MAX_COUNTER_ROUNDS,
  OfferAwaitingParty,
  OfferHistoryEntry,
  OfferStatus,
  OfferThreadItem,
  OfferThreadSummary,
} from '@elmasaif/shared';

/**
 * Shared read projections for the offer mediation thread (Story 4.2 / FR-26, FR-55). Kept in
 * one place so the buyer/seller endpoints (`offers.service`) and the admin mediation queue
 * (`admin-offers.service`) can never disagree about what a thread looks like.
 *
 * Only display names are selected — no mobile number, email or IBAN ever enters an offer
 * payload, so direct seller↔buyer contact stays impossible (mediation transparency).
 */
export const OFFER_SUMMARY_INCLUDE = {
  listing: {
    include: {
      sellerProfile: { include: { user: { select: { fullName: true } } } },
      city: true,
      district: true,
    },
  },
  buyerProfile: { include: { user: { select: { fullName: true } } } },
} as const;

export const OFFER_THREAD_INCLUDE = {
  ...OFFER_SUMMARY_INCLUDE,
  history: { orderBy: { createdAt: 'asc' } },
} as const;

export function toIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** UX-DR-10: who the live offer is waiting on, derived from the state machine. */
export function resolveAwaitingParty(status: OfferStatus): OfferAwaitingParty | null {
  switch (status) {
    case OfferStatus.PENDING_ADMIN_REVIEW:
    case OfferStatus.COUNTER_OFFERED:
      return 'ADMIN';
    case OfferStatus.RELAYED_TO_SELLER:
      return 'SELLER';
    case OfferStatus.RELAYED_TO_BUYER:
      return 'BUYER';
    default:
      return null;
  }
}

export function toOfferThreadSummary(
  offer: any,
  options: { includeHistory: boolean },
): OfferThreadSummary | OfferThreadItem {
  const listing = offer?.listing;
  const buyerName = offer?.buyerProfile?.user?.fullName ?? null;
  const sellerName = listing?.sellerProfile?.user?.fullName ?? null;

  const summary: OfferThreadSummary = {
    id: offer.id,
    status: offer.status,
    offerPrice: Number(offer.offerPrice),
    askPrice: listing ? Number(listing.askPrice) : 0,
    isBackup: Boolean(offer.isBackup),
    isLowPrice: Boolean(offer.isLowPrice),
    negotiationRound: Number(offer.negotiationRound ?? 0),
    maxCounterRounds: MAX_COUNTER_ROUNDS,
    awaitingParty: resolveAwaitingParty(offer.status),
    expiresAt: toIso(offer.expiresAt) as string,
    createdAt: toIso(offer.createdAt) as string,
    buyerName,
    sellerName,
    rejectionReason: offer.rejectionReason ?? null,
    rejectionNote: offer.rejectionNote ?? null,
    listing: {
      id: listing?.id ?? offer.listingId,
      title: listing?.title ?? '',
      propertyType: listing?.propertyType,
      cityName: listing?.city?.nameAr ?? null,
      districtName: listing?.district?.nameAr ?? null,
      askPrice: listing ? Number(listing.askPrice) : 0,
      areaSquareMeters: listing ? Number(listing.areaSquareMeters) : 0,
      status: listing?.status,
    },
  };

  if (!options.includeHistory) return summary;

  return {
    ...summary,
    history: (offer.history ?? []).map((entry: any) =>
      toHistoryEntry(entry, offer.buyerProfileId, { buyerName, sellerName }),
    ),
  };
}

/**
 * Timeline row projection (UX-DR-10 / UX-DR-13). Admin actions are detected by `actorAdminId` —
 * without it an admin relay would be mislabelled as a seller step.
 */
export function toHistoryEntry(
  entry: any,
  buyerProfileId: string,
  names: { buyerName: string | null; sellerName: string | null },
): OfferHistoryEntry {
  let actorRole: OfferHistoryEntry['actorRole'];
  let actorName: string | null = null;

  if (entry.actorAdminId) {
    actorRole = 'ADMIN';
  } else if (entry.actorProfileId && entry.actorProfileId === buyerProfileId) {
    actorRole = 'BUYER';
    actorName = names.buyerName;
  } else if (entry.actorProfileId) {
    actorRole = 'SELLER';
    actorName = names.sellerName;
  } else {
    actorRole = 'SYSTEM';
  }

  return {
    id: entry.id,
    action: entry.action,
    actorRole,
    actorName,
    priceSnapshot:
      entry.priceSnapshot === null || entry.priceSnapshot === undefined
        ? null
        : Number(entry.priceSnapshot),
    notes: entry.notes ?? null,
    roundNumber:
      entry.roundNumber === null || entry.roundNumber === undefined
        ? null
        : Number(entry.roundNumber),
    createdAt: toIso(entry.createdAt) as string,
  };
}
