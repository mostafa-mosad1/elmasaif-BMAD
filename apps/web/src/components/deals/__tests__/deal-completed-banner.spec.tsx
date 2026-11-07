import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_COMPLETED_BANNER_DESC_AR,
  DEAL_COMPLETED_BANNER_TITLE_AR,
  DealCompletedBanner,
} from '../deal-completed-banner';

describe('DealCompletedBanner (Story 5.4 / AC: 6)', () => {
  it('renders emerald green completion banner with verbatim notice', () => {
    const html = renderToString(
      React.createElement(DealCompletedBanner, {
        completedAt: '2026-11-07T12:00:00.000Z',
      }),
    );

    expect(html).toContain(DEAL_COMPLETED_BANNER_TITLE_AR);
    expect(html).toContain(DEAL_COMPLETED_BANNER_DESC_AR);
    expect(html).toContain('تاريخ الاكتمال');
    expect(html).toContain('role="status"');
  });
});

