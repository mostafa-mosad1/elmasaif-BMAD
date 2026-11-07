'use client';

import React, { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import {
  buildDealCountdownState as buildSharedCountdownState,
  DEAL_COUNTDOWN_UNIT_LABELS_AR,
  type CountdownInput,
  type CountdownState,
} from '@elmasaif/shared';

/**
 * Story 5.2 / Task 6.6 requires this exact export name from the web layer, but the maths lives in
 * `packages/shared/src/deal/countdown.ts` so the API and the screen cannot disagree about what
 * `48:00:00` means. This is an alias, never a second implementation.
 */
export const buildDealCountdownState = buildSharedCountdownState;

export type { CountdownInput, CountdownState };

/** UX-DR5: the banner ticks once a second and re-derives from a monotonic delta. */
export const DEAL_COUNTDOWN_TICK_MS = 1_000;

export const DEAL_COUNTDOWN_TITLE_AR = 'الوقت المتبقي لسداد قيمة الصفقة';

/** Verbatim from `EXPERIENCE.md#Dual Wire Transfer` — rendered inside the gold banner. */
export const DEAL_DEADLINE_NOTICE_AR =
  'رفع إيصال التحويل يوقف الإلغاء التلقائي أثناء المراجعة الإدارية، وتُمنح مهلة 12 ساعة للمعالجة في حال الرفض دون إلغاء فوري.';

/** UX-DR12: expiry is stated in words, never signalled by the clock alone. */
export const DEAL_COUNTDOWN_EXPIRED_AR = 'انتهت مهلة رفع الإيصال';

export const DEAL_COUNTDOWN_RUNNING_HINT_AR =
  'يُغلق رفع الإيصالات تلقائياً عند انتهاء العدّاد، دون تمديد تلقائي.';

/**
 * `performance.now()` is monotonic and immune to wall-clock adjustments; the `Date.now()` branch
 * exists only for environments without `performance` (SSR, test doubles).
 */
export function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Milliseconds since the payload arrived. The component never accumulates ticks: every render
 * recomputes `now - anchor`, so a throttled background tab cannot lose time (trap T-5).
 */
export function useDealCountdownElapsed(anchorMs: number | null): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (anchorMs === null) {
      setElapsedMs(0);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, monotonicNow() - anchorMs));
    }, DEAL_COUNTDOWN_TICK_MS);

    return () => window.clearInterval(timer);
  }, [anchorMs]);

  return elapsedMs;
}

export interface DealCountdownBannerProps {
  state: CountdownState;
  /** Overridable only so a spec can pin the notice; production always passes the default. */
  notice?: string;
  className?: string;
}

const UNIT_CELLS = [
  { key: 'hours', label: DEAL_COUNTDOWN_UNIT_LABELS_AR.hours },
  { key: 'minutes', label: DEAL_COUNTDOWN_UNIT_LABELS_AR.minutes },
  { key: 'seconds', label: DEAL_COUNTDOWN_UNIT_LABELS_AR.seconds },
] as const;

/**
 * AC-3 / UX-DR5: the gold banner above the two wire-transfer cards. It is purely presentational —
 * `DealPaymentView` owns the ticker so both dropzones and the banner read the same `isExpired`
 * flag from one computation.
 */
export function DealCountdownBanner({
  state,
  notice = DEAL_DEADLINE_NOTICE_AR,
  className,
}: DealCountdownBannerProps) {
  const isCritical = state.isExpired || state.isUrgent;

  return (
    <section
      dir="rtl"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      data-testid="deal-countdown-banner"
      className={[
        'rounded-card border border-accent bg-accent-light p-5 shadow-level1',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-accent-hover">
          <AlarmClock className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-sm font-bold">{DEAL_COUNTDOWN_TITLE_AR}</h2>
        </div>
        {/* The compact form screen readers announce; the digit cells below are decorative. */}
        <p className="sr-only" dir="ltr" data-testid="deal-countdown-text">
          {state.text}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2" dir="ltr" aria-hidden="true">
        {UNIT_CELLS.map((unit) => (
          <div
            key={unit.key}
            className="flex flex-col items-center rounded-xl bg-white/70 py-2 dark:bg-dark-surface-base/60"
          >
            <span
              className={`font-mono text-2xl font-bold tabular-nums ${
                isCritical ? 'text-status-danger' : 'text-deal-platform-fee dark:text-emerald-300'
              }`}
              data-testid={`deal-countdown-${unit.key}`}
            >
              {state.clock[unit.key]}
            </span>
            <span className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary">
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.progressPercent}
        aria-label="نسبة انقضاء مهلة السداد"
        data-testid="deal-countdown-progress"
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-dark-surface-base/60"
      >
        <div
          className={`h-full rounded-full transition-all ${
            isCritical ? 'bg-status-danger' : 'bg-accent'
          }`}
          style={{ width: `${state.progressPercent}%` }}
        />
      </div>

      {state.isExpired ? (
        <p
          className="mt-3 text-sm font-bold text-status-danger"
          data-testid="deal-countdown-expired"
        >
          {DEAL_COUNTDOWN_EXPIRED_AR}
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          {DEAL_COUNTDOWN_RUNNING_HINT_AR}
        </p>
      )}

      <p className="mt-3 rounded-xl border border-accent/40 bg-white/60 p-3 text-xs leading-relaxed text-ink-secondary dark:bg-dark-surface-base/60 dark:text-dark-ink-secondary">
        {notice}
      </p>
    </section>
  );
}
