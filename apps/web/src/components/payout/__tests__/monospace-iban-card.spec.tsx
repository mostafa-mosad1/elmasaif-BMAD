import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MonospaceIbanCard } from '../monospace-iban-card';

describe('MonospaceIbanCard Component (AC: 3, 5, 6)', () => {
  const mockAccount = {
    id: 'acc-1',
    accountHolderName: 'سعد بن عبد الله القحطاني',
    bankName: 'مصرف الراجحي',
    ibanMasked: 'SA03 **** **** **** **** 7519',
    ibanFormatted: 'SA03 8000 0000 6080 1016 7519',
    ibanLast4: '7519',
    isDefault: true,
    hasCommercialNameMismatch: false,
    isBoundToActiveDeal: false
  };

  it('renders monospace IBAN layout with grouped 4-char blocks and bank badge', () => {
    const html = renderToString(
      React.createElement(MonospaceIbanCard, { account: mockAccount })
    );

    expect(html).toContain('font-mono');
    expect(html).toContain('مصرف الراجحي');
    expect(html).toContain('سعد بن عبد الله القحطاني');
    expect(html).toContain('الحساب الافتراضي');
  });

  it('renders copy button and unmask toggle button', () => {
    const html = renderToString(
      React.createElement(MonospaceIbanCard, { account: mockAccount })
    );

    expect(html).toContain('نسخ رقم الآيبان');
    expect(html).toContain('إظهار رقم الآيبان');
  });

  it('renders institutional active deal lock badge when bound to active deal', () => {
    const lockedAccount = {
      ...mockAccount,
      isBoundToActiveDeal: true
    };

    const html = renderToString(
      React.createElement(MonospaceIbanCard, { account: lockedAccount })
    );

    expect(html).toContain('مرتبط بصفقة نشطة - غير قابل للتعديل حالياً');
  });

  it('renders commercial name mismatch warning indicator when flag is true', () => {
    const mismatchAccount = {
      ...mockAccount,
      hasCommercialNameMismatch: true
    };

    const html = renderToString(
      React.createElement(MonospaceIbanCard, { account: mismatchAccount })
    );

    expect(html).toContain('اسم صاحب الحساب يختلف عن الاسم المسجل');
  });
});

