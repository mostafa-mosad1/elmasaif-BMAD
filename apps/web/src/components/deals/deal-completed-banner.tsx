'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const DEAL_COMPLETED_BANNER_TITLE_AR =
  'اكتملت الصفقة بنجاح وتم تأكيد جميع التحويلات البنكية';

export const DEAL_COMPLETED_BANNER_DESC_AR =
  'تم التحقق من إثباتات الدفع واعتماد العملية بالكامل. يمكنك الآن التواصل مباشرة مع البائع لإتمام إجراءات الإفراغ العقاري عبر منصة ناجز.';

export interface DealCompletedBannerProps {
  completedAt?: string | null;
  className?: string;
}

export function DealCompletedBanner({ completedAt, className }: DealCompletedBannerProps) {
  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <section
      role="status"
      aria-label={DEAL_COMPLETED_BANNER_TITLE_AR}
      data-testid="deal-completed-banner"
      className={`rounded-2xl border border-emerald-500/30 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/20 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
              {DEAL_COMPLETED_BANNER_TITLE_AR}
            </h2>
            {formattedDate ? (
              <span className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                {`تاريخ الاكتمال: ${formattedDate}`}
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
            {DEAL_COMPLETED_BANNER_DESC_AR}
          </p>
        </div>
      </div>
    </section>
  );
}

