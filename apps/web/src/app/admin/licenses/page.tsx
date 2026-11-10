'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  FileCheck,
  Search,
  Lock,
  Unlock,
  Clock,
  Eye,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { FalLicenseQueueItem, ProfileStatus } from '@elmasaif/shared';
import { formatLockCountdown } from './licensing-helpers';

export interface AdminLicensesPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  initialItems?: FalLicenseQueueItem[];
  initialTotal?: number;
  initialLoading?: boolean;
}

export default function AdminLicensesPage(props?: AdminLicensesPageProps) {
  const { initialItems, initialTotal, initialLoading = false } = props || {};
  const router = useRouter();
  const [items, setItems] = useState<FalLicenseQueueItem[]>(initialItems || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [loading, setLoading] = useState(initialLoading);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ProfileStatus | ''>(ProfileStatus.UNDER_REVIEW);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'NEW' | 'RENEWAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      params.append('page', String(page));
      params.append('limit', '20');

      const res = await apiClient.get<{
        items: FalLicenseQueueItem[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>(`/admin/licenses?${params.toString()}`);

      if (res) {
        setItems(res.items || []);
        setTotal(res.meta?.total || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل طابور التراخيص الإداري');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, page]);

  useEffect(() => {
    if (!initialItems) {
      fetchQueue();
    }
  }, [fetchQueue, initialItems]);

  // Handle claiming a task
  const handleClaim = async (id: string) => {
    try {
      setClaimingId(id);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${id}/claim`, {});
      router.push(`/admin/licenses/${id}`);
    } catch (err: any) {
      setErrorBanner(err?.message || 'تعذر حجز قفل المراجعة');
      // Still navigate so admin can see detail in read-only mode if locked by other
      router.push(`/admin/licenses/${id}`);
    } finally {
      setClaimingId(null);
    }
  };

  const getStatusBadge = (status: ProfileStatus) => {
    switch (status) {
      case ProfileStatus.ACTIVE:
        return <Badge variant="verified">معتمدة</Badge>;
      case ProfileStatus.UNDER_REVIEW:
        return <Badge variant="warning">قيد المراجعة</Badge>;
      case ProfileStatus.REJECTED:
        return <Badge variant="danger">مرفوضة</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              طابور تدقيق واعتماد رخص فال (REGA)
            </h1>
          </div>
          <p className="text-xs text-ink-muted dark:text-dark-ink-muted mt-1">
            مراجعة طلبات تراخيص الوساطة والتسويق العقاري والتحقق من صحة الشهادات والسجلات
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchQueue()}
          disabled={loading}
          className="flex items-center gap-2 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الطابور</span>
        </Button>
      </div>

      {errorBanner && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <Card className="mb-6 border-surface-border dark:border-dark-surface-border">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(ProfileStatus.UNDER_REVIEW);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === ProfileStatus.UNDER_REVIEW
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  قيد المراجعة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(ProfileStatus.ACTIVE);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === ProfileStatus.ACTIVE
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  المعتمدة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(ProfileStatus.REJECTED);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === ProfileStatus.REJECTED
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  المرفوضة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('');
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === ''
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  الكل
                </button>
              </div>

              {/* Application Type Filter (Story 6.3 AC #4) */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border text-xs">
                <button
                  type="button"
                  data-testid="filter-type-all"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    typeFilter === 'ALL'
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  جميع الطلبات
                </button>
                <button
                  type="button"
                  data-testid="filter-type-renewals"
                  onClick={() => setTypeFilter('RENEWAL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    typeFilter === 'RENEWAL'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  طلبات التجديد
                </button>
                <button
                  type="button"
                  data-testid="filter-type-new"
                  onClick={() => setTypeFilter('NEW')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    typeFilter === 'NEW'
                      ? 'bg-surface dark:bg-dark-surface-raised text-primary font-bold shadow-xs'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  الطلبات الجديدة
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <input
                type="text"
                placeholder="بحث برقم الرخصة، السجل، أو الاسم..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full ps-9 pe-3 py-1.5 text-xs rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Search className="w-4 h-4 text-ink-muted absolute start-2.5 top-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card className="border-surface-border dark:border-dark-surface-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-surface-sunken/60 dark:bg-dark-surface-border/40 text-ink-muted border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="py-3 px-4 text-start font-semibold">مقدم الطلب</th>
                <th className="py-3 px-4 text-start font-semibold">نوع الطلب</th>
                <th className="py-3 px-4 text-start font-semibold">الاسم التجاري</th>
                <th className="py-3 px-4 text-start font-semibold">رقم رخصة فال</th>
                <th className="py-3 px-4 text-start font-semibold">السجل التجاري</th>
                <th className="py-3 px-4 text-start font-semibold">تاريخ الانتهاء</th>
                <th className="py-3 px-4 text-start font-semibold">الحالة</th>
                <th className="py-3 px-4 text-start font-semibold">حالة القفل</th>
                <th className="py-3 px-4 text-center font-semibold">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>جارٍ تحميل عناصر الطابور...</span>
                  </td>
                </tr>
              ) : items.filter((item) => {
                  if (typeFilter === 'RENEWAL') return Boolean(item.isRenewal);
                  if (typeFilter === 'NEW') return !item.isRenewal;
                  return true;
                }).length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <FileCheck className="w-10 h-10 mx-auto mb-2 text-ink-muted opacity-40" />
                    <p className="font-medium">لا توجد طلبات رخص مطابقة في هذا التصنيف</p>
                  </td>
                </tr>
              ) : (
                items
                  .filter((item) => {
                    if (typeFilter === 'RENEWAL') return Boolean(item.isRenewal);
                    if (typeFilter === 'NEW') return !item.isRenewal;
                    return true;
                  })
                  .map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-border/20 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                        {item.applicantName}
                      </div>
                      <div className="font-mono text-[11px] text-ink-muted">
                        {item.applicantPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {item.isRenewal ? (
                          <Badge
                            data-testid={`badge-renewal-${item.id}`}
                            className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-[10px]"
                          >
                            طلب تجديد
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">
                            طلب جديد
                          </Badge>
                        )}
                        {item.suspendedListingsCount && item.suspendedListingsCount > 0 ? (
                          <span
                            data-testid={`suspended-listings-${item.id}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300"
                          >
                            {item.suspendedListingsCount} إعلانات معلقة
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-ink-primary dark:text-dark-ink-primary">
                      {item.commercialName || 'غير مسجل'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
                      {item.licenseNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-ink-secondary dark:text-dark-ink-secondary">
                      {item.crNumber || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-ink-muted">
                      {new Date(item.expiryDate).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3 px-4">
                      {item.lockInfo?.isLocked ? (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                            item.lockInfo.isLockedByCurrentAdmin
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>
                            {item.lockInfo.isLockedByCurrentAdmin
                              ? 'محجوز لك'
                              : item.lockInfo.lockedByAdminName || 'مشرف آخر'}{' '}
                            ({formatLockCountdown(item.lockInfo.remainingSeconds)})
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <Unlock className="w-3 h-3" />
                          <span>متاح للمراجعة</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => handleClaim(item.id)}
                        disabled={claimingId === item.id}
                        className="flex items-center gap-1.5 text-xs mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>مراجعة وتدقيق</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 20 && (
          <div className="p-3 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between text-xs text-ink-muted">
            <span>إجمالي الطلبات: {total}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </Button>
              <span className="font-mono">صفحة {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

