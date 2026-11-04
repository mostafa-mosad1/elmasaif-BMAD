'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ProposalStatus,
  PROPOSAL_STATUS_LABELS_AR,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { HandCoins, CheckCircle2, XCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { ProposalStatusBadge } from '../proposals/proposal-status-badge';

interface AdminProposalItem {
  id: string;
  demandId: string;
  listingId: string;
  providerProfileId: string;
  status: ProposalStatus;
  proposedPrice: number;
  note: string | null;
  rejectReason: string | null;
  selectedAt: string | null;
  createdAt: string;
  demandSummary: {
    id: string;
    propertyType: string;
    cityName: string | null;
    maxBudget: number;
  } | null;
  listingSummary: {
    id: string;
    title: string;
    propertyType: string;
    cityName: string | null;
    districtName: string | null;
    askPrice: number;
    areaSquareMeters: number;
  } | null;
  providerName: string | null;
}

interface ProposalQueueResponse {
  items: AdminProposalItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const formatSar = (value: number): string => Number(value || 0).toLocaleString('en-US');

const FILTERS: Array<{ status: ProposalStatus; label: string }> = [
  { status: ProposalStatus.PENDING_ADMIN_REVIEW, label: 'بانتظار المراجعة' },
  { status: ProposalStatus.APPROVED_FOR_BUYER, label: 'متاحة للمشترى' },
  { status: ProposalStatus.REJECTED, label: 'مرفوضة' },
  { status: ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, label: 'مختارة' },
];

/**
 * Admin proposal review queue (Story 3.7 / FR-23, `Offers.Review`, AD-12). Mirrors the
 * listing moderation queue fetch idiom but WITHOUT a task-claim call — Proposal is not one of
 * the 8 locked queues (AD-10) and is non-financial, so there is no If-Match / version /
 * Idempotency-Key. Approve → visible to the buyer; reject → inline mandatory reason.
 */
export function ProposalReviewQueue() {
  const [statusFilter, setStatusFilter] = useState<ProposalStatus>(ProposalStatus.PENDING_ADMIN_REVIEW);
  const [items, setItems] = useState<AdminProposalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async (targetStatus: ProposalStatus) => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await apiClient.get<{ statusCode: number; data: ProposalQueueResponse }>(
        `/admin/proposals?status=${targetStatus}&page=1&limit=50`,
      );
      if (res?.data) {
        setItems(res.data.items || []);
        setTotal(res.data.meta?.total ?? 0);
      }
    } catch (err: unknown) {
      setErrorBanner((err as { message?: string })?.message || 'تعذر تحميل طابور مراجعة عروض المزودين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter, fetchQueue]);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/proposals/${id}/approve`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      setErrorBanner((err as { message?: string })?.message || 'تعذر اعتماد العرض');
      fetchQueue(statusFilter);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (reason.trim().length < 5) return;
    setBusyId(id);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/proposals/${id}/reject`, { reason: reason.trim() });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      setRejectingId(null);
      setReason('');
    } catch (err: unknown) {
      setErrorBanner((err as { message?: string })?.message || 'تعذر رفض العرض');
      fetchQueue(statusFilter);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <HandCoins className="w-6 h-6 text-[#D8F3DC]" />
            <span>طابور مراجعة عروض المزودين</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            تُرتب العروض تصاعدياً حسب أقدمية التقديم. اعتماد العرض يُخرِجه للمشترى، ورفضه يستوجب سبباً. لا يوجد قفل حصري للمهمة (AD-10).
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

      {errorBanner && (
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
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface dark:bg-dark-surface-raised p-3 rounded-xl border border-surface-border dark:border-dark-surface-border">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.status}
              type="button"
              onClick={() => setStatusFilter(filter.status)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === filter.status
                  ? 'bg-[#1B4332] text-white shadow-sm'
                  : 'text-ink-secondary hover:bg-surface-sunken'
              }`}
            >
              <span>{filter.label}</span>
              {statusFilter === filter.status && (
                <span className="px-2 py-0.5 rounded-full bg-white/20 font-mono text-[11px]">{total}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="py-3.5 px-4 font-bold">العقار المقدَّم</th>
                <th className="py-3.5 px-4 font-bold">طلب الشراء</th>
                <th className="py-3.5 px-4 font-bold">السعر المقترح (ر.س)</th>
                <th className="py-3.5 px-4 font-bold">المزوِّد</th>
                <th className="py-3.5 px-4 font-bold">الحالة</th>
                <th className="py-3.5 px-4 font-bold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    جاري تحميل طابور مراجعة العروض...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    لا توجد عروض في هذه القائمة حالياً
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const pending = item.status === ProposalStatus.PENDING_ADMIN_REVIEW;
                  return (
                    <tr key={item.id} className="hover:bg-surface-sunken/50 dark:hover:bg-dark-surface/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                          {item.listingSummary?.title ?? '—'}
                        </div>
                        <div className="text-[11px] text-ink-secondary mt-0.5">
                          {item.listingSummary
                            ? `${item.listingSummary.cityName ?? ''} — ${item.listingSummary.districtName ?? 'غير محدد'}`
                            : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[11px]">
                          {item.demandSummary
                            ? PROPERTY_TYPE_LABELS_AR[item.demandSummary.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR] ||
                              item.demandSummary.propertyType
                            : '—'}
                        </span>
                        {item.demandSummary ? (
                          <div className="text-[11px] text-ink-muted mt-1" dir="ltr">
                            {`${item.demandSummary.cityName ?? ''} · سقف ${formatSar(item.demandSummary.maxBudget)}`}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4">
                        <span dir="ltr" className="font-mono font-bold text-sm text-[#1B4332] dark:text-emerald-400">
                          {`${formatSar(item.proposedPrice)} SAR`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                          {item.providerName ?? 'وسيط'}
                        </div>
                        {item.note ? (
                          <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-2 max-w-xs">{item.note}</div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4">
                        <ProposalStatusBadge status={item.status} />
                        {item.status === ProposalStatus.REJECTED && item.rejectReason ? (
                          <div className="text-[10px] text-status-danger mt-1 max-w-xs">{item.rejectReason}</div>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4 text-left">
                        {!pending ? (
                          <span className="text-[11px] text-ink-muted">{PROPOSAL_STATUS_LABELS_AR[item.status]}</span>
                        ) : rejectingId === item.id ? (
                          <div className="flex items-center justify-end gap-2" data-testid={`proposal-reject-prompt-${item.id}`}>
                            <input
                              type="text"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="سبب الرفض (5 أحرف على الأقل)"
                              maxLength={500}
                              className="w-48 px-2.5 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                              aria-label="سبب رفض العرض"
                            />
                            <button
                              type="button"
                              onClick={() => handleReject(item.id)}
                              disabled={reason.trim().length < 5 || busyId === item.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                            >
                              تأكيد الرفض
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setReason('');
                              }}
                              className="inline-flex items-center px-2 py-1.5 rounded-xl text-ink-secondary"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(item.id)}
                              disabled={busyId === item.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold disabled:opacity-50"
                              data-testid={`proposal-approve-${item.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>اعتماد</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(item.id);
                                setReason('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold"
                              data-testid={`proposal-reject-${item.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>رفض</span>
                            </button>
                          </div>
                        )}
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
