'use client';

import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  PLATFORM_COMMISSION_RATE,
  PublicPlatformSettingsDto,
} from '@elmasaif/shared';
import { Card } from '../ui';
import { apiClient } from '../../lib/api-client';

export interface CommissionCalculatorProps {
  /** Raw ask price fetched from the listing; every figure below is derived from it. */
  askPrice: number;
  /** Optional dynamic platform commission rate override (e.g. 0.025 or passed from public settings) */
  commissionRate?: number;
  className?: string;
}

/** Institutional SAR money formatting used across the marketplace (LTR digits, grouped). */
export function formatSar(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ر.س`;
}

/**
 * Estimated platform commission — dynamic percentage calculation (Story 8.6 / AC6).
 * Defaults to 2.5% if not overridden or fetched dynamically.
 */
export function calculateCommission(
  askPrice: number,
  rate: number = PLATFORM_COMMISSION_RATE,
): number {
  return Math.round((Number(askPrice) || 0) * rate);
}

export function CommissionCalculator({
  askPrice,
  commissionRate,
  className,
}: CommissionCalculatorProps) {
  const [activeRate, setActiveRate] = useState<number>(
    commissionRate ?? PLATFORM_COMMISSION_RATE,
  );

  useEffect(() => {
    if (commissionRate !== undefined) {
      setActiveRate(commissionRate);
      return;
    }

    let isMounted = true;
    apiClient
      .get<{ data: PublicPlatformSettingsDto }>('/settings/public')
      .then((res) => {
        if (isMounted && res?.data?.commissionRate !== undefined) {
          setActiveRate(res.data.commissionRate);
        }
      })
      .catch(() => {
        // Fall back gracefully to PLATFORM_COMMISSION_RATE
      });

    return () => {
      isMounted = false;
    };
  }, [commissionRate]);

  const numericAskPrice = Number(askPrice) || 0;
  const commission = calculateCommission(numericAskPrice, activeRate);
  const total = numericAskPrice + commission;
  const commissionPercentLabel = Number((activeRate * 100).toFixed(2)).toLocaleString('en-US');

  const rows = [
    { label: 'سعر الطلب', value: formatSar(numericAskPrice), emphasis: false },
    {
      label: `سعي المنصة المقدَّر (${commissionPercentLabel}%)`,
      value: formatSar(commission),
      emphasis: false,
    },
    { label: 'إجمالي التكلفة المقدَّرة', value: formatSar(total), emphasis: true },
  ];

  return (
    <div
      className={twMerge(
        clsx(
          'p-4 sm:p-5 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-sunken/60 border border-surface-border dark:border-dark-surface-border space-y-3.5',
          className,
        ),
      )}
      data-testid="commission-calculator"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Calculator className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          حاسبة التكلفة الإجمالية
        </h3>
      </div>

      <dl className="space-y-2 text-sm pt-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className={twMerge(
              clsx(
                'flex items-center justify-between gap-3',
                row.emphasis &&
                  'pt-3 mt-2 border-t border-surface-border dark:border-dark-surface-border font-bold text-base',
              ),
            )}
          >
            <dt
              className={twMerge(
                clsx(
                  'text-ink-secondary dark:text-dark-ink-secondary text-xs sm:text-sm font-medium',
                  row.emphasis &&
                    'font-bold text-ink-primary dark:text-dark-ink-primary text-sm sm:text-base',
                ),
              )}
            >
              {row.label}
            </dt>
            <dd
              dir="ltr"
              className={twMerge(
                clsx(
                  'font-mono-numbers whitespace-nowrap text-sm font-bold text-ink-primary dark:text-dark-ink-primary',
                  row.emphasis &&
                    'text-base sm:text-lg font-black text-accent dark:text-accent-dark',
                ),
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
