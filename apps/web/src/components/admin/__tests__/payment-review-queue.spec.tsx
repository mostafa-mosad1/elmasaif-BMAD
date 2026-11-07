import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  DEAL_PAYMENT_STATUS,
  PaymentType,
  type AdminPaymentQueueItem,
} from '@elmasaif/shared';
import {
  PaymentReviewQueue,
  formatLockCountdown,
} from '../payment-review-queue';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: Object.assign(() => Promise.resolve({}), {
      get: vi.fn(() =>
        Promise.resolve({
          statusCode: 200,
          data: {
            items: [],
            meta: { total: 0, page: 1, limit: 50, totalPages: 1 },
          },
        }),
      ),
      post: vi.fn(() => Promise.resolve({ statusCode: 200 })),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

describe('PaymentReviewQueue (Story 5.3) (AC: 1, 2, 8)', () => {
  describe('formatLockCountdown', () => {
    it('formats remaining seconds into MM:SS correctly', () => {
      expect(formatLockCountdown(900)).toBe('15:00');
      expect(formatLockCountdown(305)).toBe('05:05');
      expect(formatLockCountdown(45)).toBe('00:45');
      expect(formatLockCountdown(0)).toBe('00:00');
      expect(formatLockCountdown(-10)).toBe('00:00');
    });
  });

  describe('SSR Render', () => {
    it('renders queue header, AD-10 lease info, and filter tabs', () => {
      const html = renderToString(<PaymentReviewQueue />);

      expect(html).toContain('طابور تدقيق إثباتات الدفع');
      expect(html).toContain('قفل حصري لمدة 15 دقيقة مع نبض تلقائي • AD-10');
      expect(html).toContain('الكل');
      expect(html).toContain('تم رفع الإيصال - قيد المراجعة');
      expect(html).toContain('قيد التدقيق الإداري');
    });
  });
});

