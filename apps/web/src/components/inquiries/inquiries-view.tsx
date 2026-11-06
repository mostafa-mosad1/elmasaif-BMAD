'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { InquiryThreadSummary } from '@elmasaif/shared';
import { MessageSquareText, X } from 'lucide-react';
import { EmptyState } from '../ui';
import { apiClient } from '../../lib/api-client';
import { BuyerInquiriesList } from './buyer-inquiries-list';
import { SellerInquiriesList } from './seller-inquiries-list';
import { InquiryViewer } from './inquiry-thread-view';

interface InquiriesPayload {
  items?: InquiryThreadSummary[];
  data?: { items?: InquiryThreadSummary[] };
}

/**
 * Which endpoint backs a surface (D6): the buyer reads `/inquiries/my`, a seller reads
 * `/inquiries/received`. Both are party-scoped server-side, so the client never filters.
 */
export function inquiriesEndpointFor(viewer: InquiryViewer): string {
  return viewer === 'BUYER' ? '/inquiries/my' : '/inquiries/received';
}

/**
 * Tolerates both envelopes: the controller wraps the list in `{ statusCode, data: { items } }`,
 * but a bare `{ items }` (or a nullish body) is accepted too — the same lesson as
 * `unwrapOffersPayload`.
 */
export function unwrapInquiriesPayload(payload: unknown): InquiryThreadSummary[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as InquiriesPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

export interface InquiriesViewProps {
  viewer: InquiryViewer;
  /** Workspace detail route base; the seller list needs its own (`/app/marketer|owner/inquiries`). */
  detailHrefBase?: string;
}

/**
 * Mediated inquiry inbox (Story 4.4 / AC-4, AC-5). Presentational lists do the rendering; this
 * wrapper owns the fetch so the buyer and seller workspaces share one contract.
 */
export function InquiriesView({ viewer, detailHrefBase }: InquiriesViewProps) {
  const [inquiries, setInquiries] = useState<InquiryThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<InquiriesPayload>(inquiriesEndpointFor(viewer))
      .then((payload) => {
        setInquiries(unwrapInquiriesPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل الاستفسارات.');
        setLoading(false);
      });
  }, [viewer]);

  useEffect(() => {
    load();
  }, [load]);

  const isBuyer = viewer === 'BUYER';

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <MessageSquareText className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          {isBuyer ? 'استفساراتي' : 'استفسارات العقارات'}
        </h1>
        <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {`${inquiries.length} استفسار`}
        </span>
      </div>
      <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary -mt-3">
        {isBuyer
          ? 'الاستفسارات التي أرسلتها عن العقارات المعروضة. تمر كل رسالة عبر فريق الوساطة قبل أن تصل إلى البائع، وبيانات التواصل محجوبة تلقائياً.'
          : 'الاستفسارات التي وصلت إلى عقاراتك بعد إحالتها من فريق الوساطة. لا تتضمن الرسائل بيانات تواصل مباشرة، ويُعاد ردّك إلى المشتري عبر الإدارة.'}
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<X className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب الاستفسارات. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : isBuyer ? (
        <BuyerInquiriesList inquiries={inquiries} detailHrefBase={detailHrefBase ?? '/app/buyer/inquiries'} />
      ) : (
        <SellerInquiriesList inquiries={inquiries} detailHrefBase={detailHrefBase} />
      )}
    </div>
  );
}
