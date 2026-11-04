'use client';

import 'leaflet/dist/leaflet.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import {
  MapListingItem,
  SAUDI_CENTER,
  MAP_DEFAULT_ZOOM,
} from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';
import type { Filters } from '../../app/properties/page';
import { PropertyPin } from './property-pin';

export interface ListingsMapPanelProps {
  filters: Filters;
  activeListingId?: string | null;
  onMarkerClick?: (id: string) => void;
}

/** Builds map query string from bounds + filters. */
function buildMapQuery(bounds: L.LatLngBounds, filters: Filters): string {
  const params = new URLSearchParams();
  params.set('swLat', String(bounds.getSouth()));
  params.set('swLng', String(bounds.getWest()));
  params.set('neLat', String(bounds.getNorth()));
  params.set('neLng', String(bounds.getEast()));
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.cityId) params.set('cityId', filters.cityId);
  if (filters.districtId) params.set('districtId', filters.districtId);
  if (filters.propertyType) params.set('propertyType', filters.propertyType);
  if (filters.priceMin) params.set('priceMin', filters.priceMin);
  if (filters.priceMax) params.set('priceMax', filters.priceMax);
  if (filters.areaMin) params.set('areaMin', filters.areaMin);
  if (filters.areaMax) params.set('areaMax', filters.areaMax);
  if (filters.bedroomsMin) params.set('bedroomsMin', filters.bedroomsMin);
  if (filters.falOnly) params.set('falOnly', 'true');
  return params.toString();
}

/** Custom cluster icon: emerald circle with count in white (DESIGN.md §5). */
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div style="background:#1B4332;color:#fff;border-radius:9999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${count}</div>`,
    className: '',
    iconSize: L.point(36, 36),
    iconAnchor: [18, 18],
  });
}

/** Inner component that uses useMap/useMapEvents (must be inside MapContainer). */
function MapEventHandlers({
  filters,
  onItemsFetched,
}: {
  filters: Filters;
  onItemsFetched: (items: MapListingItem[]) => void;
}) {
  const map = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const prevCityRef = useRef<string | null>(filters.cityId);

  const fetchItems = useCallback(() => {
    // Clamp to Saudi bounds
    const sw = map.getBounds().getSouth();
    const nw = map.getBounds().getNorth();
    const swLng = map.getBounds().getWest();
    const neLng = map.getBounds().getEast();

    const clampedBounds = L.latLngBounds(
      L.latLng(Math.max(sw, 16), Math.max(swLng, 34.5)),
      L.latLng(Math.min(nw, 32.5), Math.min(neLng, 55.7)),
    );

    const qs = buildMapQuery(clampedBounds, filtersRef.current);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    apiClient.get<{ statusCode: number; data: { items: MapListingItem[] } }>(
      `/listings/map?${qs}`,
      { signal: controller.signal },
    )
      .then((res) => onItemsFetched(res.data.items))
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Map fetch error:', err);
      });
  }, [map, onItemsFetched]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchItems, 300);
  }, [fetchItems]);

  useMapEvents({
    moveend: debouncedFetch,
    zoomend: debouncedFetch,
  });

  // Re-fetch when filters change; fly to full KSA view when city/district changes
  useEffect(() => {
    const cityChanged = filters.cityId !== prevCityRef.current;
    prevCityRef.current = filters.cityId;

    if (cityChanged && filters.cityId) {
      // Reset viewport to show all of Saudi Arabia so filtered city results are visible.
      // The `moveend` event after animation will trigger debouncedFetch automatically.
      map.flyTo(SAUDI_CENTER, MAP_DEFAULT_ZOOM, { duration: 0.8 });
    } else {
      fetchItems();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return null;
}

export function ListingsMapPanel({ filters, activeListingId, onMarkerClick }: ListingsMapPanelProps) {
  const [mapItems, setMapItems] = useState<MapListingItem[]>([]);

  const handleItemsFetched = useCallback((items: MapListingItem[]) => {
    setMapItems(items);
  }, []);

  return (
    <div className="w-full h-full relative" data-testid="listings-map-panel">
      <MapContainer
        center={SAUDI_CENTER}
        zoom={MAP_DEFAULT_ZOOM}
        className="w-full h-full"
        style={{ minHeight: '100%', minWidth: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapEventHandlers filters={filters} onItemsFetched={handleItemsFetched} />
        <MarkerClusterGroup
          disableClusteringAtZoom={12}
          chunkedLoading={true}
          iconCreateFunction={createClusterIcon}
        >
          {mapItems.map((item) => (
            <PropertyPin
              key={item.id}
              item={item}
              isActive={activeListingId === item.id}
              onMarkerClick={(id) => onMarkerClick?.(id)}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Loading / empty state overlay */}
      {mapItems.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 pointer-events-none">
          <span className="text-sm text-gray-500 dark:text-gray-400">جارِ تحميل الخريطة...</span>
        </div>
      )}
    </div>
  );
}

export default ListingsMapPanel;
