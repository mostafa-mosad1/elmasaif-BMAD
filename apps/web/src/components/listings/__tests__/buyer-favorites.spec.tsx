import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ListingSummaryItem,
  ListingStatus,
  PropertyType,
  UserRole,
} from '@elmasaif/shared';
import {
  FavoritesGrid,
  unwrapFavoritesPayload,
} from '../buyer-favorites-view';
import { ListingFavoriteButton } from '../listing-favorite-button';

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../lib/api-client')
  >('../../../lib/api-client');
  return {
    ...actual,
    apiClient: Object.assign(
      () => Promise.resolve({}),
      {
        get: vi.fn(() => Promise.resolve({ statusCode: 200, data: { items: [] } })),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
    ),
  };
});

const summaryItem = (
  id: string,
  overrides: Partial<ListingSummaryItem> = {},
): ListingSummaryItem =>
  ({
    id,
    title: `فيلا ${id}`,
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'dist-1',
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 3_100_000,
    areaSquareMeters: 450,
    bedrooms: 5,
    status: ListingStatus.ACTIVE,
    sellerRole: UserRole.MARKETER,
    isFalVerified: true,
    photoCount: 1,
    photos: [`https://s3.local/${id}.jpg?signed=true`],
    primaryPhotoUrl: `https://s3.local/${id}.jpg?signed=true`,
    totalFavorites: 2,
    isFavorited: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  } as ListingSummaryItem);

describe('unwrapFavoritesPayload (Story 3.5 / AC#3)', () => {
  it('reads items from the wrapped { statusCode, data: { items } } envelope the endpoint returns', () => {
    const items = [summaryItem('a'), summaryItem('b')];
    expect(unwrapFavoritesPayload({ data: { items } })).toEqual(items);
  });

  it('also accepts the bare { items } shape so envelope drift never breaks the page', () => {
    const items = [summaryItem('c')];
    expect(unwrapFavoritesPayload({ items })).toEqual(items);
  });

  it('returns [] for null, empty, or malformed payloads', () => {
    expect(unwrapFavoritesPayload(null)).toEqual([]);
    expect(unwrapFavoritesPayload(undefined)).toEqual([]);
    expect(unwrapFavoritesPayload({})).toEqual([]);
    expect(unwrapFavoritesPayload({ data: {} })).toEqual([]);
    expect(unwrapFavoritesPayload({ items: null as any })).toEqual([]);
  });
});

describe('FavoritesGrid (Story 3.5 / AC#3, AC#5)', () => {
  it('renders one PropertyCard per saved item linked to /properties/{id}', () => {
    const items = [summaryItem('x1'), summaryItem('x2')];
    const html = renderToString(
      <FavoritesGrid items={items} onRemove={() => {}} />,
    );

    expect(html).toContain('data-testid="favorites-grid"');
    expect(html).toContain('data-testid="favorite-card-x1"');
    expect(html).toContain('data-testid="favorite-card-x2"');
    expect(html).toContain('href="/properties/x1"');
    expect(html).toContain('href="/properties/x2"');
  });

  it('overlays the live status badge for non-ACTIVE favorites (RESERVED / SOLD / ARCHIVED)', () => {
    for (const status of [
      ListingStatus.RESERVED,
      ListingStatus.SOLD,
      ListingStatus.ARCHIVED,
    ]) {
      const html = renderToString(
        <FavoritesGrid
          items={[summaryItem('s1', { status })]}
          onRemove={() => {}}
        />,
      );
      expect(html).toContain('data-testid="favorite-status-badge"');
    }
  });

  it('renders NO status badge for an ACTIVE favorite', () => {
    const html = renderToString(
      <FavoritesGrid
        items={[summaryItem('live', { status: ListingStatus.ACTIVE })]}
        onRemove={() => {}}
      />,
    );
    expect(html).toContain('data-testid="favorite-card-live"');
    expect(html).not.toContain('data-testid="favorite-status-badge"');
  });

  it('renders no cards for an empty collection', () => {
    const html = renderToString(
      <FavoritesGrid items={[]} onRemove={() => {}} />,
    );
    expect(html).toContain('data-testid="favorites-grid"');
    expect(html).not.toContain('data-testid="favorite-card-');
  });
});

describe('ListingFavoriteButton (Story 3.5 / AC#2)', () => {
  it('renders the filled-heart remove label when seeded favorited, with its testid', () => {
    const html = renderToString(
      <ListingFavoriteButton
        listingId="live-1"
        initialFavorited={true}
        initialTotalFavorites={4}
      />,
    );

    expect(html).toContain('data-testid="listing-favorite-button"');
    expect(html).toContain('aria-label="إزالة من المفضلة"');
    expect(html).toContain('fill-red-500');
  });

  it('renders the add-to-favorites label when not favorited', () => {
    const html = renderToString(
      <ListingFavoriteButton listingId="live-2" initialFavorited={false} />,
    );
    expect(html).toContain('aria-label="إضافة إلى المفضلة"');
    expect(html).not.toContain('fill-red-500');
  });
});
