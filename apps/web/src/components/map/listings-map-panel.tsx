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

/** Known Saudi city center coordinates for instant, accurate navigation. */
export const SAUDI_CITIES_COORDS: Record<string, { center: [number, number]; zoom: number; nameAr: string }> = {
  // Riyadh
  '11111111-0000-4000-8000-000000000001': { center: [24.7136, 46.6753], zoom: 11, nameAr: 'الرياض' },
  // Jeddah
  '11111111-0000-4000-8000-000000000002': { center: [21.5433, 39.1728], zoom: 11, nameAr: 'جدة' },
  // Dammam
  '11111111-0000-4000-8000-000000000003': { center: [26.4207, 50.0888], zoom: 11, nameAr: 'الدمام' },
  // Mecca
  '11111111-0000-4000-8000-000000000004': { center: [21.3891, 39.8579], zoom: 12, nameAr: 'مكة المكرمة' },
  // Medina
  '11111111-0000-4000-8000-000000000005': { center: [24.5247, 39.5692], zoom: 12, nameAr: 'المدينة المنورة' },
  // Khobar
  '11111111-0000-4000-8000-000000000006': { center: [26.2172, 50.1971], zoom: 12, nameAr: 'الخبر' },
  // Abha
  '11111111-0000-4000-8000-000000000007': { center: [18.2164, 42.5053], zoom: 12, nameAr: 'أبها' },
  // Tabuk
  '11111111-0000-4000-8000-000000000008': { center: [28.3835, 36.5662], zoom: 12, nameAr: 'تبوك' },
};

/** Full Saudi Arabia bounding box to ensure broad queries when switching city/district. */
const FULL_SAUDI_BOUNDS = L.latLngBounds(L.latLng(16, 34.5), L.latLng(32.5, 55.7));

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

/** Custom cluster icon: obsidian slate circle with count in white. */
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div style="background:#0F172A;color:#fff;border-radius:9999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #D97706;box-shadow:0 4px 12px rgba(15,23,42,0.25);">${count}</div>`,
    className: '',
    iconSize: L.point(36, 36),
    iconAnchor: [18, 18],
  });
}

/** Inner component that uses useMap/useMapEvents (must be inside MapContainer). */
function MapEventHandlers({
  filters,
  onItemsFetched,
  activeListingId,
  mapItems,
  setLoading,
}: {
  filters: Filters;
  onItemsFetched: (items: MapListingItem[]) => void;
  activeListingId?: string | null;
  mapItems: MapListingItem[];
  setLoading: (l: boolean) => void;
}) {
  const map = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const isFirstMountRef = useRef(true);
  const prevCityRef = useRef<string | null>(filters.cityId);
  const prevDistrictRef = useRef<string | null>(filters.districtId);
  const isProgrammaticFlyRef = useRef(false);

  const fetchItems = useCallback((overrideBounds?: L.LatLngBounds, shouldFitBounds = false) => {
    setLoading(true);
    const boundsToUse = overrideBounds || map.getBounds();
    const sw = boundsToUse.getSouth();
    const nw = boundsToUse.getNorth();
    const swLng = boundsToUse.getWest();
    const neLng = boundsToUse.getEast();

    const clampedBounds = L.latLngBounds(
      L.latLng(Math.max(sw, 16), Math.max(swLng, 34.5)),
      L.latLng(Math.min(nw, 32.5), Math.min(neLng, 55.7)),
    );

    const qs = buildMapQuery(clampedBounds, filtersRef.current);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    apiClient
      .get<{ statusCode: number; data: { items: MapListingItem[] } }>(
        `/listings/map?${qs}`,
        { signal: controller.signal },
      )
      .then((res) => {
        const items = res?.data?.items || [];
        onItemsFetched(items);

        if (shouldFitBounds && items.length > 0) {
          isProgrammaticFlyRef.current = true;
          if (items.length === 1) {
            map.flyTo([items[0].latitude, items[0].longitude], 14, { duration: 0.8 });
          } else {
            const itemsBounds = L.latLngBounds(items.map((i) => [i.latitude, i.longitude]));
            map.fitBounds(itemsBounds, { padding: [50, 50], maxZoom: 14 });
          }
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Map fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [map, onItemsFetched, setLoading]);

  const debouncedFetch = useCallback(() => {
    if (isProgrammaticFlyRef.current) {
      isProgrammaticFlyRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchItems(), 300);
  }, [fetchItems]);

  useMapEvents({
    moveend: debouncedFetch,
    zoomend: debouncedFetch,
  });

  // Handle activeListingId change (pan/fly to active card pin)
  useEffect(() => {
    if (!activeListingId || !mapItems.length) return;
    const target = mapItems.find((item) => item.id === activeListingId);
    if (target) {
      isProgrammaticFlyRef.current = true;
      map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 14), {
        duration: 0.6,
      });
    }
  }, [activeListingId, mapItems, map]);

  // Handle filter changes: city, district, keyword, etc.
  useEffect(() => {
    const cityChanged = filters.cityId !== prevCityRef.current;
    const districtChanged = filters.districtId !== prevDistrictRef.current;
    prevCityRef.current = filters.cityId;
    prevDistrictRef.current = filters.districtId;

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      // On initial load, fetch full kingdom bounds and fit to available listings
      fetchItems(FULL_SAUDI_BOUNDS, true);
      return;
    }

    if (cityChanged) {
      if (filters.cityId && SAUDI_CITIES_COORDS[filters.cityId]) {
        const cityInfo = SAUDI_CITIES_COORDS[filters.cityId];
        isProgrammaticFlyRef.current = true;
        map.flyTo(cityInfo.center, cityInfo.zoom, { duration: 0.8 });
      }
      // When city changes, query full kingdom bounds so we don't get trapped in old viewport
      fetchItems(FULL_SAUDI_BOUNDS, true);
    } else if (districtChanged) {
      fetchItems(FULL_SAUDI_BOUNDS, true);
    } else {
      fetchItems(map.getBounds(), false);
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
  const [loading, setLoading] = useState(true);

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
          maxZoom={19}
        />
        <MapEventHandlers
          filters={filters}
          onItemsFetched={handleItemsFetched}
          activeListingId={activeListingId}
          mapItems={mapItems}
          setLoading={setLoading}
        />
        <MarkerClusterGroup
          disableClusteringAtZoom={11}
          chunkedLoading={true}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          spiderfyDistanceMultiplier={2}
          zoomToBoundsOnClick={true}
          maxClusterRadius={20}
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

      {/* Sleek Floating Status Pill */}
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-surface-base/90 dark:bg-dark-surface-base/90 backdrop-blur-sm border border-surface-border dark:border-dark-surface-border px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-2 pointer-events-none text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>جارِ تحديث الخريطة...</span>
        </div>
      )}

      {!loading && mapItems.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-surface-base/95 dark:bg-dark-surface-base/95 backdrop-blur-sm border border-surface-border dark:border-dark-surface-border px-4 py-2 rounded-xl shadow-md text-center pointer-events-none">
          <p className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">لا توجد عقارات في هذا النطاق</p>
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-0.5">جرب توسيع البحث أو اختيار مدينة أخرى</p>
        </div>
      )}
    </div>
  );
}

export default ListingsMapPanel;
