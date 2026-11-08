'use client';

import React from 'react';
import { Building2, Download, Landmark } from 'lucide-react';
import {
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPES,
  TERMINAL_DEAL_STATUSES,
  isPaymentUploadable,
  type DealPaymentSlot,
  type DealStatus,
} from '@elmasaif/shared';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CopyButton } from '../ui/copy-button';
import { formatSar } from '../listings/commission-calculator';
import { DealPaymentStatusBadge } from './deal-payment-status-badge';
import { DEAL_COUNTDOWN_EXPIRED_AR } from './deal-countdown-banner';
import { PaymentProofDropzone, type DealProofFormValues } from './payment-proof-dropzone';

/**
 * Display-only formatting. `Number()` is permitted **only** inside `formatSar`'s signature; the
 * wire value stays a decimal string and no amount is ever recomputed here (trap T-4, FR-29).
 */
export function formatDealAmount(amount: string | number | null | undefined): string {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? formatSar(numeric) : '—';
}

export interface PaymentSlotActions {
  canUpload: boolean;
  canDownload: boolean;
  lockReasonAr: string | null;
}

export const SLOT_LOCK_REASONS_AR = {
  dealClosed: 'الصفقة مغلقة، ولم يبقَ مجال لرفع الإيصالات.',
  deadlinePassed: DEAL_COUNTDOWN_EXPIRED_AR,
  underReview: 'الإيصال قيد التدقيق الإداري، ولا يمكن استبداله الآن.',
  confirmed: 'تم تأكيد هذا الدفع، ولا يلزم رفع إيصال جديد.',
  expired: 'انتهت مهلة هذا الدفع.',
} as const;

/**
 * Task 6.6: the decision half of a card, pure and clock-free. `deal.isExpired` comes from the
 * banner's countdown state — a card that read its own clock would disagree with the timer above
 * it (trap T-5).
 */
export function resolvePaymentSlotActions(
  slot: Pick<DealPaymentSlot, 'status' | 'hasProof'> | null | undefined,
  deal: { status: DealStatus | string; isExpired: boolean },
): PaymentSlotActions {
  const canDownload = Boolean(slot?.hasProof);
  const locked = (lockReasonAr: string): PaymentSlotActions => ({
    canUpload: false,
    canDownload,
    lockReasonAr,
  });

  if (TERMINAL_DEAL_STATUSES.includes(deal.status as DealStatus)) {
    return locked(SLOT_LOCK_REASONS_AR.dealClosed);
  }

  if (deal.isExpired) {
    return locked(SLOT_LOCK_REASONS_AR.deadlinePassed);
  }

  if (!slot || !isPaymentUploadable(slot.status)) {
    const lockReasonAr =
      slot?.status === DEAL_PAYMENT_STATUS.UNDER_REVIEW
        ? SLOT_LOCK_REASONS_AR.underReview
        : slot?.status === DEAL_PAYMENT_STATUS.CONFIRMED
          ? SLOT_LOCK_REASONS_AR.confirmed
          : SLOT_LOCK_REASONS_AR.expired;
    return locked(lockReasonAr);
  }

  return { canUpload: true, canDownload, lockReasonAr: null };
}

export type WireTransferCardAccent = 'platform' | 'seller';

export interface DealPaymentCardProps {
  accent: WireTransferCardAccent;
  title: string;
  slot: DealPaymentSlot | null;
  /** The frozen amount from the deal (`platformCommission` or `dealPrice`), decimal string. */
  amount: string;
  accountHolderName: string;
  bankName: string | null;
  iban: string;
  ibanFormatted: string;
  /** Card 1 only: the frozen `ELM-…-C` code, read from `Deal.dealReferenceCode`. */
  referenceCode?: string | null;
  deal: { status: DealStatus | string; isExpired: boolean };
  /** Set when a cross-card prerequisite (e.g. identity) closes every dropzone. */
  prerequisiteNotice?: string | null;
  isUploading?: boolean;
  uploadError?: string | null;
  uploadSuccess?: string | null;
  onUploadProof: (file: File, values: DealProofFormValues) => Promise<boolean> | boolean;
  onDownloadProof?: () => void;
}

/**
 * AC-4 / AC-5 / UX-DR4: one leg of the dual wire transfer. Card 1 (platform commission) is
 * emerald, Card 2 (seller price) is slate; both are explicit `order` classes so a two-column
 * grid keeps the platform leg first in RTL reading order.
 */
