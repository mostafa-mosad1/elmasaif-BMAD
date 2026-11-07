'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  DEAL_ALREADY_RATED,
  DEAL_BUYER_PROFILE_REQUIRED,
  DEAL_IDENTITY_REQUIRED,
  DEAL_NOT_COMPLETED,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_TYPES,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DEAL_RATING_COMMENT_TOO_LONG,
  DEAL_RATING_NOT_PARTY,
  DEAL_RATING_SCORE_INVALID,
  DEAL_TERMINAL,
  INVOICE_NOT_FOUND,
  TERMINAL_DEAL_STATUSES,
  type DealPaymentProofDownload,
  type DealPaymentSlot,
  type DealPaymentType,
  type DealPaymentView as DealPaymentViewData,
  type DealStatus,
  type SubmitDealRatingInput,
} from '@elmasaif/shared';
import { Button, Card, CardContent, EmptyState } from '../ui';
import { apiClient, describeApiError } from '../../lib/api-client';
import { useAuth } from '../providers/auth-provider';
import { formatSar } from '../listings/commission-calculator';
import {
  DealCountdownBanner,
  buildDealCountdownState,
  monotonicNow,
  useDealCountdownElapsed,
} from './deal-countdown-banner';
import { DealCompletedBanner } from './deal-completed-banner';
import { DealSellerContactCard } from './deal-seller-contact-card';
import { DealInvoiceCard } from './deal-invoice-card';
import { DealRatingCard } from './deal-rating-card';
import { DealPaymentCard, formatDealAmount } from './dual-wire-transfer-cards';
import { DealStatusBadge } from './deal-status-badge';
import { buildDealProofFormData, type DealProofFormValues } from './payment-proof-dropzone';

/** Same cadence as the offer thread: a short poll, never a socket. */
export const DEAL_PAYMENT_POLL_INTERVAL_MS = 20_000;

/** Verbatim section intro from `EXPERIENCE.md#Dual Wire Transfer`. */
export const DEAL_PAYMENT_SECTION_INTRO_AR =
  'يرجى تحويل سعي المنصة إلى حساب المنصة المعتمد، وقيمة العقار مباشرة إلى حساب البائع الموثق';

/** Same copy (and same link) as the buyer dashboard — extracted here, not reinvented. */
export const DEAL_IDENTITY_NOTICE_AR = 'أكمل توثيق هويتك لتفعيل إثباتات الدفع';
export const DEAL_IDENTITY_NOTICE_BODY_AR =
  'يلزم رفع وثيقة هوية نظيفة قبل تقديم إثباتات الدفع للصفقات.';

export const DEAL_PAYMENT_UPLOAD_SUCCESS_AR = 'تم استلام إيصال التحويل وهو قيد المراجعة الإدارية';

