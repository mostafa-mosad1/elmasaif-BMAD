import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DealCancelModal } from '../deal-cancel-modal';

describe('DealCancelModal (Story 5.6 / AC: 1, 9)', () => {
  it('returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(DealCancelModal, {
        isOpen: false,
        onClose: vi.fn(),
        dealId: 'deal-123',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toBe('');
  });

  it('renders modal with title, warning, optional reason input, and action buttons when open', () => {
    const html = renderToString(
      React.createElement(DealCancelModal, {
        isOpen: true,
        onClose: vi.fn(),
        dealId: 'deal-123',
        dealNumber: 'DEAL-2026-0001',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="cancel-deal-modal-title"');
    expect(html).toContain('إلغاء الصفقة');
    expect(html).toContain('DEAL-2026-0001');
    expect(html).toContain('سيؤدي الإلغاء إلى فك حجز العقار وإعادته فوراً');
    expect(html).toContain('سبب الإلغاء (اختياري)');
    expect(html).toContain('تأكيد إلغاء الصفقة');
    expect(html).toContain('تراجع');
  });
});
