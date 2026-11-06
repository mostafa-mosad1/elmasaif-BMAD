'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  HandCoins,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  MAX_COUNTER_ROUNDS,
  OFFER_AWAITING_PARTY_LABELS_AR,
  OFFER_REJECTION_REASONS,
  OFFER_REJECTION_REASON_LABELS_AR,
  OfferRejectionReason,
  OfferThreadItem,
  OfferHistoryEntry,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { Button, EmptyState } from '../ui';
import { apiClient, describeApiError } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { OfferStatusBadge } from './offer-status-badge';
import { OfferNegotiationTimeline } from './offer-negotiation-timeline';

/** UX-DR-13 mediation transparency copy, verbatim from `EXPERIENCE.md#Offer Timeline`. */
export const MEDIATION_TRANSPARENCY_AR =
  'كافة المفاوضات تتم تحت إشراف المنصة لحماية حقوق الطرفين وعدم كشف بيانات التواصل إلا بعد إتمام الصفقة';

/** The short-poll cadence the architecture prescribes for active negotiations (15–30 s). */
export const OFFER_THREAD_POLL_INTERVAL_MS = 20_000;

export type NegotiationViewer = 'BUYER' | 'SELLER';

export interface OfferActionAvailability {
  canAccept: boolean;
  canReject: boolean;
  canCounter: boolean;
}

/**
 * Tolerates the enveloped `{ statusCode, data }` body, a bare thread, and junk — the same
 * defensiveness as `unwrapOffersPayload`. A body without `history` is not a thread.
 */
export function unwrapOfferThreadPayload(payload: unknown): OfferThreadItem | null {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as { data?: unknown };
  const candidate =
    envelope.data && typeof envelope.data === 'object' ? (envelope.data as OfferThreadItem) : (payload as OfferThreadItem);
  if (!candidate || typeof candidate !== 'object') return null;
  if (typeof candidate.id !== 'string' || !Array.isArray(candidate.history)) return null;
  return candidate;
}

/**
 * Server-side rules mirrored for the UI only (NFR1): the tray is an affordance, the API is the
 * authority. A buyer may accept or counter; only the seller may reject; nothing is offered once
 * the offer is terminal (`awaitingParty === null`) or the round cap is reached.
 */
export function resolveOfferActions(
  thread: Pick<OfferThreadItem, 'awaitingParty' | 'negotiationRound' | 'maxCounterRounds'> | null | undefined,
  viewer: NegotiationViewer,
): OfferActionAvailability {
  const awaitingParty = thread?.awaitingParty ?? null;
  const negotiationRound = Number(thread?.negotiationRound ?? 0);
  const maxCounterRounds = Number(thread?.maxCounterRounds ?? MAX_COUNTER_ROUNDS);
  const isTurn = awaitingParty === viewer;

  return {
    canAccept: isTurn,
    canReject: viewer === 'SELLER' && awaitingParty === 'SELLER',
    canCounter: isTurn && negotiationRound < maxCounterRounds,
  };
}

const OFFER_ERROR_HINTS_AR: Record<string, string> = {
  OFFER_MAX_ROUNDS_REACHED:
    'وصلت المفاوضات إلى الحد الأقصى للجولات (5 جولات). لم يبقَ سوى قبول العرض الحالي.',
  OFFER_ALREADY_EXPIRED: 'انتهت مدة صلاحية هذا العرض. يلزم تقديم عرض جديد.',
  OFFER_INVALID_STATE_TRANSITION:
    'تغيّرت حالة العرض قبل تنفيذ الإجراء. حدّث الصفحة ثم أعد المحاولة.',
  OFFER_NOT_PARTY: 'هذا العرض غير مرتبط بحسابك الحالي.',
  OFFER_NOT_FOUND: 'لم يتم العثور على هذا العرض.',
  OFFER_COUNTER_PRICE_OUT_OF_RANGE: 'قيمة العرض المقابل خارج النطاق المسموح.',
  OFFER_REJECTION_NOTE_REQUIRED: 'يجب كتابة سبب الرفض بالتفصيل (10 أحرف على الأقل).',
  OFFER_SELLER_PROFILE_REQUIRED: 'يتطلب هذا الإجراء ملف وسيط أو مالك نشِط.',
};

export function resolveOfferErrorHint(
  code?: string | null,
  fallback: string = 'تعذر تنفيذ الإجراء. أعد المحاولة بعد قليل.',
): string {
  if (code && OFFER_ERROR_HINTS_AR[code]) return OFFER_ERROR_HINTS_AR[code];
  return fallback;
}

export interface OfferNegotiationViewProps {
  offerId: string;
  viewer: NegotiationViewer;
  backHref?: string;
}

type TrayMode = 'idle' | 'counter' | 'reject';