/** Every refusal code this screen can receive, in the buyer's words (AC-13, trap T-14). */
export const DEAL_PAYMENT_ERROR_HINTS_AR: Record<string, string> = {
  [DEAL_NOT_FOUND]: 'لم يتم العثور على هذه الصفقة.',
  [DEAL_NOT_PARTY]: 'هذه الصفقة غير مرتبطة بحسابك الحالي.',
  [DEAL_BUYER_PROFILE_REQUIRED]: 'يتطلب هذا الإجراء ملف مشترٍ نشِط.',
  [DEAL_TERMINAL]: 'انتهت هذه الصفقة، ولم يبقَ مجال لرفع الإيصالات.',
  [DEAL_PAYMENT_DEADLINE_PASSED]:
    'انتهت مهلة 48 ساعة لرفع إيصال التحويل، وتعذر استلام الإيصال.',
  [DEAL_PAYMENT_REVIEW_COMPLETE]:
    'الإيصال قيد التدقيق الإداري أو تم تأكيده، ولا يمكن استبداله حالياً.',
  [DEAL_PAYMENT_TYPE_INVALID]: 'نوع الدفعة المطلوب غير صالح لهذه الصفقة.',
  [DEAL_IDENTITY_REQUIRED]: 'أكمل توثيق هويتك أولاً قبل رفع إيصال التحويل.',
  [DEAL_PLATFORM_ACCOUNT_UNAVAILABLE]:
    'تعذر تحميل حساب المنصة المعتمد للتحصيل. يرجى التواصل مع الدعم الفني.',
  [DEAL_PAYMENT_PROOF_REQUIRED]: 'يرجى اختيار ملف إيصال التحويل.',
  [DEAL_PAYMENT_PROOF_TOO_LARGE]: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت.',
  [DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE]: 'نوع الملف غير مدعوم. اختر PDF أو JPEG أو PNG.',
  [DEAL_PAYMENT_PROOF_INFECTED]: 'تم رفض الملف بعد فحص أمني. أعد رفع إيصال آخر.',
  [DEAL_PAYMENT_PROOF_NOT_FOUND]: 'لم يتم العثور على إيصال التحويل المطلوب.',
  [DEAL_PAYMENT_PROOF_SCAN_FAILED]: 'تعذر إتمام الفحص الأمني للملف. أعد المحاولة بعد قليل.',
  [DEAL_NOT_COMPLETED]: 'لا يمكن تقييم الصفقة إلا بعد اكتمالها بنجاح.',
  [DEAL_ALREADY_RATED]: 'تم تقييم هذه الصفقة مسبقاً.',
  [DEAL_RATING_SCORE_INVALID]: 'تقييم الصفقة يجب أن يكون بين 1 و 5 نجوم.',
  [DEAL_RATING_COMMENT_TOO_LONG]: 'التعليق يجب ألا يتجاوز 500 حرف.',
  [DEAL_RATING_NOT_PARTY]: 'يحق لمشتري الصفقة فقط تقديم التقييم.',
  [INVOICE_NOT_FOUND]: 'فاتورة الصفقة غير موجودة أو لم تصدر بعد.',
  FILE_QUARANTINED: 'الإيصال قيد الفحص الأمني. أعد المحاولة بعد قليل.',
};

export function resolveDealPaymentErrorHint(
  code?: string | null,
  fallback: string = 'تعذر تنفيذ الإجراء. أعد المحاولة بعد قليل.',
): string {
  if (code && DEAL_PAYMENT_ERROR_HINTS_AR[code]) return DEAL_PAYMENT_ERROR_HINTS_AR[code];
  return fallback;
}

/**
 * Tolerates the `{ statusCode, data }` envelope, a bare view and junk — the same defensiveness as
 * `unwrapOfferThreadPayload`. A body without `payments` is not a payment view.
 */
export function unwrapDealPaymentPayload(payload: unknown): DealPaymentViewData | null {
  if (!payload || typeof payload !== 'object') return null;

  const envelope = payload as { data?: unknown };
  const candidate =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as DealPaymentViewData)
      : (payload as DealPaymentViewData);

  if (!candidate || typeof candidate !== 'object') return null;
  if (typeof candidate.id !== 'string' || !Array.isArray(candidate.payments)) return null;
  return candidate;
}

/** AC-12: `{ downloadUrl, expiresInSeconds }`, enveloped or bare. */
export function unwrapDealProofDownloadPayload(
  payload: unknown,
): DealPaymentProofDownload | null {
  if (!payload || typeof payload !== 'object') return null;

  const envelope = payload as { data?: unknown };
  const candidate =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as DealPaymentProofDownload)
      : (payload as DealPaymentProofDownload);

  if (!candidate || typeof candidate !== 'object') return null;
  if (typeof candidate.downloadUrl !== 'string' || !candidate.downloadUrl) return null;
  return candidate;
}

/** Display-only rendering of the frozen `Decimal(5,4)` fraction (`0.025` → `2.5%`). */
export function formatCommissionRatePercent(
  rate: string | number | null | undefined,
): string {
  // `Number(null)` and `Number('')` are 0, so blank snapshots must be rejected first.
  if (rate === null || rate === undefined || rate === '') return '—';
  const numeric = Number(rate);
  if (!Number.isFinite(numeric)) return '—';
  const percent = Number((numeric * 100).toFixed(2));
  return `${percent.toLocaleString('en-US')}%`;
}

