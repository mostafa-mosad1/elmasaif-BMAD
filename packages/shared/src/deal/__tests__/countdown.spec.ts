import { describe, it, expect } from 'vitest';
import {
  DEAL_COUNTDOWN_URGENT_THRESHOLD_MS,
  DEAL_COUNTDOWN_UNIT_LABELS_AR,
  buildDealCountdownState,
} from '../countdown';

/**
 * Story 5.2 / AC-3, UX-DR5, trap T-5: the countdown measures the API's `serverNow`, never the
 * browser clock, and it never renders a negative value.
 */
describe('buildDealCountdownState (Story 5.2 / AC-3)', () => {
  const createdAt = '2026-11-06T09:00:00.000Z';
  const deadline = '2026-11-08T09:00:00.000Z'; // exactly 48 h later
  const serverNow = createdAt;

  const base = { createdAt, deadline, serverNow };

  it('starts a fresh 48-hour window at 48:00:00 with an empty progress bar', () => {
    const state = buildDealCountdownState(base);

    expect(state.text).toBe('48:00:00');
    expect(state.clock).toEqual({ hours: '48', minutes: '00', seconds: '00' });
    expect(state.progressPercent).toBe(0);
    expect(state.remainingMs).toBe(48 * 3_600_000);
    expect(state.totalMs).toBe(48 * 3_600_000);
    expect(state.isExpired).toBe(false);
    expect(state.isUrgent).toBe(false);
  });

  it('reports 24:00:00 and 50 % exactly half-way through the window', () => {
    const state = buildDealCountdownState({
      ...base,
      serverNow: '2026-11-07T09:00:00.000Z',
    });

    expect(state.text).toBe('24:00:00');
    expect(state.progressPercent).toBe(50);
    expect(state.isExpired).toBe(false);
  });

  it('clamps one second past the deadline to 00:00:00 / 100 % — never a negative value', () => {
    const state = buildDealCountdownState({
      ...base,
      serverNow: '2026-11-08T09:00:01.000Z',
    });

    expect(state.remainingMs).toBe(0);
    expect(state.text).toBe('00:00:00');
    expect(state.progressPercent).toBe(100);
    expect(state.isExpired).toBe(true);
  });

  it('advances with elapsedMs without re-reading serverNow', () => {
    const early = buildDealCountdownState({ ...base, elapsedMs: 0 });
    const later = buildDealCountdownState({ ...base, elapsedMs: 3_600_000 });

    expect(early.text).toBe('48:00:00');
    expect(later.text).toBe('47:00:00');
    expect(later.progressPercent).toBe(2);
    expect(later.elapsedMs).toBe(3_600_000);
  });

  it('ignores a negative elapsedMs', () => {
    const state = buildDealCountdownState({ ...base, elapsedMs: -60_000 });

    expect(state.text).toBe('48:00:00');
    expect(state.elapsedMs).toBe(0);
  });

  it('marks the last six hours urgent, and only those', () => {
    expect(
      buildDealCountdownState({
        ...base,
        serverNow: new Date(Date.parse(deadline) - DEAL_COUNTDOWN_URGENT_THRESHOLD_MS).toISOString(),
      }).isUrgent,
    ).toBe(true);

    expect(
      buildDealCountdownState({
        ...base,
        serverNow: new Date(
          Date.parse(deadline) - DEAL_COUNTDOWN_URGENT_THRESHOLD_MS - 1,
        ).toISOString(),
      }).isUrgent,
    ).toBe(false);

    // An expired window is not "urgent", it is over.
    expect(
      buildDealCountdownState({ ...base, serverNow: '2026-11-09T09:00:00.000Z' }).isUrgent,
    ).toBe(false);
  });

  it('does not divide by zero when the deadline precedes createdAt (corrupt row)', () => {
    const state = buildDealCountdownState({
      createdAt: '2026-11-08T09:00:00.000Z',
      deadline: '2026-11-06T09:00:00.000Z',
      serverNow: '2026-11-06T09:00:00.000Z',
    });

    expect(state.totalMs).toBe(0);
    expect(state.progressPercent).toBe(100);
    expect(state.remainingMs).toBe(0);
    expect(state.isExpired).toBe(true);
  });

  it('degrades to the expired state on unparseable stamps instead of rendering NaN', () => {
    const state = buildDealCountdownState({
      createdAt: 'not-a-date',
      deadline: deadline,
      serverNow: serverNow,
    });

    expect(state.text).toBe('00:00:00');
    expect(state.isExpired).toBe(true);
    expect(Number.isNaN(state.remainingMs)).toBe(false);
  });

  it('pads each clock segment to two digits', () => {
    const state = buildDealCountdownState({
      ...base,
      serverNow: new Date(Date.parse(deadline) - (1 * 3_600_000 + 2 * 60_000 + 3_000)).toISOString(),
    });

    expect(state.text).toBe('01:02:03');
  });

  it('exposes the Arabic unit labels used by the banner', () => {
    expect(DEAL_COUNTDOWN_UNIT_LABELS_AR).toEqual({
      hours: 'ساعة',
      minutes: 'دقيقة',
      seconds: 'ثانية',
    });
  });
});
