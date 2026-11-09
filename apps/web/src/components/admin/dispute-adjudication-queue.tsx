'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  RefreshCw,
  Scale,
  Unlock,
  User,
} from 'lucide-react';
import { type ClaimLockInfo, DealStatus } from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { DealStatusBadge } from '../deals/deal-status-badge';
import { formatLockCountdown } from './payment-review-queue';

export interface AdminDisputeQueueItem {
  id: string;
  dealId: string;
  dealNumber?: string;
  dealStatus?: DealStatus;
  deal?: {
    id: string;
    dealNumber: string;
    status: DealStatus;
    buyerProfile?: { user?: { id?: string; fullName?: string } };
    sellerProfile?: { user?: { id?: string; fullName?: string } };
  };
  initiatorId?: string;
  filedByRole?: 'BUYER' | 'SELLER' | 'SYSTEM';
  filedByName?: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  resolutionAction: 'COMPLETE' | 'CANCEL' | 'RETURN_TO_REVIEW' | null;
  resolutionNotes: string | null;
  resolvedByAdminName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  lockInfo: ClaimLockInfo;
}

export function getDisputeDisplayData(dispute: AdminDisputeQueueItem) {
  const dealNumber = dispute.dealNumber || dispute.deal?.dealNumber || '—';
  const dealStatus = (dispute.dealStatus || dispute.deal?.status) as DealStatus;
  const filedByName =
    dispute.filedByName ||
    dispute.deal?.buyerProfile?.user?.fullName ||
    dispute.deal?.sellerProfile?.user?.fullName ||
    'طرف النزاع';
  const filedByRole =
    dispute.filedByRole ||
    (dispute.initiatorId && dispute.initiatorId === dispute.deal?.sellerProfile?.user?.id
      ? 'SELLER'
      : 'BUYER');
  const reason = dispute.reason || '—';
  return { dealNumber, dealStatus, filedByName, filedByRole, reason };
}

