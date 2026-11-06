'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HandCoins,
  Lock,
  RefreshCw,
  Send,
  SendHorizontal,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import {
  DEFAULT_COMMISSION_RATE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  OFFER_AWAITING_PARTY_LABELS_AR,
  OfferStatus,
  OfferThreadItem,
  PROPERTY_TYPE_LABELS_AR,
  computeDealAmounts,
  type DealAmounts,
  type DealBinding,
  type FinalApproveDealInput,
  type OfferLockInfo,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { OfferStatusBadge } from '../offers/offer-status-badge';
import { OfferNegotiationTimeline } from '../offers/offer-negotiation-timeline';
import {
  MEDIATION_TRANSPARENCY_AR,
  resolveOfferErrorHint,
  unwrapOfferThreadPayload,
} from '../offers/offer-negotiation-view';
import { formatLockCountdown } from './offer-mediation-queue';

/**
 * AD-10 prescribes a 5-minute heartbeat against the 15-minute lease; the workspace renews every
 * 4 minutes so a dropped request still leaves a full cadence of slack before the lock lapses.
 */
export const MEDIATION_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

const ADMIN_REJECT_MIN_LENGTH = 5;
const FORCE_UNLOCK_MIN_LENGTH = 5;

/** Story 5.1 / AD-2: the offer is the subject, so the endpoint takes no path parameter. */
export const FINAL_APPROVE_DEAL_ENDPOINT = '/admin/deals/final-approve';

/**
 * The exact request body `POST /admin/deals/final-approve` validates (AC-1). Exported so the
 * workspace spec asserts the payload rather than trusting the click handler.
 */
export function buildFinalApprovePayload(offerId: string): FinalApproveDealInput {
  return { offerId };
}

/**
 * AC-11: final approval is a confirmation-gated action, and it is only legal while the caller
 * holds the live lease (the API re-validates it inside the transaction — this is an affordance).
 */
export function canFinalApprove(
  status: OfferStatus | string | null | undefined,
  lockInfo: OfferLockInfo | null | undefined,
): boolean {
  return (
    status === OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL &&
    Boolean(lockInfo?.isLocked && lockInfo?.isLockedByCurrentAdmin)
  );
}

/** From the final-approval stage onwards the frozen figures are the ones that matter. */
export function shouldShowDealPreview(
  status: OfferStatus | string | null | undefined,
): boolean {
  return (
    status === OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL ||
    status === OfferStatus.CONVERTED_TO_DEAL
  );
}

/** FR-29 preview: the very arithmetic the binding transaction will freeze, run client-side. */
export function buildDealPreview(offerPrice: number | string): DealAmounts {
  return computeDealAmounts({
    dealPrice: String(offerPrice),
    commissionRate: DEFAULT_COMMISSION_RATE,
    fixedCommission: DEFAULT_FIXED_COMMISSION_SAR,
  });
}

/** AC-11: one place that knows the endpoint and the body. */
export async function postFinalApprove(
  offerId: string,
): Promise<{ statusCode: number; message?: string; data: DealBinding }> {
  return apiClient.post(FINAL_APPROVE_DEAL_ENDPOINT, buildFinalApprovePayload(offerId));
}

const commissionPercentLabel = `${(DEFAULT_COMMISSION_RATE * 100).toFixed(1)}%`;

interface MediationAction {
  action: string;
  label: string;
  successBanner: string | ((response: any) => string);
  body?: unknown;
  /** Overrides the default `/admin/offers/:id/:action` POST (Story 5.1 posts to `/admin/deals`). */
  request?: () => Promise<any>;
}

/**
 * FR-29 preview panel: the figures are computed by the shared fixed-point helper, so what the
 * administrator sees here is byte-for-byte what the binding transaction will store. `formatSar`
 * only groups and rounds for display — the frozen value never goes through it.
 */
export function DealBindingPreview({ offerPrice }: { offerPrice: number | string }) {
  const amounts = buildDealPreview(offerPrice);

  const rows = [
    { label: 'سعر الصفقة', value: amounts.finalDealPrice, emphasis: false },
    { label: `سعي المنصة (${commissionPercentLabel})`, value: amounts.finalCommission, emphasis: false },
    { label: 'الإجمالي المطلوب من المشتري', value: amounts.finalTotal, emphasis: true },
  ];

  return (
    <div
      className="rounded-card border border-primary/30 bg-primary/5 p-5 space-y-3"
      data-testid="mediation-deal-preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-primary" />
          <span>الأرقام المجمَّدة للصفقة</span>
        </h2>
        <span className="inline-flex items-center rounded-pill border border-primary/30 px-2 py-0.5 text-[11px] font-bold text-primary">
          {`مهلة السداد ${DEFAULT_PAYMENT_WINDOW_HOURS} ساعة`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg bg-surface dark:bg-dark-surface-raised p-3"
          >
            <div className="text-ink-muted dark:text-dark-ink-muted">{row.label}</div>
            <div
              dir="ltr"
              className={`mt-1 font-mono font-bold ${row.emphasis ? 'text-primary' : ''}`}
            >
              {formatSar(Number(row.value))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
        تُجمَّد هذه المبالغ وسعي المنصة ومهلة السداد عند الاعتماد النهائي، ولا تتأثر بأي تغيير لاحق
        في إعدادات المنصة.
      </p>
    </div>
  );
}

/**
 * AC-11: the final-approval action. Self-gating so the affordance cannot drift from the rule the
 * API enforces: hidden unless the caller holds the lease *and* the offer awaits final approval.
 */
export function FinalApproveSection({
  status,
  lockInfo,
  pending,
  onApprove,
}: {
  status: OfferStatus | string | null | undefined;
  lockInfo: OfferLockInfo | null | undefined;
  pending: boolean;
  onApprove: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);

  if (!canFinalApprove(status, lockInfo)) return null;

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      {confirming ? (
        <div className="space-y-2" data-testid="mediation-final-approve-confirm">
          <p className="text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
            سيتم إنشاء صفقة نهائية وحجز الإعلان، وتحويل العرض إلى «محوَّل إلى صفقة». لا يمكن التراجع
            عن هذه الخطوة من هذه الشاشة.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
              data-testid="mediation-final-approve-submit"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{pending ? 'جارٍ إنشاء الصفقة...' : 'تأكيد الاعتماد النهائي'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-ink-secondary underline"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
          data-testid="mediation-final-approve"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>الاعتماد النهائي وإنشاء الصفقة</span>
        </button>
      )}
    </div>
  );
}

/**
 * Administrative mediation workspace (Story 4.2 / AC#1, AC#4, AC#6, AC#9; AD-10). The caller must
 * hold the 15-minute lease before any decision commits — the API re-validates it inside the
 * transaction — so a second administrator always sees «قيد المعالجة بواسطة …» and read-only mode.
 */
export function OfferMediationWorkspace({ offerId }: { offerId: string }) {
  const [thread, setThread] = useState<OfferThreadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [showForceUnlock, setShowForceUnlock] = useState(false);

  const load = useCallback(
    (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);

      apiClient
        .get(`/admin/offers/${offerId}`)
        .then((payload) => {
          setThread(unwrapOfferThreadPayload(payload));
          setLoading(false);
        })
        .catch(() => {
          setError('تعذر تحميل ملف الوساطة.');
          setLoading(false);
        });
    },
    [offerId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const lockInfo = thread?.lockInfo;
  const isMine = Boolean(lockInfo?.isLocked && lockInfo?.isLockedByCurrentAdmin);
  const isOther = Boolean(lockInfo?.isLocked && !lockInfo?.isLockedByCurrentAdmin);

  useEffect(() => {
    if (!isMine) return undefined;
    const timer = window.setInterval(() => {
      apiClient.post(`/admin/offers/${offerId}/heartbeat`).catch(() => {
        // A lost heartbeat is recoverable: the lease lazily expires and the task can be claimed.
      });
    }, MEDIATION_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isMine, offerId]);

  const runAction = async ({
    action,
    label,
    successBanner,
    body,
    request,
  }: MediationAction) => {
    setPendingAction(label);
    setActionError(null);
    setBanner(null);
    try {
      const response = request
        ? await request()
        : await apiClient.post(`/admin/offers/${offerId}/${action}`, body);
      setBanner(
        typeof successBanner === 'function' ? successBanner(response) : successBanner,
      );
      setShowReject(false);
      setRejectReason('');
      setShowForceUnlock(false);
      setForceReason('');
      load();
    } catch (err) {
      const failure = describeApiError(err);
      const holder = readLockHolderName(failure.details);
      setActionError(
        holder
          ? `القفل مملوك حالياً بواسطة ${holder}.`
          : resolveOfferErrorHint(failure.code, failure.message),
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
        <span>{error || 'لم يتم العثور على هذا العرض.'}</span>
        <button type="button" onClick={() => load(true)} className="underline">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const listing = thread.listing;
  const canRelayToSeller = thread.status === OfferStatus.PENDING_ADMIN_REVIEW;
  const canRelayToBuyer = thread.status === OfferStatus.COUNTER_OFFERED;
  const rejectReasonValid = rejectReason.trim().length >= ADMIN_REJECT_MIN_LENGTH;
  const forceReasonValid = forceReason.trim().length >= FORCE_UNLOCK_MIN_LENGTH;

  return (
    <div dir="rtl" className="space-y-6">
      <Link
        href="/admin/negotiations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-primary dark:text-dark-ink-secondary"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        <span>رجوع إلى طابور الوساطة</span>
      </Link>

      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary" />
              <span className="truncate">{listing?.title || 'عرض شراء'}</span>
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
                {OFFER_AWAITING_PARTY_LABELS_AR[thread.awaitingParty]}
              </span>
            ) : null}
            <OfferStatusBadge status={thread.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">سعر الطلب</div>
            <div dir="ltr" className="mt-1 font-mono font-bold">
              {formatSar(thread.askPrice)}
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">العرض الحالي</div>
            <div dir="ltr" className="mt-1 font-mono font-bold text-primary">
              {formatSar(thread.offerPrice)}
            </div>
          </div>
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">الجولة</div>
            <div className="mt-1 font-mono font-bold">
              {`${thread.negotiationRound} من ${thread.maxCounterRounds}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          <span>{`المشتري: ${thread.buyerName || 'مشتري'}`}</span>
          <span>{`البائع: ${thread.sellerName || 'بائع'}`}</span>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            <span>تحديث</span>
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
          <span>{MEDIATION_TRANSPARENCY_AR}</span>
        </div>
      </div>

      {/* Story 5.1 / FR-29: the figures the binding transaction will freeze */}
      {shouldShowDealPreview(thread.status) ? (
        <DealBindingPreview offerPrice={thread.offerPrice} />
      ) : null}

      {/* Lease banner (AD-10) */}
      {isMine && lockInfo ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl bg-[#1B4332] p-3 text-xs font-bold text-white"
          data-testid="mediation-lock-banner"
        >
          <span className="inline-flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>القفل بحوزتك — المتبقي</span>
            <span dir="ltr" className="font-mono">
              {formatLockCountdown(lockInfo.remainingSeconds)}
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              runAction({
                action: 'release',
                label: 'release',
                successBanner: 'تم تحرير قفل الوساطة.',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>تحرير القفل</span>
          </button>
        </div>
      ) : isOther && lockInfo ? (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 space-y-2"
          data-testid="mediation-readonly-banner"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-700" />
            <span>{`قيد المعالجة بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}</span>
            <span dir="ltr" className="font-mono text-[11px]">
              {`(${formatLockCountdown(lockInfo.remainingSeconds)})`}
            </span>
          </div>
          <p className="text-[11px] font-normal">
            يمكنك الاطلاع على التفاوض فقط حتى يحرّر المشرف القفل أو تنتهي مدة الاستئجار.
          </p>
          {showForceUnlock ? (
            <div className="space-y-2">
              <textarea
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="سبب فك القفل (5 أحرف على الأقل)"
                data-testid="mediation-force-unlock-reason"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!forceReasonValid || pendingAction !== null}
                  onClick={() =>
                    runAction({
                      action: 'force-unlock',
                      label: 'force-unlock',
                      successBanner: 'تم فك القفل وتسجيل السبب في سجل التدقيق.',
                      body: { reason: forceReason.trim() },
                    })
                  }
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
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
            >
              فك القفل بسبب موثّق (يتطلب صلاحية Tasks.ForceUnlock)
            </button>
          )}
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-3 text-xs font-semibold"
          data-testid="mediation-claim-banner"
        >
          <span>العرض متاح للوساطة — استلم المهمة قبل اعتماد أي قرار.</span>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              runAction({
                action: 'claim',
                label: 'claim',
                successBanner: 'تم استلام مهمة الوساطة لمدة 15 دقيقة.',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B4332] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{pendingAction === 'claim' ? 'جارٍ الاستلام...' : 'استلام المهمة'}</span>
          </button>
        </div>
      )}

      {banner ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-status-verifiedBorder bg-status-verifiedBg p-3 text-xs font-semibold text-status-verified"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{banner}</span>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-status-dangerBorder bg-status-dangerBg p-3 text-xs font-semibold text-status-danger"
          data-testid="mediation-action-error"
        >
          {actionError}
        </div>
      ) : null}

      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">سجل التفاوض</h2>
        <OfferNegotiationTimeline history={Array.isArray(thread.history) ? thread.history : []} />
      </div>

      {/* Mediation decisions — only while this admin holds the lease */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-3">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          قرار الوساطة
        </h2>

        {!isMine ? (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            لا يمكن اعتماد قرار قبل استلام المهمة. القرارات تُرفض من الخادم إذا لم يكن القفل بحوزتك.
          </p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                disabled={!canRelayToSeller || pendingAction !== null}
                onClick={() =>
                  runAction({
                    action: 'relay-to-seller',
                    label: 'relay-to-seller',
                    successBanner: 'تم إرسال العرض إلى البائع بعد اعتماده.',
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1B4332] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40"
                data-testid="mediation-relay-to-seller"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال العرض إلى البائع</span>
              </button>

              <button
                type="button"
                disabled={!canRelayToBuyer || pendingAction !== null}
                onClick={() =>
                  runAction({
                    action: 'relay-to-buyer',
                    label: 'relay-to-buyer',
                    successBanner: 'تم إرسال العرض المضاد إلى المشتري.',
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40"
                data-testid="mediation-relay-to-buyer"
              >
                <SendHorizontal className="w-3.5 h-3.5" />
                <span>إرسال العرض المضاد إلى المشتري</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReject((value) => !value)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-dangerBorder px-3.5 py-2 text-xs font-bold text-status-danger"
                data-testid="mediation-reject-toggle"
              >
                <X className="w-3.5 h-3.5" />
                <span>رفض إلزامي بسبب</span>
              </button>
            </div>

            {/* Story 5.1 / AC-11: confirmation-gated, lease-gated final approval */}
            <FinalApproveSection
              status={thread.status}
              lockInfo={lockInfo}
              pending={pendingAction !== null}
              onApprove={() =>
                runAction({
                  action: 'final-approve',
                  label: 'final-approve',
                  request: () => postFinalApprove(offerId),
                  successBanner: (response) =>
                    `تم إنشاء الصفقة برقم مرجعي ${
                      response?.data?.dealReferenceCode ?? '—'
                    } وحجز الإعلان.`,
                })
              }
            />

            {showReject ? (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="سبب الرفض الإداري (5 أحرف على الأقل)"
                  data-testid="mediation-reject-reason"
                  className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-xs"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!rejectReasonValid || pendingAction !== null}
                    onClick={() =>
                      runAction({
                        action: 'reject',
                        label: 'reject',
                        successBanner: 'تم رفض العرض إدارياً وتسجيل السبب.',
                        body: { reason: rejectReason.trim() },
                      })
                    }
                    className="rounded-lg bg-status-danger px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    تأكيد الرفض الإداري
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    className="text-xs text-ink-secondary underline"
                  >
                    إلغاء
                  </button>
                </div>
                {!rejectReasonValid && rejectReason.length > 0 ? (
                  <p className="text-[11px] text-status-danger">
                    {`سبب الرفض يجب ألا يقل عن ${ADMIN_REJECT_MIN_LENGTH} أحرف.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="flex items-center gap-1.5 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <AlertCircle className="w-3 h-3" />
              <span>كل قرار يُسجَّل في سجل التفاوض وسجل التدقيق ويحرّر القفل عند الاعتماد.</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
