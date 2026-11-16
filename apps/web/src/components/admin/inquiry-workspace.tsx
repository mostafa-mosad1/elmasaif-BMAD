'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessagesSquare,
  RefreshCw,
  Send,
  SendHorizontal,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import {
  CLAIMABLE_INQUIRY_STATUSES,
  INQUIRY_AUTHOR_LABELS_AR,
  INQUIRY_AWAITING_PARTY_LABELS_AR,
  INQUIRY_CLOSED,
  INQUIRY_CLOSE_REASON_REQUIRED,
  INQUIRY_FORCE_UNLOCK_REASON_MISSING,
  INQUIRY_FORCE_UNLOCK_REASON_REQUIRED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS,
  INQUIRY_LOCK_REQUIRED,
  INQUIRY_MESSAGE_MAX_LENGTH,
  InquiryAuthorRole,
  InquiryMessageItem,
  InquiryStatus,
  InquiryThreadItem,
  PROPERTY_TYPE_LABELS_AR,
  closeInquirySchema,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { InquiryStatusBadge } from '../inquiries/inquiry-status-badge';
import { unwrapInquiryThreadPayload } from '../inquiries/inquiry-thread-view';
import { formatLockCountdown } from './offer-mediation-queue';

/** AD-10 prescribes a 5-minute heartbeat against the 15-minute lease. */
export const CONVERSATION_HEARTBEAT_INTERVAL_MS = INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS;

const CLOSE_REASON_MIN_LENGTH = 5;

const ERROR_HINTS_AR: Record<string, string> = {
  [INQUIRY_LOCK_REQUIRED]: 'استلم المحادثة أولاً قبل تنفيذ أي إجراء.',
  [INQUIRY_LOCK_EXPIRED]: 'انتهت مدة القفل. أعد استلام المحادثة ثم أعد المحاولة.',
  [INQUIRY_LOCK_CONFLICT]: 'القفل بحوزة مشرف آخر حالياً.',
  [INQUIRY_CLOSED]: 'المحادثة مغلقة نهائياً ولا تقبل مزيداً من الإجراءات.',
  [INQUIRY_INVALID_STATE_TRANSITION]: 'تغيّرت حالة المحادثة قبل تنفيذ الإجراء. حدّث الصفحة.',
  [INQUIRY_CLOSE_REASON_REQUIRED]: `سبب الإغلاق يجب ألا يقل عن ${CLOSE_REASON_MIN_LENGTH} أحرف.`,
  [INQUIRY_FORCE_UNLOCK_REASON_REQUIRED]: 'فك القفل يتطلب سبباً موثقاً.',
  [INQUIRY_FORCE_UNLOCK_REASON_MISSING]: 'فك القفل يتطلب سبباً موثقاً.',
};

/** Admin-side hint lookup, mirroring `resolveOfferErrorHint` for the negotiation workspace. */
export function resolveInquiryErrorHint(code: string | undefined, fallback: string): string {
  return ERROR_HINTS_AR[code ?? ''] ?? fallback;
}

export interface ConversationActions {
  isClosed: boolean;
  canRelayToSeller: boolean;
  canRelayToBuyer: boolean;
  canClose: boolean;
}

/**
 * The relay buttons mirror the server's state machine (D5) for affordance only: the API re-checks
 * the status inside the transaction, so a stale tab can enable nothing the server would accept.
 */
export function resolveConversationActions(status: InquiryStatus): ConversationActions {
  return {
    isClosed: status === InquiryStatus.CLOSED,
    canRelayToSeller: status === InquiryStatus.PENDING_ADMIN_REVIEW,
    canRelayToBuyer: status === InquiryStatus.SELLER_RESPONDED,
    canClose: CLAIMABLE_INQUIRY_STATUSES.includes(status),
  };
}

/**
 * Administrative conversation workspace (Story 4.4 / AC-3, AC-4, AC-5; AD-10).
 *
 * An administrator sees every message — including counterparty messages that have not been
 * relayed yet — because relaying them is the task. The API re-validates the lease inside the
 * transaction, so a second administrator can inspect but never decide.
 */
export function InquiryWorkspace({ inquiryId }: { inquiryId: string }) {
  const [thread, setThread] = useState<InquiryThreadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [relayNote, setRelayNote] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [showForceUnlock, setShowForceUnlock] = useState(false);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(
    (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);

      apiClient
        .get<unknown>(`/admin/inquiries/${inquiryId}`)
        .then((payload) => {
          const parsed = unwrapInquiryThreadPayload(payload);
          setThread(parsed);
          const info = parsed?.lockInfo;
          setDeadlineMs(
            info?.isLocked ? Date.now() + (info.remainingSeconds ?? 0) * 1000 : null,
          );
          setLoading(false);
        })
        .catch(() => {
          setError('تعذر تحميل ملف المحادثة.');
          setLoading(false);
        });
    },
    [inquiryId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // Display-only countdown: the server clock is the authority (`ClockService.now()`), this simply
  // drains the lease the API handed back so the administrator sees it expiring.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lockInfo = thread?.lockInfo;
  const isMine = Boolean(lockInfo?.isLocked && lockInfo?.isLockedByCurrentAdmin);
  const isOther = Boolean(lockInfo?.isLocked && !lockInfo?.isLockedByCurrentAdmin);
  const secondsLeft =
    deadlineMs && isMine ? Math.max(0, Math.floor((deadlineMs - nowMs) / 1000)) : null;

  useEffect(() => {
    if (!isMine) return undefined;
    const timer = window.setInterval(() => {
      apiClient.post(`/admin/inquiries/${inquiryId}/heartbeat`).catch(() => {
        // A lost heartbeat is recoverable: the lease lazily expires and the task can be reclaimed.
      });
    }, CONVERSATION_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isMine, inquiryId]);

  const runAction = async (action: string, body?: unknown, successBanner?: string) => {
    setPendingAction(action);
    setActionError(null);
    setBanner(null);
    try {
      await apiClient.post(`/admin/inquiries/${inquiryId}/${action}`, body);
      setBanner(successBanner ?? 'تم تنفيذ الإجراء.');
      setRelayNote('');
      setShowClose(false);
      setCloseReason('');
      setShowForceUnlock(false);
      setForceReason('');
      load();
    } catch (err) {
      const failure = describeApiError(err);
      const holder = readLockHolderName(failure.details);
      setActionError(
        holder
          ? `القفل مملوك حالياً بواسطة ${holder}.`
          : resolveInquiryErrorHint(failure.code, failure.message || 'تعذر تنفيذ الإجراء.'),
      );
      load();
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl" aria-busy="true">
        <div className="h-28 rounded-card bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse" />
        <div className="h-64 rounded-card bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-900"
        dir="rtl"
      >
        <span>{error || 'لم يتم العثور على هذه المحادثة.'}</span>
        <button type="button" onClick={() => load(true)} className="underline">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const listing = thread.listing;
  const { isClosed, canRelayToSeller, canRelayToBuyer, canClose } = resolveConversationActions(
    thread.status,
  );
  // The same schema the API enforces, so the button can never enable an invalid close.
  const closeReasonValid = closeInquirySchema.safeParse({ reason: closeReason }).success;
  const forceReasonValid = forceReason.trim().length >= CLOSE_REASON_MIN_LENGTH;
  const relayNoteBody = relayNote.trim() ? { note: relayNote.trim() } : {};

  return (
    <div dir="rtl" className="space-y-6">
      <Link
        href="/admin/conversations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-primary dark:text-dark-ink-secondary"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        <span>رجوع إلى طابور المحادثات</span>
      </Link>

      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <MessagesSquare className="w-5 h-5 text-primary" />
              <span className="truncate">{listing?.title || 'استفسار عقار'}</span>
            </h1>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
              {[
                PROPERTY_TYPE_LABELS_AR[
                  listing?.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR
                ] || listing?.propertyType,
                listing?.areaSquareMeters ? `م² ${listing.areaSquareMeters}` : null,
                listing?.cityName,
                listing?.districtName,
              ]
                .filter(Boolean)
                .join(' — ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {thread.awaitingParty ? (
              <span className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder">
                {INQUIRY_AWAITING_PARTY_LABELS_AR[thread.awaitingParty]}
              </span>
            ) : null}
            <InquiryStatusBadge status={thread.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">سعر الطلب</div>
            <div dir="ltr" className="mt-1 font-mono font-bold">
              {formatSar(Number(thread.listing?.askPrice ?? 0))}
            </div>
          </div>
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">المشتري</div>
            <div className="mt-1 font-bold">{thread.buyerName || 'مشتري'}</div>
          </div>
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">البائع</div>
            <div className="mt-1 font-bold">{thread.sellerName || 'بائع'}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          <span>{`عدد الرسائل: ${thread.messageCount}`}</span>
          <span>{`الموضوع: ${thread.subject || 'استفسار عن العقار'}`}</span>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            data-testid="conversation-refresh"
          >
            <RefreshCw className="w-3 h-3" />
            <span>تحديث</span>
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
          <span>
            الرسائل غير المحالة لا تظهر للطرف الآخر. إحالة الرسالة تضع ختم الإحالة عليها وتفتح لها
            مسار العرض، وتبقى بيانات التواصل محجوبة في كل الأحوال.
          </span>
        </div>
      </div>

      {/* Lease banner (AD-10) */}
      {isMine && lockInfo ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl bg-primary p-3 text-xs font-bold text-white shadow-sm"
          data-testid="conversation-lock-banner"
        >
          <span className="inline-flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>القفل بحوزتك — المتبقي</span>
            <span dir="ltr" className="font-mono">
              {formatLockCountdown(secondsLeft ?? lockInfo.remainingSeconds)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => runAction('release', undefined, 'تم تحرير قفل المحادثة.')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25"
            data-testid="conversation-release"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>تحرير القفل</span>
          </button>
        </div>
      ) : isOther && lockInfo ? (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 space-y-2"
          data-testid="conversation-readonly-banner"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-700" />
            <span>{`قيد المعالجة بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}</span>
            <span dir="ltr" className="font-mono text-[11px]">
              {`(${formatLockCountdown(lockInfo.remainingSeconds)})`}
            </span>
          </div>
          <p className="text-[11px] font-normal">
            يمكنك الاطلاع على المحادثة فقط حتى يحرّر المشرف القفل أو تنتهي مدة الاستئجار.
          </p>
          {showForceUnlock ? (
            <div className="space-y-2">
              <textarea
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="سبب فك القفل (5 أحرف على الأقل)"
                data-testid="conversation-force-unlock-reason"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!forceReasonValid || pendingAction !== null}
                  onClick={() =>
                    runAction(
                      'force-unlock',
                      { reason: forceReason.trim() },
                      'تم فك القفل وتسجيل السبب في سجل التدقيق.',
                    )
                  }
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  data-testid="conversation-force-unlock-confirm"
                >
                  تأكيد فك القفل
                </button>
                <button
                  type="button"
                  onClick={() => setShowForceUnlock(false)}
                  className="text-xs underline"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForceUnlock(true)}
              className="text-[11px] underline"
              data-testid="conversation-force-unlock-toggle"
            >
              فك القفل بسبب موثّق (يتطلب صلاحية Tasks.ForceUnlock)
            </button>
          )}
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-3 text-xs font-semibold"
          data-testid="conversation-claim-banner"
        >
          <span>
            {isClosed
              ? 'المحادثة مغلقة نهائياً.'
              : 'المحادثة متاحة للوساطة — استلم المهمة قبل أي قرار.'}
          </span>
          {isClosed ? null : (
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => runAction('claim', undefined, 'تم استلام المحادثة لمدة 15 دقيقة.')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
              data-testid="conversation-claim"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{pendingAction === 'claim' ? 'جارٍ الاستلام...' : 'استلام المحادثة'}</span>
            </button>
          )}
        </div>
      )}

      {banner ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-status-verifiedBorder bg-status-verifiedBg p-3 text-xs font-semibold text-status-verified"
          data-testid="conversation-banner"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{banner}</span>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-status-dangerBorder bg-status-dangerBg p-3 text-xs font-semibold text-status-danger"
          data-testid="conversation-action-error"
        >
          {actionError}
        </div>
      ) : null}

      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          سجل المحادثة الكامل
        </h2>
        <ol className="space-y-3" data-testid="conversation-timeline">
          {thread.messages.map((message) => (
            <AdminMessageRow key={message.id} message={message} />
          ))}
        </ol>
      </div>

      {/* Relay decisions — only while this admin holds the lease */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-3">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          قرار الوساطة
        </h2>

        {!isMine ? (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            لا يمكن اعتماد قرار قبل استلام المهمة. تُرفض القرارات من الخادم إذا لم يكن القفل
            بحوزتك.
          </p>
        ) : (
          <>
            <div>
              <label
                htmlFor="conversation-relay-note"
                className="block text-xs font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5"
              >
                ملاحظة إدارية تُرفق مع الإحالة (اختياري)
              </label>
              <textarea
                id="conversation-relay-note"
                value={relayNote}
                onChange={(event) => setRelayNote(event.target.value)}
                rows={2}
                maxLength={INQUIRY_MESSAGE_MAX_LENGTH}
                placeholder="تُحجب بيانات التواصل منها تلقائياً قبل الحفظ"
                data-testid="conversation-relay-note"
                className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                disabled={!canRelayToSeller || pendingAction !== null || isClosed}
                onClick={() =>
                  runAction(
                    'relay-to-seller',
                    relayNoteBody,
                    'تم إحالة الاستفسار إلى البائع بعد مراجعته.',
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-40"
                data-testid="conversation-relay-to-seller"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إحالة الاستفسار إلى البائع</span>
              </button>

              <button
                type="button"
                disabled={!canRelayToBuyer || pendingAction !== null || isClosed}
                onClick={() =>
                  runAction(
                    'relay-to-buyer',
                    relayNoteBody,
                    'تم إحالة رد البائع إلى المشتري.',
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40"
                data-testid="conversation-relay-to-buyer"
              >
                <SendHorizontal className="w-3.5 h-3.5" />
                <span>إحالة رد البائع إلى المشتري</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClose((value) => !value)}
                disabled={!canClose || pendingAction !== null || isClosed}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-dangerBorder px-3.5 py-2 text-xs font-bold text-status-danger disabled:opacity-40"
                data-testid="conversation-close-toggle"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق المحادثة بسبب</span>
              </button>
            </div>

            {showClose ? (
              <div className="space-y-2">
                <textarea
                  value={closeReason}
                  onChange={(event) => setCloseReason(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="سبب الإغلاق (5 أحرف على الأقل)"
                  data-testid="conversation-close-reason"
                  className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-xs"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!closeReasonValid || pendingAction !== null}
                    onClick={() =>
                      runAction(
                        'close',
                        { reason: closeReason.trim() },
                        'تم إغلاق المحادثة وتسجيل السبب.',
                      )
                    }
                    className="rounded-lg bg-status-danger px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    data-testid="conversation-close-confirm"
                  >
                    تأكيد الإغلاق
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClose(false)}
                    className="text-xs text-ink-secondary underline"
                  >
                    إلغاء
                  </button>
                </div>
                {!closeReasonValid && closeReason.length > 0 ? (
                  <p className="text-[11px] text-status-danger">
                    {`سبب الإغلاق يجب ألا يقل عن ${CLOSE_REASON_MIN_LENGTH} أحرف.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="flex items-center gap-1.5 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <AlertCircle className="w-3 h-3" />
              <span>كل قرار يُسجَّل في سجل التدقيق ويحرّر القفل عند الاعتماد.</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function AdminMessageRow({ message }: { message: InquiryMessageItem }) {
  const isAdmin = message.authorRole === InquiryAuthorRole.ADMIN;
  const isUnrelayed = !isAdmin && message.relayedAt === null;

  return (
    <li
      className={`rounded-xl border p-3 space-y-2 ${
        isAdmin
          ? 'border-primary/20 bg-primary/5'
          : 'border-surface-border dark:border-dark-surface-border'
      }`}
      data-testid={`conversation-message-${message.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted dark:text-dark-ink-muted">
        <span className="font-bold text-ink-secondary dark:text-dark-ink-secondary">
          {INQUIRY_AUTHOR_LABELS_AR[message.authorRole] ?? message.authorRole}
          {message.authorName && !isAdmin ? ` — ${message.authorName}` : ''}
        </span>
        <span dir="ltr">{new Date(message.createdAt).toLocaleString('ar-SA')}</span>
      </div>

      <p className="text-sm text-ink-primary dark:text-dark-ink-primary whitespace-pre-wrap leading-relaxed">
        {message.body}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {message.maskingApplied ? (
          <span className="inline-flex items-center gap-1 font-bold text-[#D97706]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>تم حجب بيانات التواصل</span>
          </span>
        ) : null}
        {isUnrelayed ? (
          <span
            className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 font-bold text-status-pending border border-status-pendingBorder"
            data-testid={`conversation-message-unrelayed-${message.id}`}
          >
            لم تُحل بعد — مخفية عن الطرف الآخر
          </span>
        ) : null}
        {message.attachments.length > 0 ? (
          <span className="text-ink-muted dark:text-dark-ink-muted">
            {`${message.attachments.length} مرفق`}
          </span>
        ) : null}
      </div>
    </li>
  );
}