/**
 * Mediated negotiation screen (Story 4.2 / AC#8): listing summary, ask vs current proposal,
 * round counter, lifecycle badge, the chronological timeline, the mediation transparency badge
 * and the action tray — sticky on mobile, inline from `md` up. Short-polls the thread every
 * 20 s while a party is still expected to respond, and never polls a terminal offer.
 */
export function OfferNegotiationView({ offerId, viewer, backHref }: OfferNegotiationViewProps) {
  const [thread, setThread] = useState<OfferThreadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mode, setMode] = useState<TrayMode>('idle');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [rejectReason, setRejectReason] = useState<OfferRejectionReason>('PRICE_TOO_LOW');
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(
    (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);

      apiClient
        .get(`/offers/${offerId}`)
        .then((payload) => {
          setThread(unwrapOfferThreadPayload(payload));
          setLoading(false);
        })
        .catch(() => {
          setError('تعذر تحميل تفاصيل التفاوض.');
          setLoading(false);
        });
    },
    [offerId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const awaitingParty = thread?.awaitingParty ?? null;
  const isPolling = awaitingParty !== null;

  useEffect(() => {
    if (!isPolling) return;
    const timer = window.setInterval(() => load(), OFFER_THREAD_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPolling, load]);

  const actions = useMemo(() => resolveOfferActions(thread, viewer), [thread, viewer]);

  const performer = viewer === 'BUYER' ? 'buyer' : 'seller';

  const runAction = async (label: string, action: string, body?: unknown) => {
    setPendingAction(label);
    setActionError(null);
    setBanner(null);

    try {
      await apiClient.post(`/offers/${offerId}/${action}`, body);
      setBanner(
        action.startsWith('accept')
          ? 'تم تسجيل موافقتك، والعرض الآن بانتظار الموافقة الإدارية النهائية.'
          : action.startsWith('reject')
            ? 'تم تسجيل رفض العرض وإبلاغ الإدارة بالسبب.'
            : 'تم إرسال عرضك المقابل إلى الإدارة لمراجعته قبل إحالته للطرف الآخر.',
      );
      setMode('idle');
      setCounterPrice('');
      setCounterNote('');
      setRejectNote('');
      load();
    } catch (err) {
      const failure = describeApiError(err);
      setActionError(resolveOfferErrorHint(failure.code, failure.message));
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
      <EmptyState
        icon={<X className="w-7 h-7" />}
        title={error || 'تعذر العثور على هذا العرض'}
        description="قد يكون العرض منتهياً أو خارج نطاق حسابك. أعد المحاولة أو ارجع إلى قائمة العروض."
        actionLabel="إعادة المحاولة"
        onAction={() => load(true)}
        secondaryActionLabel={backHref ? 'رجوع إلى العروض' : undefined}
        secondaryActionHref={backHref}
      />
    );
  }

  const listing = thread.listing;
  const awaitingLabel = awaitingParty ? OFFER_AWAITING_PARTY_LABELS_AR[awaitingParty] : null;
  const history: OfferHistoryEntry[] = Array.isArray(thread.history) ? thread.history : [];

  return (
    <div className="space-y-6 pb-32 md:pb-0" dir="rtl">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-primary dark:text-dark-ink-secondary"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>رجوع إلى قائمة العروض</span>
        </Link>
      ) : null}

      {/* Listing + price head */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary" />
              <span className="truncate">{listing?.title || 'عرض شراء'}</span>
            </h1>
            <p className="flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
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
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {awaitingLabel ? (
              <span
                className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
                data-testid="offer-awaiting-chip"
              >
                {awaitingLabel}
              </span>
            ) : null}
            <OfferStatusBadge status={thread.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">سعر الطلب</div>
            <div dir="ltr" className="mt-1 font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
              {formatSar(thread.askPrice)}
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">العرض الحالي</div>
            <div dir="ltr" className="mt-1 font-mono font-bold text-primary" data-testid="offer-current-price">
              {formatSar(thread.offerPrice)}
            </div>
          </div>
          <div className="rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken p-3">
            <div className="text-ink-muted dark:text-dark-ink-muted">جولة التفاوض</div>
            <div
              className="mt-1 font-mono font-bold text-ink-primary dark:text-dark-ink-primary"
              data-testid="offer-round-counter"
            >
              {`الجولة ${thread.negotiationRound} من ${thread.maxCounterRounds}`}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
          <span>{MEDIATION_TRANSPARENCY_AR}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-muted dark:text-dark-ink-muted">
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

        {thread.rejectionReason ? (
          <p className="text-[11px] text-status-danger">
            {`سبب الرفض: ${
              OFFER_REJECTION_REASON_LABELS_AR[thread.rejectionReason as OfferRejectionReason] ||
              thread.rejectionReason
            }`}
            {thread.rejectionNote ? ` — ${thread.rejectionNote}` : ''}
          </p>
        ) : null}
      </div>

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
          data-testid="offer-action-error"
        >
          {actionError}
        </div>
      ) : null}

      {/* Timeline */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-5 space-y-4">
        <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          سجل التفاوض
        </h2>
        <OfferNegotiationTimeline history={history} />
      </div>

      {/* Action tray — sticky bottom bar on mobile, inline from md up (UX-DR-10) */}
      <div
        className="sticky bottom-0 z-20 md:static md:z-auto -mx-4 sm:-mx-8 md:mx-0 border-t border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised md:bg-transparent md:border-0 md:rounded-card md:border md:border-surface-border md:dark:border-dark-surface-border px-4 sm:px-8 md:px-5 py-3 md:py-5 space-y-3"
        data-testid="offer-action-tray"
      >
        {!actions.canAccept && !actions.canCounter ? (
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            {awaitingParty
              ? OFFER_AWAITING_PARTY_LABELS_AR[awaitingParty]
              : 'لا يوجد إجراء مطلوب منك على هذا العرض حالياً.'}
          </p>
        ) : null}

        {mode === 'counter' ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="offer-counter-price"
                className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1"
              >
                قيمة العرض المقابل (ريال سعودي)
              </label>
              <input
                id="offer-counter-price"
                data-testid="offer-counter-price"
                inputMode="decimal"
                value={counterPrice}
                onChange={(event) => setCounterPrice(event.target.value)}
                className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-sm font-mono"
                placeholder="0"
              />
            </div>
            <div>
              <label
                htmlFor="offer-counter-note"
                className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1"
              >
                ملاحظة (اختياري)
              </label>
              <textarea
                id="offer-counter-note"
                data-testid="offer-counter-note"
                value={counterNote}
                onChange={(event) => setCounterNote(event.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() =>
                  runAction('counter', `counter-by-${performer}`, {
                    counterPrice,
                    note: counterNote.trim() || null,
                  })
                }
                isLoading={pendingAction === 'counter'}
                disabled={!counterPrice.trim() || pendingAction !== null}
              >
                <Send className="w-4 h-4" />
                <span>إرسال العرض المقابل</span>
              </Button>
              <Button variant="ghost" onClick={() => setMode('idle')} disabled={pendingAction !== null}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : mode === 'reject' ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="offer-reject-reason"
                className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1"
              >
                سبب الرفض (إلزامي)
              </label>
              <select
                id="offer-reject-reason"
                data-testid="offer-reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value as OfferRejectionReason)}
                className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-sm"
              >
                {OFFER_REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {OFFER_REJECTION_REASON_LABELS_AR[reason]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="offer-reject-note"
                className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1"
              >
                {rejectReason === 'OTHER' ? 'تفاصيل السبب (10 أحرف على الأقل)' : 'ملاحظة (اختياري)'}
              </label>
              <textarea
                id="offer-reject-note"
                data-testid="offer-reject-note"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                onClick={() =>
                  runAction('reject', 'reject-by-seller', {
                    reason: rejectReason,
                    note: rejectNote.trim() || null,
                  })
                }
                isLoading={pendingAction === 'reject'}
                disabled={pendingAction !== null}
              >
                <X className="w-4 h-4" />
                <span>تأكيد الرفض</span>
              </Button>
              <Button variant="ghost" onClick={() => setMode('idle')} disabled={pendingAction !== null}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {actions.canAccept ? (
              <Button
                onClick={() => runAction('accept', `accept-by-${performer}`)}
                isLoading={pendingAction === 'accept'}
                disabled={pendingAction !== null}
                className="flex-1 sm:flex-none"
                data-testid="offer-accept-action"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>قبول العرض</span>
              </Button>
            ) : null}

            {actions.canCounter ? (
              <Button
                variant="outline"
                onClick={() => setMode('counter')}
                disabled={pendingAction !== null}
                className="flex-1 sm:flex-none"
                data-testid="offer-counter-action"
              >
                <HandCoins className="w-4 h-4" />
                <span>تقديم عرض مقابل جديد</span>
              </Button>
            ) : null}

            {actions.canReject ? (
              <Button
                variant="ghost"
                onClick={() => setMode('reject')}
                disabled={pendingAction !== null}
                data-testid="offer-reject-action"
              >
                <X className="w-4 h-4" />
                <span>رفض العرض</span>
              </Button>
            ) : null}
          </div>
        )}

        {actions.canAccept && !actions.canCounter ? (
          <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
            {`بلغت المفاوضات الحد الأقصى (${thread.maxCounterRounds} جولات)، لذا يبقى القبول أو الرفض فقط.`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