interface AdminDisputesPayload {
  data?: {
    items?: AdminDisputeQueueItem[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  };
}

const STATUS_FILTERS: Array<{ value: '' | 'OPEN' | 'RESOLVED'; label: string }> = [
  { value: '', label: 'الكل' },
  { value: 'OPEN', label: 'نزاعات مفتوحة' },
  { value: 'RESOLVED', label: 'نزاعات مفضولة ومحسومة' },
];

export const FILED_BY_ROLE_LABELS_AR: Record<string, string> = {
  BUYER: 'المشتري',
  SELLER: 'البائع',
  SYSTEM: 'النظام الآلي (انتهاء مهلة)',
};

export function DisputeAdjudicationQueue() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'' | 'OPEN' | 'RESOLVED'>('');
  const [items, setItems] = useState<AdminDisputeQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async (filter: '' | 'OPEN' | 'RESOLVED') => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const query = filter ? `?status=${filter}&page=1&limit=50` : '?page=1&limit=50';
      const res = await apiClient.get<AdminDisputesPayload>(`/admin/disputes${query}`);
      setItems(res?.data?.items ?? []);
      setTotal(res?.data?.meta?.total ?? res?.data?.items?.length ?? 0);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل طابور النزاعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter, fetchQueue]);

  const handleClaim = async (disputeId: string) => {
    setClaimingId(disputeId);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/disputes/${disputeId}/claim`);
      router.push(`/admin/disputes/${disputeId}`);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر حجز قفل النزاع للمراجعة');
      await fetchQueue(statusFilter);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border dark:border-dark-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
              طابور فض النزاعات والتحكيم الإداري
            </h1>
          </div>
          <p className="mt-1 text-xs text-ink-muted dark:text-dark-ink-muted">
            التحقيق في طلبات النزاع وإصدار قرارات إدارية نهائية وملزمة للصفقات المتنازع عليها
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            إجمالي النزاعات: {total}
          </span>
          <button
            type="button"
            onClick={() => fetchQueue(statusFilter)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-sunken dark:bg-dark-surface-raised dark:text-dark-ink-secondary dark:hover:bg-dark-surface-sunken"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorBanner ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg p-4 text-xs font-semibold text-status-danger"
          data-testid="dispute-queue-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.value
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-sunken text-ink-secondary hover:bg-surface-border/60 dark:bg-dark-surface-sunken dark:text-dark-ink-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Table */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-12 text-center">
          <Scale className="mx-auto h-12 w-12 text-ink-muted/40 dark:text-dark-ink-muted/40 mb-3" />
          <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
            لا توجد نزاعات حالياً
          </h3>
          <p className="mt-1 text-xs text-ink-muted dark:text-dark-ink-muted">
            طابور النزاعات فارغ وفق التصنيف المحدد.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View (Visible on screens < 768px - No horizontal table overflow) */}
          <div className="block md:hidden space-y-3.5">
            {items.map((dispute) => {
              const lock = dispute.lockInfo;
              const isLocked = Boolean(lock?.isLocked);
              const isMine = Boolean(lock?.isLockedByCurrentAdmin);
              const holderName = readLockHolderName(lock);
              const isResolved = dispute.status === 'RESOLVED';
              const { dealNumber, dealStatus, filedByName, filedByRole, reason } =
                getDisputeDisplayData(dispute);

              return (
                <div
                  key={dispute.id}
                  className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-4 space-y-3 shadow-xs"
                >
                  {/* Card Header: Deal number & Status badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold bg-surface-sunken dark:bg-dark-surface-sunken px-2.5 py-1 rounded-md text-ink-primary dark:text-dark-ink-primary border border-surface-border/50">
                      {dealNumber}
                    </span>
                    {dealStatus ? <DealStatusBadge status={dealStatus} /> : null}
                  </div>

                  {/* Initiator & Role */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                        {filedByName}
                      </span>
                      <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted bg-surface-sunken dark:bg-dark-surface-sunken px-1.5 py-0.5 rounded shrink-0">
                        {FILED_BY_ROLE_LABELS_AR[filedByRole] || filedByRole}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted dark:text-dark-ink-muted shrink-0">
                      {new Date(dispute.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>

                  {/* Reason text box */}
                  <div className="rounded-lg bg-surface-sunken/60 dark:bg-dark-surface-sunken/60 p-2.5 text-xs text-ink-secondary dark:text-dark-ink-secondary border border-surface-border/40">
                    <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">سبب النزاع: </span>
                    <span className="break-words">{reason}</span>
                  </div>

                  {/* Lock / Audit status */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-border/60 dark:border-dark-surface-border/60">
                    <span className="text-ink-muted dark:text-dark-ink-muted text-[11px]">حالة القفل:</span>
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        محسوم ({dispute.resolutionAction})
                      </span>
                    ) : isLocked ? (
                      <div className="text-left space-y-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isMine ? 'text-primary' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {isMine ? 'محجوز لك' : `قيد التدقيق: ${holderName}`}
                        </span>
                        {lock?.remainingSeconds ? (
                          <span className="block font-mono text-[10px] text-ink-muted dark:text-dark-ink-muted">
                            متبقي: {formatLockCountdown(lock.remainingSeconds)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                        <Unlock className="h-3.5 w-3.5" />
                        متاح للمراجعة
                      </span>
                    )}
                  </div>

                  {/* Action Button: Full width on mobile */}
                  <div className="pt-1">
                    {isResolved ? (
                      <Link
                        href={`/admin/disputes/${dispute.id}`}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:text-dark-ink-secondary dark:hover:bg-dark-surface-sunken"
                      >
                        <Eye className="h-4 w-4" />
                        عرض القرار
                      </Link>
                    ) : isLocked && !isMine ? (
                      <Link
                        href={`/admin/disputes/${dispute.id}`}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:text-dark-ink-secondary dark:hover:bg-dark-surface-sunken"
                      >
                        <Eye className="h-4 w-4" />
                        معاينة
                      </Link>
                    ) : isMine ? (
                      <Link
                        href={`/admin/disputes/${dispute.id}`}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover"
                      >
                        <FileText className="h-4 w-4" />
                        متابعة البت
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleClaim(dispute.id)}
                        disabled={claimingId === dispute.id}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                      >
                        <Lock className="h-4 w-4" />
                        {claimingId === dispute.id ? 'جارٍ الحجز...' : 'حجز ومراجعة'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Visible on screens >= 768px) */}
          <div className="hidden md:block overflow-x-auto rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised">
            <table className="w-full text-right text-xs" data-testid="dispute-queue-table">
              <thead className="border-b border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken text-ink-muted dark:text-dark-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">رقم الصفقة</th>
                  <th className="px-4 py-3 font-semibold">حالة الصفقة</th>
                  <th className="px-4 py-3 font-semibold">طرف النزاع</th>
                  <th className="px-4 py-3 font-semibold">سبب النزاع</th>
                  <th className="px-4 py-3 font-semibold">تاريخ الرفع</th>
                  <th className="px-4 py-3 font-semibold">حالة التدقيق والقفل</th>
                  <th className="px-4 py-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {items.map((dispute) => {
                  const lock = dispute.lockInfo;
                  const isLocked = Boolean(lock?.isLocked);
                  const isMine = Boolean(lock?.isLockedByCurrentAdmin);
                  const holderName = readLockHolderName(lock);
                  const isResolved = dispute.status === 'RESOLVED';
                  const { dealNumber, dealStatus, filedByName, filedByRole, reason } =
                    getDisputeDisplayData(dispute);

                  return (
                    <tr
                      key={dispute.id}
                      className="hover:bg-surface-sunken/50 dark:hover:bg-dark-surface-sunken/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
                        {dealNumber}
                      </td>
                      <td className="px-4 py-3">
                        {dealStatus ? <DealStatusBadge status={dealStatus} /> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                          {filedByName}
                        </div>
                        <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted">
                          {FILED_BY_ROLE_LABELS_AR[filedByRole] || filedByRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-ink-secondary dark:text-dark-ink-secondary" title={reason}>
                        {reason}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-muted dark:text-dark-ink-muted whitespace-nowrap">
                        {new Date(dispute.createdAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            محسوم ({dispute.resolutionAction})
                          </span>
                        ) : isLocked ? (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                isMine
                                  ? 'text-primary'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              {isMine ? 'محجوز لك' : `قيد التدقيق: ${holderName}`}
                            </span>
                            {lock?.remainingSeconds ? (
                              <span className="block font-mono text-[10px] text-ink-muted dark:text-dark-ink-muted">
                                متبقي: {formatLockCountdown(lock.remainingSeconds)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                            <Unlock className="h-3.5 w-3.5" />
                            متاح للمراجعة
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {isResolved ? (
                          <Link
                            href={`/admin/disputes/${dispute.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-border dark:border-dark-surface-border px-2.5 py-1 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:text-dark-ink-secondary dark:hover:bg-dark-surface-sunken"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            عرض القرار
                          </Link>
                        ) : isLocked && !isMine ? (
                          <Link
                            href={`/admin/disputes/${dispute.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-border dark:border-dark-surface-border px-2.5 py-1 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:text-dark-ink-secondary dark:hover:bg-dark-surface-sunken"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            معاينة
                          </Link>
                        ) : isMine ? (
                          <Link
                            href={`/admin/disputes/${dispute.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            متابعة البت
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleClaim(dispute.id)}
                            disabled={claimingId === dispute.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            {claimingId === dispute.id ? 'جارٍ الحجز...' : 'حجز ومراجعة'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
