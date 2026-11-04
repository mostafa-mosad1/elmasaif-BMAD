'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DemandStatus,
  PROPERTY_TYPE_LABELS_AR,
  DEMAND_NOT_CANCELLABLE,
} from '@elmasaif/shared';
import { FileQuestion, Plus, MapPin, X, HandCoins } from 'lucide-react';
import { Button, Card, EmptyState } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { BuyerDemandItem } from './demand-item';
import { DemandStatusBadge } from './demand-status-badge';
import { DemandSubmitForm } from './demand-submit-form';
import { BuyerProposalsSection } from '../proposals';

interface DemandsPayload {
  items?: BuyerDemandItem[];
  data?: { items?: BuyerDemandItem[] };
}

/**
 * Tolerates both envelopes: `GET /demands/my` wraps in `{ statusCode, data: { items } }`
 * like search/map/favorites, but a bare `{ items }` is accepted too — the same lesson as
 * `unwrapFavoritesPayload` / `unwrapSimilarPayload`.
 */
export function unwrapDemandsPayload(payload: unknown): BuyerDemandItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as DemandsPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

const CANCELLABLE_STATUSES: DemandStatus[] = [DemandStatus.ACTIVE, DemandStatus.MATCHED];

function formatRemainingWindow(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(msLeft)) return '—';
  if (msLeft <= 0) return 'انتهت مدة الطلب';
  const days = Math.ceil(msLeft / 86400000);
  if (days === 1) return 'متبقي يوم واحد';
  if (days === 2) return 'متبقي يومان';
  if (days <= 10) return `متبقي ${days.toLocaleString('en-US')} أيام`;
  return `متبقي ${days.toLocaleString('en-US')} يوماً`;
}

const formatSar = (value: number): string => Number(value || 0).toLocaleString('en-US');

export interface DemandsGridProps {
  items: BuyerDemandItem[];
  onCancel: (demandId: string, reason: string) => void;
}

