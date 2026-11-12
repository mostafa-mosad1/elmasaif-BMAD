'use client';

import React, { useState } from 'react';
import {
  AdminRole,
  ClaimLockInfo,
  FORCE_UNLOCK_MIN_REASON_LENGTH,
} from '@elmasaif/shared';
import {
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { formatLockCountdown } from '../../hooks/use-task-claim-lock';

export interface TaskClaimLockBannerProps {
  lockInfo: ClaimLockInfo | null;
  remainingSeconds?: number;
  version?: number | null;
  queueLabelAr?: string;
  isLoading?: boolean;
  error?: string | null;
  canForceUnlock?: boolean;
  defaultForceUnlockOpen?: boolean;
  onClaim?: () => Promise<unknown> | void;
  onHeartbeat?: () => Promise<unknown> | void;
  onRelease?: () => Promise<unknown> | void;
  onForceUnlock?: (reason: string) => Promise<unknown> | void;
}

export function TaskClaimLockBanner({
  lockInfo,
  remainingSeconds,
  version,
  queueLabelAr,
  isLoading = false,
  error = null,
  canForceUnlock: canForceUnlockProp,
  defaultForceUnlockOpen = false,
  onClaim,
  onHeartbeat,
  onRelease,
  onForceUnlock,
}: TaskClaimLockBannerProps) {
  const { admin, hasPermission } = useAdminAuth();
  const [showForceUnlockModal, setShowForceUnlockModal] = useState<boolean>(
    defaultForceUnlockOpen,
  );
  const [forceUnlockReason, setForceUnlockReason] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const canForceUnlock =
    typeof canForceUnlockProp === 'boolean'
      ? canForceUnlockProp
      : Boolean(
          hasPermission('Tasks.ForceUnlock') ||
            admin?.role === AdminRole.SUPER_ADMIN,
        );

  const effectiveRemainingSeconds =
    typeof remainingSeconds === 'number'
      ? remainingSeconds
      : (lockInfo?.remainingSeconds ?? 0);

  const isLocked = Boolean(lockInfo?.isLocked && effectiveRemainingSeconds > 0);
  const isLockedByCurrentAdmin = Boolean(
    isLocked && lockInfo?.isLockedByCurrentAdmin,
  );
  const isLockedByOtherAdmin = Boolean(
    isLocked && !lockInfo?.isLockedByCurrentAdmin,
  );

  const countdownLabel = formatLockCountdown(effectiveRemainingSeconds);
  const holderName = lockInfo?.lockedByAdminName || 'مشرف آخر';

  const handleConfirmForceUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = forceUnlockReason.trim();
    if (trimmed.length < FORCE_UNLOCK_MIN_REASON_LENGTH) {
      setValidationError(
        `يجب إدخال سبب فك القفل القسري (${FORCE_UNLOCK_MIN_REASON_LENGTH} أحرف على الأقل) لتوثيقه في سجل التدقيق.`,
      );
      return;
    }
    setValidationError(null);
    await onForceUnlock?.(trimmed);
    setShowForceUnlockModal(false);
    setForceUnlockReason('');
  };

  return (
    <div dir="rtl" className="space-y-3" data-testid="task-claim-lock-banner">
      {/* Case 1: Locked by another admin -> Prominent Amber Read-Only Warning Banner */}
      {isLockedByOtherAdmin && (
        <div
          role="alert"
          data-lock-state="LOCKED_BY_OTHER"
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-900">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-amber-950">
                    {`هذه المهمة قيد المراجعة حالياً من قِبل: ${holderName}`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2.5 py-0.5 text-xs font-bold text-amber-950">
                    <Clock className="h-3.5 w-3.5" />
                    <span dir="ltr">{countdownLabel}</span>
                  </span>
                  {typeof version === 'number' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                      {`v${version}`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-amber-900">
                  وضع القراءة فقط — جميع أزرار القرار معطلة لمنع التعارض (AD-10 &amp; FR-62). ينتهي الحجز تلقائياً عند انتهاء المؤقت.
                </p>
              </div>
            </div>

            {canForceUnlock && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setValidationError(null);
                    setShowForceUnlockModal((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>فك القفل قسرياً (Super Admin)</span>
                </button>
              </div>
            )}
          </div>

          {showForceUnlockModal && canForceUnlock && (
            <form
              onSubmit={handleConfirmForceUnlock}
              className="mt-4 rounded-xl border border-amber-300 bg-white p-4 text-ink-primary shadow-inner space-y-3"
              data-testid="force-unlock-modal"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    كسر القفل القسري للمهمة ({queueLabelAr || 'طابور العمليات'}) — سجل التدقيق الإلزامي (AuditLog)
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-ink-secondary">
                  الصلاحية: Tasks.ForceUnlock
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="force-unlock-reason-input"
                  className="block text-xs font-semibold text-ink-primary"
                >
                  سبب فك القفل القسري (إلزامي - 5 أحرف على الأقل)
                </label>
                <textarea
                  id="force-unlock-reason-input"
                  rows={2}
                  value={forceUnlockReason}
                  onChange={(e) => setForceUnlockReason(e.target.value)}
                  placeholder="مثال: المشرف المناوب في إجازة طارئة والمهمة تتطلب معالجة فورية..."
                  className="w-full rounded-xl border border-surface-border px-3 py-2 text-xs focus:border-red-600 focus:outline-none"
                />
                {validationError && (
                  <p className="text-xs font-bold text-red-600">
                    {validationError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForceUnlockModal(false);
                    setValidationError(null);
                  }}
                  className="rounded-xl border border-surface-border px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>تأكيد فك القفل وتوثيق السبب</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Case 2: Locked by current admin -> Active Emerald Lease & Heartbeat Bar */}
      {isLockedByCurrentAdmin && (
        <div
          role="status"
          data-lock-state="LOCKED_BY_ME"
          className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-200/80 text-emerald-900">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-emerald-950">
                    المهمة محجوزة باسمك للمراجعة الحصرية
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200/90 px-2.5 py-0.5 text-xs font-bold text-emerald-950">
                    <Clock className="h-3.5 w-3.5" />
                    <span dir="ltr">{countdownLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <RefreshCw className="h-3 w-3" />
                    <span>تجديد تلقائي كل 5 دقائق</span>
                  </span>
                  {typeof version === 'number' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-900">
                      {`If-Match: "${version}"`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-emerald-900">
                  أزرار اتخاذ القرار مفعّلة لك الآن. يتم تمديد الحجز تلقائياً لمدة 15 دقيقة طالما أن نافذة المراجعة نشطة.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onHeartbeat && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onHeartbeat()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>تجديد القفل الآن</span>
                </button>
              )}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onRelease?.()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>تحرير المهمة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case 3: Unlocked -> Claim Call-to-Action Banner */}
      {!isLocked && (
        <div
          role="region"
          aria-label="حالة قفل المهمة"
          data-lock-state="UNLOCKED"
          className="rounded-2xl border border-surface-border bg-surface p-4 text-ink-primary shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B4332]/10 text-[#1B4332]">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink-primary">
                    المهمة متاحة للاستلام والمراجعة
                  </span>
                  {typeof version === 'number' && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-secondary">
                      v{version}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary">
                  يجب استلام المهمة أولاً لتفعيل أزرار الاعتماد أو الرفض ومنع تداخل قرارات المشرفين (حجز حصري لمدة 15 دقيقة).
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onClaim?.()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1B4332]/90 disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>استلام المهمة وبدء المراجعة (حجز 15 دقيقة)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800"
        >
          {error}
        </div>
      )}
    </div>
  );
}
