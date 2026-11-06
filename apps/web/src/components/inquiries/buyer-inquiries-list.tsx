'use client';

import React from 'react';
import Link from 'next/link';
import {
  InquiryThreadSummary,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { MapPin, MessageSquareText } from 'lucide-react';
import { EmptyState } from '../ui';
import { InquiryStatusBadge } from './inquiry-status-badge';

export interface BuyerInquiriesListProps {
  inquiries: InquiryThreadSummary[];
  /** Workspace detail route base, e.g. `/app/buyer/inquiries`; rows stay unlinked without it. */
  detailHrefBase?: string;
}

/**
 * The buyer's own mediated inquiries (Story 4.4 / AC-1, AC-4, AC-5). Presentational on purpose:
 * the fetch wrapper lives in `inquiries-view.tsx`, so SSR tests can render this list directly
 * with fixture data.
 */
export function BuyerInquiriesList({ inquiries, detailHrefBase }: BuyerInquiriesListProps) {
  if (inquiries.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareText className="w-7 h-7" />}
        title="لا توجد استفسارات بعد"
        description="تصفح العقارات المعروضة وأرسل استفسارك عبر المنصة؛ يصل سؤالك إلى البائع بعد مراجعته من فريق الوساطة."
        actionLabel="تصفح العقارات المتاحة"
        actionHref="/"
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="buyer-inquiries-list">
      {inquiries.map((inquiry) => (
        <li
          key={inquiry.id}
          className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-2"
          data-testid={`buyer-inquiry-row-${inquiry.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary truncate">
                {inquiry.listing?.title || '—'}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {[
                    PROPERTY_TYPE_LABELS_AR[
                      inquiry.listing?.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR
                    ] || inquiry.listing?.propertyType,
                    inquiry.listing?.cityName,
                    inquiry.listing?.districtName,
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {inquiry.awaitingParty === 'BUYER' ? (
                <span
                  className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
                  data-testid={`buyer-inquiry-awaiting-${inquiry.id}`}
                >
                  بانتظار ردك
                </span>
              ) : null}
              <InquiryStatusBadge status={inquiry.status} />
            </div>
          </div>

          {inquiry.subject ? (
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary truncate">
              {inquiry.subject}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted dark:text-dark-ink-muted">
            <span>{`${inquiry.messageCount} رسالة`}</span>
            <span dir="ltr">{new Date(inquiry.lastMessageAt).toLocaleString('ar-SA')}</span>
          </div>

          {detailHrefBase ? (
            <div className="pt-1">
              <Link
                href={`${detailHrefBase}/${inquiry.id}`}
                className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                data-testid={`buyer-inquiry-open-${inquiry.id}`}
              >
                فتح المحادثة
              </Link>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