export interface DealPaymentSummaryRow {
  key: 'dealPrice' | 'commissionRate' | 'platformCommission' | 'totalAmount';
  labelAr: string;
  value: string;
}

/**
 * Task 6.6: the frozen financial summary, read straight off the payload. Nothing is recomputed —
 * `totalAmount` is the value frozen at approval, not `dealPrice + platformCommission` (FR-29).
 */
export function buildDealPaymentSummaryRows(
  view: Pick<
    DealPaymentViewData,
    'dealPrice' | 'platformCommission' | 'totalAmount' | 'commissionRateSnapshot'
  >,
): DealPaymentSummaryRow[] {
  return [
    {
      key: 'dealPrice',
      labelAr: 'قيمة العقار المتفق عليها',
      value: formatDealAmount(view.dealPrice),
    },
    {
      key: 'commissionRate',
      labelAr: 'نسبة سعي المنصة (مثبتة عند الاعتماد)',
      value: formatCommissionRatePercent(view.commissionRateSnapshot),
    },
    {
      key: 'platformCommission',
      labelAr: 'سعي المنصة',
      value: formatDealAmount(view.platformCommission),
    },
    {
      key: 'totalAmount',
      labelAr: 'إجمالي المبلغ المستحق',
      value: formatDealAmount(view.totalAmount),
    },
  ];
}

export interface DealPaymentViewProps {
  dealId: string;
}

type ProofFieldState = Partial<Record<DealPaymentType, string>>;

/**
 * AC-3…AC-5, UX-DR4/DR5: the buyer's deal payment screen. One fetch (`GET /deals/:id`), one
 * countdown (`serverNow` + `performance.now()` deltas), two wire-transfer cards, the frozen
 * summary, the identity prerequisite and a 20-second short poll while the window is open.
 */
