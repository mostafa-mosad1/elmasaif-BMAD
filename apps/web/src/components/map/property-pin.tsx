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
  const typeColor = PROPERTY_TYPE_MAP_COLORS[item.propertyType as PropertyType] || '#6B7280';
  const priceLabel = formatPinPrice(item.askPrice);

  const bg = isActive ? '#1B4332' : '#FFFFFF';
  const color = isActive ? '#FFFFFF' : '#0F172A';
  const borderColor = isActive ? '#1B4332' : typeColor;

  const icon = L.divIcon({
    html: `<div
      style="background:${bg};color:${color};border:1.5px solid ${borderColor};border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15);cursor:pointer;"
      role="button"
      tabindex="0"
      aria-label="${item.title} - ${priceLabel}"
    >${priceLabel}</div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [30, 15],
    popupAnchor: [0, -15],
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
