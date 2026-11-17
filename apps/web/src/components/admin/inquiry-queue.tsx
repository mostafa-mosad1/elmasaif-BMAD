'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Clock, Lock, MessagesSquare, RefreshCw, Unlock } from 'lucide-react';
import {
  INQUIRY_AWAITING_PARTY_LABELS_AR,
  InquiryThreadSummary,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { InquiryStatusBadge } from '../inquiries/inquiry-status-badge';
import { formatLockCountdown } from './offer-mediation-queue';

interface AdminInquiryQueuePayload {
  items?: InquiryThreadSummary[];
  meta?: { total: number };
  data?: {
    items?: InquiryThreadSummary[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  };
}

/**
 * Tolerates the enveloped queue body (`{ statusCode, data: { items, meta } }`) and a bare
 * `{ items }`. The meta total drives the header counter only, so a missing meta never breaks the
 * table.
 */
export function unwrapInquiryQueuePayload(payload: unknown): {
  items: InquiryThreadSummary[];
  total: number;
} {
  if (!payload || typeof payload !== 'object') return { items: [], total: 0 };
  const { items, meta, data } = payload as AdminInquiryQueuePayload;
  const rows = Array.isArray(data?.items) ? data?.items : Array.isArray(items) ? items : [];
  const total = data?.meta?.total ?? meta?.total ?? rows.length;
  return { items: rows, total };
}

/**
 * Turns a failed claim into the banner a second administrator should read: a named holder when
 * `INQUIRY_LOCK_CONFLICT` carries `details.lockInfo` (AC-3), otherwise the server message.
 */
export function describeQueueClaimError(failure: {
  message?: string;
  details?: unknown;
}): string {
  const holder = readLockHolderName(failure.details);
  if (holder) {
    return `المحادثة مقفولة حالياً بواسطة ${holder}. يمكنك المتابعة بعد انتهاء مدة القفل أو طلب فك القفل.`;
  }
  return failure.message || 'تعذر استلام المحادثة';
}

/**
 * Admin conversation queue (Story 4.4 / AC-3, AD-10): mediated inquiries awaiting a relay,
 * oldest-first, each with the active 15-minute claim lease. Reading never claims — the explicit
 * `POST /claim` does — and a second administrator sees the holder's name rather than a generic
 * error because `INQUIRY_LOCK_CONFLICT` carries `details.lockInfo`.
 */
export function InquiryQueue() {
  const router = useRouter();
  const [items, setItems] = useState<InquiryThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await apiClient.get<AdminInquiryQueuePayload>('/admin/inquiries?page=1&limit=50');
      const parsed = unwrapInquiryQueuePayload(res);
      setItems(parsed.items);
      setTotal(parsed.total);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل طابور المحادثات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleClaim = async (inquiryId: string) => {
    setClaimingId(inquiryId);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/claim`);
      router.push(`/admin/conversations/${inquiryId}`);
    } catch (err) {
      setErrorBanner(describeQueueClaimError(describeApiError(err)));
      await fetchQueue();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل حصري لمدة 15 دقيقة مع نبض تلقائي • AD-10</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <MessagesSquare className="w-6 h-6 text-accent" />
            <span>طابور المحادثات</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            استفسارات المشترين التي تنتظر إحالة إدارية، والأردية التي يرسلها البائعون وتنتظر
            الإحالة إلى المشتري. تُعرض تصاعدياً حسب الأقدمية لضمان عدالة المعالجة.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
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
          data-testid="conversation-queue-error"
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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          <span>بانتظار الوساطة</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[11px]">
            {`${total}`}
          </span>
        </div>
        <div className="text-xs text-ink-secondary font-medium">{`إجمالي السجلات: ${total}`}</div>
      </div>

      <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="py-3.5 px-4 font-bold">العقار</th>
                <th className="py-3.5 px-4 font-bold">الأطراف</th>
                <th className="py-3.5 px-4 font-bold">الموضوع</th>
                <th className="py-3.5 px-4 font-bold">الحالة</th>
                <th className="py-3.5 px-4 font-bold">قفل المهمة</th>
                <th className="py-3.5 px-4 font-bold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    جاري تحميل طابور المحادثات...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    لا توجد محادثات بانتظار الوساطة حالياً
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
                      data-testid={`conversation-queue-row-${item.id}`}
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
                        <div className="max-w-[18rem] truncate text-ink-secondary dark:text-dark-ink-secondary">
                          {item.subject || 'استفسار عن العقار'}
                        </div>
                        <div className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
                          {`${item.messageCount} رسالة`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <InquiryStatusBadge status={item.status} />
                        <div className="mt-1 text-[11px] text-ink-muted">
                          {item.awaitingParty
                            ? INQUIRY_AWAITING_PARTY_LABELS_AR[item.awaitingParty]
                            : new Date(item.lastMessageAt).toLocaleString('ar-SA')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {!lockInfo?.isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Unlock className="w-3 h-3" />
                            <span>متاح للوساطة</span>
                          </span>
                        ) : lockInfo.isLockedByCurrentAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary text-white">
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
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                              data-testid={`conversation-queue-claim-${item.id}`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {lockInfo?.isLockedByCurrentAdmin ? 'متابعة الوساطة' : 'استلام المحادثة'}
                              </span>
                            </button>
                          ) : (
                            <Link
                              href={`/admin/conversations/${item.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-colors"
                              data-testid={`conversation-queue-preview-${item.id}`}
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
