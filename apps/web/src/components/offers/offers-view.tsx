'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ACTIVE_OFFER_STATUSES, OfferItem } from '@elmasaif/shared';
import { HandCoins, X } from 'lucide-react';
import { EmptyState } from '../ui';
import { apiClient } from '../../lib/api-client';
import { BuyerOffersList } from './buyer-offers-list';

interface OffersPayload {
  items?: OfferItem[];
  data?: { items?: OfferItem[] };
}

/**
 * Tolerates both envelopes: `GET /offers/my` wraps in `{ statusCode, data: { items } }`, but a
 * bare `{ items }` (or a nullish body) is accepted too — the same lesson as
 * `unwrapDemandsPayload` / `unwrapMatchingDemandsPayload`.
 */
export function unwrapOffersPayload(payload: unknown): OfferItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as OffersPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

/**
 * Dashboard counter (Story 4.1 / FR-25): an offer counts as active only while its status is
 * non-terminal AND it has not lapsed, mirroring the server's active definition so an expired
 * offer is never reported as «نشط». Display-only, so the browser clock is acceptable.
 */
export function countActiveOffers(items: OfferItem[]): number {
  if (!Array.isArray(items)) return 0;
  const nowMs = Date.now();
  return items.filter(
    (item) =>
      ACTIVE_OFFER_STATUSES.includes(item.status) &&
      new Date(item.expiresAt).getTime() > nowMs,
  ).length;
}

/**
 * Buyer offer surface (Story 4.1 / FR-25, FR-59): the caller's own purchase offers, newest
 * first, backed by `GET /offers/my`. Seller responses and counter rounds land in Story 4.2.
 */
export function OffersView() {
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<OffersPayload>('/offers/my')
      .then((payload) => {
        setOffers(unwrapOffersPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل عروض الشراء.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <HandCoins className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          عروض الشراء
        </h1>
        <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {`${countActiveOffers(offers)} عرض نشط`}
        </span>
      </div>
      <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary -mt-3">
        عروض الشراء التي قدمتها على العقارات المعروضة وحالتها لدى المنصة. تُعرض العروض على
        البائع بعد اعتمادها إدارياً.
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<X className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب عروضك. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : (
        <BuyerOffersList offers={offers} />
      )}
    </div>
  );
}