function DemandCard({ item, onCancel }: { item: BuyerDemandItem; onCancel: DemandsGridProps['onCancel'] }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [proposalsOpen, setProposalsOpen] = useState(false);

  const cancellable = CANCELLABLE_STATUSES.includes(item.status);

  const confirmCancel = () => {
    if (reason.trim().length < 5) return;
    onCancel(item.id, reason.trim());
    setPromptOpen(false);
    setReason('');
  };

  return (
    <Card className="h-full" data-testid={`demand-card-${item.id}`}>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-ink-primary dark:text-dark-ink-primary truncate">
              {[PROPERTY_TYPE_LABELS_AR[item.propertyType] || item.propertyType, item.cityName]
                .filter(Boolean)
                .join(' — ')}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted dark:text-dark-ink-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.districtName || 'جميع الأحياء'}</span>
            </p>
          </div>
          <DemandStatusBadge status={item.status} />
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

        {item.status === DemandStatus.MATCHED || item.status === DemandStatus.ACTIVE ? (
          <div className="space-y-3" data-testid={`demand-proposals-section-${item.id}`}>
            <Button
              variant={proposalsOpen ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setProposalsOpen((open) => !open)}
              className="text-xs gap-1.5"
              data-testid={`demand-proposals-toggle-${item.id}`}
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>{proposalsOpen ? 'إخفاء العروض' : 'العروض المتاحة'}</span>
            </Button>
            {proposalsOpen ? <BuyerProposalsSection demandId={item.id} /> : null}
          </div>
        ) : null}

        {item.notes ? (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary line-clamp-2">
            {item.notes}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-surface-border dark:border-dark-surface-border pt-3">
          {item.status === DemandStatus.CANCELLED || item.status === DemandStatus.EXPIRED ? (
            <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
              {item.cancelReason ? `سبب الإلغاء: ${item.cancelReason}` : 'لم يعد الطلب نشطاً'}
            </span>
          ) : (
            <span className="text-xs font-semibold text-primary" data-testid="demand-expiry-window">
              {formatRemainingWindow(item.expiresAt)}
            </span>
          )}

          {cancellable ? (
            promptOpen ? (
              <div className="flex items-center gap-2" data-testid={`demand-cancel-prompt-${item.id}`}>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="سبب الإلغاء (5 أحرف على الأقل)"
                  maxLength={500}
                  className="w-44 px-2.5 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="سبب إلغاء طلب الشراء"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirmCancel}
                  disabled={reason.trim().length < 5}
                  data-testid={`demand-cancel-confirm-${item.id}`}
                >
                  تأكيد
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPromptOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPromptOpen(true)}
                className="text-xs gap-1.5"
                data-testid={`demand-cancel-btn-${item.id}`}
              >
                <span>إلغاء الطلب</span>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * Pure presentational lifecycle grid (Story 3.6 / AC#3, AC#4), exported as a named
 * component so it can be rendered via `renderToString` independently of the fetch wrapper.
 * The cancel affordance only appears for ACTIVE / MATCHED rows — every other status is
 * terminal, and the reason prompt is collected locally before `onCancel` fires.
 */
export function DemandsGrid({ items, onCancel }: DemandsGridProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      data-testid="demands-grid"
    >
      {items.map((item) => (
        <DemandCard key={item.id} item={item} onCancel={onCancel} />
      ))}
    </div>
  );
}

/**
 * Buyer demands workspace (Story 3.6 / FR-21, FR-58): active + historical demand list with
 * remaining expiry windows, inline cancel-with-reason, and the structured submission form.
 */
export function DemandsView() {
  const [items, setItems] = useState<BuyerDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    apiClient
      .get<DemandsPayload>('/demands/my')
      .then((payload) => {
        setItems(unwrapDemandsPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل طلبات الشراء.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const handleCancel = async (demandId: string, reason: string) => {
    try {
      const response = await apiClient.post<{ data?: BuyerDemandItem }>(
        `/demands/${demandId}/cancel`,
        { reason },
      );
      const cancelled = response?.data;
      setItems((prev) =>
        prev.map((item) =>
          item.id === demandId
            ? cancelled
              ? { ...cancelled }
              : {
                  ...item,
                  status: DemandStatus.CANCELLED,
                  cancelReason: reason,
                  cancelledAt: new Date().toISOString(),
                }
            : item,
        ),
      );
      setBanner('تم إلغاء طلب الشراء بنجاح.');
    } catch (err) {
      // Item stays untouched — surface the structured reason for the refusal.
      if (err instanceof ApiError && err.code === DEMAND_NOT_CANCELLABLE) {
        setBanner(err.message);
      } else {
        setBanner('تعذر إلغاء طلب الشراء. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  const handleSubmitted = (demand: BuyerDemandItem) => {
    setItems((prev) => [demand, ...prev]);
    setFormOpen(false);
    setBanner('تم نشر طلب الشراء وهو الآن نشط لمدة 30 يوماً.');
  };

  const activeCount = items.filter((item) => item.status === DemandStatus.ACTIVE).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              طلبات الشراء
            </h1>
            <span className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              {`${activeCount} نشط من ${items.length}`}
            </span>
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            تابع طلباتك العقارية النشطة والسجل المنتهي، وألغِ أي طلب لم يعد يناسبك.
          </p>
        </div>

        <Button
          variant={formOpen ? 'secondary' : 'primary'}
          size="md"
          onClick={() => setFormOpen((open) => !open)}
          className="gap-2 self-start sm:self-auto"
          data-testid="demand-toggle-form"
        >
          {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{formOpen ? 'إخفاء النموذج' : 'طلب شراء جديد'}</span>
        </Button>
      </div>

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-ink-primary dark:text-dark-ink-primary"
          data-testid="demands-banner"
        >
          {banner}
        </div>
      ) : null}

      {formOpen ? <DemandSubmitForm onSubmitted={handleSubmitted} /> : null}

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
          icon={<FileQuestion className="w-7 h-7" />}
          title={error}
          description="حدث خطأ أثناء جلب طلبات الشراء. أعد المحاولة بعد قليل."
          actionLabel="إعادة المحاولة"
          onAction={load}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="w-7 h-7" />}
          title="لا توجد طلبات شراء بعد"
          description="انشر أول طلب شراء بالمدينة والميزانية والمساحة التي تبحث عنها، وسيصل مباشرة للبائعين المؤهلين."
          actionLabel="نشر طلب شراء"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <DemandsGrid items={items} onCancel={handleCancel} />
      )}
    </div>
  );
}
