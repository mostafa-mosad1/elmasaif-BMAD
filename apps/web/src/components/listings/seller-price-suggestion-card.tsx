'use client';

import React, { useState } from 'react';
import {
  PriceSuggestionItem,
  PriceSuggestionStatus,
} from '@elmasaif/shared';
import {
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';

export interface SellerPriceSuggestionCardProps {
  listingId: string;
  suggestion: PriceSuggestionItem;
  onResponded?: (
    action: 'accept' | 'decline',
    updatedSuggestion: PriceSuggestionItem,
    updatedListing?: any,
  ) => void;
}

export function SellerPriceSuggestionCard({
  listingId,
  suggestion,
  onResponded,
}: SellerPriceSuggestionCardProps) {
  const [sellerNote, setSellerNote] = useState('');
  const [submitting, setSubmitting] = useState<'accept' | 'decline' | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [currentSuggestion, setCurrentSuggestion] = useState<PriceSuggestionItem>(suggestion);

  const currentPrice = Number(currentSuggestion.currentAskPrice);
  const suggestedPrice = Number(currentSuggestion.suggestedPrice);
  const diffAmount = suggestedPrice - currentPrice;
  const diffPercent = currentPrice > 0 ? (diffAmount / currentPrice) * 100 : 0;
  const isPending = currentSuggestion.status === PriceSuggestionStatus.PENDING;

  const handleResponse = async (action: 'accept' | 'decline') => {
    setSubmitting(action);
    setFeedback(null);
    try {
      const endpoint = `/listings/${listingId}/price-suggestions/${currentSuggestion.id}/${action}`;
      const res = await apiClient.post<{
        statusCode: number;
        message: string;
        data: {
          suggestion: PriceSuggestionItem;
          listing: any;
        };
      }>(endpoint, {
        sellerResponseNote: sellerNote.trim() || undefined,
      });

      if (res?.data?.suggestion) {
        setCurrentSuggestion(res.data.suggestion);
        if (onResponded) {
          onResponded(action, res.data.suggestion, res.data.listing);
        }
      }

      setFeedback({
        type: 'success',
        message:
          action === 'accept'
            ? 'تم قبول السعر المقترح بنجاح وإعادة الإعلان للمراجعة التأكيدية'
            : 'تم رفض المقترح والاحتفاظ بسعرك الحالي دون أي تغيير',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر إرسال الرد على مقترح السعر',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      dir="rtl"
      className="p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-level2 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-surface-border dark:border-dark-surface-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
              مقترح تعديل السعر الاسترشادي من إدارة التقييم العقاري (FR-57)
            </h4>
            <div className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
              {`المشرف المقترح: ${currentSuggestion.suggestedByAdminName}`}
            </div>
          </div>
        </div>

        <div>
          {currentSuggestion.status === PriceSuggestionStatus.PENDING ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent-light dark:bg-amber-950/40 text-accent-dark dark:text-amber-300 border border-accent/30">
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار رد البائع</span>
            </span>
          ) : currentSuggestion.status === PriceSuggestionStatus.ACCEPTED ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم قبول السعر المقترح</span>
            </span>
          ) : currentSuggestion.status === PriceSuggestionStatus.DECLINED ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-sunken dark:bg-dark-surface-raised text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border">
              <XCircle className="w-3.5 h-3.5" />
              <span>تم رفض المقترح</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-sunken dark:bg-dark-surface-raised text-ink-muted dark:text-dark-ink-muted border border-surface-border dark:border-dark-surface-border">
              <span>تم استبداله بمقترح أحدث</span>
            </span>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border">
          <div className="text-[11px] text-ink-muted dark:text-dark-ink-muted">السعر المطلوب السابق</div>
          <div dir="ltr" className="font-mono font-bold text-sm text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
            {`${currentPrice.toLocaleString('en-US')} SAR`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-accent-light/60 dark:bg-amber-950/20 border border-accent/30">
          <div className="text-[11px] font-bold text-accent-dark dark:text-accent">
            السعر المقترح الاسترشادي
          </div>
          <div dir="ltr" className="font-mono font-extrabold text-base text-accent-dark dark:text-accent mt-0.5">
            {`${suggestedPrice.toLocaleString('en-US')} SAR`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-muted dark:text-dark-ink-muted">الفارق السوقي</div>
            <div dir="ltr" className="font-mono font-bold text-xs mt-0.5 flex items-center gap-1">
              {diffPercent < 0 ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">{`${diffPercent.toFixed(1)}%`}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-blue-700">{`+${diffPercent.toFixed(1)}%`}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rationale text */}
      <div className="p-3.5 rounded-xl bg-surface-sunken/60 dark:bg-dark-surface-raised/60 border border-surface-border dark:border-dark-surface-border space-y-1">
        <div className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">المبررات السوقية وتحليل التقييم:</div>
        <p className="text-xs text-ink-primary dark:text-dark-ink-primary leading-relaxed whitespace-pre-line">
          {currentSuggestion.reason}
        </p>
      </div>

      {/* Seller Note / Response status */}
      {currentSuggestion.sellerResponseNote && (
        <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs space-y-0.5">
          <span className="font-bold text-ink-secondary dark:text-dark-ink-secondary">ملاحظة البائع: </span>
          <span className="text-ink-primary dark:text-dark-ink-primary">{currentSuggestion.sellerResponseNote}</span>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Interactive Controls for Pending Status */}
      {isPending && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              ملاحظة رد البائع (اختياري)
            </label>
            <input
              type="text"
              value={sellerNote}
              onChange={(e) => setSellerNote(e.target.value)}
              placeholder="أدخل أي ملاحظة تود توثيقها مع قرارك..."
              disabled={Boolean(submitting)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => handleResponse('accept')}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span>قبول السعر المقترح وتحديث الإعلان</span>
            </button>

            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => handleResponse('decline')}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4 text-status-danger" />
              <span>رفض المقترح والاحتفاظ بالسعر الحالي</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

