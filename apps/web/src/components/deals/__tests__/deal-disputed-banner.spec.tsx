import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_DISPUTED_BANNER_DESC_AR,
  DEAL_DISPUTED_BANNER_TITLE_AR,
  DealDisputedBanner,
} from '../deal-disputed-banner';

describe('DealDisputedBanner (Story 5.6 / AC: 4, 9, 10)', () => {
  it('renders amber disputed banner with verbatim notice and role="status"', () => {
    const html = renderToString(React.createElement(DealDisputedBanner));

    expect(html).toContain(DEAL_DISPUTED_BANNER_TITLE_AR);
    expect(html).toContain(DEAL_DISPUTED_BANNER_DESC_AR);
    expect(html).toContain('role="status"');
    expect(html).toContain('data-testid="deal-disputed-banner"');
    expect(html).toContain('aria-label="' + DEAL_DISPUTED_BANNER_TITLE_AR + '"');
  });

  it('applies custom className when provided', () => {
    const html = renderToString(
      React.createElement(DealDisputedBanner, { className: 'custom-margin' }),
    );

    expect(html).toContain('custom-margin');
  });
});

