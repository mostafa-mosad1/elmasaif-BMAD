'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FraudStatus,
  FraudSeverity,
  FraudEventType,
  NoteEntityType,
  FRAUD_STATUS_LABELS_AR,
  FRAUD_SEVERITY_LABELS_AR,
  FRAUD_EVENT_TYPE_LABELS_AR,
  FraudLogDto,
  PaginatedFraudLogsDto,
} from '@elmasaif/shared';
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  FileText,
  Building2,
  User,
  X,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';
import { OperationalInternalNotesCard } from './operational-internal-notes-card';

export interface FraudManagementWorkspaceProps {
  initialData?: PaginatedFraudLogsDto | null;
}

export function FraudManagementWorkspace({ initialData = null }: FraudManagementWorkspaceProps) {
  const [data, setData] = useState<PaginatedFraudLogsDto | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<FraudLogDto | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Form State for Create
  const [newTargetUserId, setNewTargetUserId] = useState('');
  const [newTargetListingId, setNewTargetListingId] = useState('');
  const [newTargetDealId, setNewTargetDealId] = useState('');
  const [newEventType, setNewEventType] = useState<FraudEventType>(
    FraudEventType.REPEATED_REJECTED_PROOFS,
  );
  const [newSeverity, setNewSeverity] = useState<FraudSeverity>(FraudSeverity.HIGH);
  const [newDescription, setNewDescription] = useState('');
  const [newReasons, setNewReasons] = useState('');
  const [newPenaltyAmount, setNewPenaltyAmount] = useState('');
  const [newSuspendMarketer, setNewSuspendMarketer] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State for Resolve
  const [resolveStatus, setResolveStatus] = useState<FraudStatus.RESOLVED | FraudStatus.DISMISSED>(
    FraudStatus.RESOLVED,
  );
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (eventTypeFilter) params.set('eventType', eventTypeFilter);
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const res: any = await apiClient.get(`/admin/fraud?${params.toString()}`);
      setData(res?.data || res);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل سجلات مكافحة الاحتيال');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, severityFilter, eventTypeFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetUserId.trim() || !newDescription.trim()) {
      setCreateError('يرجى تعبئة الحقول الإلزامية: معرف المستخدم ووصف الحالة.');
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);

    try {
      const reasonsList = newReasons
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const payload = {
        targetUserId: newTargetUserId.trim(),
        targetListingId: newTargetListingId.trim() || undefined,
        targetDealId: newTargetDealId.trim() || undefined,
        eventType: newEventType,
        severity: newSeverity,
        description: newDescription.trim(),
        reasons: reasonsList.length > 0 ? reasonsList : undefined,
        penaltyAmountSar: newPenaltyAmount ? parseFloat(newPenaltyAmount) : undefined,
        suspendMarketer: newSuspendMarketer,
      };

      await apiClient.post('/admin/fraud', payload);
      setSuccessMessage('تم تسجيل حالة الاشتباه بنجاح');
      setIsCreateModalOpen(false);
      resetCreateForm();
      fetchData();
    } catch (err) {
      const parsed = describeApiError(err);
      setCreateError(parsed.message || 'حدث خطأ أثناء تسجيل حالة الاشتباه');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const resetCreateForm = () => {
    setNewTargetUserId('');
    setNewTargetListingId('');
    setNewTargetDealId('');
    setNewEventType(FraudEventType.REPEATED_REJECTED_PROOFS);
    setNewSeverity(FraudSeverity.HIGH);
    setNewDescription('');
    setNewReasons('');
    setNewPenaltyAmount('');
    setNewSuspendMarketer(false);
    setCreateError(null);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resolutionNotes.trim()) {
      setResolveError('يرجى كتابة ملاحظات المعالجة وتفاصيل القرار.');
      return;
    }

    setIsSubmittingResolve(true);
    setResolveError(null);

    try {
      await apiClient.patch(`/admin/fraud/${selectedCase.id}/resolve`, {
        status: resolveStatus,
        resolutionNotes: resolutionNotes.trim(),
      });

      setSuccessMessage('تمت معالجة حالة الاشتباه بنجاح');
      setIsResolveModalOpen(false);
      setSelectedCase(null);
      setResolutionNotes('');
      fetchData();
    } catch (err) {
      const parsed = describeApiError(err);
      setResolveError(parsed.message || 'فشلت معالجة حالة الاشتباه');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const getSeverityBadgeClass = (severity: FraudSeverity) => {
    switch (severity) {
      case FraudSeverity.CRITICAL:
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
      case FraudSeverity.HIGH:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      case FraudSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800';
      case FraudSeverity.LOW:
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
    }
  };

  const getStatusBadgeClass = (status: FraudStatus) => {
    switch (status) {
      case FraudStatus.OPEN:
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200';
      case FraudStatus.INVESTIGATING:
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-200';
      case FraudStatus.RESOLVED:
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200';
      case FraudStatus.DISMISSED:
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-border dark:border-dark-surface-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-600 dark:text-rose-400" />
            سجل إدارة مكافحة الاحتيال والأنشطة المشبوهة
          </h1>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            مراقبة الحالات المشبوهة، معالجة التلاعب بالدفعات، وتعليق حسابات المخالفين وفق اشتراطات الهيئة العامة للعقار.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            <span>تسجيل حالة اشتباه</span>
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

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-4 bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-3 right-3 text-ink-secondary dark:text-dark-ink-secondary" />
            <input
              type="text"
              placeholder="بحث برقم الحالة، المعرف، أو التفاصيل..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pr-9 pl-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
            >
              <option value="">جميع الحالات (All Statuses)</option>
              {Object.values(FraudStatus).map((st) => (
                <option key={st} value={st}>
                  {FRAUD_STATUS_LABELS_AR[st]}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
            >
              <option value="">جميع درجات الخطورة (All Severities)</option>
              {Object.values(FraudSeverity).map((sev) => (
                <option key={sev} value={sev}>
                  {FRAUD_SEVERITY_LABELS_AR[sev]}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
            >
              <option value="">جميع أنواع الأنشطة (All Events)</option>
              {Object.values(FraudEventType).map((ev) => (
                <option key={ev} value={ev}>
                  {FRAUD_EVENT_TYPE_LABELS_AR[ev]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Fraud Logs Table */}
      <div className="bg-surface dark:bg-dark-surface-base rounded-xl border border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/70 text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
              <tr>
                <th className="px-4 py-3 font-semibold">رقم الحالة</th>
                <th className="px-4 py-3 font-semibold">نوع النشاط</th>
                <th className="px-4 py-3 font-semibold">الخطورة</th>
                <th className="px-4 py-3 font-semibold">الحالة</th>
                <th className="px-4 py-3 font-semibold">المستخدم المشتبه به</th>
                <th className="px-4 py-3 font-semibold">تاريخ التسجيل</th>
                <th className="px-4 py-3 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {isLoading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-secondary dark:text-dark-ink-secondary">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                    <span>جارٍ تحميل سجلات مكافحة الاحتيال...</span>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-secondary dark:text-dark-ink-secondary">
                    <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-ink-muted dark:text-dark-ink-muted" />
                    <p className="font-medium">لا توجد حالات احتيال مسجلة مطابقة للفلاتر</p>
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-rose-600 dark:text-rose-400">
                      {item.caseNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink-primary dark:text-dark-ink-primary">
                        {FRAUD_EVENT_TYPE_LABELS_AR[item.eventType] || item.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getSeverityBadgeClass(
                          item.severity,
                        )}`}
                      >
                        {FRAUD_SEVERITY_LABELS_AR[item.severity]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                          item.status,
                        )}`}
                      >
                        {FRAUD_STATUS_LABELS_AR[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-primary dark:text-dark-ink-primary">
                          {item.targetUser
                            ? `${item.targetUser.firstName} ${item.targetUser.lastName}`
                            : 'مستخدم محدد بالمعرف'}
                        </span>
                        <span className="text-xs text-ink-muted dark:text-dark-ink-muted font-mono">
                          {item.targetUserId.substring(0, 12)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary dark:text-dark-ink-secondary text-xs">
                      {new Date(item.createdAt).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCase(item);
                            setIsResolveModalOpen(false);
                          }}
                          className="p-1.5 text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken rounded-lg transition-colors"
                          title="عرض تفاصيل الحالة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(item.status === FraudStatus.OPEN ||
                          item.status === FraudStatus.INVESTIGATING) && (
                          <button
                            onClick={() => {
                              setSelectedCase(item);
                              setResolveStatus(FraudStatus.RESOLVED);
                              setResolutionNotes('');
                              setIsResolveModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg font-medium transition-colors"
                          >
                            معالجة
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.totalCount > 0 && (
          <div className="p-4 border-t border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>
              عرض {Math.min((data.page - 1) * data.limit + 1, data.totalCount)} -{' '}
              {Math.min(data.page * data.limit, data.totalCount)} من إجمالي {data.totalCount} حالة
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-surface-border dark:border-dark-surface-border rounded-xl disabled:opacity-40 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-medium text-ink-primary dark:text-dark-ink-primary">
                صفحة {data.page} من {data.totalPages}
              </span>
              <button
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="p-1.5 border border-surface-border dark:border-dark-surface-border rounded-xl disabled:opacity-40 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Case Details Drawer/Modal */}
      {selectedCase && !isResolveModalOpen && (
        <div
          onClick={() => setSelectedCase(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="p-5 bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                  تفاصيل الحالة: {selectedCase.caseNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 text-ink-muted hover:text-ink-primary dark:text-dark-ink-muted dark:hover:text-dark-ink-primary rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">نوع النشاط المشبوه</label>
                  <p className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                    {FRAUD_EVENT_TYPE_LABELS_AR[selectedCase.eventType]}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">درجة الخطورة</label>
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getSeverityBadgeClass(
                        selectedCase.severity,
                      )}`}
                    >
                      {FRAUD_SEVERITY_LABELS_AR[selectedCase.severity]}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">حالة الملف</label>
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                        selectedCase.status,
                      )}`}
                    >
                      {FRAUD_STATUS_LABELS_AR[selectedCase.status]}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">تاريخ التسجيل</label>
                  <p className="text-xs text-ink-primary dark:text-dark-ink-primary">
                    {new Date(selectedCase.createdAt).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>

              <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
                <label className="text-xs text-ink-muted dark:text-dark-ink-muted">المستخدم المشتبه به</label>
                <p className="font-medium text-ink-primary dark:text-dark-ink-primary">
                  {selectedCase.targetUser
                    ? `${selectedCase.targetUser.firstName} ${selectedCase.targetUser.lastName} (${selectedCase.targetUser.email})`
                    : selectedCase.targetUserId}
                </p>
                {selectedCase.targetUser?.phone && (
                  <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">{selectedCase.targetUser.phone}</p>
                )}
              </div>

              {(selectedCase.targetListingId || selectedCase.targetDealId) && (
                <div className="grid grid-cols-2 gap-4 border-t border-surface-border dark:border-dark-surface-border pt-4">
                  {selectedCase.targetListingId && (
                    <div>
                      <label className="text-xs text-ink-muted dark:text-dark-ink-muted">العقار المستهدف</label>
                      <p className="font-mono text-xs text-ink-primary dark:text-dark-ink-primary">
                        {selectedCase.targetListingId}
                      </p>
                    </div>
                  )}
                  {selectedCase.targetDealId && (
                    <div>
                      <label className="text-xs text-ink-muted dark:text-dark-ink-muted">الصفقة المرتبطة</label>
                      <p className="font-mono text-xs text-ink-primary dark:text-dark-ink-primary">
                        {selectedCase.targetDealId}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
                <label className="text-xs text-ink-muted dark:text-dark-ink-muted">الوصف وتفاصيل الاشتباه</label>
                <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1 whitespace-pre-wrap bg-surface-sunken dark:bg-dark-surface-sunken p-3 rounded-xl border border-surface-border dark:border-dark-surface-border">
                  {selectedCase.description}
                </p>
              </div>

              {selectedCase.reasons && selectedCase.reasons.length > 0 && (
                <div>
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">الأسباب والأدلة</label>
                  <ul className="list-disc list-inside text-sm text-ink-secondary dark:text-dark-ink-secondary space-y-1 mt-1">
                    {selectedCase.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCase.penaltyAmountSar && (
                <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">الغرامة المالية المقررة</label>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                    {selectedCase.penaltyAmountSar.toLocaleString('ar-SA')} ر.س
                  </p>
                </div>
              )}

              {selectedCase.marketerSuspended && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <UserX className="w-5 h-5 text-rose-600" />
                  <span>تم تعليق حساب المسوق فورياً ووضع عقاراته تحت المراجعة الرقابية.</span>
                </div>
              )}

              {selectedCase.resolutionNotes && (
                <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
                  <label className="text-xs text-ink-muted dark:text-dark-ink-muted">ملاحظات وقرار المعالجة</label>
                  <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1 whitespace-pre-wrap bg-surface-sunken dark:bg-dark-surface-sunken p-3 rounded-xl border border-surface-border dark:border-dark-surface-border">
                    {selectedCase.resolutionNotes}
                  </p>
                  {selectedCase.resolvedAt && (
                    <p className="text-xs text-ink-muted dark:text-dark-ink-muted mt-1">
                      تمت المعالجة في: {new Date(selectedCase.resolvedAt).toLocaleString('ar-SA')}
                    </p>
                  )}
                </div>
              )}

              {/* Internal Staff Notes for this fraud case */}
              <div className="border-t border-surface-border dark:border-dark-surface-border pt-4">
                <OperationalInternalNotesCard
                  entityType={NoteEntityType.FRAUD_CASE}
                  entityId={selectedCase.id}
                  title="ملاحظات التحقيق الداخلي (Internal Staff Notes)"
                />
              </div>
            </div>

            <div className="p-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 flex items-center justify-between">
              {(selectedCase.status === FraudStatus.OPEN ||
                selectedCase.status === FraudStatus.INVESTIGATING) && (
                <button
                  onClick={() => setIsResolveModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition-colors"
                >
                  معالجة أو إغلاق الملف
                </button>
              )}
              <button
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary font-medium text-sm rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors ml-auto"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve / Adjudicate Action Modal */}
      {selectedCase && isResolveModalOpen && (
        <div
          onClick={() => setIsResolveModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="p-5 bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                معالجة الحالة: {selectedCase.caseNumber}
              </h2>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="p-1.5 text-ink-muted hover:text-ink-primary dark:text-dark-ink-muted dark:hover:text-dark-ink-primary rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 overflow-y-auto">
              {resolveError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60">
                  {resolveError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-2">
                  القرار النهائي
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                      resolveStatus === FraudStatus.RESOLVED
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-semibold'
                        : 'border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolveStatus"
                      value={FraudStatus.RESOLVED}
                      checked={resolveStatus === FraudStatus.RESOLVED}
                      onChange={() => setResolveStatus(FraudStatus.RESOLVED)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>إثبات ومعالجة (RESOLVED)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                      resolveStatus === FraudStatus.DISMISSED
                        ? 'border-slate-500 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-300 font-semibold'
                        : 'border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolveStatus"
                      value={FraudStatus.DISMISSED}
                      checked={resolveStatus === FraudStatus.DISMISSED}
                      onChange={() => setResolveStatus(FraudStatus.DISMISSED)}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span>حفظ لعدم الثبوت (DISMISSED)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                  ملاحظات المعالجة وتفاصيل القرار <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="اكتب أسباب القرار والتدابير المتخذة بالتفصيل..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full p-3 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmittingResolve && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>تأكيد القرار وإغلاق الحالة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Case Modal */}
      {isCreateModalOpen && (
        <div
          onClick={() => setIsCreateModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="p-5 bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                  تسجيل حالة اشتباه أو احتيال جديدة
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-ink-muted hover:text-ink-primary dark:text-dark-ink-muted dark:hover:text-dark-ink-primary rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto">
              {createError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                  معرف المستخدم المستهدف (User ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="UUID الخاص بالمستخدم المشتبه به"
                  value={newTargetUserId}
                  onChange={(e) => setNewTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                    معرف العقار (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="Listing ID"
                    value={newTargetListingId}
                    onChange={(e) => setNewTargetListingId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                    معرف الصفقة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="Deal ID"
                    value={newTargetDealId}
                    onChange={(e) => setNewTargetDealId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                    نوع النشاط المشبوه <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as FraudEventType)}
                    className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                  >
                    {Object.values(FraudEventType).map((ev) => (
                      <option key={ev} value={ev}>
                        {FRAUD_EVENT_TYPE_LABELS_AR[ev]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                    درجة الخطورة <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as FraudSeverity)}
                    className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                  >
                    {Object.values(FraudSeverity).map((sev) => (
                      <option key={sev} value={sev}>
                        {FRAUD_SEVERITY_LABELS_AR[sev]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                  وصف الواقعة وتفاصيل الاشتباه <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="وصف تفصيلي للنشاط أو الشبهة المرصودة..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-3 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                  أسباب وأدلة الرصد (سطر لكل سبب)
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: مطابقة رقم الحساب مع قائمة سوداء&#10;تكرار رفع إيصال بنكي مزور"
                  value={newReasons}
                  onChange={(e) => setNewReasons(e.target.value)}
                  className="w-full p-2.5 text-xs bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1">
                  الغرامة المالية المقررة (ر.س - اختياري)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newPenaltyAmount}
                  onChange={(e) => setNewPenaltyAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="p-3 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSuspendMarketer}
                    onChange={(e) => setNewSuspendMarketer(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded-sm focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    تعليق حساب المسوق فورياً وتجميد إعلاناته (COMPLIANCE_RESTRICTED)
                  </span>
                </label>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-400 mt-1 mr-6">
                  سيتم تعليق رخصة وحساب المستخدم وحجب جميع إعلاناته النشطة لحين استكمال التحقيق الرقابي.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary rounded-xl hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmittingCreate && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>تسجيل الحالة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
