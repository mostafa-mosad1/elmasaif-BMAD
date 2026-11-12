'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  VIOLATION_ACTIONS,
  VIOLATION_ACTION_LABELS_AR,
  VIOLATION_CATEGORIES,
  VIOLATION_CATEGORY_LABELS_AR,
  VIOLATION_REPORT_STATUS_LABELS_AR,
  VIOLATION_REPORT_STATUSES,
  VIOLATION_TARGET_TYPE_LABELS_AR,
  ViolationAction,
  ViolationCategory,
  ViolationReportDetailDto,
  ViolationReportItemDto,
  ViolationReportsQueueResponseDto,
  ViolationReportStatus,
} from '@elmasaif/shared';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  History,
  Paperclip,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';

export type ViolationStatusTab = ViolationReportStatus | 'ALL';

export interface ViolationReportsWorkspaceProps {
  initialQueueData?: ViolationReportsQueueResponseDto | null;
  initialSelectedDetail?: ViolationReportDetailDto | null;
  initialStatusFilter?: ViolationStatusTab;
  initialCategoryFilter?: ViolationCategory | 'ALL';
  initialModalMode?: 'ADJUDICATE' | 'DISMISS' | null;
  initialModalTarget?: ViolationReportItemDto | null;
}

export function ViolationReportsWorkspace({
  initialQueueData = null,
  initialSelectedDetail = null,
  initialStatusFilter = 'ALL',
  initialCategoryFilter = 'ALL',
  initialModalMode = null,
  initialModalTarget = null,
}: ViolationReportsWorkspaceProps) {
  const [queueData, setQueueData] =
    useState<ViolationReportsQueueResponseDto | null>(initialQueueData);
  const [selectedDetail, setSelectedDetail] =
    useState<ViolationReportDetailDto | null>(initialSelectedDetail);
  const [statusTab, setStatusTab] =
    useState<ViolationStatusTab>(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<ViolationCategory | 'ALL'>(
    initialCategoryFilter,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(
    null,
  );

  // Modal State
  const [modalMode, setModalMode] = useState<'ADJUDICATE' | 'DISMISS' | null>(
    initialModalMode,
  );
  const [modalTarget, setModalTarget] = useState<ViolationReportItemDto | null>(
    initialModalTarget,
  );
  const [selectedAction, setSelectedAction] =
    useState<ViolationAction>('LISTING_REMOVED');
  const [adjudicationNotes, setAdjudicationNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusTab !== 'ALL') params.set('status', statusTab);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res: any = await apiClient.get(
        `/admin/reports?${params.toString()}`,
      );
      const data = res?.data || res;
      setQueueData(data);
    } catch (err: any) {
      setError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusTab, categoryFilter, searchTerm]);

  useEffect(() => {
    if (!initialQueueData) {
      fetchQueue();
    }
  }, [fetchQueue, initialQueueData]);

  const handleOpenDetail = async (item: ViolationReportItemDto) => {
    setIsDetailLoading(true);
    try {
      const res: any = await apiClient.get(`/admin/reports/${item.id}`);
      setSelectedDetail(res?.data || res);
    } catch (err: any) {
      setError(describeApiError(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleOpenAdjudicateModal = (item: ViolationReportItemDto) => {
    setModalTarget(item);
    setModalMode('ADJUDICATE');
    setSelectedAction('LISTING_REMOVED');
    setAdjudicationNotes('');
    setModalError(null);
  };

  const handleOpenDismissModal = (item: ViolationReportItemDto) => {
    setModalTarget(item);
    setModalMode('DISMISS');
    setAdjudicationNotes('');
    setModalError(null);
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setModalTarget(null);
    setAdjudicationNotes('');
    setModalError(null);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTarget) return;

    if (adjudicationNotes.trim().length < 5) {
      setModalError('يجب كتابة مبررات الإجراء (5 أحرف على الأقل)');
      return;
    }

    setIsSubmittingAction(true);
    setModalError(null);

    try {
      if (modalMode === 'ADJUDICATE') {
        await apiClient.post(`/admin/reports/${modalTarget.id}/adjudicate`, {
          action: selectedAction,
          notes: adjudicationNotes.trim(),
          status: 'RESOLVED',
        });
        setActionSuccessMessage(
          `تم اتخاذ الإجراء النظامي (${VIOLATION_ACTION_LABELS_AR[selectedAction]}) على البلاغ بنجاح`,
        );
      } else {
        await apiClient.post(`/admin/reports/${modalTarget.id}/dismiss`, {
          notes: adjudicationNotes.trim(),
        });
        setActionSuccessMessage('تم استبعاد البلاغ وتوثيق السبب في سجل التدقيق بنجاح');
      }

      handleCloseModal();
      fetchQueue();
      if (selectedDetail && selectedDetail.id === modalTarget.id) {
        handleOpenDetail(modalTarget);
      }
    } catch (err: any) {
      setModalError(describeApiError(err));
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const counts = queueData?.counts || {
    total: 0,
    pending: 0,
    underReview: 0,
    resolved: 0,
    dismissed: 0,
  };

  const items = queueData?.items || [];

  return (
    <div className="space-y-6 font-sans" dir="rtl">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                طابور بلاغات المخالفات والامتثال
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                مراجعة وتدقيق بلاغات الاحتيال، وتجاوزات الوسطاء، والإعلانات المضللة (Reports.Handle)
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث الطابور</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs font-medium text-neutral-500">إجمالي البلاغات</span>
          <p className="mt-1 text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            {counts.total}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            قيد الانتظار
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-amber-900 dark:text-amber-200">
            {counts.pending}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            قيد المعالجة
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-blue-900 dark:text-blue-200">
            {counts.underReview}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            تم اتخاذ إجراء
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-emerald-900 dark:text-emerald-200">
            {counts.resolved}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-800/40">
          <span className="text-xs font-medium text-neutral-500">بلاغات مستبعدة</span>
          <p className="mt-1 text-2xl font-bold font-mono text-neutral-700 dark:text-neutral-300">
            {counts.dismissed}
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
          {error}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', ...VIOLATION_REPORT_STATUSES] as ViolationStatusTab[]).map(
            (tab) => {
              const label =
                tab === 'ALL'
                  ? 'كافة البلاغات'
                  : VIOLATION_REPORT_STATUS_LABELS_AR[tab];
              const isSelected = statusTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusTab(tab)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
                  }`}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as ViolationCategory | 'ALL')
            }
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            <option value="ALL">كافة التصنيفات</option>
            {VIOLATION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {VIOLATION_CATEGORY_LABELS_AR[cat]}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="بحث بالرقم أو المبلّغ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pr-8 pl-3 text-xs text-neutral-900 focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout: Queue List & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Reports Queue List */}
        <div className={`space-y-3 ${selectedDetail ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800">
              <ShieldAlert className="mx-auto h-12 w-12 text-neutral-400" />
              <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                لا توجد بلاغات تطابق الفلاتر المحددة
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                لم يتم تقديم أي بلاغات جديدة في هذا القسم حالياً.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedDetail?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md dark:bg-neutral-900 ${
                    isSelected
                      ? 'border-primary-500 ring-1 ring-primary-500 dark:border-primary-400'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                        {item.reportNumber}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {VIOLATION_TARGET_TYPE_LABELS_AR[item.targetType]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          item.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : item.status === 'UNDER_REVIEW'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : item.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        {VIOLATION_REPORT_STATUS_LABELS_AR[item.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>

                  {/* Body & Target Info */}
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{VIOLATION_CATEGORY_LABELS_AR[item.category]}</span>
                    </div>

                    <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    {/* Target Preview */}
                    {item.targetPreview && (
                      <div className="rounded-lg bg-neutral-50 p-2.5 text-xs border border-neutral-100 dark:bg-neutral-800/50 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="h-4 w-4 text-neutral-400 shrink-0" />
                          <span className="font-medium text-neutral-900 dark:text-white truncate">
                            {item.targetPreview.title || 'إعلان عقاري'}
                          </span>
                        </div>
                        {item.targetPreview.brokerName && (
                          <span className="text-[11px] text-neutral-500 truncate mr-2">
                            الوسيط: {item.targetPreview.brokerName}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reporter footer */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span>
                          المبلّغ: {item.reporterName || 'مستخدم مجهول (بدون اسم)'}
                        </span>
                      </div>
                      {item.attachments.length > 0 && (
                        <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                          <Paperclip className="h-3 w-3" />
                          <span>{item.attachments.length} مرفقات</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>عرض التفاصيل</span>
                    </button>

                    {item.status !== 'RESOLVED' && item.status !== 'DISMISSED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenDismissModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>استبعاد</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAdjudicateModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>اتخاذ إجراء نظامي</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Detail View Panel */}
        {selectedDetail && (
          <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <span className="text-xs text-neutral-500">تفاصيل البلاغ</span>
                <h3 className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                  {selectedDetail.reportNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target & Entity Snapshot */}
            {selectedDetail.targetPreview && (
              <div className="rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  بيانات العقار أو الوسيط المستهدف:
                </span>
                <p className="font-bold text-neutral-900 dark:text-white">
                  {selectedDetail.targetPreview.title}
                </p>
                {selectedDetail.targetPreview.brokerName && (
                  <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                    الوسيط: {selectedDetail.targetPreview.brokerName} (رخصة:{' '}
                    {selectedDetail.targetPreview.licenseNumber || 'غير متوفر'})
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <span className="block text-xs font-semibold text-neutral-500 mb-1">
                نص البلاغ كاملاً:
              </span>
              <p className="rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200">
                {selectedDetail.description}
              </p>
            </div>

            {/* Evidence Attachments with Signed Links */}
            <div>
              <span className="block text-xs font-semibold text-neutral-500 mb-1">
                المستندات والأدلة المرفقة ({selectedDetail.signedAttachments.length}):
              </span>
              {selectedDetail.signedAttachments.length === 0 ? (
                <p className="text-xs text-neutral-400">لا توجد مرفقات مع هذا البلاغ</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedDetail.signedAttachments.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline dark:text-primary-400"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>مستند إثبات رقم {i + 1}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Reporter Contact Info */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-800/30 space-y-1">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300 block">
                بيانات مقدم البلاغ:
              </span>
              <p>الاسم: {selectedDetail.reporterName || 'مجهول'}</p>
              <p>البريد: {selectedDetail.reporterEmail || 'غير مسجل'}</p>
              <p>الجوال: {selectedDetail.reporterPhone || 'غير مسجل'}</p>
            </div>

            {/* Audit Trail */}
            {selectedDetail.auditTrail && selectedDetail.auditTrail.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  <History className="h-4 w-4" />
                  <span>سجل الإجراءات والتدقيق (Immutable Audit):</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedDetail.auditTrail.map((log) => (
                    <div
                      key={log.id}
                      className="rounded bg-neutral-50 p-2 text-[11px] dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800"
                    >
                      <div className="flex justify-between items-center text-neutral-500 mb-1">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {log.actorAdminName}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString('ar-SA')}</span>
                      </div>
                      <span className="font-mono text-xs text-primary-600 dark:text-primary-400">
                        {log.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjudication / Dismissal Modal */}
      {modalMode && modalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                {modalMode === 'ADJUDICATE' ? (
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-neutral-500" />
                )}
                <h3 className="font-bold text-neutral-900 dark:text-white">
                  {modalMode === 'ADJUDICATE'
                    ? 'اتخاذ إجراء نظامي حيال البلاغ'
                    : 'استبعاد البلاغ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="mt-4 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {modalError}
                </div>
              )}

              <div className="rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-800/50">
                <span className="font-semibold">البلاغ المستهدف: </span>
                <span className="font-mono">{modalTarget.reportNumber}</span> (
                {VIOLATION_CATEGORY_LABELS_AR[modalTarget.category]})
              </div>

              {modalMode === 'ADJUDICATE' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    الإجراء النظامي المعتمد *
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) =>
                      setSelectedAction(e.target.value as ViolationAction)
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    {VIOLATION_ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {VIOLATION_ACTION_LABELS_AR[act]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  مبررات وتفاصيل القرار * (تسجل في سجل التدقيق غير القابل للتعديل)
                </label>
                <textarea
                  rows={3}
                  value={adjudicationNotes}
                  onChange={(e) => setAdjudicationNotes(e.target.value)}
                  placeholder="اكتب الأسباب والقرارات التي تم اتخاذها بناءً على المراجعة..."
                  required
                  className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className={`rounded-lg px-5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                    modalMode === 'ADJUDICATE'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-neutral-800 hover:bg-neutral-900'
                  }`}
                >
                  {isSubmittingAction
                    ? 'جاري الحفظ...'
                    : modalMode === 'ADJUDICATE'
                    ? 'تأكيد الإجراء النظامي'
                    : 'تأكيد الاستبعاد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