export function DealPaymentView({ dealId }: DealPaymentViewProps) {
  const { identityStatus } = useAuth();

  const [view, setView] = useState<DealPaymentViewData | null>(null);
  const [anchorMs, setAnchorMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DealPaymentType | null>(null);
  const [proofErrors, setProofErrors] = useState<ProofFieldState>({});
  const [proofSuccess, setProofSuccess] = useState<ProofFieldState>({});

  const load = useCallback(() => {
    setError(null);

    return apiClient
      .get<unknown>(`/deals/${dealId}`)
      .then((payload) => {
        const next = unwrapDealPaymentPayload(payload);
        if (!next) {
          setError('تعذر قراءة بيانات الصفقة.');
          setView(null);
        } else {
          setView(next);
          setAnchorMs(monotonicNow());
        }
        setLoading(false);
      })
      .catch((err) => {
        const failure = describeApiError(err);
        setError(resolveDealPaymentErrorHint(failure.code, 'تعذر تحميل بيانات الصفقة.'));
        setLoading(false);
      });
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  const elapsedMs = useDealCountdownElapsed(anchorMs);
  const countdown = useMemo(
    () =>
      buildDealCountdownState({
        createdAt: view?.createdAt ?? '',
        deadline: view?.paymentDeadline ?? '',
        serverNow: view?.serverNow ?? '',
        elapsedMs,
      }),
    [view?.createdAt, view?.paymentDeadline, view?.serverNow, elapsedMs],
  );

  const isTerminal = Boolean(
    view && TERMINAL_DEAL_STATUSES.includes(view.status as DealStatus),
  );
  const isPolling = Boolean(view) && !countdown.isExpired && !isTerminal;

  useEffect(() => {
    if (!isPolling) return;
    const timer = window.setInterval(() => {
      load();
    }, DEAL_PAYMENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPolling, load]);

  const identityBlocked = Boolean(identityStatus && !identityStatus.canUploadDealPaymentProof);

  const summaryRows = useMemo(
    () => (view ? buildDealPaymentSummaryRows(view) : []),
    [view],
  );

  const handleUpload = useCallback(
    async (
      paymentType: DealPaymentType,
      file: File,
      values: DealProofFormValues,
    ): Promise<boolean> => {
      setUploadingType(paymentType);
      setActionError(null);
      setBanner(null);
      setProofErrors((current) => ({ ...current, [paymentType]: undefined }));
      setProofSuccess((current) => ({ ...current, [paymentType]: undefined }));

      try {
        const payload = await apiClient<{ message?: string; data?: DealPaymentSlot }>(
          `/deals/${dealId}/payments/${paymentType}/proof`,
          { method: 'POST', body: buildDealProofFormData(file, values) },
        );

        const message = payload?.message ?? DEAL_PAYMENT_UPLOAD_SUCCESS_AR;
        setProofSuccess((current) => ({ ...current, [paymentType]: message }));
        setBanner(message);
        load();
        return true;
      } catch (err) {
        const failure = describeApiError(err);
        setProofErrors((current) => ({
          ...current,
          [paymentType]: resolveDealPaymentErrorHint(failure.code, failure.message),
        }));
        return false;
      } finally {
        setUploadingType(null);
      }
    },
    [dealId, load],
  );

  const handleDownload = useCallback(
    async (paymentType: DealPaymentType) => {
      setActionError(null);
      try {
        const payload = await apiClient<unknown>(
          `/deals/${dealId}/payments/${paymentType}/proof-url`,
        );
        const download = unwrapDealProofDownloadPayload(payload);
        if (!download) {
          setActionError('تعذر إنشاء رابط تحميل الإيصال.');
          return;
        }
        if (typeof window !== 'undefined') {
          window.open(download.downloadUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (err) {
        const failure = describeApiError(err);
        setActionError(
          resolveDealPaymentErrorHint(failure.code, 'تعذر تحميل الإيصال. أعد المحاولة.'),
        );
      }
    },
    [dealId],
  );

  if (loading) {
    return (
      <div className="space-y-4" dir="rtl" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken" />
        <div className="h-40 animate-pulse rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
          <div className="h-72 animate-pulse rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
        </div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <EmptyState
        title={error ?? 'تعذر تحميل بيانات الصفقة.'}
        description="قد تكون الصفقة أُغلقت أو أن الرابط غير صحيح. أعد المحاولة أو ارجع إلى قائمة صفقاتك."
        actionLabel="إعادة المحاولة"
        onAction={() => {
          setLoading(true);
          load();
        }}
        secondaryActionLabel="العودة إلى صفقاتي"
        secondaryActionHref="/app/buyer/deals"
      />
    );
  }

  const platformSlot =
    view.payments.find((payment) => payment.paymentType === DEAL_PAYMENT_TYPES[0]) ?? null;
  const sellerSlot =
    view.payments.find((payment) => payment.paymentType === DEAL_PAYMENT_TYPES[1]) ?? null;
  const sharedCardProps = { deal: { status: view.status, isExpired: countdown.isExpired } };
  const isCompleted = view.status === 'COMPLETED';

  const handleRatingSubmit = async (input: SubmitDealRatingInput) => {
    try {
      setActionError(null);
      await apiClient.post(`/deals/${dealId}/rating`, input);
      setBanner('تم تسجيل تقييمك بنجاح');
      await load();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { code?: string; message?: string } } } | undefined;
      const code = errorObj?.response?.data?.code;
      const message =
        code && DEAL_PAYMENT_ERROR_HINTS_AR[code]
          ? DEAL_PAYMENT_ERROR_HINTS_AR[code]
          : errorObj?.response?.data?.message || 'تعذر إرسال التقييم. أعد المحاولة بعد قليل.';
      throw new Error(message);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/app/buyer/deals"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            صفقاتي والدفع
          </Link>
          <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
            {`صفقة ${view.dealNumber}`}
          </h1>
          <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
            {`العقار: ${view.propertyTitle}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DealStatusBadge status={view.status} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => load()}
            aria-label="تحديث بيانات الصفقة"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            تحديث
          </Button>
        </div>
      </div>

      {isCompleted ? (
        <DealCompletedBanner completedAt={view.completedAt} />
      ) : (
        <DealCountdownBanner state={countdown} />
      )}

      {isCompleted ? (
        <div className="space-y-6">
          <DealSellerContactCard sellerContact={view.sellerContact} />
          <DealInvoiceCard invoice={view.invoice} />
          <DealRatingCard
            dealId={view.id}
            rating={view.rating}
            canRate={view.canRate}
            onSubmitRating={handleRatingSubmit}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {DEAL_PAYMENT_SECTION_INTRO_AR}
        </p>
      )}

      {identityBlocked ? (
        <section
          role="status"
          className="rounded-xl border border-accent/30 bg-accent-light p-5"
          data-testid="deal-identity-notice"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="font-bold text-ink-primary dark:text-dark-ink-primary">
                {DEAL_IDENTITY_NOTICE_AR}
              </h2>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                {DEAL_IDENTITY_NOTICE_BODY_AR}
              </p>
              <Link
                href="/app/settings/identity"
                className="inline-flex text-sm font-semibold text-primary underline"
              >
                الانتقال إلى توثيق الهوية
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="rounded-xl border border-status-danger/20 bg-status-dangerBg p-3 text-sm text-status-danger"
        >
          {actionError}
        </p>
      ) : null}

      {banner ? (
        <p
          role="status"
          className="rounded-xl border border-status-verified/20 bg-status-verifiedBg p-3 text-sm text-status-verified"
        >
          {banner}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DealPaymentCard
          accent="platform"
          title="سعي المنصة"
          slot={platformSlot}
          amount={view.platformCommission}
          accountHolderName={view.platformAccount.accountHolderName}
          bankName={view.platformAccount.bankName}
          iban={view.platformAccount.iban}
          ibanFormatted={view.platformAccount.ibanFormatted}
          referenceCode={view.dealReferenceCode}
          prerequisiteNotice={identityBlocked ? DEAL_IDENTITY_NOTICE_AR : null}
          isUploading={uploadingType === DEAL_PAYMENT_TYPES[0]}
          uploadError={proofErrors[DEAL_PAYMENT_TYPES[0]] ?? null}
          uploadSuccess={proofSuccess[DEAL_PAYMENT_TYPES[0]] ?? null}
          onUploadProof={(file, values) => handleUpload(DEAL_PAYMENT_TYPES[0], file, values)}
          onDownloadProof={() => handleDownload(DEAL_PAYMENT_TYPES[0])}
          {...sharedCardProps}
        />

        <DealPaymentCard
          accent="seller"
          title="قيمة العقار للبائع"
          slot={sellerSlot}
          amount={view.dealPrice}
          accountHolderName={view.sellerPayout.accountHolderName}
          bankName={view.sellerPayout.bankName}
          iban={view.sellerPayout.iban}
          ibanFormatted={view.sellerPayout.ibanFormatted}
          prerequisiteNotice={identityBlocked ? DEAL_IDENTITY_NOTICE_AR : null}
          isUploading={uploadingType === DEAL_PAYMENT_TYPES[1]}
          uploadError={proofErrors[DEAL_PAYMENT_TYPES[1]] ?? null}
          uploadSuccess={proofSuccess[DEAL_PAYMENT_TYPES[1]] ?? null}
          onUploadProof={(file, values) => handleUpload(DEAL_PAYMENT_TYPES[1], file, values)}
          onDownloadProof={() => handleDownload(DEAL_PAYMENT_TYPES[1])}
          {...sharedCardProps}
        />
      </div>

      <Card className="border-surface-borderStrong">
        <CardContent className="p-5">
          <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
            الملخص المالي المثبت عند اعتماد الصفقة
          </h2>
          <p className="mt-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
            المبالغ أدناه محفوظة كما اعتُمدت، ولا يعاد حسابها من إعدادات المنصة.
          </p>
          <dl className="mt-3 divide-y divide-surface-border dark:divide-dark-surface-border">
            {summaryRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 py-2 text-xs"
                data-testid={`deal-summary-${row.key}`}
              >
                <dt className="text-ink-secondary dark:text-dark-ink-secondary">{row.labelAr}</dt>
                <dd
                  dir="ltr"
                  className="font-mono font-bold text-ink-primary dark:text-dark-ink-primary"
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-ink-muted dark:text-dark-ink-muted">
            {`إجمالي المطالبة: ${formatSar(Number(view.totalAmount) || 0)} — تُحوَّل قيمة العقار مباشرة إلى البائع، ولا تمر عبر المنصة.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
