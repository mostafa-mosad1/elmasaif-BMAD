'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Map, List } from 'lucide-react';
import type { Filters } from './page';
import type { ListingsMapPanelProps } from '../../components/map/listings-map-panel';

// Dynamic import with ssr: false — Leaflet requires window
const ListingsMapPanel = dynamic<ListingsMapPanelProps>(
  () => import('../../components/map/listings-map-panel'),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-surface-sunken dark:bg-dark-surface-sunken">
        <span className="text-sm text-ink-muted dark:text-dark-ink-muted">جارِ تحميل الخريطة...</span>
      </div>
    ),
    ssr: false,
  },
);

type MobileView = 'map' | 'list';

export interface PropertiesSplitViewProps {
  filters: Filters;
  activeListingId: string | null;
  onMarkerClick: (id: string) => void;
  children: React.ReactNode; // The listing grid (PropertiesSearchView)
}

export function PropertiesSplitView({
  filters,
  activeListingId,
  onMarkerClick,
  children,
}: PropertiesSplitViewProps) {
  const [mobileView, setMobileView] = useState<MobileView>('list');

  return (
    <div className="relative" data-testid="properties-split-view">
      {/* Desktop: map on top, grid below (lg+) */}
      <div className="hidden lg:flex flex-col w-full">
        {/* Map panel — full width, fixed height, no overflow */}
        <div className="w-full overflow-hidden shrink-0" style={{ height: '50vh' }}>
          <ListingsMapPanel
            filters={filters}
            activeListingId={activeListingId}
            onMarkerClick={onMarkerClick}
          />
        </div>
        {/* Grid panel — scrollable below */}
        <div className="w-full flex-1">
          {children}
        </div>
      </div>

      {/* Mobile: single panel with pill toggle */}
      <div className="lg:hidden">
        {mobileView === 'list' && children}
        {mobileView === 'map' && (
          <div style={{ height: 'calc(100vh - 120px)' }}>
            <ListingsMapPanel
              filters={filters}
              activeListingId={activeListingId}
              onMarkerClick={onMarkerClick}
            />
          </div>
        )}

        {/* Floating pill toggle */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-surface-base dark:bg-dark-surface-raised rounded-full shadow-level3 border border-surface-border dark:border-dark-surface-border p-1">
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              mobileView === 'list'
                ? 'bg-primary text-white'
                : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
            }`}
            aria-pressed={mobileView === 'list'}
          >
            <List className="w-4 h-4" />
            <span>القائمة</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('map')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              mobileView === 'map'
                ? 'bg-primary text-white'
                : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
            }`}
            aria-pressed={mobileView === 'map'}
          >
            <Map className="w-4 h-4" />
            <span>الخريطة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
