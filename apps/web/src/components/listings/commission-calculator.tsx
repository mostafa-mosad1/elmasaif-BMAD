'use client';

import React from 'react';
import { Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PLATFORM_COMMISSION_RATE } from '@elmasaif/shared';
import { Card } from '../ui';

export interface CommissionCalculatorProps {
  /** Raw ask price fetched from the listing; every figure below is derived from it. */
  askPrice: number;
  className?: string;
}

/** Institutional SAR money formatting used across the marketplace (LTR digits, grouped). */
export function formatSar(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ر.س`;
}

/**
 * Estimated platform commission — the exact same formula the property cards use (FR-18).
 * A pure percentage estimate; any fixed fee belongs to the Deal stage, not this widget.
 */
export function calculateCommission(askPrice: number): number {
  return Math.round((Number(askPrice) || 0) * PLATFORM_COMMISSION_RATE);
}

const commissionPercentLabel = (PLATFORM_COMMISSION_RATE * 100).toLocaleString('en-US');

export function CommissionCalculator({
  askPrice,
  className,
}: CommissionCalculatorProps) {
  const numericAskPrice = Number(askPrice) || 0;
  const commission = calculateCommission(numericAskPrice);
  const total = numericAskPrice + commission;

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
    <Card
      sunken
      className={twMerge(clsx('p-5', className))}
      data-testid="commission-calculator"
    >
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
        <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
          حاسبة التكلفة الإجمالية
        </h3>
        <span className="ms-auto text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          تقديرية — تُحتسب على سعر الطلب
        </span>
      </div>

      <dl className="space-y-2.5 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className={twMerge(
              clsx(
                'flex items-center justify-between gap-3',
                row.emphasis &&
                  'pt-2.5 mt-2.5 border-t border-surface-border dark:border-dark-surface-border',
              ),
            )}
          >
            <dt
              className={twMerge(
                clsx(
                  'text-ink-secondary dark:text-dark-ink-secondary',
                  row.emphasis &&
                    'font-bold text-ink-primary dark:text-dark-ink-primary',
                ),
              )}
            >
              {row.label}
            </dt>
            <dd
              dir="ltr"
              className={twMerge(
                clsx(
                  'font-mono-numbers whitespace-nowrap',
                  row.emphasis
                    ? 'text-base font-bold text-primary dark:text-primary-light'
                    : 'font-semibold text-ink-primary dark:text-dark-ink-primary',
                ),
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
