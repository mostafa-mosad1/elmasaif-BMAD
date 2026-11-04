'use client';

import React from 'react';
import { MapListingItem, PROPERTY_TYPE_LABELS_AR, PropertyType } from '@elmasaif/shared';
import { ListingStatusBadge } from '../listings/listing-status-badge';

export interface MapPopupCardProps {
  item: MapListingItem;
}

export function MapPopupCard({ item }: MapPopupCardProps) {
  const title = item.title.length > 60 ? `${item.title.slice(0, 60)}…` : item.title;
  const typeLabel = PROPERTY_TYPE_LABELS_AR[item.propertyType as PropertyType] || item.propertyType;

  return (
    <div className="p-2 min-w-[200px]" dir="rtl">
      {/* Photo */}
      {item.primaryPhotoUrl ? (
        <img
          src={item.primaryPhotoUrl}
          alt={item.title}
          className="w-full h-24 object-cover rounded-lg mb-2"
        />
      ) : (
        <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
        {title}
      </h4>

      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
          {item.askPrice.toLocaleString('en-US')}
          <span className="text-xs font-medium mr-1">ر.س</span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
        <span>{item.areaSquareMeters.toLocaleString('en-US')} م²</span>
        <span>{typeLabel}</span>
      </div>

      <div className="flex items-center justify-between">
        <ListingStatusBadge status={item.status} className="!text-[10px] !px-2 !py-0.5" />
        {item.isFalVerified && (
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">فال ✓</span>
        )}
      </div>

      <a
        href={`/properties/${item.id}`}
        className="mt-2 block w-full text-center text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg py-1.5 transition-colors no-underline"
      >
        عرض التفاصيل
      </a>
    </div>
  );
}
