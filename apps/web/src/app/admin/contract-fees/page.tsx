'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  CreditCard,
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
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import {
  type ContractFeePaymentQueueItem,
  type ContractFeePaymentStatus,
  CONTRACT_FEE_PAYMENT_STATUS,
} from '@elmasaif/shared';
import {
  formatLockCountdown,
  CONTRACT_FEE_STATUS_CONFIG,
} from './contract-fees-helpers';

export interface AdminContractFeesPageProps {
  initialItems?: ContractFeePaymentQueueItem[];
  initialTotal?: number;
  initialLoading?: boolean;
}

export default function AdminContractFeesPage(props?: AdminContractFeesPageProps) {
  const { initialItems, initialTotal, initialLoading = false } = props || {};
  const router = useRouter();

  const [items, setItems] = useState<ContractFeePaymentQueueItem[]>(initialItems || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [loading, setLoading] = useState(initialLoading);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      params.append('page', String(page));
      params.append('limit', '20');

      const res = await apiClient<{
        items: ContractFeePaymentQueueItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/contract-fees?${params.toString()}`);

      if (res) {
        setItems(res.items || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل طابور إشعارات رسوم العقود');
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
      await apiClient(`/admin/contract-fees/${id}/claim`, { method: 'POST' });
      router.push(`/admin/contract-fees/${id}`);
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في حجز قفل المعاينة');
      fetchQueue();
    } finally {
      setClaimingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQueue();
  };

  const totalPages = Math.ceil(total / 20) || 1;

  const tabs: Array<{ id: string; label: string; countBadge?: number }> = [
    { id: 'ALL', label: 'جميع الإشعارات' },
    { id: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED, label: 'بانتظار التدقيق' },
    { id: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW, label: 'قيد التدقيق' },
    { id: CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED, label: 'مؤكد ومعتمد' },
    { id: CONTRACT_FEE_PAYMENT_STATUS.REJECTED, label: 'مرفوض' },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-700" />
              <span>طابور تدقيق رسوم العقود والنشر الآلي</span>
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              {total} إشعار
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            مراجعة وتدقيق إشعارات التحويل البنكي لرسوم عقود التسويق (1,000 ريال) وتفعيل العقد ونشر الإعلان آلياً بالسوق العام.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/owner-requests">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <FileText className="w-4 h-4" />
              <span>طلبات الملاك</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQueue()}
            disabled={loading}
            className="gap-2 text-xs"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {errorBanner && (
        <div
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorBanner(null)}
            className="text-xs h-7 px-2 hover:bg-destructive/20"
          >
            إغلاق
          </Button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setStatusFilter(tab.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-emerald-800 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search form */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="ابحث بالعنوان، المالك، الجوال، مرجع الحوالة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <Button type="submit" size="sm" className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white">
                بحث
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Main Queue Table */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse" data-testid="contract-fees-table">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
                <th className="py-3 px-4">العقار</th>
                <th className="py-3 px-4">المالك</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">بيانات التحويل</th>
                <th className="py-3 px-4">تاريخ الرفع</th>
                <th className="py-3 px-4">حالة الإشعار</th>
                <th className="py-3 px-4">حالة القفل (15 دقيقة)</th>
                <th className="py-3 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                    <span>جاري تحميل طابور إشعارات رسوم العقود...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">لا توجد إشعارات سداد مطابقة للبحث أو الفلتر</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ستظهر هنا إشعارات التحويل البنكي المرفوعة من قبل ملاك العقارات فور تقديمها
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const statusCfg = CONTRACT_FEE_STATUS_CONFIG[item.status] || {
                    label: item.status,
                    bg: 'bg-muted',
                    text: 'text-muted-foreground',
                    border: 'border-border',
                  };

                  const lock = item.lockInfo;
                  const isUnderMyLease = lock.isLocked && lock.isLockedByCurrentAdmin;
                  const isLockedByOther = lock.isLocked && !lock.isLockedByCurrentAdmin;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors group"
                      data-testid={`fee-row-${item.id}`}
                    >
                      {/* Property title */}
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px]" title={item.propertyTitle}>
                            {item.propertyTitle}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-normal">
                            عقد #{item.ownerContractId.slice(0, 8)}
                          </span>
                        </div>
                      </td>

                      {/* Owner details */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{item.ownerLegalName}</span>
                          <span className="text-[11px] text-muted-foreground font-mono dir-ltr text-right">
                            {item.maskedMobileNumber}
                          </span>
                        </div>
                      </td>

                      {/* Fee Amount */}
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {item.amount.toLocaleString()} ر.س
                      </td>

                      {/* Transfer metadata */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-[11px]">
                          <span className="font-mono text-slate-800 font-bold" dir="ltr">
                            {item.bankReferenceCode || '—'}
                          </span>
                          <span className="text-muted-foreground">{item.senderBankName || '—'}</span>
                        </div>
                      </td>

                      {/* Upload date */}
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                        {item.uploadedAt
                          ? new Date(item.uploadedAt).toLocaleDateString('ar-SA')
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Lock status */}
                      <td className="py-3.5 px-4">
                        {isUnderMyLease ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
                            <Lock className="w-3 h-3 text-emerald-700" />
                            <span>محجوز لك ({formatLockCountdown(lock.remainingSeconds)})</span>
                          </div>
                        ) : isLockedByOther ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 text-[11px] font-medium border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" />
                            <span className="truncate max-w-[120px]" title={lock.lockedByAdminName || ''}>
                              {lock.lockedByAdminName || 'مشرف آخر'} ({formatLockCountdown(lock.remainingSeconds)})
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <Unlock className="w-3 h-3 text-slate-400" />
                            <span>متاح للمعاينة</span>
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!lock.isLocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleClaim(item.id, e)}
                              disabled={claimingId === item.id}
                              className="text-xs h-7 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-bold gap-1"
                              data-testid={`claim-btn-${item.id}`}
                            >
                              <Lock className="w-3 h-3" />
                              <span>حجز ومراجعة</span>
                            </Button>
                          ) : (
                            <Link href={`/admin/contract-fees/${item.id}`}>
                              <Button
                                size="sm"
                                variant={isUnderMyLease ? 'default' : 'ghost'}
                                className={`text-xs h-7 px-2.5 gap-1 ${
                                  isUnderMyLease
                                    ? 'bg-emerald-800 hover:bg-emerald-900 text-white font-bold'
                                    : 'text-muted-foreground'
                                }`}
                                data-testid={`view-dossier-btn-${item.id}`}
                              >
                                <Eye className="w-3 h-3" />
                                <span>{isUnderMyLease ? 'متابعة التدقيق' : 'معاينة'}</span>
                              </Button>
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

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
            <span>
              عرض الصفحة {page} من أصل {totalPages} ({total} إشعار إجمالي)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 px-3 text-xs gap-1"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 px-3 text-xs gap-1"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

