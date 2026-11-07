import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_RATING_CONFIRMATION_AR,
  DEAL_RATING_TITLE_AR,
  DealRatingCard,
} from '../deal-rating-card';

describe('DealRatingCard (Story 5.4 / AC: 4, 6)', () => {
  it('renders interactive 1-5 star selector and comment field when unrated', () => {
    const html = renderToString(
      React.createElement(DealRatingCard, {
        dealId: 'deal-1',
        rating: null,
        canRate: true,
      }),
    );

    expect(html).toContain(DEAL_RATING_TITLE_AR);
    expect(html).toContain('درجة التقييم');
    expect(html).toContain('اختر عدد النجوم');
    expect(html).toContain('ملاحظات أو تعليق (اختياري)');
    expect(html).toContain('إرسال التقييم');
  });

  it('renders read-only score, stars, and comment when already rated', () => {
    const html = renderToString(
      React.createElement(DealRatingCard, {
        dealId: 'deal-1',
        rating: {
          id: 'rating-1',
          score: 5,
          comment: 'تعامل راقي وسريع في الإفراغ',
          createdAt: '2026-11-07T12:00:00.000Z',
        },
        canRate: false,
      }),
    );

    expect(html).toContain(DEAL_RATING_TITLE_AR);
    expect(html).toContain(DEAL_RATING_CONFIRMATION_AR);
    expect(html).toContain('ممتاز');
    expect(html).toContain('تعامل راقي وسريع في الإفراغ');
    expect(html).not.toContain('إرسال التقييم');
  });

  it('renders nothing when unrated but canRate is false (e.g. non-completed deal)', () => {
    const html = renderToString(
      React.createElement(DealRatingCard, {
        dealId: 'deal-1',
        rating: null,
        canRate: false,
      }),
    );
    expect(html).toBe('');
  });
});

