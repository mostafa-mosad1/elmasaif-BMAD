'use client';

import React, { useEffect, useState } from 'react';
import { ListingSummaryItem } from '@elmasaif/shared';
import { PropertyCard } from './property-card';
import { apiClient } from '../../lib/api-client';

interface SimilarListingsPayload {
  items?: ListingSummaryItem[];
  data?: { items?: ListingSummaryItem[] };
}

/**
 * Tolerates both response envelopes: the new endpoint wraps in `{ statusCode, data: { items } }`
 * (matching search/map), but detail-shaped bare `{ items }` is also accepted so this stays
 * robust to upstream envelope drift (same lesson as `unwrapDetailResponse` in Story 3.3).
 */
export function unwrapSimilarPayload(
  payload: SimilarListingsPayload | null | undefined,
): ListingSummaryItem[] {
  if (!payload) return [];
  const wrapped = payload.data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export interface SimilarListingsSectionProps {
  listingId: string;
}

/**
 * Pure presentational carousel for Story 3.4 / FR-18. Renders nothing when the
 * list is empty; otherwise the section heading and a horizontal overflow strip
 * of `PropertyCard`s linked to `/properties/{id}` (AC#4). Kept as a named export
 * so the fetch wrapper and the visual can be tested independently.
 */
export function SimilarListingsCarousel({
  items,
}: {
  items: ListingSummaryItem[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <section
      className="pt-4 border-t border-surface-border dark:border-dark-surface-border"
      data-testid="similar-listings-section"
    >
      <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary mb-3">
        عقارات مشابهة
      </h2>
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        data-testid="similar-listings-strip"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-72 sm:w-80 shrink-0"
            data-testid={`similar-listing-card-${item.id}`}
          >
            <PropertyCard listing={item} href={`/properties/${item.id}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Similar listings engine host section (Story 3.4 / FR-18).
 *
 * Strictly supplementary: while loading, when the engine returns zero rows, or
 * when the request fails, this component renders nothing — never a spinner slot,
 * never an error card, never a layout shift. The Story 3.3 detail screen must
 * look exactly as it did without this section if anything goes wrong (AC#5).
 *
 * The ±20% band and district-first / city-fallback merge live server-side; the
 * client only fetches by `listingId` and hands the returned array to the carousel.
 */
export function SimilarListingsSection({ listingId }: SimilarListingsSectionProps) {
  const [items, setItems] = useState<ListingSummaryItem[]>([]);

  useEffect(() => {
    if (!listingId) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setItems([]);

    apiClient
      .get<SimilarListingsPayload>(`/listings/${listingId}/similar`)
      .then((payload) => {
        if (cancelled) return;
        setItems(unwrapSimilarPayload(payload));
      })
      .catch(() => {
        // AC#5 — swallow failures silently so the detail screen is unchanged.
        if (cancelled) return;
        setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  return <SimilarListingsCarousel items={items} />;
}
