'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SupportTicketCountsDto,
  SupportTicketDetailDto,
  SupportTicketItemDto,
  SupportTicketsQueueResponseDto,
  TicketCategory,
  TicketMessageDto,
  TicketPriority,
  TicketSlaState,
  TicketStatus,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS_AR,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS_AR,
  TICKET_SLA_STATE_LABELS_AR,
  TICKET_STATUS_LABELS_AR,
  TICKET_STATUSES,
} from '@elmasaif/shared';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Headphones,
  History,
  LifeBuoy,
  Lock,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';

export type TicketStatusTab = TicketStatus | 'ALL';

export interface SupportTicketsWorkspaceProps {
  initialQueueData?: SupportTicketsQueueResponseDto | null;
  initialSelectedDetail?: SupportTicketDetailDto | null;
  initialStatusFilter?: TicketStatusTab;
  initialPriorityFilter?: TicketPriority | 'ALL';
  initialCategoryFilter?: TicketCategory | 'ALL';
  initialSlaFilter?: TicketSlaState | 'ALL';
  canManageNotes?: boolean;
}

export function SupportTicketsWorkspace({
  initialQueueData = null,
  initialSelectedDetail = null,
  initialStatusFilter = 'ALL',
  initialPriorityFilter = 'ALL',
  initialCategoryFilter = 'ALL',
  initialSlaFilter = 'ALL',
  canManageNotes = true,
}: SupportTicketsWorkspaceProps) {
  const [queueData, setQueueData] =
    useState<SupportTicketsQueueResponseDto | null>(initialQueueData);
  const [selectedDetail, setSelectedDetail] =
    useState<SupportTicketDetailDto | null>(initialSelectedDetail);
  const [statusTab, setStatusTab] =
    useState<TicketStatusTab>(initialStatusFilter);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'ALL'>(
    initialPriorityFilter,
  );
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'ALL'>(
    initialCategoryFilter,
  );
  const [slaFilter, setSlaFilter] = useState<TicketSlaState | 'ALL'>(
    initialSlaFilter,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(
    null,
  );

  // Message composer state
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Resolution modal state
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<
    'RESOLVED' | 'CLOSED'
  >('RESOLVED');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusTab !== 'ALL') params.set('status', statusTab);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (slaFilter !== 'ALL') params.set('slaState', slaFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res: any = await apiClient.get(
        `/admin/tickets?${params.toString()}`,
      );
      const data = res?.data || res;
      setQueueData(data);
    } catch (err: any) {
      setError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [statusTab, priorityFilter, categoryFilter, slaFilter, searchTerm]);

  useEffect(() => {
    if (!initialQueueData) {
      fetchQueue();
    }
  }, [fetchQueue, initialQueueData]);

  const handleOpenDetail = async (item: SupportTicketItemDto) => {
    setIsDetailLoading(true);
    try {
      const res: any = await apiClient.get(`/admin/tickets/${item.id}`);
      setSelectedDetail(res?.data || res);
    } catch (err: any) {
      setError(describeApiError(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !replyMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      await apiClient.post(`/admin/tickets/${selectedDetail.id}/messages`, {
        message: replyMessage.trim(),
        isInternal: isInternalNote,
        attachments: [],
      });
      setReplyMessage('');
      setIsInternalNote(false);
      setActionSuccessMessage(
        isInternalNote
          ? 'تم حفظ الملاحظة الداخلية بنجاح'
          : 'تم إرسال الرد للعميل بنجاح',
      );
      // Refresh detail
      handleOpenDetail(selectedDetail);
      fetchQueue();
    } catch (err: any) {
      setError(describeApiError(err));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedDetail) return;
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      setResolutionStatus(newStatus);
      setResolutionSummary('');
      setResolutionError(null);
      setIsResolutionModalOpen(true);
      return;
    }

    try {
      await apiClient.patch(`/admin/tickets/${selectedDetail.id}/status`, {
        status: newStatus,
      });
      setActionSuccessMessage(
        `تم تحديث حالة التذكرة إلى: ${TICKET_STATUS_LABELS_AR[newStatus]}`,
      );
      handleOpenDetail(selectedDetail);
      fetchQueue();
    } catch (err: any) {
      setError(describeApiError(err));
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedDetail) return;
    try {
      await apiClient.post(`/admin/tickets/${selectedDetail.id}/assign`, {});
      setActionSuccessMessage('تم تعيين التذكرة لك بنجاح');
      handleOpenDetail(selectedDetail);
      fetchQueue();
    } catch (err: any) {
      setError(describeApiError(err));
    }
  };

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail) return;

    if (resolutionSummary.trim().length < 5) {
      setResolutionError('يجب كتابة ملخص الحل (5 أحرف على الأقل)');
      return;
    }

    setIsSubmittingResolution(true);
    try {
      await apiClient.patch(`/admin/tickets/${selectedDetail.id}/status`, {
        status: resolutionStatus,
        resolutionSummary: resolutionSummary.trim(),
      });
      setIsResolutionModalOpen(false);
      setActionSuccessMessage(
        resolutionStatus === 'RESOLVED'
          ? 'تم حل التذكرة بنجاح'
          : 'تم إغلاق التذكرة بنجاح',
      );
      handleOpenDetail(selectedDetail);
      fetchQueue();
    } catch (err: any) {
      setResolutionError(describeApiError(err));
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const counts: SupportTicketCountsDto = queueData?.counts || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    slaNearingBreach: 0,
    slaBreached: 0,
  };

  const items = queueData?.items || [];

  return (
    <div className="space-y-6 font-sans" dir="rtl">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              طابور تذاكر الدعم الفني وخدمة العملاء
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              إدارة وحل استفسارات ومشاكل المستخدمين مع مراقبة مؤشرات اتفاقية مستوى الخدمة SLA (Tickets.Handle)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث التذاكر</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs font-medium text-neutral-500">تذاكر مفتوحة</span>
          <p className="mt-1 text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            {counts.open}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            قيد المعالجة
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-blue-900 dark:text-blue-200">
            {counts.inProgress}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            أوشكت مهلة SLA
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-amber-900 dark:text-amber-200">
            {counts.slaNearingBreach}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
          <span className="text-xs font-medium text-red-700 dark:text-red-400">
            تجاوزت مهلة SLA
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-red-900 dark:text-red-200">
            {counts.slaBreached}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            تم الحل
          </span>
          <p className="mt-1 text-2xl font-bold font-mono text-emerald-900 dark:text-emerald-200">
            {counts.resolved}
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
          {(['ALL', ...TICKET_STATUSES] as TicketStatusTab[]).map((tab) => {
            const label =
              tab === 'ALL'
                ? 'كافة التذاكر'
                : TICKET_STATUS_LABELS_AR[tab];
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
          })}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* SLA Filter */}
          <select
            value={slaFilter}
            onChange={(e) =>
              setSlaFilter(e.target.value as TicketSlaState | 'ALL')
            }
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            <option value="ALL">كافة حالات SLA</option>
            <option value="ON_TRACK">ضمن المهلة (On Track)</option>
            <option value="NEARING_BREACH">أوشكت المهلة (Nearing Breach)</option>
            <option value="BREACHED">تجاوزت المهلة (Breached)</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as TicketPriority | 'ALL')
            }
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            <option value="ALL">كافة الأولويات</option>
            {TICKET_PRIORITIES.map((pri) => (
              <option key={pri} value={pri}>
                {TICKET_PRIORITY_LABELS_AR[pri]}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="بحث بالرقم أو الموضوع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pr-8 pl-3 text-xs text-neutral-900 focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Tickets Queue & Detail Thread View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List */}
        <div
          className={`space-y-3 ${
            selectedDetail ? 'lg:col-span-5' : 'lg:col-span-12'
          }`}
        >
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800">
              <Headphones className="mx-auto h-12 w-12 text-neutral-400" />
              <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                لا توجد تذاكر تطابق الفلاتر المحددة
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                لا توجد تذاكر دعم فني مفتوحة حالياً.
              </p>
            </div>
          ) : (
            items.map((t) => {
              const isSelected = selectedDetail?.id === t.id;
              const isBreached =
                t.firstResponseSla.isBreached || t.resolutionSla.isBreached;
              const isNearing =
                t.firstResponseSla.state === 'NEARING_BREACH' ||
                t.resolutionSla.state === 'NEARING_BREACH';

              return (
                <div
                  key={t.id}
                  onClick={() => handleOpenDetail(t)}
                  className={`rounded-xl border bg-white p-4 cursor-pointer transition-all hover:shadow-md dark:bg-neutral-900 ${
                    isSelected
                      ? 'border-primary-500 ring-1 ring-primary-500 dark:border-primary-400'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2.5 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
                        {t.ticketNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          t.priority === 'URGENT'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        {TICKET_PRIORITY_LABELS_AR[t.priority]}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {TICKET_STATUS_LABELS_AR[t.status]}
                      </span>
                    </div>

                    {/* SLA Countdown Badge */}
                    <div
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        isBreached
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : isNearing
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>
                        {isBreached
                          ? 'تجاوزت SLA'
                          : isNearing
                          ? 'أوشكت مهلة الرد'
                          : 'ضمن المهلة'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 space-y-1.5">
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {t.subject}
                    </h4>
                    <p className="text-[11px] text-neutral-500 line-clamp-1">
                      {t.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                      <span>{t.contactName}</span>
                      <div className="flex items-center gap-2">
                        {t.assignedAdminName && (
                          <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                            المسؤول: {t.assignedAdminName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{t.messagesCount || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Thread View & Actions */}
        {selectedDetail && (
          <div className="lg:col-span-7 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            {/* Thread Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-neutral-900 dark:text-white">
                    {selectedDetail.ticketNumber}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    {TICKET_STATUS_LABELS_AR[selectedDetail.status]}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {TICKET_CATEGORY_LABELS_AR[selectedDetail.category]}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                  {selectedDetail.subject}
                </h3>
              </div>

              {/* Quick Actions Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedDetail.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange('IN_PROGRESS')}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    بدء المعالجة
                  </button>
                )}

                {!selectedDetail.assignedAdminId && (
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>تعيين لي</span>
                  </button>
                )}

                {selectedDetail.status !== 'RESOLVED' &&
                  selectedDetail.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatusChange('RESOLVED')}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      حل التذكرة
                    </button>
                  )}

                {selectedDetail.status !== 'CLOSED' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange('CLOSED')}
                    className="rounded-lg bg-neutral-800 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-900"
                  >
                    إغلاق التذكرة
                  </button>
                )}
              </div>
            </div>

            {/* SLA Status Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100 dark:bg-neutral-800/40 dark:border-neutral-800 flex items-center justify-between">
                <span>مهلة الرد الأول:</span>
                <span
                  className={`font-semibold ${
                    selectedDetail.firstResponseSla.isBreached
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {selectedDetail.firstRespondedAt
                    ? 'تم الرد'
                    : selectedDetail.firstResponseSla.isBreached
                    ? 'تجاوزت المهلة'
                    : `${selectedDetail.firstResponseSla.remainingMinutes} دقيقة متبقية`}
                </span>
              </div>

              <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100 dark:bg-neutral-800/40 dark:border-neutral-800 flex items-center justify-between">
                <span>مهلة الحل النهائي:</span>
                <span
                  className={`font-semibold ${
                    selectedDetail.resolutionSla.isBreached
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {selectedDetail.resolvedAt
                    ? 'تم الحل'
                    : selectedDetail.resolutionSla.isBreached
                    ? 'تجاوزت المهلة'
                    : `${Math.round(selectedDetail.resolutionSla.remainingMinutes / 60)} ساعة متبقية`}
                </span>
              </div>
            </div>

            {/* Customer Details Box */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-800/30 flex items-center justify-between">
              <div>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {selectedDetail.contactName}
                </span>
                <span className="text-neutral-500 mr-2">
                  ({selectedDetail.contactEmail})
                </span>
              </div>
              {selectedDetail.contactPhone && (
                <span className="font-mono text-neutral-600 dark:text-neutral-400">
                  {selectedDetail.contactPhone}
                </span>
              )}
            </div>

            {/* Initial description */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs leading-relaxed text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-200">
              <span className="block font-semibold text-neutral-500 mb-1">
                وصف المشكلة الأساسي:
              </span>
              {selectedDetail.description}
            </div>

            {/* Attachments preview */}
            {selectedDetail.signedAttachments.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-neutral-500">
                  المرفقات:
                </span>
                <div className="flex gap-2 flex-wrap">
                  {selectedDetail.signedAttachments.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs text-primary-600 hover:underline dark:bg-neutral-800 dark:text-primary-400"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span>مرفق {i + 1}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Summary (If resolved) */}
            {selectedDetail.resolutionSummary && (
              <div className="rounded-xl bg-emerald-50 p-3.5 text-xs border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                  ملخص الحل المعتمد:
                </span>
                <p className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  {selectedDetail.resolutionSummary}
                </p>
              </div>
            )}

            {/* Messages Thread (Customer replies, Staff replies, and Internal Staff Notes) */}
            <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                سجل المحادثة والملاحظات:
              </h4>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {selectedDetail.messages.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">
                    لا توجد رسائل أو ردود حتى الآن
                  </p>
                ) : (
                  selectedDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl p-3 text-xs leading-relaxed border ${
                        msg.isInternal
                          ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60'
                          : msg.authorType === 'ADMIN'
                          ? 'bg-blue-50/80 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60'
                          : 'bg-white border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          {msg.isInternal && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                              <Lock className="h-2.5 w-2.5" />
                              <span>ملاحظة داخلية</span>
                            </span>
                          )}
                          <span
                            className={
                              msg.authorType === 'ADMIN'
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-neutral-900 dark:text-white'
                            }
                          >
                            {msg.authorName}
                          </span>
                        </div>
                        <span className="text-neutral-400">
                          {new Date(msg.createdAt).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-neutral-800 dark:text-neutral-200">
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reply Composer */}
            <form onSubmit={handleSendMessage} className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  كتابة رد أو ملاحظة:
                </span>
                {canManageNotes && (
                  <label className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <Lock className="h-3 w-3" />
                    <span>ملاحظة داخلية للمشرفين فقط (غير مرئية للعميل)</span>
                  </label>
                )}
              </div>

              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'اكتب ملاحظة داخلية لفريق العمل...'
                      : 'اكتب الرد الرسمي للعميل...'
                  }
                  required
                  className={`flex-1 rounded-lg border p-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none ${
                    isInternalNote
                      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                      : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-800'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !replyMessage.trim()}
                  className={`self-end rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                    isInternalNote
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Resolution / Closure Modal */}
      {isResolutionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="font-bold text-neutral-900 dark:text-white">
                {resolutionStatus === 'RESOLVED'
                  ? 'اعتماد حل التذكرة'
                  : 'إغلاق التذكرة نهائياً'}
              </h3>
              <button
                type="button"
                onClick={() => setIsResolutionModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResolution} className="mt-4 space-y-4">
              {resolutionError && (
                <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {resolutionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  ملخص الحل والنتيجة * (إلزامي)
                </label>
                <textarea
                  rows={3}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="اكتب الإجراءات التي تمت لحل طلب العميل بالتفصيل..."
                  required
                  className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsResolutionModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolution}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingResolution
                    ? 'جاري الحفظ...'
                    : resolutionStatus === 'RESOLVED'
                    ? 'تأكيد الحل'
                    : 'تأكيد الإغلاق'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

