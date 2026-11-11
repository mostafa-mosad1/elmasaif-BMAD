'use client';

import React from 'react';
import { ShieldCheck, Star, Building2, CheckCircle2, Calendar } from 'lucide-react';
import { BrokerPublicProfileDto } from '@elmasaif/shared';
import { Badge, Card } from '../ui';

export interface BrokerProfileHeaderProps {
  profile: BrokerPublicProfileDto;
  className?: string;
}

export function BrokerProfileHeader({ profile, className = '' }: BrokerProfileHeaderProps) {
  const { commercialName, fullName, isFalVerified, falLicense, stats, createdAt } = profile;

  const joinYear = new Date(createdAt).getFullYear();
  const joinDateFormatted = !isNaN(joinYear) ? `عضو منذ ${joinYear}` : 'عضو موثق';

  return (
    <Card className={`p-6 sm:p-8 bg-surface-base dark:bg-dark-surface-base ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left / Main Profile Identity in RTL */}
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-light dark:bg-primary-dark/30 text-primary dark:text-primary-light flex items-center justify-center font-bold text-2xl sm:text-3xl shrink-0 border border-primary/20 shadow-sm">
            {commercialName.charAt(0)}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                {commercialName}
              </h1>

              {isFalVerified && falLicense ? (
                <Badge
                  variant="verified"
                  size="md"
                  icon={<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                >
                  <span>مرخص وموثق من فال REGA</span>
                  <span className="font-mono font-medium text-[11px] opacity-90">({falLicense.licenseNumber})</span>
                </Badge>
              ) : (
                <Badge variant="neutral" size="md">
                  <span>وسيط عقاري</span>
                </Badge>
              )}
            </div>

            {commercialName !== fullName && (
              <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary">
                المسؤول: {fullName}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary dark:text-dark-ink-secondary pt-1">
              <div className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{joinDateFormatted}</span>
              </div>

              {stats.averageRating !== null ? (
                <div className="inline-flex items-center gap-1 text-ink-primary dark:text-dark-ink-primary font-medium">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-sm">{stats.averageRating}</span>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary">
                    {`(${stats.totalReviews} تقييم)`}
                  </span>
                </div>
              ) : (
                <span className="text-ink-secondary dark:text-dark-ink-secondary">
                  لا توجد تقييمات بعد
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Operational Performance Summary Tally */}
        <div className="flex items-center gap-3 sm:gap-4 border-t md:border-t-0 md:border-r border-surface-border dark:border-dark-surface-border pt-4 md:pt-0 md:pr-6">
          <div className="flex-1 sm:flex-initial text-center px-4 py-3 rounded-card bg-surface-sunken/60 dark:bg-dark-surface-sunken/60 border border-surface-border/50 dark:border-dark-surface-border/50 min-w-[110px]">
            <div className="flex items-center justify-center gap-1.5 text-ink-secondary dark:text-dark-ink-secondary text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>صفقات مكتملة</span>
            </div>
            <p className="text-2xl font-bold font-mono text-ink-primary dark:text-dark-ink-primary">
              {stats.completedDealsCount}
            </p>
          </div>

          <div className="flex-1 sm:flex-initial text-center px-4 py-3 rounded-card bg-surface-sunken/60 dark:bg-dark-surface-sunken/60 border border-surface-border/50 dark:border-dark-surface-border/50 min-w-[110px]">
            <div className="flex items-center justify-center gap-1.5 text-ink-secondary dark:text-dark-ink-secondary text-xs mb-1">
              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>عقارات معروضة</span>
            </div>
            <p className="text-2xl font-bold font-mono text-ink-primary dark:text-dark-ink-primary">
              {stats.activeListingsCount}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
