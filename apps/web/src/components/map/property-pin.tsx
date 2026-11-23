'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { PROPERTY_TYPE_MAP_COLORS, MapListingItem, PropertyType } from '@elmasaif/shared';
import { MapPopupCard } from './map-popup-card';

/**
 * Formats a numeric price into a compact Arabic label for the map pin.
 * e.g. 3200000 → "3.2 مليون", 450000 → "450 ألف"
 */
export function formatPinPrice(price: number): string {
  if (price >= 1_000_000) {
    const val = price / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} مليون`;
  }
  if (price >= 1_000) {
    const val = price / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(0)} ألف`;
  }
  return price.toLocaleString('en-US');
}

export interface PropertyPinProps {
  item: MapListingItem;
  isActive: boolean;
  onMarkerClick: (id: string) => void;
}

export function PropertyPin({ item, isActive, onMarkerClick }: PropertyPinProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const priceLabel = formatPinPrice(item.askPrice);

  const icon = L.divIcon({
    html: `
      <div
        class="property-map-pin"
        style="display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.28));transition:transform 0.18s ease-in-out;${
          isActive ? 'transform:scale(1.22);z-index:9999;' : ''
        }"
        role="button"
        tabindex="0"
        aria-label="${item.title} - ${priceLabel}"
      >
        <div style="background:#0F172A;color:#FFFFFF;padding:1.5px 7px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 4px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.25);">${priceLabel}</div>
        <svg width="34" height="42" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Green oval ground / shadow -->
          <ellipse cx="18" cy="41" rx="14" ry="4.5" fill="#10B981" />
          <!-- Pin body left side (bright red) -->
          <path d="M18 2 A14 14 0 0 0 4 16 C4 23.5 11 29.5 18 39 L18 2 Z" fill="#EF4444" />
          <!-- Pin body right side (darker red 3D shade) -->
          <path d="M18 2 A14 14 0 0 1 32 16 C32 23.5 25 29.5 18 39 L18 2 Z" fill="#DC2626" />
          <!-- Inner circle cutout -->
          <circle cx="18" cy="16" r="5.5" fill="#FFFFFF" />
        </svg>
      </div>
    `,
    className: '',
    iconSize: [60, 64],
    iconAnchor: [30, 62],
    popupAnchor: [0, -64],
  });

  // Programmatically open/close popup when active state changes (card hover ↔ pin sync)
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isActive) {
      marker.openPopup();
    } else {
      marker.closePopup();
    }
  }, [isActive]);

  const handlers = {
    // Hover → show popup
    mouseover: () => {
      const marker = markerRef.current;
      if (marker) marker.openPopup();
    },
    // Mouse leaves → close popup (unless card in grid is still hovering it)
    mouseout: () => {
      if (isActive) return; // card hover keeps it open
      const marker = markerRef.current;
      if (marker) marker.closePopup();
    },
    // Click → scroll to card in grid
    click: () => onMarkerClick(item.id),
  };

  return (
    <Marker
      ref={markerRef}
      position={[item.latitude, item.longitude]}
      icon={icon}
      eventHandlers={handlers}
    >
      <Popup autoPan={false} maxWidth={280} closeOnClick={true}>
        <MapPopupCard item={item} />
      </Popup>
    </Marker>
  );
}
