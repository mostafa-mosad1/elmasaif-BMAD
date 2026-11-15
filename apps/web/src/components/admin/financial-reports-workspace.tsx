'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FinancialIndicatorsDto,
  PaginatedFinancialTransactionsDto,
  FinancialTransactionRowDto,
  PropertyType,
  SAUDI_VAT_RATE,
} from '@elmasaif/shared';
import {
  DollarSign,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Receipt,
  Scale,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { apiClient, describeApiError, getApiBaseUrl } from '../../lib/api-client';

export const PROPERTY_TYPE_LABELS_AR: Record<PropertyType, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.FLOOR]: 'دور',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.FARM]: 'مزرعة',
  [PropertyType.CHALET]: 'شاليه',
  [PropertyType.REST_HOUSE]: 'استراحة',
  [PropertyType.COMMERCIAL_SHOP]: 'محل تجاري',
  [PropertyType.OFFICE]: 'مكتب',
  [PropertyType.WAREHOUSE]: 'مستودع',
};

export interface FinancialReportsWorkspaceProps {
  initialIndicators?: FinancialIndicatorsDto | null;
  initialTransactions?: PaginatedFinancialTransactionsDto | null;
}

export function FinancialReportsWorkspace({
  initialIndicators = null,
  initialTransactions = null,
}: FinancialReportsWorkspaceProps) {
  const [indicators, setIndicators] = useState<FinancialIndicatorsDto | null>(initialIndicators);
  const [transactionsData, setTransactionsData] =
    useState<PaginatedFinancialTransactionsDto | null>(initialTransactions);
  const [isLoading, setIsLoading] = useState(!initialIndicators || !initialTransactions);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) {
      params.set('startDate', new Date(startDate).toISOString());
    }
    if (endDate) {
      // End of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      params.set('endDate', end.toISOString());
    }
    if (propertyType) {
      params.set('propertyType', propertyType);
    }
    return params;
  }, [startDate, endDate, propertyType]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseParams = buildQueryParams();

      // Fetch indicators
      const indRes: any = await apiClient.get(
        `/admin/finance/indicators?${baseParams.toString()}`,
      );
      setIndicators(indRes?.data || indRes);

      // Fetch transactions
      const txParams = new URLSearchParams(baseParams);
      txParams.set('page', page.toString());
      txParams.set('limit', limit.toString());

      const txRes: any = await apiClient.get(
        `/admin/finance/transactions?${txParams.toString()}`,
      );
      setTransactionsData(txRes?.data || txRes);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل المؤشرات والتقارير المالية');
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryParams, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const params = buildQueryParams();
      const baseUrl = getApiBaseUrl();
      const exportUrl = `${baseUrl}/admin/finance/export?${params.toString()}`;

      const res = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/csv',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('فشل تصدير التقرير المالي. يرجى التأكد من الصلاحيات.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elmasaif-financial-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل ملف CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-border dark:border-dark-surface-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-primary dark:text-emerald-400" />
            المؤشرات المالية وتقارير العمليات المحاسبية
          </h1>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            متابعة إجمالي حجم التداولات، العمولات المحصلة، رسوم العقود، وضريبة القيمة المضافة (15% VAT) مع تصدير Excel مطابق للمعايير السعودية.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span>تصدير تقرير محاسبي (Excel / CSV)</span>
          </button>
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-surface dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1">
              من تاريخ (Start Date)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1">
              إلى تاريخ (End Date)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1">
              نوع العقار (Property Type)
            </label>
            <select
              value={propertyType}
              onChange={(e) => {
                setPropertyType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            >
              <option value="">كافة الأنواع (All Types)</option>
              {Object.values(PropertyType).map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS_AR[t] || t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPropertyType('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-sm rounded-xl transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Transactions */}
        <div className="p-5 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs">
          <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary mb-2">
            <span className="text-xs font-semibold">إجمالي حجم المبيعات</span>
            <DollarSign className="w-5 h-5 text-primary dark:text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary font-mono">
            {indicators
              ? indicators.grossTransactionVolumeSar.toLocaleString('ar-SA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}{' '}
            <span className="text-xs font-normal text-ink-secondary dark:text-dark-ink-secondary">ر.س</span>
          </p>
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
            {indicators?.completedDealsCount || 0} صفقات بيع مكتملة
          </p>
        </div>

        {/* Commissions */}
        <div className="p-5 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs">
          <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary mb-2">
            <span className="text-xs font-semibold">عمولات السعي المعتمدة</span>
            <TrendingUp className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary font-mono">
            {indicators
              ? indicators.confirmedCommissionsSar.toLocaleString('ar-SA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}{' '}
            <span className="text-xs font-normal text-ink-secondary dark:text-dark-ink-secondary">ر.س</span>
          </p>
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
            نسبة السعي القانونية 2.5%
          </p>
        </div>

        {/* Contract Fees */}
        <div className="p-5 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs">
          <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary mb-2">
            <span className="text-xs font-semibold">رسوم العقود المحصلة</span>
            <Receipt className="w-5 h-5 text-primary dark:text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary font-mono">
            {indicators
              ? indicators.collectedContractFeesSar.toLocaleString('ar-SA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}{' '}
            <span className="text-xs font-normal text-ink-secondary dark:text-dark-ink-secondary">ر.س</span>
          </p>
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
            {indicators?.signedContractsCount || 0} عقود وساطة مدفوعة
          </p>
        </div>

        {/* 15% VAT */}
        <div className="p-5 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs">
          <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary mb-2">
            <span className="text-xs font-semibold">ضريبة القيمة المضافة (15%)</span>
            <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {indicators
              ? indicators.totalVatSar.toLocaleString('ar-SA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}{' '}
            <span className="text-xs font-normal text-ink-secondary dark:text-dark-ink-secondary">ر.س</span>
          </p>
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
            مستحقة لهيئة الزكاة والضريبة والجمارك (ZATCA)
          </p>
        </div>

        {/* Net Revenue */}
        <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-2">
            <span className="text-xs font-bold">صافي إيرادات المنصة</span>
            <ShieldCheck className="w-5 h-5 text-primary dark:text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-primary dark:text-emerald-300 font-mono">
            {indicators
              ? indicators.totalNetRevenueSar.toLocaleString('ar-SA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}{' '}
            <span className="text-xs font-normal text-primary dark:text-emerald-400">ر.س</span>
          </p>
          <p className="text-[11px] text-primary/80 dark:text-emerald-400 mt-1">
            الإيراد الإجمالي شامل ضريبة القيمة المضافة
          </p>
        </div>
      </div>

      {/* Transaction Records Table */}
      <div className="bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-ink-secondary dark:text-dark-ink-secondary" />
            <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              سجل الحركات المالية والمحاسبية التفصيلي
            </h2>
          </div>
          <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-mono">
            {transactionsData?.total || 0} حركة مسجلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/70 text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="px-4 py-3 font-semibold">المرجع</th>
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="px-4 py-3 font-semibold">العقار / المدينة</th>
                <th className="px-4 py-3 font-semibold">الطرف المقابل</th>
                <th className="px-4 py-3 font-semibold">قيمة الصفقة</th>
                <th className="px-4 py-3 font-semibold">الرسوم الأساسية</th>
                <th className="px-4 py-3 font-semibold">ضريبة VAT (15%)</th>
                <th className="px-4 py-3 font-semibold">الإجمالي</th>
                <th className="px-4 py-3 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border font-mono text-xs">
              {isLoading && !transactionsData ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-ink-secondary dark:text-dark-ink-secondary">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary dark:text-emerald-400" />
                    <span>جارٍ تحميل العمليات المالية...</span>
                  </td>
                </tr>
              ) : !transactionsData || transactionsData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-ink-secondary dark:text-dark-ink-secondary">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-ink-muted dark:text-dark-ink-muted" />
                    <p className="font-medium">لا توجد حركات مالية مسجلة خلال الفترة المحددة</p>
                  </td>
                </tr>
              ) : (
                transactionsData.items.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40 transition-colors font-sans"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-ink-primary dark:text-dark-ink-primary">
                      {row.referenceCode}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.type === 'DEAL_COMMISSION'
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-emerald-50 text-primary dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {row.type === 'DEAL_COMMISSION' ? 'عمولة سعي' : 'رسوم عقد منصة'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-primary dark:text-dark-ink-primary truncate max-w-[180px]">
                          {row.propertyTitle}
                        </span>
                        <span className="text-xs text-ink-muted dark:text-dark-ink-muted">{row.city}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-primary dark:text-dark-ink-primary">{row.counterpartyName}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary dark:text-dark-ink-primary">
                      {row.grossValueSar.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-primary dark:text-dark-ink-primary">
                      {row.feeSar.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400">
                      {row.vatSar.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-primary dark:text-emerald-400">
                      {row.totalSar.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="px-4 py-3 text-ink-secondary dark:text-dark-ink-secondary text-xs">
                      {new Date(row.date).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {transactionsData && transactionsData.total > 0 && (
          <div className="p-4 border-t border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>
              عرض{' '}
              {Math.min(
                (transactionsData.page - 1) * transactionsData.limit + 1,
                transactionsData.total,
              )}{' '}
              - {Math.min(transactionsData.page * transactionsData.limit, transactionsData.total)} من
              إجمالي {transactionsData.total} حركة
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={transactionsData.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-surface-border dark:border-dark-surface-border rounded-xl disabled:opacity-40 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-ink-primary dark:text-dark-ink-primary">
                صفحة {transactionsData.page} من {transactionsData.totalPages}
              </span>
              <button
                disabled={transactionsData.page >= transactionsData.totalPages}
                onClick={() => setPage((p) => Math.min(transactionsData.totalPages, p + 1))}
                className="p-1.5 border border-surface-border dark:border-dark-surface-border rounded-xl disabled:opacity-40 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

