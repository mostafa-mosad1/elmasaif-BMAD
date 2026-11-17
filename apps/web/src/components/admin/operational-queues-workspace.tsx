'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AdminRole,
  ClaimLockInfo,
  FORCE_UNLOCK_MIN_REASON_LENGTH,
  OPERATIONAL_QUEUE_METADATA,
  OPERATIONAL_QUEUE_TYPES,
  OperationalQueueCounts,
  OperationalQueueItemSummary,
  OperationalQueueLockFilterState,
  OperationalQueueType,
  OperationalQueuesHubResponse,
} from '@elmasaif/shared';
import {
  Lock,
  Unlock,
  Clock,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { formatLockCountdown } from '../../hooks/use-task-claim-lock';
import { TaskClaimLockBanner } from './task-claim-lock-banner';

export interface OperationalQueuesWorkspaceProps {
  initialHubData?: OperationalQueuesHubResponse | null;
  initialQueueFilter?: OperationalQueueType | 'ALL';
  initialLockStateFilter?: OperationalQueueLockFilterState;
  initialSelectedItemId?: string | null;
  canForceUnlock?: boolean;
}

const LOCK_STATE_TABS: Array<{
  id: OperationalQueueLockFilterState;
  labelAr: string;
}> = [
  { id: 'ALL', labelAr: 'الكل' },
  { id: 'LOCKED_BY_ME', labelAr: 'مهامي المحجوزة' },
  { id: 'UNLOCKED', labelAr: 'متاحة للاستلام' },
  { id: 'LOCKED_BY_OTHER', labelAr: 'محجوزة لمشرف آخر' },
];

export function OperationalQueuesWorkspace({
  initialHubData = null,
  initialQueueFilter = 'ALL',
  initialLockStateFilter = 'ALL',
  initialSelectedItemId = null,
  canForceUnlock: canForceUnlockProp,
}: OperationalQueuesWorkspaceProps) {
  const { admin, hasPermission } = useAdminAuth();

  const [hubData, setHubData] = useState<OperationalQueuesHubResponse | null>(
    initialHubData,
  );
  const [queueFilter, setQueueFilter] = useState<OperationalQueueType | 'ALL'>(
    initialQueueFilter,
  );
  const [lockStateFilter, setLockStateFilter] =
    useState<OperationalQueueLockFilterState>(initialLockStateFilter);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialSelectedItemId ?? initialHubData?.items?.[0]?.id ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceUnlockTarget, setForceUnlockTarget] =
    useState<OperationalQueueItemSummary | null>(null);
  const [forceUnlockReason, setForceUnlockReason] = useState<string>('');
  const [forceUnlockError, setForceUnlockError] = useState<string | null>(null);

  const canForceUnlock =
    typeof canForceUnlockProp === 'boolean'
      ? canForceUnlockProp
      : Boolean(
          hasPermission('Tasks.ForceUnlock') ||
            admin?.role === AdminRole.SUPER_ADMIN,
        );

  const fetchHubData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (queueFilter !== 'ALL') {
        params.set('queue', queueFilter);
      }
      if (lockStateFilter !== 'ALL') {
        params.set('lockState', lockStateFilter);
      }
      const queryString = params.toString();
      const endpoint = `/admin/queues${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient.get<{
        code: string;
        data: OperationalQueuesHubResponse;
      }>(endpoint);
      if (response?.data) {
        setHubData(response.data);
      }
    } catch (err) {
      const envelope = describeApiError(err);
      setError(envelope.message || 'تعذر تحميل بيانات طوابير العمليات الموحدة');
    } finally {
      setIsLoading(false);
    }
  }, [queueFilter, lockStateFilter]);

  useEffect(() => {
    if (!initialHubData) {
      fetchHubData();
    }
  }, [initialHubData, fetchHubData]);

  const countsByQueue = useMemo(() => {
    const map = new Map<OperationalQueueType, OperationalQueueCounts>();
    for (const q of OPERATIONAL_QUEUE_TYPES) {
      map.set(q, {
        queue: q,
        queueType: q,
        totalOpen: 0,
        unlocked: 0,
        lockedByMe: 0,
        lockedByOther: 0,
      });
    }
    const rawCounts = hubData?.counts ?? hubData?.queues ?? [];
    for (const entry of rawCounts) {
      const qType = (entry.queue ?? entry.queueType) as OperationalQueueType;
      if (!qType) continue;
      const totalOpen = entry.totalOpen ?? entry.totalPending ?? 0;
      const unlocked = entry.unlocked ?? entry.unlockedAvailable ?? 0;
      const lockedByMe = entry.lockedByMe ?? entry.lockedByCurrentAdmin ?? 0;
      const activelyLocked = entry.activelyLocked ?? (totalOpen - unlocked);
      const lockedByOther =
        entry.lockedByOther ?? Math.max(0, activelyLocked - lockedByMe);
      map.set(qType, {
        ...entry,
        queue: qType,
        queueType: qType,
        totalOpen,
        unlocked,
        lockedByMe,
        lockedByOther,
      });
    }
    return map;
  }, [hubData?.counts, hubData?.queues]);

  const filteredItems = useMemo(() => {
    const allItems = hubData?.items ?? [];
    return allItems.filter((item) => {
      const itemQueue = item.queue ?? item.queueType;
      if (queueFilter !== 'ALL' && itemQueue !== queueFilter) {
        return false;
      }
      if (
        lockStateFilter === 'UNLOCKED' &&
        item.lockInfo.isLocked
      ) {
        return false;
      }
      if (
        (lockStateFilter === 'LOCKED_BY_ME' || lockStateFilter === 'MY_CLAIMS') &&
        !item.lockInfo.isLockedByCurrentAdmin
      ) {
        return false;
      }
      if (
        lockStateFilter === 'LOCKED_BY_OTHER' &&
        (!item.lockInfo.isLocked || item.lockInfo.isLockedByCurrentAdmin)
      ) {
        return false;
      }
      if (lockStateFilter === 'LOCKED' && !item.lockInfo.isLocked) {
        return false;
      }
      return true;
    });
  }, [hubData?.items, queueFilter, lockStateFilter]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return filteredItems[0] ?? null;
    return (
      filteredItems.find((item) => item.id === selectedItemId) ??
      filteredItems[0] ??
      null
    );
  }, [filteredItems, selectedItemId]);

  const updateItemLockInState = useCallback(
    (
      queue: OperationalQueueType,
      entityId: string,
      nextLockInfo: ClaimLockInfo,
      nextVersion?: number,
    ) => {
      setHubData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => {
            const itemQueue = item.queue ?? item.queueType;
            return itemQueue === queue && item.id === entityId
              ? {
                  ...item,
                  lockInfo: nextLockInfo,
                  version:
                    typeof nextVersion === 'number' ? nextVersion : item.version,
                }
              : item;
          }),
        };
      });
    },
    [],
  );

  const handleQueueAction = useCallback(
    async (
      item: OperationalQueueItemSummary,
      action: 'claim' | 'heartbeat' | 'release' | 'force-unlock',
      reason?: string,
    ) => {
      setActionItemId(item.id);
      setError(null);
      try {
        const itemQueue = item.queue ?? item.queueType;
        const meta = OPERATIONAL_QUEUE_METADATA[itemQueue];
        const slug = item.queueSlug || meta?.slug || meta?.primarySlug;
        const body = action === 'force-unlock' ? { reason } : undefined;
        const response = await apiClient.post<{
          code: string;
          data?: {
            lockInfo?: ClaimLockInfo;
            version?: number;
          };
        }>(`/admin/queues/${slug}/${item.id}/${action}`, body);

        if (response?.data?.lockInfo) {
          updateItemLockInState(
            itemQueue,
            item.id,
            response.data.lockInfo,
            response.data.version,
          );
        } else {
          await fetchHubData();
        }
      } catch (err) {
        const envelope = describeApiError(err);
        setError(envelope.message || 'تعذر تنفيذ إجراء القفل على المهمة');
        const conflictLockInfo = (
          envelope.details as { lockInfo?: ClaimLockInfo } | undefined
        )?.lockInfo;
        if (conflictLockInfo) {
          updateItemLockInState(item.queue ?? item.queueType, item.id, conflictLockInfo);
        }
      } finally {
        setActionItemId(null);
      }
    },
    [fetchHubData, updateItemLockInState],
  );

  const handleSubmitInlineForceUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceUnlockTarget) return;
    const trimmed = forceUnlockReason.trim();
    if (trimmed.length < FORCE_UNLOCK_MIN_REASON_LENGTH) {
      setForceUnlockError(
        `يجب إدخال سبب فك القفل القسري (${FORCE_UNLOCK_MIN_REASON_LENGTH} أحرف على الأقل) لتوثيقه في سجل التدقيق.`,
      );
      return;
    }
    setForceUnlockError(null);
    await handleQueueAction(forceUnlockTarget, 'force-unlock', trimmed);
    setForceUnlockTarget(null);
    setForceUnlockReason('');
  };

  return (
    <div dir="rtl" className="space-y-6" data-testid="operational-queues-workspace">
      {/* Executive Header */}
      <div className="rounded-2xl bg-primary p-6 text-white shadow-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-light border border-white/10">
              <Layers className="h-3.5 w-3.5" />
              <span>مركز التحكم في طوابير المهام والأقفال التشغيلية • AD-10 &amp; FR-62</span>
            </div>
            <h1 className="text-2xl font-bold">
              طوابير المهام والأقفال التشغيلية الموحدة (8 طوابير)
            </h1>
            <p className="max-w-3xl text-xs leading-relaxed text-white/85">
              إدارة حجز المهام الحصري لمدة 15 دقيقة مع التجديد التلقائي لنبضات النشاط كل 5 دقائق (Heartbeat)، والتحقق من تزامن النسخ (<code dir="ltr">If-Match</code> / <code dir="ltr">version</code>) لمنع تعارض قرارات المشرفين.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchHubData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 px-4 py-2.5 text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث حالة الأقفال</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8 Operational Queue Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPERATIONAL_QUEUE_TYPES.map((queueType) => {
          const meta = OPERATIONAL_QUEUE_METADATA[queueType];
          const counts = countsByQueue.get(queueType)!;
          const isSelectedQueue = queueFilter === queueType;

          return (
            <div
              key={queueType}
              data-testid={`queue-card-${meta.slug}`}
              className={`rounded-2xl border p-4 transition-all ${
                isSelectedQueue
                  ? 'border-accent bg-accent/5 dark:bg-accent/10 shadow-sm'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base hover:border-accent/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setQueueFilter((prev) =>
                        prev === queueType ? 'ALL' : queueType,
                      )
                    }
                    className="text-right text-sm font-bold text-ink-primary dark:text-dark-ink-primary hover:text-accent"
                  >
                    {meta.labelAr}
                  </button>
                  <p className="text-[11px] font-mono text-ink-secondary dark:text-dark-ink-secondary">
                    {meta.reviewPermission}
                  </p>
                </div>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent-dark dark:text-accent">
                  {counts.totalOpen}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-raised px-2 py-1">
                  <span className="block font-bold text-ink-primary dark:text-dark-ink-primary">
                    {counts.unlocked}
                  </span>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary">متاحة</span>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-1 text-emerald-800 dark:text-emerald-300">
                  <span className="block font-bold">{counts.lockedByMe}</span>
                  <span>مهامي</span>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2 py-1 text-amber-800 dark:text-amber-300">
                  <span className="block font-bold">{counts.lockedByOther}</span>
                  <span>مشرف آخر</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-surface-border dark:border-dark-surface-border pt-2.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setQueueFilter((prev) =>
                      prev === queueType ? 'ALL' : queueType,
                    )
                  }
                  className="font-semibold text-accent hover:underline"
                >
                  {isSelectedQueue ? 'عرض كل الطوابير' : 'تصفية هذا الطابور'}
                </button>
                <Link
                  href={meta.adminWorkspaceHref}
                  className="inline-flex items-center gap-1 font-semibold text-ink-secondary dark:text-dark-ink-secondary hover:text-accent"
                >
                  <span>مساحة الطابور</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Task Claim Lock Banner */}
      {selectedItem && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
              المهمة المحددة للمعاينة والتحكم في القفل: {selectedItem.titleAr} (
              {selectedItem.referenceCode ?? selectedItem.referenceNumber})
            </span>
            <Link
              href={selectedItem.workspaceHref}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
            >
              <span>الانتقال إلى مساحة المراجعة الكاملة</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <TaskClaimLockBanner
            lockInfo={selectedItem.lockInfo}
            version={selectedItem.version}
            queueLabelAr={
              OPERATIONAL_QUEUE_METADATA[
                (selectedItem.queue ?? selectedItem.queueType) as OperationalQueueType
              ]?.labelAr
            }
            isLoading={actionItemId === selectedItem.id}
            error={error}
            canForceUnlock={canForceUnlock}
            onClaim={() => handleQueueAction(selectedItem, 'claim')}
            onHeartbeat={() => handleQueueAction(selectedItem, 'heartbeat')}
            onRelease={() => handleQueueAction(selectedItem, 'release')}
            onForceUnlock={(reason) =>
              handleQueueAction(selectedItem, 'force-unlock', reason)
            }
          />
        </section>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
            <Filter className="h-3.5 w-3.5" />
            <span>حالة القفل:</span>
          </span>
          {LOCK_STATE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLockStateFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                lockStateFilter === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-sunken dark:bg-dark-surface-raised text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
              }`}
            >
              {tab.labelAr}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="queue-type-select" className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
            الطابور التشغيلي:
          </label>
          <select
            id="queue-type-select"
            value={queueFilter}
            onChange={(e) =>
              setQueueFilter(e.target.value as OperationalQueueType | 'ALL')
            }
            className="rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-raised px-3 py-1.5 text-xs font-bold text-ink-primary dark:text-dark-ink-primary focus:outline-none"
          >
            <option value="ALL">جميع الطوابير (8)</option>
            {OPERATIONAL_QUEUE_TYPES.map((q) => (
              <option key={q} value={q}>
                {OPERATIONAL_QUEUE_METADATA[q].labelAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inline Force-Unlock Modal when triggered from table row */}
      {forceUnlockTarget && canForceUnlock && (
        <form
          onSubmit={handleSubmitInlineForceUnlock}
          className="rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 space-y-3"
          data-testid="table-force-unlock-modal"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-red-900 dark:text-red-200">
              <ShieldAlert className="h-4 w-4" />
              <span>
                فك القفل قسرياً للمهمة: {forceUnlockTarget.titleAr} (
                {forceUnlockTarget.referenceCode ?? forceUnlockTarget.referenceNumber})
              </span>
            </div>
            <span className="text-xs font-semibold text-red-800 dark:text-red-300">
              المشرف الحالي: {forceUnlockTarget.lockInfo.lockedByAdminName || 'مشرف آخر'}
            </span>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="table-force-unlock-reason"
              className="block text-xs font-bold text-red-950 dark:text-red-200"
            >
              سبب فك القفل القسري (إلزامي لسجل التدقيق AuditLog — 5 أحرف على الأقل)
            </label>
            <textarea
              id="table-force-unlock-reason"
              rows={2}
              value={forceUnlockReason}
              onChange={(e) => setForceUnlockReason(e.target.value)}
              className="w-full rounded-xl border border-red-300 dark:border-red-800 bg-surface-base dark:bg-dark-surface-raised px-3 py-2 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none"
              placeholder="اكتب مبرر كسر القفل الإداري..."
            />
            {forceUnlockError && (
              <p className="text-xs font-bold text-red-700 dark:text-red-400">{forceUnlockError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setForceUnlockTarget(null);
                setForceUnlockReason('');
                setForceUnlockError(null);
              }}
              className="rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={actionItemId === forceUnlockTarget.id}
              className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              تأكيد فك القفل القسري
            </button>
          </div>
        </form>
      )}

      {/* Unified Queue Tasks List */}
      <div className="overflow-hidden rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base">
        <div className="border-b border-surface-border dark:border-dark-surface-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            قائمة المهام التشغيلية النشطة ({filteredItems.length})
          </h2>
          <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            مدة الحجز القياسية: 15 دقيقة • نبضة التجديد: 5 دقائق
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary dark:text-dark-ink-secondary">
            لا توجد مهام مطابقة لمعايير التصفية الحالية.
          </div>
        ) : (
          <div className="divide-y divide-surface-border dark:divide-dark-surface-border">
            {filteredItems.map((item) => {
              const itemQueue = (item.queue ?? item.queueType) as OperationalQueueType;
              const meta = OPERATIONAL_QUEUE_METADATA[itemQueue];
              const isLocked = item.lockInfo.isLocked;
              const isMine = isLocked && item.lockInfo.isLockedByCurrentAdmin;
              const isOther = isLocked && !item.lockInfo.isLockedByCurrentAdmin;
              const countdown = formatLockCountdown(
                item.lockInfo.remainingSeconds,
              );
              const isBusy = actionItemId === item.id;

              return (
                <div
                  key={`${itemQueue}-${item.id}`}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex flex-col gap-3 px-6 py-4 transition-colors lg:flex-row lg:items-center lg:justify-between cursor-pointer ${
                    selectedItem?.id === item.id
                      ? 'bg-accent/5 dark:bg-accent/10'
                      : 'hover:bg-surface-sunken/50 dark:hover:bg-dark-surface-raised/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent-dark dark:text-accent">
                        {meta?.labelAr || item.queueLabelAr}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                        {item.referenceCode ?? item.referenceNumber}
                      </span>
                      <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                        {item.titleAr}
                      </span>
                      <span className="rounded-full bg-surface-sunken dark:bg-dark-surface-raised px-2 py-0.5 font-mono text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
                        {item.status} • v{item.version ?? 1}
                      </span>
                    </div>

                    {/* Lock Status Pill */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isMine && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 px-3 py-0.5 font-bold text-emerald-900 dark:text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>محجوزة باسمك</span>
                          <span dir="ltr" className="font-mono">
                            ({countdown})
                          </span>
                        </span>
                      )}

                      {isOther && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-3 py-0.5 font-bold text-amber-950 dark:text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>
                            {`محجوزة بواسطة: ${item.lockInfo.lockedByAdminName || 'مشرف آخر'} (وضع القراءة فقط)`}
                          </span>
                          <span dir="ltr" className="font-mono">
                            {`(${countdown})`}
                          </span>
                        </span>
                      )}

                      {!isLocked && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken dark:bg-dark-surface-raised px-3 py-0.5 font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                          <Clock className="h-3.5 w-3.5" />
                          <span>متاحة للاستلام (غير محجوزة)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div
                    className="flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!isLocked && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleQueueAction(item, 'claim')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>استلام المهمة</span>
                      </button>
                    )}

                    {isMine && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleQueueAction(item, 'heartbeat')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>تجديد القفل</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleQueueAction(item, 'release')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 dark:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-900 dark:hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          <span>تحرير المهمة</span>
                        </button>
                      </>
                    )}

                    {isOther && canForceUnlock && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setForceUnlockTarget(item);
                          setForceUnlockReason('');
                          setForceUnlockError(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>فك القفل قسرياً</span>
                      </button>
                    )}

                    <Link
                      href={item.workspaceHref}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-raised px-3.5 py-2 text-xs font-bold text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken"
                    >
                      <span>فتح مساحة المراجعة</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