export function DealPaymentCard({
  accent,
  title,
  slot,
  amount,
  accountHolderName,
  bankName,
  iban,
  ibanFormatted,
  referenceCode,
  deal,
  prerequisiteNotice,
  isUploading = false,
  uploadError = null,
  uploadSuccess = null,
  onUploadProof,
  onDownloadProof,
}: DealPaymentCardProps) {
  const isPlatform = accent === 'platform';
  const Icon = isPlatform ? Building2 : Landmark;
  const actions = resolvePaymentSlotActions(slot, deal);
  const lockReason = prerequisiteNotice ?? actions.lockReasonAr;
  // Literal strings, not an interpolated `order-${n}`: Tailwind only emits classes it can read.
  const orderClass = isPlatform ? 'order-1' : 'order-2';

  return (
    <Card
      className={`p-5 sm:p-6 shadow-level1 ${orderClass} border-2 ${
        isPlatform
          ? 'border-deal-platform-fee bg-deal-platform-fee-bg'
          : 'border-surface-borderStrong bg-deal-seller-price-bg'
      }`}
      data-testid={`deal-payment-card-${accent}`}
    >
      <CardHeader className="mb-4 p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs ${
                isPlatform ? 'bg-deal-platform-fee' : 'bg-deal-seller-price'
              }`}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <CardTitle className="text-base font-bold">{title}</CardTitle>
          </div>
          {slot ? <DealPaymentStatusBadge status={slot.status} /> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        <div className="rounded-xl border border-surface-border/60 bg-white/70 p-3.5 dark:border-dark-surface-border dark:bg-dark-surface-base/50">
          <p className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary">
            المبلغ المطلوب تحويله
          </p>
          <p
            dir="ltr"
            className={`mt-0.5 font-mono text-2xl sm:text-3xl font-extrabold ${
              isPlatform ? 'text-deal-platform-fee' : 'text-deal-seller-price dark:text-slate-100'
            }`}
            data-testid={`deal-card-amount-${accent}`}
          >
            {formatDealAmount(amount)}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border/60 bg-white/70 p-3.5 dark:border-dark-surface-border dark:bg-dark-surface-base/50">
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-secondary dark:text-dark-ink-secondary">اسم صاحب الحساب</dt>
              <dd className="font-semibold text-ink-primary dark:text-dark-ink-primary text-start">
                {accountHolderName}
              </dd>
            </div>
            {bankName ? (
              <div className="flex items-center justify-between gap-2 border-t border-surface-border/40 pt-2 dark:border-dark-surface-border/40">
                <dt className="text-ink-secondary dark:text-dark-ink-secondary">البنك</dt>
                <dd className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                  {bankName}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-xl border border-surface-border/80 bg-white p-3.5 shadow-xs dark:border-dark-surface-border dark:bg-dark-surface-base">
          <p className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary">
            رقم الآيبان (IBAN)
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span
              dir="ltr"
              className="font-mono text-sm sm:text-base font-bold text-ink-primary dark:text-dark-ink-primary"
              data-testid={`deal-card-iban-${accent}`}
            >
              {ibanFormatted || iban}
            </span>
            <CopyButton
              value={iban}
              label="نسخ الآيبان"
              copiedMessage="تم نسخ رقم الآيبان البنكي"
            />
          </div>
        </div>

        {referenceCode ? (
          <div className="rounded-xl border border-accent/40 bg-accent-light p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary">
              رمز مرجع التحويل (يُكتب في وصف الحوالة البنكية)
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span
                dir="ltr"
                className="font-mono text-base font-bold tracking-wide text-accent-hover"
                data-testid="deal-reference-code"
              >
                {referenceCode}
              </span>
              <CopyButton value={referenceCode} label="نسخ الرمز" />
            </div>
          </div>
        ) : null}

        {slot?.status === DEAL_PAYMENT_STATUS.REJECTED ? (
          <div
            role="alert"
            className="space-y-1 rounded-xl border border-status-danger/30 bg-status-dangerBg p-3 text-xs text-status-danger"
          >
            <p className="font-bold">أعد رفع إيصال التحويل قبل انتهاء المهلة</p>
            {slot.rejectionReason ? <p>{slot.rejectionReason}</p> : null}
          </div>
        ) : null}

        {slot?.hasProof && slot.uploadedAt ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-white/80 p-3 text-xs dark:border-dark-surface-border dark:bg-dark-surface-base/60">
            <span className="text-ink-secondary dark:text-dark-ink-secondary">
              تم رفع الإيصال في{' '}
              <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                {new Date(slot.uploadedAt).toLocaleDateString('ar-SA')}
              </span>
            </span>
            {actions.canDownload && onDownloadProof ? (
              <Button type="button" size="sm" variant="outline" onClick={onDownloadProof}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                تحميل الإيصال
              </Button>
            ) : null}
          </div>
        ) : null}

        <PaymentProofDropzone
          paymentType={slot?.paymentType ?? DEAL_PAYMENT_TYPES[isPlatform ? 0 : 1]}
          title={title}
          disabled={!actions.canUpload || Boolean(prerequisiteNotice)}
          disabledReason={lockReason}
          isUploading={isUploading}
          errorMessage={uploadError}
          successMessage={uploadSuccess}
          onUpload={onUploadProof}
        />

        {slot?.bankReferenceCode || slot?.senderBankName ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted dark:text-dark-ink-muted">
            {slot?.bankReferenceCode ? (
              <Badge variant="neutral" size="sm">
                {`مرجع الحوالة: ${slot.bankReferenceCode}`}
              </Badge>
            ) : null}
            {slot?.senderBankName ? (
              <Badge variant="neutral" size="sm">
                {`البنك المُحوِّل: ${slot.senderBankName}`}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
