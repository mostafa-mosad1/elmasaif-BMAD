'use client';

import React, { useState } from 'react';
import { createProposalSchema } from '@elmasaif/shared';
import { HandCoins } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { ProposalItem } from './proposal-item';

export interface ProposalSubmitFormProps {
  demandId: string;
  /** The caller's own ACTIVE listings that qualified against this demand (FR-22 match). */
  matchedListings: Array<{ listingId: string; title: string; askPrice: number }>;
  /** Buyer's ceiling — surfaced as a hint; the authoritative gate is server-side. */
  maxBudget?: number;
  onSubmitted?: (proposal: ProposalItem) => void;
  onCancel?: () => void;
}

type FieldErrors = Partial<Record<string, string>>;

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary';

const labelClass =
  'block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5';

const formatSar = (value: number): string => Number(value || 0).toLocaleString('en-US');

/**
 * Binding proposal submission (Story 3.7 / FR-23). The provider picks one of their own
 * matching listings, sets a proposed price, and optionally a note. Client validation reuses
 * the shared `createProposalSchema` (same rules/Arabic messages as the API); the buyer's
 * `maxBudget` ceiling and re-matching are enforced server-side, so a rejected submission is
 * surfaced verbatim via `ApiError.code` (notably `PROPOSAL_DUPLICATE`).
 */
export function ProposalSubmitForm({
  demandId,
  matchedListings,
  maxBudget,
  onSubmitted,
  onCancel,
}: ProposalSubmitFormProps) {
  const [listingId, setListingId] = useState<string>(matchedListings[0]?.listingId ?? '');
  const [proposedPrice, setProposedPrice] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);

    const payload = {
      demandId,
      listingId,
      proposedPrice: proposedPrice.trim(),
      note: note.trim() ? note.trim() : null,
    };
    const parsed = createProposalSchema.safeParse(payload);
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
      const response = await apiClient.post<{ statusCode: number; data: ProposalItem }>(
        '/proposals',
        parsed.data,
      );
      const created = (response?.data ?? (response as unknown as ProposalItem)) as ProposalItem;
      onSubmitted?.(created);
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.message
          ? err.message
          : 'تعذر حفظ العرض. يرجى المحاولة مرة أخرى.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="proposal-submit-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="w-4 h-4 text-primary" />
          <span>تقديم عرض على طلب الشراء</span>
        </CardTitle>
        <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
          اختر أحد عقاراتك المطابقة وحدّد سعراً ملزماً. يخضع العرض لمراجعة الإدارة قبل عرضه على المشتري.
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} dir="rtl">
          <div>
            <label htmlFor="proposal-listing" className={labelClass}>
              العقار المطابق <span className="text-red-500">*</span>
            </label>
            <select
              id="proposal-listing"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className={inputClass}
              data-testid="proposal-listing"
            >
              {matchedListings.map((listing) => (
                <option key={listing.listingId} value={listing.listingId}>
                  {`${listing.title} — ${formatSar(listing.askPrice)} ر.س`}
                </option>
              ))}
            </select>
            {errors.listingId ? (
              <p className="mt-1 text-xs text-red-500 font-medium">{errors.listingId}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="proposal-price" className={labelClass}>
              السعر المقترح (ر.س) <span className="text-red-500">*</span>
            </label>
            <input
              id="proposal-price"
              type="text"
              inputMode="decimal"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              placeholder="1150000"
              className={inputClass}
              data-testid="proposal-price"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.proposedPrice}</span>
              {maxBudget ? <span>{`أقصى ميزانية لدى المشتري: ${formatSar(maxBudget)} ر.س`}</span> : null}
            </div>
          </div>

          <div>
            <label htmlFor="proposal-note" className={labelClass}>
              ملاحظة للوسيط (اختياري)
            </label>
            <textarea
              id="proposal-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: جاهز للتسجيل الفوري مع تحمّل رسوم الوساطة"
              className={`${inputClass} resize-none`}
              data-testid="proposal-note"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.note}</span>
              <span>{`${note.length}/1000`}</span>
            </div>
          </div>

          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected"
              data-testid="proposal-submit-error"
            >
              {serverError}
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
              disabled={submitting || !listingId}
              data-testid="proposal-submit-btn"
            >
              {submitting ? 'جاري إرسال العرض...' : 'إرسال العرض'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
