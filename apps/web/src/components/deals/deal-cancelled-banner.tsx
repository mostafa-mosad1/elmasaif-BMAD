'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export const DEAL_CANCELLED_BANNER_TITLE_AR = 'تم إلغاء الصفقة لانتهاء مهلة السداد';

export const DEAL_CANCELLED_BANNER_DESC_AR =
  'تم إلغاء هذه الصفقة تلقائياً لانتهاء المهلة الزمنية المحددة (48 ساعة) دون استلام إثبات التحويل البنكي المطلوب. تمت إعادة إتاحة العقار في السوق.';

export interface DealCancelledBannerProps {
  cancelledAt?: string | null;
  className?: string;
}

export function DealCancelledBanner({ cancelledAt, className }: DealCancelledBannerProps) {
  const formattedDate = cancelledAt
    ? new Date(cancelledAt).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <section
      role="status"
      aria-label={DEAL_CANCELLED_BANNER_TITLE_AR}
      data-testid="deal-cancelled-banner"
      className={`rounded-2xl border border-red-500/30 bg-red-50/70 p-5 shadow-sm dark:border-red-500/20 dark:bg-red-950/20 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-red-950 dark:text-red-100">
              {DEAL_CANCELLED_BANNER_TITLE_AR}
            </h2>
            {formattedDate ? (
              <span className="text-xs font-medium text-red-700/80 dark:text-red-300/80">
                {`تاريخ الإلغاء: ${formattedDate}`}
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-red-900/90 dark:text-red-200/90">
            {DEAL_CANCELLED_BANNER_DESC_AR}
          </p>
        </div>
      </div>
    </section>
  );
}

