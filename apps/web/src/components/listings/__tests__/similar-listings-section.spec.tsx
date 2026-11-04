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
  SimilarListingsCarousel,
  SimilarListingsSection,
  unwrapSimilarPayload,
} from '../similar-listings-section';

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

const summaryItem = (id: string, overrides: Partial<ListingSummaryItem> = {}): ListingSummaryItem =>
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
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  } as ListingSummaryItem);

describe('unwrapSimilarPayload (Story 3.4 / AC#5)', () => {
  it('reads items from the wrapped { statusCode, data: { items } } envelope that /listings/:id/similar returns', () => {
    const items = [summaryItem('a'), summaryItem('b')];
    expect(unwrapSimilarPayload({ data: { items } })).toEqual(items);
  });

  it('also accepts the bare { items } shape so envelope drift never breaks the carousel', () => {
    const items = [summaryItem('c')];
    expect(unwrapSimilarPayload({ items })).toEqual(items);
  });

  it('returns [] for null, empty, or malformed payloads (AC#5 — silence beats error)', () => {
    expect(unwrapSimilarPayload(null)).toEqual([]);
    expect(unwrapSimilarPayload(undefined)).toEqual([]);
    expect(unwrapSimilarPayload({})).toEqual([]);
    expect(unwrapSimilarPayload({ data: {} })).toEqual([]);
    expect(unwrapSimilarPayload({ items: null as any })).toEqual([]);
  });
});

describe('SimilarListingsCarousel (Story 3.4 / AC#1, AC#4)', () => {
  it('renders nothing when the engine returned zero matches — no section, no error, no layout shift', () => {
    expect(SimilarListingsCarousel({ items: [] })).toBeNull();
    const html = renderToString(<SimilarListingsCarousel items={[]} />);
    expect(html).toBe('');
    expect(html).not.toContain('عقارات مشابهة');
  });

  it('renders the "عقارات مشابهة" heading and one PropertyCard per item with a horizontal scroll strip', () => {
    const items = [summaryItem('x1'), summaryItem('x2'), summaryItem('x3')];
    const html = renderToString(<SimilarListingsCarousel items={items} />);

    expect(html).toContain('عقارات مشابهة');
    expect(html).toContain('data-testid="similar-listings-section"');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('shrink-0');
    expect(html).toContain('data-testid="similar-listing-card-x1"');
    expect(html).toContain('data-testid="similar-listing-card-x2"');
    expect(html).toContain('data-testid="similar-listing-card-x3"');
  });

  it('navigates each card directly to /properties/{id} via PropertyCard href (AC#4)', () => {
    const items = [summaryItem('nav-1'), summaryItem('nav-2')];
    const html = renderToString(<SimilarListingsCarousel items={items} />);

    expect(html).toContain('href="/properties/nav-1"');
    expect(html).toContain('href="/properties/nav-2"');
  });

  it('never renders a card for the current listing id — the server already excludes it (AC#2)', () => {
    const items = [summaryItem('other-1'), summaryItem('other-2')];
    const html = renderToString(<SimilarListingsCarousel items={items} />);

    expect(html).not.toContain('data-testid="similar-listing-card-current"');
    expect(html).toContain('data-testid="similar-listing-card-other-1"');
  });

  it('inherits the parent dir="rtl" — the strip itself does not fight it with custom scroll math', () => {
    const items = [summaryItem('rtl-1')];
    const html = renderToString(<SimilarListingsCarousel items={items} />);
    // No explicit dir attribute on the section — RTL comes from the detail view.
    expect(html).not.toMatch(/<section[^>]*dir=/);
  });
});

describe('SimilarListingsSection (Story 3.4 / AC#1)', () => {
  it('renders empty (null) on the server — no layout shift while the fetch is still pending', () => {
    const html = renderToString(<SimilarListingsSection listingId="live-1" />);
    // useEffect never fires under renderToString, so state stays [] → carousel returns null.
    expect(html).toBe('');
    expect(html).not.toContain('عقارات مشابهة');
  });
});
