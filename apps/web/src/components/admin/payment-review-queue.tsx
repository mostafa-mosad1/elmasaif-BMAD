'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Lock,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Wallet,
} from 'lucide-react';
import {
  type AdminPaymentQueueItem,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_TYPE_LABELS_AR,
  DealPaymentStatus,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';

export function formatLockCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface AdminPaymentQueuePayload {
  data?: {
    items?: AdminPaymentQueueItem[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  };
}

const STATUS_FILTERS: Array<{ value: '' | DealPaymentStatus; label: string }> = [
  { value: '', label: 'الكل' },
  { value: DEAL_PAYMENT_STATUS.PROOF_UPLOADED, label: DEAL_PAYMENT_STATUS_LABELS_AR.PROOF_UPLOADED },
  { value: DEAL_PAYMENT_STATUS.UNDER_REVIEW, label: DEAL_PAYMENT_STATUS_LABELS_AR.UNDER_REVIEW },
];

export function PaymentReviewQueue() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'' | DealPaymentStatus>('');
  const [items, setItems] = useState<AdminPaymentQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async (filter: '' | DealPaymentStatus) => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const query = filter ? `?status=${filter}&page=1&limit=50` : '?page=1&limit=50';
      const res = await apiClient.get<AdminPaymentQueuePayload>(`/admin/payments${query}`);
      setItems(res?.data?.items ?? []);
      setTotal(res?.data?.meta?.total ?? res?.data?.items?.length ?? 0);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل طابور تدقيق إثباتات الدفع');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter, fetchQueue]);

  const handleClaim = async (paymentId: string) => {
    setClaimingId(paymentId);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/claim`);
      router.push(`/admin/payments/${paymentId}`);
    } catch (err) {
      const failure = describeApiError(err);
      const holder = readLockHolderName(failure.details);
      setErrorBanner(
        holder
          ? `إثبات الدفع مقفول حالياً بواسطة ${holder}. يمكنك المتابعة بعد انتهاء مدة القفل أو طلب فك القفل.`
          : failure.message || 'تعذر استلام مهمة التدقيق',
      );
      await fetchQueue(statusFilter);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 text-[#D8F3DC] px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل حصري لمدة 15 دقيقة مع نبض تلقائي • AD-10</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-[#D8F3DC]" />
            <span>طابور تدقيق إثباتات الدفع</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            تُعرض إثباتات الدفع تصاعدياً حسب الأقدمية. كل إثبات يُدقق بشكل مستقل لضمان الشفافية،
            والقفل يضمن عدم تضارب المشرفين أثناء مراجعة التحويلات البنكية.
          </p>
        </div>
        <div className="text-left bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 self-start sm:self-auto">
          <div className="text-xs text-white/70">إجمالي الإثباتات في الطابور</div>
          <div className="text-2xl font-extrabold text-[#D8F3DC]">{total}</div>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div className="flex-1 font-medium">{errorBanner}</div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-xs text-red-600 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#1B4332] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchQueue(statusFilter)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
          <p className="text-sm">جارٍ تحميل طابور التدقيق...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-base font-semibold text-gray-800">لا توجد إثباتات دفع بانتظار التدقيق</p>
          <p className="text-xs text-gray-500">تم تدقيق كافة إيصالات التحويل البنكي الواردة.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isMine = item.lockInfo?.isLocked && item.lockInfo?.isLockedByCurrentAdmin;
            const isOther = item.lockInfo?.isLocked && !item.lockInfo?.isLockedByCurrentAdmin;
            const typeLabel =
              DEAL_PAYMENT_TYPE_LABELS_AR[item.paymentType] || item.paymentType;

            return (
              <div
                key={item.id}
                data-testid={`payment-row-${item.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-gray-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded">
                      {item.dealNumber}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                      {typeLabel}
                    </span>
                    {isMine && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" />
                        <span>قيد تدقيقك • {formatLockCountdown(item.lockInfo.remainingSeconds)}</span>
                      </span>
                    )}
                    {isOther && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" />
                        <span>
                          قيد التدقيق بواسطة {item.lockInfo.lockedByAdminName || 'مشرف آخر'} •{' '}
                          {formatLockCountdown(item.lockInfo.remainingSeconds)}
                        </span>
                      </span>
                    )}
                    {!item.lockInfo.isLocked && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Unlock className="w-3 h-3 text-gray-400" />
                        <span>متاح للتدقيق</span>
                      </span>
                    )}
                  </div>

                  <div className="text-base font-bold text-gray-900">
                    {item.propertyTitle || 'صفقة عقارية'}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span>
                      المبلغ:{' '}
                      <strong className="text-gray-900 font-bold">
                        {formatSar(Number(item.amount))}
                      </strong>
                    </span>
                    {item.bankReferenceCode && (
                      <span>
                        المرجع البنكي: <span className="font-mono">{item.bankReferenceCode}</span>
                      </span>
                    )}
                    {item.senderBankName && <span>البنك: {item.senderBankName}</span>}
                    {item.uploadedAt && (
                      <span>
                        تاريخ الرفع: {new Date(item.uploadedAt).toLocaleString('ar-SA')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  {isMine ? (
                    <Link
                      href={`/admin/payments/${item.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      <span>متابعة التدقيق</span>
                    </Link>
                  ) : isOther ? (
                    <Link
                      href={`/admin/payments/${item.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>معاينة للقراءة</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleClaim(item.id)}
                      disabled={claimingId === item.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2d6a4f] transition-colors shadow-sm disabled:opacity-50"
                    >
                      {claimingId === item.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جارٍ الاستلام...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>استلام المهمة</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

