'use client';

import React from 'react';
import { Home } from 'lucide-react';
import { ListingSummaryItem } from '@elmasaif/shared';
import { PropertyCard } from '../listings/property-card';
import { Card, EmptyState } from '../ui';

export interface BrokerListingsGridProps {
  listings: ListingSummaryItem[];
  brokerName?: string;
  className?: string;
}

export function BrokerListingsGrid({
  listings,
  brokerName = 'الوسيط',
  className = '',
}: BrokerListingsGridProps) {
  if (listings.length === 0) {
    return (
      <Card className={`p-8 text-center bg-surface-base dark:bg-dark-surface-base ${className}`}>
        <EmptyState
          icon={<Home className="w-10 h-10 text-ink-muted/50" />}
          title="لا توجد عقارات معروضة حالياً لهذا الوسيط"
          description="لم يقم الوسيط بنشر أي عقارات معروضة للبيع في الوقت الراهن."
        />
      </Card>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            العقارات المتاحة للبيع
          </h3>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
            تصفح جميع العقارات المعروضة والنشطة عبر الوسيط
          </p>
        </div>
        <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border">
          {listings.length} {listings.length === 1 ? 'عقار متاح' : 'عقارات متاحة'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <PropertyCard
            key={listing.id}
            listing={listing}
            href={`/properties/${listing.id}`}
          />
        ))}
      </div>
    </div>
  );
}

