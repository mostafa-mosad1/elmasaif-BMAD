'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  FileText,
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
  Building,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import {
  OwnerListingRequestQueueItem,
  OwnerListingRequestStatus,
  PropertyType,
} from '@elmasaif/shared';
import {
  formatLockCountdown,
  OWNER_REQUEST_STATUS_MAP,
  PROPERTY_TYPE_MAP,
} from './contracts-helpers';

export interface AdminOwnerRequestsPageProps {
  initialItems?: OwnerListingRequestQueueItem[];
  initialTotal?: number;
  initialLoading?: boolean;
}

export default function AdminOwnerRequestsPage(props?: AdminOwnerRequestsPageProps) {
  const { initialItems, initialTotal, initialLoading = false } = props || {};
  const router = useRouter();

  const [items, setItems] = useState<OwnerListingRequestQueueItem[]>(initialItems || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [loading, setLoading] = useState(initialLoading);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OwnerListingRequestStatus | ''>('');
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

      const res = await apiClient<{
        items: OwnerListingRequestQueueItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/owner-requests?${params.toString()}`);

      if (res) {
        setItems(res.items || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل طابور طلبات الملاك');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, page]);

  useEffect(() => {
    if (!initialItems) {
      fetchQueue();
    }
  }, [fetchQueue, initialItems]);

  const handleClaim = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setClaimingId(id);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${id}/claim`, { method: 'POST' });
      router.push(`/admin/owner-requests/${id}`);
    } catch (err: any) {
      setErrorBanner(err?.message || 'تعذر استلام المهمة (قد تكون محجوزة لمشرف آخر)');
      await fetchQueue();
    } finally {
      setClaimingId(null);
    }
  };

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div dir="rtl" className="space-y-6">
      {/* Sovereign Header Banner */}
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>نظام وساطة الملاك المباشرين • FR-69 &amp; UC-67</span>
          </div>
          <h1 className="text-2xl font-bold">طابور مراجعة طلبات الملاك وإرسال العقود</h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            مراجعة طلبات الإدراج المقدمة من الملاك والتحقق من صكوك الملكية والحسابات البنكية وإرسال العقود الإلكترونية القياسية مع قفل العمليات لمدة 15 دقيقة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQueue()}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الطابور</span>
          </Button>
        </div>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorBanner}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === '' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                الكل ({total})
              </Button>
              <Button
                variant={statusFilter === OwnerListingRequestStatus.PENDING ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(OwnerListingRequestStatus.PENDING);
                  setPage(1);
                }}
                className={statusFilter === OwnerListingRequestStatus.PENDING ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                قيد المراجعة
              </Button>
              <Button
                variant={statusFilter === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE);
                  setPage(1);
                }}
                className={statusFilter === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                بانتظار التوقيع
              </Button>
              <Button
                variant={statusFilter === OwnerListingRequestStatus.MODIFICATION_REQUESTED ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(OwnerListingRequestStatus.MODIFICATION_REQUESTED);
                  setPage(1);
                }}
              >
                مطلوب تعديلات
              </Button>
              <Button
                variant={statusFilter === OwnerListingRequestStatus.REJECTED ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(OwnerListingRequestStatus.REJECTED);
                  setPage(1);
                }}
              >
                مرفوضة
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث باسم المالك أو عنوان العقار..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>جاري تحميل طلبات الإدراج...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <FileText className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-base font-semibold">لا توجد طلبات إدراج مطابقة للشروط</p>
              <p className="text-xs">جرّب تغيير مرشحات البحث أو مسح كلمة البحث.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3.5">العقار</th>
                    <th className="p-3.5">المدينة والحي</th>
                    <th className="p-3.5">السعر المطلوب</th>
                    <th className="p-3.5">المالك</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">قفل العمليات (15 دقيقة)</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => {
                    const statusConfig = OWNER_REQUEST_STATUS_MAP[item.status] || {
                      label: item.status,
                      bg: 'bg-surface-sunken dark:bg-dark-surface-sunken',
                      text: 'text-ink-secondary dark:text-dark-ink-secondary',
                      border: 'border-surface-border dark:border-dark-surface-border',
                    };
                    const propTypeLabel = PROPERTY_TYPE_MAP[item.propertyType] || item.propertyType;

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{item.propertyTitle}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="font-medium text-primary">{propTypeLabel}</span>
                            <span>•</span>
                            <span>صك رقم: {item.titleDeedNumber}</span>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-medium">{item.cityName}</div>
                          <div className="text-xs text-muted-foreground">{item.districtName}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-foreground">
                            {item.askPrice.toLocaleString()} ر.س
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-medium">{item.ownerLegalName}</div>
                          <div className="text-xs text-muted-foreground" dir="ltr">
                            {item.maskedMobileNumber}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {item.lockInfo?.isLocked ? (
                            item.lockInfo.isLockedByCurrentAdmin ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>أنت مستلم المهمة ({formatLockCountdown(item.lockInfo.remainingSeconds)})</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
                                <Lock className="w-3.5 h-3.5 text-rose-600" />
                                <span>محجوز لـ: {item.lockInfo.lockedByAdminName || 'مشرف آخر'}</span>
                              </div>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                              <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>متاح للاستلام</span>
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!item.lockInfo?.isLocked ? (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={claimingId === item.id}
                                onClick={(e) => handleClaim(item.id, e)}
                                className="bg-primary hover:bg-primary-hover text-white gap-1 text-xs"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>استلام</span>
                              </Button>
                            ) : (
                              <Link href={`/admin/owner-requests/${item.id}`}>
                                <Button size="sm" variant="outline" className="gap-1 text-xs">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>معاينة</span>
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>
                إجمالي الطلبات: {total} • الصفحة {page} من {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
