'use client';

import React from 'react';
import Link from 'next/link';
import { MAX_COUNTER_ROUNDS, OfferItem, PROPERTY_TYPE_LABELS_AR } from '@elmasaif/shared';
import { HandCoins, MapPin } from 'lucide-react';
import { EmptyState } from '../ui';
import { formatSar } from '../listings/commission-calculator';
import { OfferStatusBadge } from './offer-status-badge';

/**
 * Remaining validity of an offer, expressed the way the offer cards read it. The browser clock
 * is acceptable here: the value is display-only, the authoritative expiry lives server-side.
 */
export function formatOfferExpiry(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(msLeft)) return '—';
  if (msLeft <= 0) return 'انتهت مدة العرض';
  const days = Math.ceil(msLeft / 86400000);
  if (days === 1) return 'متبقي يوم واحد';
  if (days === 2) return 'متبقي يومان';
  if (days <= 10) return `متبقي ${days.toLocaleString('en-US')} أيام`;
  return `متبقي ${days.toLocaleString('en-US')} يوماً`;
}

export interface BuyerOffersListProps {
  offers: OfferItem[];
  /** Workspace detail route base, e.g. `/app/buyer/offers`; rows stay unlinked without it. */
  detailHrefBase?: string;
}

/**
 * Pure presentational list of the caller's own offers (Story 4.1 / FR-25, FR-59). Each row
 * carries the listing summary, the binding offer price next to the ask price, the Arabic
 * lifecycle badge, a backup-offer chip and the remaining validity window. Story 4.2 adds the
 * optional «بانتظار ردك» chip, the round counter and an opt-in detail link. Exported so
 * SSR tests can render it independently of the fetch wrapper.
 */
export function BuyerOffersList({ offers, detailHrefBase }: BuyerOffersListProps) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<HandCoins className="w-7 h-7" />}
        title="لا توجد عروض شراء بعد"
        description="تصفح العقارات المعروضة وقدم أول عرض شراء لبدء التفاوض المباشر بإشراف المنصة."
        actionLabel="تصفح العقارات المتاحة"
        actionHref="/"
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="buyer-offers-list">
      {offers.map((offer) => {
        const listing = offer.listing;
        return (
          <li
            key={offer.id}
            className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-2"
            data-testid={`buyer-offer-row-${offer.id}`}
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
                {offer.awaitingParty === 'BUYER' ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
                    data-testid={`buyer-offer-awaiting-${offer.id}`}
                  >
                    بانتظار ردك
                  </span>
                ) : null}
                {offer.isBackup ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-[#C69C45]/15 px-2 py-0.5 text-[11px] font-bold text-[#8a6a1f] dark:text-[#D4AF37]"
                    data-testid={`buyer-offer-backup-${offer.id}`}
                  >
                    عرض احتياطي
                  </span>
                ) : null}
                {offer.isBackup && offer.activatedAt ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-status-infoBg px-2 py-0.5 text-[11px] font-bold text-status-info border border-status-infoBorder"
                    data-testid={`buyer-offer-backup-activated-${offer.id}`}
                  >
                    عرض احتياطي مُفعَّل
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

            <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <span className="inline-flex items-center gap-2">
                <span>{formatOfferExpiry(offer.expiresAt)}</span>
                {offer.negotiationRound !== undefined && offer.negotiationRound !== null ? (
                  <span
                    className="inline-flex items-center rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 font-semibold"
                    data-testid={`buyer-offer-round-${offer.id}`}
                  >
                    {`جولة ${offer.negotiationRound} من ${MAX_COUNTER_ROUNDS}`}
                  </span>
                ) : null}
              </span>
              {offer.note ? <span className="truncate max-w-[55%]">{offer.note}</span> : null}
            </div>

            {detailHrefBase ? (
              <div className="pt-1">
                <Link
                  href={`${detailHrefBase}/${offer.id}`}
                  className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                  data-testid={`buyer-offer-open-${offer.id}`}
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
