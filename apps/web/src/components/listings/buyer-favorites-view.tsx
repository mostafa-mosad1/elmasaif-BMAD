'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import {
  ListingSummaryItem,
  ListingStatus,
  MAX_FAVORITES_PER_USER,
  FAVORITES_LIMIT_REACHED,
} from '@elmasaif/shared';
import { PropertyCard } from './property-card';
import { ListingStatusBadge } from './listing-status-badge';
import { EmptyState } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';

interface FavoritesPayload {
  items?: ListingSummaryItem[];
  data?: { items?: ListingSummaryItem[] };
}

/**
 * Tolerates both response envelopes: `GET /listings/favorites` wraps in
 * `{ statusCode, data: { items } }` (matching search/map/similar), but a bare
 * `{ items }` is also accepted so the view stays robust to envelope drift — the
 * same lesson as `unwrapSimilarPayload` / `unwrapDetailResponse`.
 */
export function unwrapFavoritesPayload(
  payload: unknown,
): ListingSummaryItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as FavoritesPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

export interface FavoritesGridProps {
  items: ListingSummaryItem[];
  onRemove: (listingId: string) => void;
}

/**
 * Pure presentational grid (Story 3.5 / AC#3, AC#5), kept as a named export so it can
 * be tested via `renderToString` independently of the fetch wrapper.
 *
 * Each cell reuses `PropertyCard` but overrides its built-in POST with `onRemove`, so
 * the page owns un-favoriting (removal in place). A saved property whose LIVE status is
 * no longer `ACTIVE` gets a `ListingStatusBadge` overlaid on the free top-left corner —
 * outside the card, so `property-card.tsx` stays untouched.
 */
export function FavoritesGrid({ items, onRemove }: FavoritesGridProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      data-testid="favorites-grid"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="relative"
          data-testid={`favorite-card-${item.id}`}
        >
          <PropertyCard
            listing={item}
            href={`/properties/${item.id}`}
            onFavoriteToggle={() => onRemove(item.id)}
          />
          {item.status !== ListingStatus.ACTIVE ? (
            <div className="absolute top-3 left-3 z-10" data-testid="favorite-status-badge">
              <ListingStatusBadge status={item.status} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Buyer favorites collection page body (Story 3.5 / FR-20). Loads every saved property
 * newest-first, renders them as `PropertyCard`s, and lets the buyer un-favorite in place.
 * Server caps the list at 100; the header shows the saved count against that limit.
 */
export function BuyerFavoritesView() {
  const [items, setItems] = useState<ListingSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<FavoritesPayload>('/listings/favorites')
      .then((payload) => {
        setItems(unwrapFavoritesPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل العقارات المفضلة.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const handleRemove = async (listingId: string) => {
    try {
      const response = await apiClient.post<{
        data: { isFavorited: boolean; totalFavorites: number };
      }>(`/listings/${listingId}/favorite`);
      // Only remove when the server confirms the favorite is gone; any other
      // result leaves the card in place (guard against a non-toggle response).
      if (response?.data && response.data.isFavorited === false) {
        setItems((prev) => prev.filter((item) => item.id !== listingId));
      }
    } catch (err) {
      // Removal failed — item stays. Surface the 100-cap message; swallow others.
      if (err instanceof ApiError && err.code === FAVORITES_LIMIT_REACHED) {
        setBanner(err.message);
      } else {
        console.error('Failed to remove favorite', err);
      }
    }
  };

  const savedCount = items.length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          العقارات المفضلة
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
          {`${savedCount} من أصل ${MAX_FAVORITES_PER_USER} الحد الأقصى`}
        </p>
      </div>

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-4 text-sm text-status-rejected"
          data-testid="favorites-banner"
        >
          {banner}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-80 rounded-card bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Heart className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب عقاراتك المفضلة. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : savedCount === 0 ? (
        <EmptyState
          icon={<Heart className="w-7 h-7" />}
          title="لا توجد عقارات مفضلة بعد"
          description="قم بحفظ العقارات التي تهمك بالضغط على القلب في أي عقار، وستظهر هنا لمتابعة حالتها بمرور الوقت."
          actionLabel="تصفح العقارات"
          actionHref="/properties"
        />
      ) : (
        <FavoritesGrid items={items} onRemove={handleRemove} />
      )}
    </div>
  );
}
