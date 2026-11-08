import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_CANCELLED_BANNER_DESC_AR,
  DEAL_CANCELLED_BANNER_TITLE_AR,
  DealCancelledBanner,
} from '../deal-cancelled-banner';

describe('DealCancelledBanner (Story 5.5 / AC: 9)', () => {
  it('renders red cancellation banner with verbatim notice and role="status"', () => {
    const html = renderToString(
      React.createElement(DealCancelledBanner, {
        cancelledAt: '2026-11-08T12:00:00.000Z',
      }),
    );

    expect(html).toContain(DEAL_CANCELLED_BANNER_TITLE_AR);
    expect(html).toContain(DEAL_CANCELLED_BANNER_DESC_AR);
    expect(html).toContain('تاريخ الإلغاء');
    expect(html).toContain('role="status"');
    expect(html).toContain('data-testid="deal-cancelled-banner"');
  });

  it('renders cleanly without cancelledAt date', () => {
    const html = renderToString(React.createElement(DealCancelledBanner));

    expect(html).toContain(DEAL_CANCELLED_BANNER_TITLE_AR);
    expect(html).toContain(DEAL_CANCELLED_BANNER_DESC_AR);
    expect(html).not.toContain('تاريخ الإلغاء');
  });
});

