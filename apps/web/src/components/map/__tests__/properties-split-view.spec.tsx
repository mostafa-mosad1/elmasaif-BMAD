import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Mock next/dynamic — return a placeholder component for SSR tests
vi.mock('next/dynamic', () => ({
  default: (loader: any, opts?: any) => {
    const Comp = (props: any) =>
      React.createElement('div', { 'data-testid': 'dynamic-map', ...props }, 'Map Placeholder');
    Comp.displayName = 'DynamicMap';
    return Comp;
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Map: (props: any) => React.createElement('span', props, 'MapIcon'),
  List: (props: any) => React.createElement('span', props, 'ListIcon'),
}));

import { PropertiesSplitView } from '../../../app/properties/properties-split-view';

describe('PropertiesSplitView (Story 3.2)', () => {
  const mockFilters = {
    q: '',
    cityId: null,
    districtId: null,
    propertyType: null as any,
    priceMin: '',
    priceMax: '',
    areaMin: '',
    areaMax: '',
    bedroomsMin: '',
    falOnly: false,
    sort: 'newest' as any,
    page: 1,
    limit: 20,
  };

  it('renders the split-view wrapper', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', { 'data-testid': 'grid-children' }, 'Grid Content'),
      }),
    );
    expect(html).toContain('data-testid="properties-split-view"');
  });

  it('renders children (grid) content', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', null, 'Grid Content'),
      }),
    );
    expect(html).toContain('Grid Content');
  });

  it('renders the dynamic map placeholder (mocked next/dynamic)', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', null, 'Grid'),
      }),
    );
    expect(html).toContain('Map Placeholder');
  });

  it('renders mobile pill toggle buttons', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', null, 'Grid'),
      }),
    );
    // Both buttons should be present (list + map)
    expect(html).toContain('القائمة');
    expect(html).toContain('الخريطة');
  });

  it('contains desktop layout classes (lg:flex hidden)', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', null, 'Grid'),
      }),
    );
    expect(html).toContain('hidden lg:flex');
  });

  it('contains mobile-only class (lg:hidden)', () => {
    const html = renderToString(
      React.createElement(PropertiesSplitView, {
        filters: mockFilters,
        activeListingId: null,
        onMarkerClick: vi.fn(),
        children: React.createElement('div', null, 'Grid'),
      }),
    );
    expect(html).toContain('lg:hidden');
  });
});
