'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AuditLogListItemDto,
  AuditLogDetailDto,
  PaginatedAuditLogsDto,
  AUDIT_ACTOR_TYPE,
  AUDIT_ACTION_LABELS_AR,
  AUDIT_ACTION_CATEGORY_MAP,
  AUDIT_CATEGORY_STYLES,
} from '@elmasaif/shared';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Lock,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';
import { AuditLogDetailModal } from './audit-log-detail-modal';

export const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'جميع الكيانات (All Entities)' },
  { value: 'Deal', label: 'صفقة (Deal)' },
  { value: 'Listing', label: 'عقار (Listing)' },
  { value: 'User', label: 'مستخدم (User)' },
  { value: 'PayoutAccount', label: 'حساب بنكي / آيبان (PayoutAccount)' },
  { value: 'PaymentProof', label: 'إشعار تحويل (PaymentProof)' },
  { value: 'ContractFee', label: 'رسوم عقد (ContractFee)' },
  { value: 'FalLicense', label: 'رخصة فال (FalLicense)' },
  { value: 'SupportTicket', label: 'تذكرة دعم (SupportTicket)' },
  { value: 'ViolationReport', label: 'بلاغ مخالفة (ViolationReport)' },
  { value: 'PlatformSetting', label: 'إعدادات المنصة (PlatformSetting)' },
  { value: 'TaskClaimLock', label: 'قفل مهمة (TaskClaimLock)' },
];

export const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'جميع المنفذين (All Actors)' },
  { value: AUDIT_ACTOR_TYPE.ADMIN, label: 'مشرف (Admin)' },
  { value: AUDIT_ACTOR_TYPE.USER, label: 'مستخدم (User)' },
  { value: AUDIT_ACTOR_TYPE.SYSTEM, label: 'النظام (System)' },
];

export interface AuditLogWorkspaceProps {
  initialData?: PaginatedAuditLogsDto | null;
}

export function AuditLogWorkspace({ initialData = null }: AuditLogWorkspaceProps) {
  const [logsData, setLogsData] = useState<PaginatedAuditLogsDto | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorType, setActorType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Detail Modal state
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<AuditLogDetailDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (searchTerm.trim()) queryParams.set('search', searchTerm.trim());
      if (entityType) queryParams.set('entityType', entityType);
      if (actorType) queryParams.set('actorType', actorType);
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);

      const res = await apiClient<{ data: PaginatedAuditLogsDto }>(
        `/admin/audit?${queryParams.toString()}`,
      );
      setLogsData(res.data);
    } catch (err: any) {
      setError(describeApiError(err).message || 'تعذر تحميل سجلات التدقيق الرقابي');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchTerm, entityType, actorType, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setEntityType('');
    setActorType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleOpenDetail = async (id: string) => {
    setSelectedLogId(id);
    setIsModalOpen(true);
    setIsDetailLoading(true);
    try {
      const res = await apiClient<{ data: AuditLogDetailDto }>(
        `/admin/audit/${id}`,
      );
      setDetailLog(res.data);
    } catch (err: any) {
      setError(describeApiError(err).message || 'تعذر استرجاع تفاصيل السجل');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setIsModalOpen(false);
    setSelectedLogId(null);
    setDetailLog(null);
  };

  const formatSaudiDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('ar-SA', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#1B4332]/10 dark:bg-emerald-950/40 text-[#1B4332] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                سجل التدقيق والرقابة (Audit Log)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <Lock className="w-3.5 h-3.5" />
                <span>سجل غير قابل للتعديل (Append-Only)</span>
              </span>
            </div>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1">
              سجل رقابي غير قابل للتعديل يوثق جميع العمليات الإدارية والتحولات الحساسة في النظام (REGA / PDPL / ZATCA)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-semibold hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-center gap-3 text-rose-800 dark:text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>فلاتر البحث والاستعلام المتقدم</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة تعيين الفلاتر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="بحث في الإجراء، المنفذ، أو المبرر..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Entity Type Select */}
          <div>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Type Select */}
          <div>
            <select
              value={actorType}
              onChange={(e) => {
                setActorType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ACTOR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              title="من تاريخ"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40 text-ink-secondary dark:text-dark-ink-secondary font-bold">
                <th className="py-3 px-4 text-start">التاريخ والوقت</th>
                <th className="py-3 px-4 text-start">نوع الإجراء / الحدث</th>
                <th className="py-3 px-4 text-start">الكيان</th>
                <th className="py-3 px-4 text-start">المنفذ (Actor)</th>
                <th className="py-3 px-4 text-start">عنوان IP</th>
                <th className="py-3 px-4 text-start">المبرر / سبب الإجراء</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <span>جاري تحميل سجلات التدقيق...</span>
                    </div>
                  </td>
                </tr>
              ) : !logsData?.items || logsData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ScrollText className="w-8 h-8 text-ink-muted/50" />
                      <p className="font-semibold">لا توجد سجلات تدقيق تطابق معايير البحث الحالية.</p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        إعادة تعيين الفلاتر
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                logsData.items.map((log) => {
                  const cat = AUDIT_ACTION_CATEGORY_MAP[log.action] || 'system';
                  const catStyle = AUDIT_CATEGORY_STYLES[cat];
                  const actionAr = AUDIT_ACTION_LABELS_AR[log.action] || log.action;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-ink-secondary dark:text-dark-ink-secondary">
                        {formatSaudiDate(log.createdAt)}
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catStyle.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dotClass}`} />
                          <span>{actionAr}</span>
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                            {log.entityType}
                          </span>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {log.entityId}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                              {log.actorName}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {log.actorType}
                            </span>
                          </div>
                          <span className="text-[10px] text-ink-muted">
                            {log.actorRole}
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-secondary dark:text-dark-ink-secondary whitespace-nowrap">
                        {log.ipAddress || '—'}
                      </td>

                      {/* Justification Reason Preview */}
                      <td className="py-3 px-4 max-w-xs truncate text-ink-secondary dark:text-dark-ink-secondary">
                        {log.justificationReason || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(log.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-semibold hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
                          title="عرض تفاصيل السجل واللقطات السابقة/اللاحقة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض التفاصيل</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {logsData && logsData.total > 0 && (
          <div className="px-6 py-4 border-t border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>
              <span>
                إجمالي السجلات: <strong className="font-mono">{logsData.total}</strong> • الصفحة{' '}
                <strong className="font-mono">{logsData.page}</strong> من{' '}
                <strong className="font-mono">{logsData.totalPages}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border font-semibold hover:bg-surface-sunken dark:hover:bg-dark-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(logsData.totalPages, p + 1))}
                disabled={page >= logsData.totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border font-semibold hover:bg-surface-sunken dark:hover:bg-dark-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface font-mono"
              >
                <option value={10}>10 / صفحة</option>
                <option value={20}>20 / صفحة</option>
                <option value={50}>50 / صفحة</option>
                <option value={100}>100 / صفحة</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      <AuditLogDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseDetail}
        log={detailLog}
        isLoading={isDetailLoading}
      />
    </div>
  );
}

