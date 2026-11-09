import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DealDisputeModal } from '../deal-dispute-modal';

describe('DealDisputeModal (Story 5.6 / AC: 4, 9)', () => {
  it('returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(DealDisputeModal, {
        isOpen: false,
        onClose: vi.fn(),
        dealId: 'deal-123',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toBe('');
  });

  it('renders modal with title, explanation, required reason input, and action buttons when open', () => {
    const html = renderToString(
      React.createElement(DealDisputeModal, {
        isOpen: true,
        onClose: vi.fn(),
        dealId: 'deal-123',
        dealNumber: 'DEAL-2026-0001',
        onSuccess: vi.fn(),
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="dispute-modal-title"');
    expect(html).toContain('تقديم نزاع رسمي حول الصفقة');
    expect(html).toContain('DEAL-2026-0001');
    expect(html).toContain('تقديم نزاع يؤدي إلى تجميد فوري لمهلة السداد التلقائية');
    expect(html).toContain('تفاصيل وأسباب النزاع');
    expect(html).toContain('تأكيد تقديم النزاع');
    expect(html).toContain('إلغاء');
  });
});
