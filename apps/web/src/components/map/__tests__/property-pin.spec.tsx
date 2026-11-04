import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ListingStatus, PropertyType, MapListingItem } from '@elmasaif/shared';

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className, ...props }: any) =>
    React.createElement('div', { 'data-testid': 'map-container', className }, children),
  TileLayer: () => null,
  Marker: ({ children, position }: any) =>
    React.createElement('div', { 'data-testid': 'marker', 'data-position': JSON.stringify(position) }, children),
  Popup: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'popup' }, children),
  useMap: () => ({
    getBounds: () => ({
      getSouth: () => 16,
      getWest: () => 34.5,
      getNorth: () => 32.5,
      getEast: () => 55.7,
    }),
    on: vi.fn(),
    flyTo: vi.fn(),
  }),
  useMapEvents: vi.fn(),
}));

// Mock react-leaflet-cluster
vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'cluster-group' }, children),
}));

// Mock apiClient
vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ statusCode: 200, data: { items: [] } }),
  },
}));

// Mock leaflet (window access)
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts: any) => opts),
    latLng: vi.fn((lat, lng) => ({ lat, lng })),
    latLngBounds: vi.fn((sw, ne) => ({ sw, ne, getSouth: () => 16, getWest: () => 34, getNorth: () => 32, getEast: () => 55 })),
    point: vi.fn((x, y) => ({ x, y })),
  },
  divIcon: vi.fn((opts: any) => opts),
  latLng: vi.fn((lat, lng) => ({ lat, lng })),
  latLngBounds: vi.fn((sw, ne) => ({ sw, ne, getSouth: () => 16, getWest: () => 34, getNorth: () => 32, getEast: () => 55 })),
  point: vi.fn((x, y) => ({ x, y })),
}));

import { PropertyPin, formatPinPrice } from '../property-pin';

describe('formatPinPrice (Story 3.2)', () => {
  it('formats millions with one decimal', () => {
    expect(formatPinPrice(3200000)).toBe('3.2 مليون');
  });

  it('formats whole millions', () => {
    expect(formatPinPrice(5000000)).toBe('5 مليون');
  });

  it('formats thousands', () => {
    expect(formatPinPrice(450000)).toBe('450 ألف');
  });

  it('formats small numbers with locale', () => {
    expect(formatPinPrice(900)).toBe('900');
  });
});

describe('PropertyPin (Story 3.2)', () => {
  const mockItem: MapListingItem = {
    id: 'pin-1',
    title: 'فيلا فاخرة',
    propertyType: PropertyType.VILLA,
    latitude: 24.7,
    longitude: 46.6,
    askPrice: 3200000,
    areaSquareMeters: 450,
    status: ListingStatus.ACTIVE,
    isFalVerified: true,
  };

  it('renders a Marker with correct position', () => {
    const html = renderToString(
      React.createElement(PropertyPin, {
        item: mockItem,
        isActive: false,
        onMarkerClick: vi.fn(),
      }),
    );
    expect(html).toContain('data-testid="marker"');
    expect(html).toContain('24.7');
    expect(html).toContain('46.6');
  });

  it('renders a Popup inside the marker', () => {
    const html = renderToString(
      React.createElement(PropertyPin, {
        item: mockItem,
        isActive: false,
        onMarkerClick: vi.fn(),
      }),
    );
    expect(html).toContain('data-testid="popup"');
  });
});
