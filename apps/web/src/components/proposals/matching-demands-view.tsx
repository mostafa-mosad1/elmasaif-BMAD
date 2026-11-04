'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PROPERTY_TYPE_LABELS_AR } from '@elmasaif/shared';
import { HandCoins, MapPin, Sparkles, X } from 'lucide-react';
import { Button, Card, EmptyState } from '../ui';
import { apiClient } from '../../lib/api-client';
import { MatchingDemandItem } from './proposal-item';
import { ProposalSubmitForm } from './proposal-submit-form';

interface MatchingDemandsPayload {
  items?: MatchingDemandItem[];
  data?: { items?: MatchingDemandItem[] };
}

/**
 * Tolerates both envelopes: `GET /proposals/matching-demands` wraps in
 * `{ statusCode, data: { items } }`, but a bare `{ items }` is accepted too — the exact
 * lesson from `unwrapDemandsPayload` / `unwrapFavoritesPayload`.
 */
export function unwrapMatchingDemandsPayload(payload: unknown): MatchingDemandItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as MatchingDemandsPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

const formatSar = (value: number): string => Number(value || 0).toLocaleString('en-US');

/** One matching demand + the provider's listings that qualified against it. */
function MatchingDemandCard({
  item,
  proposed,
  onProposed,
}: {
  item: MatchingDemandItem;
  proposed: boolean;
  onProposed: (demandId: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Card className="h-full" data-testid={`matching-demand-card-${item.demandId}`}>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-ink-primary dark:text-dark-ink-primary truncate">
              {[PROPERTY_TYPE_LABELS_AR[item.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR] || item.propertyType, item.cityName]
                .filter(Boolean)
                .join(' — ')}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted dark:text-dark-ink-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.districtName || 'جميع الأحياء'}</span>
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
            <Sparkles className="w-3 h-3" />
            <span>مطابقة</span>
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-muted dark:text-dark-ink-muted">الميزانية (ر.س)</dt>
            <dd className="font-mono font-semibold text-ink-primary dark:text-dark-ink-primary">
              {formatSar(item.minBudget)} – {formatSar(item.maxBudget)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted dark:text-dark-ink-muted">المساحة (م²)</dt>
            <dd className="font-mono font-semibold text-ink-primary dark:text-dark-ink-primary">
              {formatSar(item.minArea)} – {formatSar(item.maxArea)}
            </dd>
          </div>
        </dl>

        <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
          <span className="font-semibold">{item.matchedListings.length}</span>
          <span> من عقاراتك المطابقة</span>
        </div>

        {item.notes ? (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary line-clamp-2">
            {item.notes}
          </p>
        ) : null}

        <div className="border-t border-surface-border dark:border-dark-surface-border pt-3">
          {proposed ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-verified"
              data-testid={`matching-demand-proposed-${item.demandId}`}
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>تم تقديم عرضك — بانتظار مراجعة الإدارة</span>
            </span>
          ) : formOpen ? (
            <div className="space-y-3" data-testid={`matching-demand-form-${item.demandId}`}>
              <ProposalSubmitForm
                demandId={item.demandId}
                matchedListings={item.matchedListings.map((l) => ({
                  listingId: l.listingId,
                  title: l.title,
                  askPrice: l.askPrice,
                }))}
                maxBudget={item.maxBudget}
                onCancel={() => setFormOpen(false)}
                onSubmitted={() => {
                  setFormOpen(false);
                  onProposed(item.demandId);
                }}
              />
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setFormOpen(true)}
              className="text-xs gap-1.5"
              data-testid={`matching-demand-propose-btn-${item.demandId}`}
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>قدّم عرض</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export interface MatchingDemandsGridProps {
  items: MatchingDemandItem[];
  proposedDemandIds: ReadonlySet<string>;
  onProposed: (demandId: string) => void;
}

/**
 * Pure presentational matching grid (Story 3.7 / FR-22), exported so it can be rendered via
 * `renderToString` independently of the fetch wrapper.
 */
export function MatchingDemandsGrid({
  items,
  proposedDemandIds,
  onProposed,
}: MatchingDemandsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="matching-demands-grid">
      {items.map((item) => (
        <MatchingDemandCard
          key={item.demandId}
          item={item}
          proposed={proposedDemandIds.has(item.demandId)}
          onProposed={onProposed}
        />
      ))}
    </div>
  );
}

/**
 * Provider matching-alert surface (Story 3.7 / FR-22): the buyer demands that match the
 * caller's own ACTIVE listings, newest-matched first. The MVP "instant alert" — durable
 * in-app/email push is deferred to Story 8.8. Submission opens `ProposalSubmitForm`
 * prefilled with one of the caller's qualifying listings.
 */
export function MatchingDemandsView() {
  const [items, setItems] = useState<MatchingDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposedDemandIds, setProposedDemandIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<MatchingDemandsPayload>('/proposals/matching-demands')
      .then((payload) => {
        setItems(unwrapMatchingDemandsPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل مطابقات طلبات الشراء.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleProposed = (demandId: string) => {
    setProposedDemandIds((prev) => new Set(prev).add(demandId));
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <HandCoins className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          مطابقات طلبات الشراء
        </h1>
        <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {`${items.length} طلب مطابق`}
        </span>
      </div>
      <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary -mt-3">
        طلبات الشراء التي تطابق عقاراتك النشطة. قدّم عرضاً ملزماً لأيٍّ منها ليخضع لمراجعة الإدارة قبل وصوله للمشتري.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 rounded-card bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<X className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب المطابقات. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-7 h-7" />}
          title="لا توجد مطابقات بعد"
          description="ستظهر هنا طلبات الشراء التي تطابق عقاراتك النشطة فور نشرها من المشترين."
        />
      ) : (
        <MatchingDemandsGrid
          items={items}
          proposedDemandIds={proposedDemandIds}
          onProposed={handleProposed}
        />
      )}
    </div>
  );
}
