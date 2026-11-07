/**
 * The 48-hour payment countdown (Story 5.2 / UX-DR5, AD-11, AD-13).
 *
 * The server owns the clock. A browser that measures `Date.now()` against a
 * `ClockService`-generated deadline shows garbage the moment the deterministic dev clock is in
 * use, and drifts on a slow device even in production. So the API hands the client three ISO
 * stamps — `createdAt`, `paymentDeadline` and `serverNow` — and the client reports how much time
 * has passed since the payload arrived. Nothing in this module reads an implicit clock: every
 * function is pure, so the whole 48-hour behaviour is provable without faking timers.
 */

/** The last six hours turn the banner urgent (UX-DR5). */
export const DEAL_COUNTDOWN_URGENT_THRESHOLD_MS = 6 * 3_600_000;

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** The unit labels printed under the digits, in RTL reading order. */
export const DEAL_COUNTDOWN_UNIT_LABELS_AR = {
  hours: 'ساعة',
  minutes: 'دقيقة',
  seconds: 'ثانية',
} as const;

export interface CountdownInput {
  /** ISO — when the deal was bound (the start of the payment window). */
  createdAt: string;
  /** ISO — `createdAt + paymentWindowHoursSnapshot`. */
  deadline: string;
  /** ISO — the clock the deadline was measured against, straight from the API. */
  serverNow: string;
  /** Milliseconds elapsed since the payload arrived. Defaults to 0. */
  elapsedMs?: number;
}

export interface CountdownState {
  /** Clamped: never negative. */
  remainingMs: number;
  /** `deadline - createdAt`, floored at 0. */
  totalMs: number;
  /** Time consumed inside the window, clamped into `[0, totalMs]`. */
  elapsedMs: number;
  /** Elapsed share of the window, 0..100, rounded and clamped. */
  progressPercent: number;
  clock: { hours: string; minutes: string; seconds: string };
  /** `HH:MM:SS` — hours are not wrapped at 24 (a 48-hour window starts at `48:00:00`). */
  text: string;
  isExpired: boolean;
  /** `0 < remainingMs <= DEAL_COUNTDOWN_URGENT_THRESHOLD_MS`. */
  isUrgent: boolean;
}

function toMillis(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * The single source of truth for what the banner may render. Passing an explicit `elapsedMs`
 * (rather than letting the component accumulate ticks) keeps a throttled background tab from
 * losing time: the caller recomputes from a `performance.now()` delta on every render.
 */
export function buildDealCountdownState(input: CountdownInput): CountdownState {
  const createdMs = toMillis(input.createdAt);
  const deadlineMs = toMillis(input.deadline);
  const serverMs = toMillis(input.serverNow);
  const tickMs = clamp(Number(input.elapsedMs ?? 0), 0, Number.MAX_SAFE_INTEGER);

  // A corrupt row (missing or unparseable stamps) must render the expired state, never `NaN`.
  if (createdMs === null || deadlineMs === null) {
    return {
      remainingMs: 0,
      totalMs: 0,
      elapsedMs: 0,
      progressPercent: 100,
      clock: { hours: '00', minutes: '00', seconds: '00' },
      text: '00:00:00',
      isExpired: true,
      isUrgent: false,
    };
  }

  const totalMs = Math.max(0, deadlineMs - createdMs);
  const nowMs = (serverMs ?? createdMs) + tickMs;
  const remainingMs = clamp(deadlineMs - nowMs, 0, Number.MAX_SAFE_INTEGER);
  const consumedMs = clamp(nowMs - createdMs, 0, totalMs);
  const progressPercent = totalMs <= 0 ? 100 : clamp(Math.round((consumedMs / totalMs) * 100), 0, 100);

  const hours = Math.floor(remainingMs / MS_PER_HOUR);
  const minutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((remainingMs % MS_PER_MINUTE) / MS_PER_SECOND);

  const clock = { hours: pad2(hours), minutes: pad2(minutes), seconds: pad2(seconds) };

  return {
    remainingMs,
    totalMs,
    elapsedMs: consumedMs,
    progressPercent,
    clock,
    text: `${clock.hours}:${clock.minutes}:${clock.seconds}`,
    isExpired: remainingMs === 0,
    isUrgent: remainingMs > 0 && remainingMs <= DEAL_COUNTDOWN_URGENT_THRESHOLD_MS,
  };
}
