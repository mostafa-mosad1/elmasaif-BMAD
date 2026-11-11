'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { BrokerStatsDto } from '@elmasaif/shared';
import { Card } from '../ui';

export interface BrokerRatingsBreakdownProps {
  stats: BrokerStatsDto;
  className?: string;
}

export function BrokerRatingsBreakdown({ stats, className = '' }: BrokerRatingsBreakdownProps) {
  const { averageRating, totalReviews, ratingDistribution } = stats;

  const starTiers: Array<'5' | '4' | '3' | '2' | '1'> = ['5', '4', '3', '2', '1'];

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case '5':
        return '5 نجوم';
      case '4':
        return '4 نجوم';
      case '3':
        return '3 نجوم';
      case '2':
        return 'نجمتان';
      case '1':
        return 'نجمة واحدة';
      default:
        return `${tier} نجوم`;
    }
  };

  return (
    <Card className={`p-6 bg-surface-base dark:bg-dark-surface-base ${className}`}>
      <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-4">
        تقييمات وأداء الوسيط
      </h2>

      {totalReviews === 0 || averageRating === null ? (
        <div className="py-6 text-center text-ink-secondary dark:text-dark-ink-secondary text-sm">
          <Star className="w-8 h-8 mx-auto mb-2 text-ink-muted/40 stroke-1" />
          <p>لا توجد تقييمات معتمدة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Headline Score Block */}
          <div className="md:col-span-4 text-center md:border-l border-surface-border dark:border-dark-surface-border md:pl-6">
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-ink-primary dark:text-dark-ink-primary mb-2">
              {averageRating.toFixed(1)}
            </div>

            <div className="flex items-center justify-center gap-1 mb-2 text-amber-500 fill-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(averageRating)
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-surface-border dark:text-dark-surface-border fill-transparent'
                  }`}
                />
              ))}
            </div>

            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-medium">
              {`بناءً على ${totalReviews} تقييم معتمد`}
            </p>
          </div>

          {/* Distribution Bars */}
          <div className="md:col-span-8 space-y-2">
            {starTiers.map((tier) => {
              const count = ratingDistribution[tier] ?? 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

              return (
                <div key={tier} className="flex items-center gap-3 text-xs">
                  <span className="w-14 text-ink-secondary dark:text-dark-ink-secondary shrink-0 font-medium">
                    {getTierLabel(tier)}
                  </span>

                  <div className="flex-1 h-2 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="w-8 text-left font-mono text-ink-secondary dark:text-dark-ink-secondary shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
