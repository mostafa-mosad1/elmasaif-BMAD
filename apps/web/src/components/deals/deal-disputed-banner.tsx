'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const DEAL_DISPUTED_BANNER_TITLE_AR = 'الصفقة قيد النزاع والتدقيق الإداري';
export const DEAL_DISPUTED_BANNER_DESC_AR =
  'الصفقة قيد النزاع والتدقيق الإداري من قبل الإدارة العليا. تم تجميد المهل التلقائية لحين صدور القرار النهائي.';

export interface DealDisputedBannerProps {
  className?: string;
}

export function DealDisputedBanner({ className }: DealDisputedBannerProps) {
  return (
    <section
      role="status"
      aria-label={DEAL_DISPUTED_BANNER_TITLE_AR}
      data-testid="deal-disputed-banner"
      className={`rounded-2xl border border-amber-500/30 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1.5">
          <h2 className="text-base font-bold text-amber-950 dark:text-amber-100">
            {DEAL_DISPUTED_BANNER_TITLE_AR}
          </h2>
          <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            {DEAL_DISPUTED_BANNER_DESC_AR}
          </p>
        </div>
      </div>
    </section>
  );
}

