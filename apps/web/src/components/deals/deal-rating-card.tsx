'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import type { DealRatingSummary, SubmitDealRatingInput } from '@elmasaif/shared';
import { Button, Card, CardContent } from '../ui';

export const DEAL_RATING_TITLE_AR = 'تقييم تجربة البائع';
export const DEAL_RATING_CONFIRMATION_AR = 'تم تسجيل تقييمك بنجاح';

const RATING_SCORE_LABELS_AR: Record<number, string> = {
  1: 'ضعيف',
  2: 'مقبول',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز',
};

export interface DealRatingCardProps {
  dealId: string;
  rating?: DealRatingSummary | null;
  canRate?: boolean;
  onSubmitRating?: (input: SubmitDealRatingInput) => Promise<void>;
  className?: string;
}

export function DealRatingCard({
  dealId,
  rating: initialRating,
  canRate = true,
  onSubmitRating,
  className,
}: DealRatingCardProps) {
  const [rating, setRating] = useState<DealRatingSummary | null>(initialRating ?? null);
  const [selectedScore, setSelectedScore] = useState<number>(0);
  const [hoveredScore, setHoveredScore] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If already rated, show read-only view
  if (rating) {
    const formattedDate = new Date(rating.createdAt).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <Card
        className={`border-surface-borderStrong shadow-sm ${className ?? ''}`}
        data-testid="deal-rating-card-rated"
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-4 dark:border-dark-surface-border">
            <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              {DEAL_RATING_TITLE_AR}
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {DEAL_RATING_CONFIRMATION_AR}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" dir="ltr" data-testid="read-only-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= rating.score
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-surface-borderStrong dark:text-dark-surface-border'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
              {RATING_SCORE_LABELS_AR[rating.score] ?? `${rating.score} من 5`}
            </span>
            <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
              ({formattedDate})
            </span>
          </div>

          {rating.comment ? (
            <div className="rounded-xl border border-surface-border bg-surface-ground p-4 dark:border-dark-surface-border dark:bg-dark-surface-ground">
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary" data-testid="rating-comment-text">
                {`"${rating.comment}"`}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // If unrated but cannot rate (e.g. non-completed deal)
  if (!canRate) {
    return null;
  }

  const activeScore = hoveredScore || selectedScore;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScore < 1 || selectedScore > 5) {
      setError('يرجى اختيار عدد النجوم للتقييم (1 إلى 5 نجوم)');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (onSubmitRating) {
        await onSubmitRating({
          score: selectedScore,
          comment: comment.trim() || undefined,
        });
      }
      setRating({
        id: 'new-rating',
        score: selectedScore,
        comment: comment.trim() || null,
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'تعذر إرسال التقييم. أعد المحاولة بعد قليل.';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      className={`border-surface-borderStrong shadow-sm ${className ?? ''}`}
      data-testid="deal-rating-card-unrated"
    >
      <CardContent className="p-6 space-y-4">
        <div className="border-b border-surface-border pb-3 dark:border-dark-surface-border">
          <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            {DEAL_RATING_TITLE_AR}
          </h2>
          <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
            شاركنا تجربتك في إتمام هذه الصفقة مع البائع (التقييم نهائي وغير قابل للتعديل)
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-status-danger/20 bg-status-dangerBg p-3 text-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star selector */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
              درجة التقييم
            </span>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1"
                dir="ltr"
                role="radiogroup"
                aria-label="اختر عدد النجوم"
                data-testid="interactive-star-selector"
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={selectedScore === star}
                    aria-label={`${star} من 5`}
                    className="p-1 text-surface-borderStrong transition-transform hover:scale-110 focus:outline-none dark:text-dark-surface-border"
                    onMouseEnter={() => setHoveredScore(star)}
                    onMouseLeave={() => setHoveredScore(0)}
                    onClick={() => setSelectedScore(star)}
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= activeScore
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-surface-borderStrong hover:text-amber-300 dark:text-dark-surface-border'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              {activeScore > 0 ? (
                <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  {RATING_SCORE_LABELS_AR[activeScore]}
                </span>
              ) : null}
            </div>
          </div>

          {/* Comment text area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <label htmlFor={`deal-rating-comment-${dealId}`}>ملاحظات أو تعليق (اختياري)</label>
              <span className="font-mono">{comment.length} / 500</span>
            </div>
            <textarea
              id={`deal-rating-comment-${dealId}`}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="اكتب ملاحظاتك حول مرونة البائع وتعاونه في الإفراغ..."
              rows={3}
              className="w-full rounded-xl border border-surface-border bg-surface-ground p-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary focus:outline-none dark:border-dark-surface-border dark:bg-dark-surface-ground dark:text-dark-ink-primary"
              data-testid="rating-comment-input"
            />
          </div>

          <Button
            type="submit"
            disabled={selectedScore === 0 || isSubmitting}
            className="w-full sm:w-auto"
            data-testid="submit-rating-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                جاري إرسال التقييم...
              </>
            ) : (
              'إرسال التقييم'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

