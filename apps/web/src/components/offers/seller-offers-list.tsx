import React from 'react';
import Link from 'next/link';
import {
  MAX_COUNTER_ROUNDS,
  OFFER_AWAITING_PARTY_LABELS_AR,
  OfferThreadSummary,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { HandCoins, MapPin } from 'lucide-react';
import { EmptyState } from '../ui';
import { formatSar } from '../listings/commission-calculator';
import { OfferStatusBadge } from './offer-status-badge';
import { formatOfferExpiry } from './buyer-offers-list';

export interface SellerOffersListProps {
  offers: OfferThreadSummary[];
  /** Workspace-specific detail route base, e.g. `/app/marketer/offers`. */
  detailHrefBase?: string;
}

/**
 * «العروض الواردة» inbox (Story 4.2 / FR-55, AC#10): the mediated offers sitting on the caller's
 * own listings. Purely presentational — the fetch wrapper lives in `SellerOffersView` — so the
 * SSR suite can render every row without a DOM.
 */
export function SellerOffersList({ offers, detailHrefBase }: SellerOffersListProps) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<HandCoins className="w-7 h-7" />}
        title="لا توجد عروض واردة بعد"
        description="ستظهر هنا عروض الشراء التي تعتمدها الإدارة على عقاراتك، ويمكنك الرد عليها بالقبول أو الرفض أو عرض مقابل."
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="seller-offers-list">
      {offers.map((offer) => {
        const listing = offer.listing;
        const awaitingSeller = offer.awaitingParty === 'SELLER';

        return (
          <li
            key={offer.id}
            className="rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-4 space-y-2"
            data-testid={`seller-offer-row-${offer.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary truncate">
                  {listing?.title || '—'}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {[
                      PROPERTY_TYPE_LABELS_AR[
                        listing?.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR
                      ] || listing?.propertyType,
                      listing?.areaSquareMeters ? `م² ${listing.areaSquareMeters}` : null,
                      listing?.cityName,
                      listing?.districtName,
                    ]
                      .filter(Boolean)
                      .join(' — ')}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {awaitingSeller ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
                    data-testid={`seller-offer-awaiting-${offer.id}`}
                  >
                    بانتظار ردك
                  </span>
                ) : offer.awaitingParty ? (
                  <span className="inline-flex items-center rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                    {OFFER_AWAITING_PARTY_LABELS_AR[offer.awaitingParty]}
                  </span>
                ) : null}
                {offer.isBackup ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-dark dark:text-accent border border-accent/20"
                    data-testid={`seller-offer-backup-${offer.id}`}
                  >
                    {offer.activatedAt ? 'عرض احتياطي مُفعَّل' : 'عرض احتياطي'}
                  </span>
                ) : null}
                <OfferStatusBadge status={offer.status} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-secondary dark:text-dark-ink-secondary">
                سعر الطلب:{' '}
                <span dir="ltr" className="font-mono">
                  {formatSar(offer.askPrice)}
                </span>
              </span>
              <span dir="ltr" className="font-mono font-bold text-primary">
                {formatSar(offer.offerPrice)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <span className="inline-flex items-center gap-2">
                <span>{`المشتري: ${offer.buyerName || 'مشتري'}`}</span>
                <span
                  className="inline-flex items-center rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 font-semibold"
                  data-testid={`seller-offer-round-${offer.id}`}
                >
                  {`جولة ${offer.negotiationRound} من ${MAX_COUNTER_ROUNDS}`}
                </span>
              </span>
              <span>{formatOfferExpiry(offer.expiresAt)}</span>
            </div>

            {detailHrefBase ? (
              <div className="pt-1">
                <Link
                  href={`${detailHrefBase}/${offer.id}`}
                  className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                  data-testid={`seller-offer-open-${offer.id}`}
                >
                  فتح التفاوض
                </Link>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
