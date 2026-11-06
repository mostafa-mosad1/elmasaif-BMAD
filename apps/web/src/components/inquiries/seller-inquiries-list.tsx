'use client';

import React from 'react';
import Link from 'next/link';
import {
  InquiryThreadSummary,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { Inbox, MapPin } from 'lucide-react';
import { EmptyState } from '../ui';
import { InquiryStatusBadge } from './inquiry-status-badge';

export interface SellerInquiriesListProps {
  inquiries: InquiryThreadSummary[];
  /** Workspace detail route base, e.g. `/app/marketer/inquiries`; rows stay unlinked without it. */
  detailHrefBase?: string;
}

/**
 * Inquiries opened on the caller's own listings (Story 4.4 / AC-4, AC-5). Only threads that have
 * already been relayed show a message body on the detail screen, so this inbox is a work list,
 * never a direct channel: the buyer is named, their contact details are not part of the payload.
 */
export function SellerInquiriesList({ inquiries, detailHrefBase }: SellerInquiriesListProps) {
  if (inquiries.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="w-7 h-7" />}
        title="لا توجد استفسارات على عقاراتك"
        description="عندما يرسل مشترٍ استفساراً على أحد عقاراتك وتتم إحالته إليك من فريق الوساطة، سيظهر هنا."
        actionLabel="إدارة عقاراتي"
        actionHref="/app/owner/listings/new"
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="seller-inquiries-list">
      {inquiries.map((inquiry) => (
        <li
          key={inquiry.id}
          className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-2"
          data-testid={`seller-inquiry-row-${inquiry.id}`}
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
              {inquiry.awaitingParty === 'SELLER' ? (
                <span
                  className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
                  data-testid={`seller-inquiry-awaiting-${inquiry.id}`}
                >
                  بانتظار ردك
                </span>
              ) : null}
              <InquiryStatusBadge status={inquiry.status} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-secondary dark:text-dark-ink-secondary truncate">
              {inquiry.subject || 'استفسار عن العقار'}
            </span>
            <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted shrink-0">
              {inquiry.buyerName ? `من: ${inquiry.buyerName}` : 'من: مشترٍ'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted dark:text-dark-ink-muted">
            <span>{`${inquiry.messageCount} رسالة`}</span>
            <span dir="ltr">{new Date(inquiry.lastMessageAt).toLocaleString('ar-SA')}</span>
          </div>

          {detailHrefBase ? (
            <div className="pt-1">
              <Link
                href={`${detailHrefBase}/${inquiry.id}`}
                className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                data-testid={`seller-inquiry-open-${inquiry.id}`}
              >
                فتح الاستفسار
              </Link>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
