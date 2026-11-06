'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins, X } from 'lucide-react';
import { OfferThreadSummary } from '@elmasaif/shared';
import { EmptyState } from '../ui';
import { apiClient } from '../../lib/api-client';
import { SellerOffersList } from './seller-offers-list';
import { unwrapOffersPayload } from './offers-view';

/**
 * `GET /offers/received` returns the same `{ data: { items } }` envelope as `GET /offers/my`, so
 * the payload unwrapping stays in one place — this is only a typed pass-through, never a fork.
 */
export function unwrapSellerOffersPayload(payload: unknown): OfferThreadSummary[] {
  return unwrapOffersPayload(payload) as unknown as OfferThreadSummary[];
}

export interface SellerOffersViewProps {
  /** Workspace-specific detail route base, e.g. `/app/marketer/offers`. */
  detailHrefBase: string;
}

/**
 * «العروض الواردة» seller surface (Story 4.2 / AC#10, FR-55). Mounted unchanged by the marketer
 * and owner trees; only the detail route base differs, so the sidebar highlighting stays correct.
 */
export function SellerOffersView({ detailHrefBase }: SellerOffersViewProps) {
  const [offers, setOffers] = useState<OfferThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get('/offers/received')
      .then((payload) => {
        setOffers(unwrapSellerOffersPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل العروض الواردة.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const awaitingCount = offers.filter((offer) => offer.awaitingParty === 'SELLER').length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <HandCoins className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          العروض الواردة
        </h1>
        <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {`${awaitingCount} بانتظار ردك`}
        </span>
      </div>
      <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary -mt-3">
        عروض الشراء التي اعتمدتها الإدارة على عقاراتك. كل عرض مضاد يمر عبر الإدارة قبل إحالته
        للطرف الآخر، والتواصل المباشر مع المشتري غير متاح.
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<X className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب العروض الواردة. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : (
        <SellerOffersList offers={offers} detailHrefBase={detailHrefBase} />
      )}
    </div>
  );
}
