'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Clock, HandCoins, Lock, RefreshCw, Unlock } from 'lucide-react';
import { OFFER_AWAITING_PARTY_LABELS_AR, OfferStatus, OfferThreadSummary } from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { OfferStatusBadge } from '../offers/offer-status-badge';
import { formatOfferExpiry } from '../offers/buyer-offers-list';

/** Shared with the mediation workspace so both surfaces read the 15-minute lease identically. */
export function formatLockCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface AdminOfferQueuePayload {
  data?: {
    items?: OfferThreadSummary[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  };
}

const STATUS_FILTERS: Array<{ value: '' | OfferStatus; label: string }> = [
  { value: '', label: 'الكل' },
  { value: OfferStatus.PENDING_ADMIN_REVIEW, label: 'قيد المراجعة الإدارية' },
  { value: OfferStatus.COUNTER_OFFERED, label: 'عروض مضادة' },
  {
    value: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    label: 'معتمد — بانتظار الاعتماد النهائي',
  },
];

/**
 * Admin mediation queue (Story 4.2 / AC#9, AD-10): the offers awaiting mediation oldest-first,
 * each with the active 15-minute claim lease. Claiming is an explicit `POST` — reading the queue
 * never takes the task — and a second administrator sees the holder's name, not a generic error.
 */
export function OfferMediationQueue() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'' | OfferStatus>('');
  const [items, setItems] = useState<OfferThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async (filter: '' | OfferStatus) => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const query = filter ? `?status=${filter}&page=1&limit=50` : '?page=1&limit=50';
      const res = await apiClient.get<AdminOfferQueuePayload>(`/admin/offers${query}`);
      setItems(res?.data?.items ?? []);
      setTotal(res?.data?.meta?.total ?? res?.data?.items?.length ?? 0);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل طابور وساطة عروض الشراء');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter, fetchQueue]);

  const handleClaim = async (offerId: string) => {
    setClaimingId(offerId);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/offers/${offerId}/claim`);
      router.push(`/admin/negotiations/${offerId}`);
    } catch (err) {
      const failure = describeApiError(err);
      const holder = readLockHolderName(failure.details);
      setErrorBanner(
        holder
          ? `العرض مقفول حالياً بواسطة ${holder}. يمكنك المتابعة بعد انتهاء مدة القفل أو طلب فك القفل.`
          : failure.message || 'تعذر استلام مهمة الوساطة',
      );
      await fetchQueue(statusFilter);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 text-[#D8F3DC] px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل حصري لمدة 15 دقيقة مع نبض تلقائي • AD-10</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <HandCoins className="w-6 h-6 text-[#D8F3DC]" />
            <span>طابور وساطة عروض الشراء</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            تُعرض العروض تصاعدياً حسب الأقدمية لضمان عدالة المعالجة. اعتمد العرض أو ارفضه قبل
            إحالته إلى البائع، وأعد إحالة كل عرض مضاد إلى المشتري.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchQueue(statusFilter)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث الطابور</span>
        </button>
      </div>

      {errorBanner ? (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 flex items-center justify-between text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-red-700 underline">
            إغلاق
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface dark:bg-dark-surface-raised p-3 rounded-xl border border-surface-border dark:border-dark-surface-border">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <button
                key={filter.value || 'all'}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-[#1B4332] text-white shadow-sm'
                    : 'text-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{filter.label}</span>
                {isActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[11px]">
                    {`${total}`}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-ink-secondary font-medium">{`إجمالي السجلات: ${total}`}</div>
      </div>

      <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="py-3.5 px-4 font-bold">العقار</th>
                <th className="py-3.5 px-4 font-bold">المشتري</th>
                <th className="py-3.5 px-4 font-bold">السعر الحالي (ر.س)</th>
                <th className="py-3.5 px-4 font-bold text-center">الجولة</th>
                <th className="py-3.5 px-4 font-bold">الحالة</th>
                <th className="py-3.5 px-4 font-bold">قفل المهمة</th>
                <th className="py-3.5 px-4 font-bold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    جاري تحميل طابور الوساطة...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    لا توجد عروض بانتظار الوساطة حالياً
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const lockInfo = item.lockInfo;
                  const isLockedByOther = Boolean(
                    lockInfo?.isLocked && !lockInfo?.isLockedByCurrentAdmin,
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-sunken/50 dark:hover:bg-dark-surface/40 transition-colors"
                      data-testid={`mediation-queue-row-${item.id}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                          {item.listing?.title || '—'}
                        </div>
                        <div className="text-[11px] text-ink-secondary mt-0.5">
                          {[item.listing?.cityName, item.listing?.districtName]
                            .filter(Boolean)
                            .join(' — ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                          {item.buyerName || 'مشتري'}
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          {`البائع: ${item.sellerName || 'بائع'}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          dir="ltr"
                          className="font-mono font-bold text-sm text-[#1B4332] dark:text-emerald-400"
                        >
                          {formatSar(item.offerPrice)}
                        </span>
                        <div dir="ltr" className="text-[11px] text-ink-muted font-mono">
                          {formatSar(item.askPrice)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {`${item.negotiationRound}/${item.maxCounterRounds}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <OfferStatusBadge status={item.status} />
                        <div className="mt-1 text-[11px] text-ink-muted">
                          {item.awaitingParty
                            ? OFFER_AWAITING_PARTY_LABELS_AR[item.awaitingParty]
                            : formatOfferExpiry(item.expiresAt)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {!lockInfo?.isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Unlock className="w-3 h-3" />
                            <span>متاح للوساطة</span>
                          </span>
                        ) : lockInfo.isLockedByCurrentAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1B4332] text-white">
                            <Lock className="w-3 h-3" />
                            <span>قيد المعالجة بواسطتك</span>
                            <span dir="ltr" className="font-mono text-[10px] opacity-90">
                              {`(${formatLockCountdown(lockInfo.remainingSeconds)})`}
                            </span>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>{`مقفول بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}</span>
                            </span>
                            <div dir="ltr" className="text-[10px] font-mono text-amber-800">
                              {`Expires in ${formatLockCountdown(lockInfo.remainingSeconds)}`}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          {!isLockedByOther ? (
                            <button
                              type="button"
                              disabled={claimingId === item.id}
                              onClick={() => handleClaim(item.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {lockInfo?.isLockedByCurrentAdmin ? 'متابعة الوساطة' : 'استلام المهمة'}
                              </span>
                            </button>
                          ) : (
                            <Link
                              href={`/admin/negotiations/${item.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-colors"
                            >
                              معاينة فقط
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
