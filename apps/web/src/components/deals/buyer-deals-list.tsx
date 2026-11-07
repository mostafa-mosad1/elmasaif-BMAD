'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, X } from 'lucide-react';
import { type DealSummary } from '@elmasaif/shared';
import { EmptyState } from '../ui';
import { apiClient, describeApiError } from '../../lib/api-client';
import { DealStatusBadge } from './deal-status-badge';
import { formatDealAmount } from './dual-wire-transfer-cards';

export const DEALS_LIST_TITLE_AR = 'صفقاتي والدفع';
export const DEALS_LIST_INTRO_AR =
  'الصفقات المعتمدة التي تنتظر سداد سعي المنصة وقيمة العقار. لكل صفقة مهلة 48 ساعة لرفع إيصالات التحويل.';

/**
 * `GET /deals/my` answers `{ statusCode, data: DealSummary[] }`. A bare array and an
 * `{ data: { items } }` body are accepted too, the same tolerance as `unwrapOffersPayload`.
 */
export function unwrapDealListPayload(payload: unknown): DealSummary[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as DealSummary[];
  if (typeof payload !== 'object') return [];

  const envelope = payload as { data?: unknown; items?: unknown };
  if (Array.isArray(envelope.data)) return envelope.data as DealSummary[];

  const nested = envelope.data as { items?: unknown } | undefined;
  if (nested && Array.isArray(nested.items)) return nested.items as DealSummary[];

  if (Array.isArray(envelope.items)) return envelope.items as DealSummary[];
  return [];
}

/** Display-only date; the authoritative deadline arithmetic lives in the countdown banner. */
export function formatDealDeadline(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ar-SA');
}

function ProofChip({ label, uploaded }: { label: string; uploaded: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold ${
        uploaded
          ? 'bg-status-verifiedBg text-status-verified border border-status-verifiedBorder'
          : 'bg-status-neutralBg text-status-neutral border border-status-neutralBorder'
      }`}
    >
      {uploaded ? `${label}: تم الرفع` : `${label}: بانتظار الرفع`}
    </span>
  );
}

/** Pure presentational list, exported so an SSR spec can render it without the fetch wrapper. */
export function DealSummaryList({ deals }: { deals: DealSummary[] }) {
  if (!deals.length) {
    return (
      <EmptyState
        icon={<Wallet className="w-7 h-7" />}
        title="لا توجد صفقات نشطة بعد"
        description="تظهر هنا الصفقات التي تُعتمد نهائياً من الإدارة بعد قبول العرض. يمكنك متابعة عروضك المتفاوض عليها من صفحة عروضي."
        actionLabel="عروضي النشطة"
        actionHref="/app/buyer/offers"
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="buyer-deals-list">
      {deals.map((deal) => (
        <li
          key={deal.id}
          className="space-y-2 rounded-xl border border-surface-border p-4 dark:border-dark-surface-border"
          data-testid={`buyer-deal-row-${deal.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                {deal.propertyTitle || '—'}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted dark:text-dark-ink-muted" dir="ltr">
                {deal.dealNumber}
              </p>
            </div>
            <DealStatusBadge status={deal.status} />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-secondary dark:text-dark-ink-secondary">
              {`إجمالي المبلغ المستحق: ${formatDealAmount(deal.totalAmount)}`}
            </span>
            <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
              {`آخر موعد للسداد: ${formatDealDeadline(deal.paymentDeadline)}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ProofChip label="سعي المنصة" uploaded={Boolean(deal.platformFeeProofUploaded)} />
            <ProofChip label="قيمة العقار" uploaded={Boolean(deal.sellerPriceProofUploaded)} />
          </div>

          <div className="pt-1">
            <Link
              href={`/app/buyer/deals/${deal.id}`}
              className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
              data-testid={`buyer-deal-open-${deal.id}`}
            >
              عرض الصفقة وإتمام الدفع
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * AC-2 / D6: the buyer's deal list, backed by `GET /deals/my` — the deal id returned by Story
 * 5.1's final approval is clickable instead of being pasted by hand.
 */
export function BuyerDealsList() {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<unknown>('/deals/my')
      .then((payload) => {
        setDeals(unwrapDealListPayload(payload));
        setLoading(false);
      })
      .catch((err) => {
        const failure = describeApiError(err);
        setError(
          failure.code === 'DEAL_BUYER_PROFILE_REQUIRED'
            ? 'يتطلب هذا القسم ملف مشترٍ نشِط.'
            : 'تعذر تحميل صفقاتك.',
        );
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          {DEALS_LIST_TITLE_AR}
        </h1>
        <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {`${deals.length} صفقة`}
        </span>
      </div>

      <p className="-mt-3 text-sm text-ink-secondary dark:text-dark-ink-secondary">
        {DEALS_LIST_INTRO_AR}
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<X className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب صفقاتك. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : (
        <DealSummaryList deals={deals} />
      )}
    </div>
  );
}
