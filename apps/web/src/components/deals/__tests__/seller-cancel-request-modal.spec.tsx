import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SellerCancelRequestModal } from '../seller-cancel-request-modal';

describe('SellerCancelRequestModal (Story 5.6 / AC: 2, 10)', () => {
  it('returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(SellerCancelRequestModal, {
        isOpen: false,
        onClose: vi.fn(),
        dealId: 'deal-123',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toBe('');
  });

  it('renders modal with title, reason input, and buttons when open', () => {
    const html = renderToString(
      React.createElement(SellerCancelRequestModal, {
        isOpen: true,
        onClose: vi.fn(),
        dealId: 'deal-123',
        dealNumber: 'DEAL-2026-0001',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="seller-cancel-modal-title"');
    expect(html).toContain('طلب إلغاء الصفقة من قِبل البائع');
    expect(html).toContain('DEAL-2026-0001');
    expect(html).toContain('سبب طلب الإلغاء');
    expect(html).toContain('إرسال طلب الإلغاء للإدارة');
    expect(html).toContain('تراجع');
  });
});
