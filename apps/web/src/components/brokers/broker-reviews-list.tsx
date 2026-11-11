'use client';

import React from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { BrokerReviewItemDto } from '@elmasaif/shared';
import { Card, EmptyState } from '../ui';

export interface BrokerReviewsListProps {
  reviews: BrokerReviewItemDto[];
  className?: string;
}

export function BrokerReviewsList({ reviews, className = '' }: BrokerReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <Card className={`p-8 text-center bg-surface-base dark:bg-dark-surface-base ${className}`}>
        <EmptyState
          icon={<MessageSquare className="w-10 h-10 text-ink-muted/50" />}
          title="لا توجد تقييمات معتمدة لهذا الوسيط حتى الآن"
          description="ستظهر تقييمات المشترين المعتمدة هنا فور إتمام الصفقات وتوثيق المراجعات."
        />
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
        تقييمات وآراء المشترين ({reviews.length})
      </h3>

      <div className="space-y-3">
        {reviews.map((review) => {
          const formattedDate = new Date(review.createdAt).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            <Card
              key={review.id}
              className="p-5 bg-surface-base dark:bg-dark-surface-base hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center font-bold text-xs text-ink-secondary dark:text-dark-ink-secondary">
                    {review.rater.maskedName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                      {review.rater.maskedName}
                    </p>
                    <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
                      {formattedDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-amber-500 fill-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.score
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-surface-border dark:text-dark-surface-border fill-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {review.comment ? (
                <p className="text-xs sm:text-sm text-ink-primary dark:text-dark-ink-primary leading-relaxed pr-10">
                  {review.comment}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

