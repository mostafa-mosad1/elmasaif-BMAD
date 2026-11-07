import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DEAL_INVOICE_TITLE_AR, DealInvoiceCard } from '../deal-invoice-card';

describe('DealInvoiceCard (Story 5.4 / AC: 2, 5, 6)', () => {
  const invoice = {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV-20261107-DL-0001',
    subtotalAmount: '43478.26',
    vatAmount: '6521.74',
    vatRate: '0.15',
    totalAmount: '50000.00',
    vatTreatment: 'STANDARD_RATE_15',
    createdAt: '2026-11-07T12:00:00.000Z',
  };

  it('renders statutory VAT invoice summary with subtotal, 15% VAT, and total', () => {
    const html = renderToString(React.createElement(DealInvoiceCard, { invoice }));

    expect(html).toContain(DEAL_INVOICE_TITLE_AR);
    expect(html).toContain('INV-20261107-DL-0001');
    expect(html).toContain('43,478.26');
    expect(html).toContain('6,521.74');
    expect(html).toContain('50,000');
    expect(html).toContain('ضريبة القيمة المضافة (15%)');
    expect(html).toContain('طباعة الفاتورة');
  });

  it('renders nothing when invoice is null or undefined', () => {
    const html = renderToString(React.createElement(DealInvoiceCard, { invoice: null }));
    expect(html).toBe('');
  });
});

