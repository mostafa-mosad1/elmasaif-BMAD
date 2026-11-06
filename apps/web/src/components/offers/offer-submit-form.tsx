'use client';

import React, { useMemo, useState } from 'react';
import {
  LOW_PRICE_THRESHOLD_PERCENT,
  ListingStatus,
  OFFER_ACTIVE_EXISTS,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OfferItem,
  submitOfferSchema,
} from '@elmasaif/shared';
import { HandCoins, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';

export interface OfferSubmitFormProps {
  listingId: string;
  /** The listing's published ask price — the reference for the sub-50 % gate (BR-11). */
  askPrice: number;
  /** `RESERVED` listings only accept backup offers (FR-27). */
  listingStatus: ListingStatus | string;
  /** Prefilled price (e.g. reopened form); the buyer can still edit it. */
  initialPrice?: string;
  onSubmitted?: (offer: OfferItem) => void;
  onCancel?: () => void;
}

type FieldErrors = Partial<Record<string, string>>;

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary';

const labelClass =
  'block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5';

/** Server rejections carry a stable `code` (AD-8); each one gets a buyer-actionable hint. */
const CODE_HINTS: Record<string, string> = {
  [OFFER_ACTIVE_EXISTS]:
    'لديك عرض نشط على هذا العقار بالفعل. تابع حالته من صفحة «عروضي النشطة».',
  [OFFER_LOW_PRICE_CONFIRMATION_REQUIRED]:
    'يجب تأكيد أن عرضك أقل من نصف سعر الطلب قبل الإرسال.',
  [OFFER_LISTING_NOT_OFFERABLE]:
    'لم يعد العقار متاحاً لاستقبال العروض في حالته الحالية.',
};

/**
 * Binding purchase-offer intake on the property detail screen (Story 4.1 / FR-25, UX-DR-10,
 * UX-DR-13). Validates with the shared `submitOfferSchema` (same rules/Arabic messages as the
 * API), gates a sub-50 % bid behind an explicit acknowledgement (BR-11), and surfaces
 * `ApiError.code` inline. Every guardrail is re-checked server-side (NFR1).
 */
export function OfferSubmitForm({
  listingId,
  askPrice,
  listingStatus,
  initialPrice = '',
  onSubmitted,
  onCancel,
}: OfferSubmitFormProps) {
  const [price, setPrice] = useState(initialPrice);
  const [note, setNote] = useState('');
  const [lowPriceConfirm, setLowPriceConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const numericAskPrice = Number(askPrice) || 0;
  const numericPrice = Number(price.replace(/,/g, ''));
  const isBackup = listingStatus === ListingStatus.RESERVED;
  const belowHalf = useMemo(
    () => numericPrice > 0 && numericPrice < numericAskPrice * LOW_PRICE_THRESHOLD_PERCENT,
    [numericPrice, numericAskPrice],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    setServerHint(null);

    const payload = {
      listingId,
      offerPrice: price.trim(),
      note: note.trim() ? note.trim() : null,
      lowPriceConfirmation: belowHalf ? lowPriceConfirm : false,
    };
    const parsed = submitOfferSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await apiClient.post<{ statusCode: number; data: OfferItem }>(
        '/offers',
        parsed.data,
      );
      const created = (response?.data ?? (response as unknown as OfferItem)) as OfferItem;
      setSubmitted(true);
      onSubmitted?.(created);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message || 'تعذر تسجيل العرض.');
        setServerHint(CODE_HINTS[err.code] ?? null);
      } else {
        setServerError('تعذر تسجيل العرض. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card data-testid="offer-submit-success">
        <CardContent className="p-5 space-y-2" dir="rtl">
          <div className="flex items-center gap-2 text-status-verified font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>{isBackup ? 'تم تسجيل عرضك الاحتياطي' : 'تم تسجيل عرض الشراء'}</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            تم تسجيل عرضك وهو قيد المراجعة الإدارية. سيتم إبلاغك عند عرضه على البائع.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="offer-submit-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="w-4 h-4 text-primary" />
          <span>{isBackup ? 'تقديم عرض احتياطي' : 'تقديم عرض شراء'}</span>
        </CardTitle>
        <p className="text-xs text-ink-muted dark:text-dark-ink-muted leading-relaxed">
          {isBackup
            ? 'العقار محجوز حالياً ويُسجَّل عرضك كعرض احتياطي في حال انتهاء الحجز الحالي.'
            : 'تقديم عرض شراء ملزم خاضع لتدقيق المنصة قبل عرضه على البائع.'}
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} dir="rtl">
          <div>
            <label htmlFor="offer-price" className={labelClass}>
              قيمة العرض (ر.س) <span className="text-red-500">*</span>
            </label>
            <input
              id="offer-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1150000"
              className={inputClass}
              data-testid="offer-price"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.offerPrice}</span>
              <span dir="ltr">{`سعر الطلب: ${formatSar(numericAskPrice)}`}</span>
            </div>
          </div>

          {belowHalf ? (
            <div
              className="rounded-xl border border-[#C69C45]/30 bg-[#C69C45]/10 p-3 space-y-2"
              data-testid="offer-low-price-gate"
            >
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                إعلان: السعر المدخل أقل من نصف سعر الطلب. تقديم هذا العرض يتطلب تأكيداً صريحاً منك.
              </p>
              <label className="flex items-start gap-2 text-xs font-medium text-ink-primary dark:text-dark-ink-primary">
                <input
                  type="checkbox"
                  checked={lowPriceConfirm}
                  onChange={(e) => setLowPriceConfirm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-surface-border text-primary focus:ring-primary"
                  data-testid="offer-low-price-confirm"
                />
                <span>
                  أؤكد أن عرضي أقل من نصف سعر الطلب المعلن وأرغب في تقديمه رغم ذلك.
                </span>
              </label>
            </div>
          ) : null}

          <div>
            <label htmlFor="offer-note" className={labelClass}>
              ملاحظات العرض (اختياري)
            </label>
            <textarea
              id="offer-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: جاهز لإتمام الإجراءات خلال أسبوع"
              className={`${inputClass} resize-none`}
              data-testid="offer-note"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.note}</span>
              <span>{`${note.length}/500`}</span>
            </div>
          </div>

          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected"
              data-testid="offer-submit-error"
            >
              <p>{serverError}</p>
              {serverHint ? <p className="mt-1 text-xs">{serverHint}</p> : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            {onCancel ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                إلغاء
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || (belowHalf && !lowPriceConfirm)}
              data-testid="offer-submit-btn"
            >
              {submitting ? 'جاري الإرسال...' : isBackup ? 'إرسال العرض الاحتياطي' : 'إرسال العرض'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
