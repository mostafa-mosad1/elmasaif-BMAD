import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { buildDealCountdownState as buildSharedDealCountdownState } from '@elmasaif/shared';
import {
  DEAL_COUNTDOWN_EXPIRED_AR,
  DEAL_COUNTDOWN_TICK_MS,
  DEAL_COUNTDOWN_TITLE_AR,
  DEAL_DEADLINE_NOTICE_AR,
  DealCountdownBanner,
  buildDealCountdownState,
} from '../deal-countdown-banner';

const CREATED_AT = '2026-11-07T00:00:00.000Z';
const DEADLINE = '2026-11-09T00:00:00.000Z'; // createdAt + 48 h
const HOUR_MS = 3_600_000;

function stateAfter(elapsedMs = 0) {
  return buildDealCountdownState({
    createdAt: CREATED_AT,
    deadline: DEADLINE,
    serverNow: CREATED_AT,
    elapsedMs,
  });
}

function render(state: ReturnType<typeof stateAfter>): string {
  return renderToString(React.createElement(DealCountdownBanner, { state }));
}

describe('DealCountdownBanner (AC: 3, UX-DR5)', () => {
  it('aliases the shared countdown maths instead of re-implementing it', () => {
    expect(buildDealCountdownState).toBe(buildSharedDealCountdownState);
    expect(DEAL_COUNTDOWN_TICK_MS).toBe(1000);
  });

  it('renders a fresh 48-hour window with the Arabic unit labels and the verbatim notice', () => {
    const html = render(stateAfter());

    expect(html).toContain('48:00:00');
    expect(html).toContain('ساعة');
    expect(html).toContain('دقيقة');
    expect(html).toContain('ثانية');
    expect(html).toContain(DEAL_COUNTDOWN_TITLE_AR);
    expect(html).toContain(DEAL_DEADLINE_NOTICE_AR);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-valuenow="0"');
  });

  it('shows the elapsed half of the window as 24:00:00 / 50 %', () => {
    const state = stateAfter(24 * HOUR_MS);
    const html = render(state);

    expect(state.text).toBe('24:00:00');
    expect(html).toContain('24:00:00');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).not.toContain(DEAL_COUNTDOWN_EXPIRED_AR);
  });

  it('stops at 00:00:00 and states the expiry in words once the deadline passes', () => {
    const state = stateAfter(48 * HOUR_MS + 1_000);
    const html = render(state);

    expect(state.remainingMs).toBe(0);
    expect(state.isExpired).toBe(true);
    expect(html).toContain('00:00:00');
    expect(html).toContain(DEAL_COUNTDOWN_EXPIRED_AR);
    expect(html).toContain('aria-valuenow="100"');
    expect(html).not.toContain('-00:00:01');
  });

  it('keeps the gold banner styling and the deadline notice inside the banner', () => {
    const html = render(stateAfter());

    expect(html).toContain('border-accent');
    expect(html).toContain('bg-accent-light');
    expect(html).toContain('font-mono');
    expect(html).toContain(DEAL_DEADLINE_NOTICE_AR);
  });
});
