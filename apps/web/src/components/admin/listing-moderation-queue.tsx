'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Clock,
  Lock,
  Unlock,
  FileText,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  BarChart2,
  MapPin,
} from 'lucide-react';
import {
  ListingStatus,
  ModerationQueueItem,
  ModerationQueueResponse,
  PropertyType,
  UserRole,
} from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

const SELLER_ROLE_LABELS: Record<string, string> = {
  [UserRole.MARKETER]: 'وسيط عقاري (فال)',
  [UserRole.OWNER]: 'مالك مباشر',
};

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface ListingModerationQueueProps {
  initialItems?: ModerationQueueItem[];
  initialTotal?: number;
  initialStatus?: ListingStatus;
}

export function ListingModerationQueue({
  initialItems,
  initialTotal,
  initialStatus = ListingStatus.PENDING_REVIEW,
}: ListingModerationQueueProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ListingStatus>(initialStatus);
  const [items, setItems] = useState<ModerationQueueItem[]>(initialItems || []);
  const [total, setTotal] = useState<number>(
    initialTotal ?? (initialItems ? initialItems.length : 0),
  );
  const [loading, setLoading] = useState<boolean>(!initialItems);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(
    async (targetStatus: ListingStatus) => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const res = await apiClient.get<{
          statusCode: number;
          data: ModerationQueueResponse;
        }>(`/admin/listings/moderation-queue?status=${targetStatus}&page=1&limit=50`);
        if (res?.data) {
          setItems(res.data.items || []);
          setTotal(res.data.meta?.total ?? 0);
        }
      } catch (err: any) {
        setErrorBanner(
          err?.message || 'تعذر تحميل طابور مراجعة الإعلانات العقارية',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (initialItems && statusFilter === initialStatus) {
      return;
    }
    fetchQueue(statusFilter);
  }, [statusFilter, initialItems, initialStatus, fetchQueue]);

  const handleClaimAndReview = async (listingId: string) => {
    setClaimingId(listingId);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/listings/${listingId}/claim`);
      router.push(`/admin/listings/${listingId}/review`);
    } catch (err: any) {
      setErrorBanner(
        err?.message ||
          'تعذر استلام المهمة — قد يكون الإعلان قيد المراجعة حالياً بواسطة مشرف آخر',
      );
      await fetchQueue(statusFilter);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <Lock className="w-3.5 h-3.5" />
            <span>نظام القفل الحصري للمهام (15 دقيقة + نبض تلقائي كل 5 دقائق) • AD-10</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-accent" />
            <span>طابور مراجعة الإعلانات العقارية</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            تُرتب الإعلانات تصاعدياً حسب أقدمية التقديم (الأقدم أولاً) لضمان عدالة وسرعة المعالجة، مع قفل حصري لمدة 15 دقيقة يمنع تضارب قرارات المشرفين.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/listings/analytics"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>تحليلات التفاعل العامة</span>
          </Link>

          <button
            type="button"
            onClick={() => fetchQueue(statusFilter)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث الطابور</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorBanner && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 flex items-center justify-between text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-700 underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface dark:bg-dark-surface-raised p-3 rounded-xl border border-surface-border dark:border-dark-surface-border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter(ListingStatus.PENDING_REVIEW)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === ListingStatus.PENDING_REVIEW
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>بانتظار المراجعة</span>
            {statusFilter === ListingStatus.PENDING_REVIEW && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[11px]">
                {`${total}`}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(ListingStatus.ACTIVE)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === ListingStatus.ACTIVE
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>معتمدة</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(ListingStatus.REJECTED)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === ListingStatus.REJECTED
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>مرفوضة</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(ListingStatus.SUSPENDED)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === ListingStatus.SUSPENDED
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>معلق للامتثال</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(ListingStatus.BLOCKED)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === ListingStatus.BLOCKED
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>محظور</span>
          </button>
        </div>

        <div className="text-xs text-ink-secondary font-medium">
          {`إجمالي السجلات: ${total}`}
        </div>
      </div>

      {/* Queue Data Table */}
      <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="py-3.5 px-4 font-bold">العقار والموقع</th>
                <th className="py-3.5 px-4 font-bold">النوع والمساحة</th>
                <th className="py-3.5 px-4 font-bold">السعر المطلوب (ر.س)</th>
                <th className="py-3.5 px-4 font-bold">مقدم الإعلان</th>
                <th className="py-3.5 px-4 font-bold text-center">المرفقات</th>
                <th className="py-3.5 px-4 font-bold">حالة قفل المهمة</th>
                <th className="py-3.5 px-4 font-bold text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    جاري تحميل طابور مراجعة الإعلانات العقارية...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    لا توجد إعلانات عقارية في هذه القائمة حالياً
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const { lockInfo } = item;
                  const isLockedByOther =
                    lockInfo.isLocked && !lockInfo.isLockedByCurrentAdmin;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-sunken/50 dark:hover:bg-dark-surface/40 transition-colors"
                    >
                      {/* Title & Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                            {item.title}
                          </span>
                          {item.activePriceSuggestion && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold">
                              مقترح سعر معلّق
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-ink-secondary mt-0.5">
                          <MapPin className="w-3 h-3 text-primary" />
                          <span>{`${item.cityName} — حي ${item.districtName}`}</span>
                        </div>
                      </td>

                      {/* Type & Area */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[11px]">
                          {PROPERTY_TYPE_LABELS[item.propertyType] || item.propertyType}
                        </span>
                        <div className="text-[11px] text-ink-muted mt-1 font-mono">
                          {`${item.areaSquareMeters} م²`}
                        </div>
                      </td>

                      {/* Ask Price (JetBrains Mono) */}
                      <td className="py-3.5 px-4">
                        <span
                          dir="ltr"
                          className="font-mono font-bold text-sm text-primary dark:text-accent"
                        >
                          {`${Number(item.askPrice).toLocaleString('en-US')} SAR`}
                        </span>
                      </td>

                      {/* Seller Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                          {item.sellerName}
                        </div>
                        <span className="text-[11px] text-ink-secondary">
                          {SELLER_ROLE_LABELS[item.sellerRole] || item.sellerRole}
                        </span>
                      </td>

                      {/* Attachments Count */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-2.5 text-[11px] font-medium text-ink-secondary">
                          <span className="inline-flex items-center gap-1" title="الصور">
                            <ImageIcon className="w-3.5 h-3.5 text-primary" />
                            <span className="font-mono">{`${item.photoCount}`}</span>
                          </span>
                          <span className="inline-flex items-center gap-1" title="المستندات القانونية">
                            <FileText className="w-3.5 h-3.5 text-amber-700" />
                            <span className="font-mono">{`${item.documentCount}`}</span>
                          </span>
                        </div>
                      </td>

                      {/* Lock Status Badge */}
                      <td className="py-3.5 px-4">
                        {!lockInfo.isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Unlock className="w-3 h-3" />
                            <span>متاح للمراجعة</span>
                          </span>
                        ) : lockInfo.isLockedByCurrentAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary text-white">
                            <Lock className="w-3 h-3" />
                            <span>قيد المراجعة بواسطتك</span>
                            <span dir="ltr" className="font-mono text-[10px] opacity-90">
                              {`(${formatCountdown(lockInfo.remainingSeconds)})`}
                            </span>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>{`مقفول بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}</span>
                            </span>
                            <div dir="ltr" className="text-[10px] font-mono text-amber-800">
                              {`Expires in ${formatCountdown(lockInfo.remainingSeconds)}`}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          {statusFilter === ListingStatus.PENDING_REVIEW && !isLockedByOther ? (
                            <button
                              type="button"
                              disabled={claimingId === item.id}
                              onClick={() => handleClaimAndReview(item.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {lockInfo.isLockedByCurrentAdmin
                                  ? 'متابعة المراجعة'
                                  : 'استلام ومراجعة الإعلان'}
                              </span>
                            </button>
                          ) : (
                            <Link
                              href={`/admin/listings/${item.id}/review`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>
                                {statusFilter === ListingStatus.ACTIVE
                                  ? 'معاينة واقتراح سعر'
                                  : 'معاينة وتفاصيل الإعلان'}
                              </span>
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

