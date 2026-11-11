import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminContractFeesPage from '../page';
import {
  PropertyType,
  CONTRACT_FEE_PAYMENT_STATUS,
  type ContractFeePaymentQueueItem,
} from '@elmasaif/shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('AdminContractFeesPage Queue (Story 7.3 / AC: 3, 8)', () => {
  const mockItem: ContractFeePaymentQueueItem = {
    id: 'pay-uuid-001',
    ownerContractId: 'contract-uuid-001',
    listingId: 'listing-uuid-001',
    propertyTitle: 'فيلا فاخرة مودرن بحي النرجس',
    propertyType: PropertyType.VILLA,
    ownerLegalName: 'عبدالله بن محمد المطيري',
    maskedMobileNumber: '+966 5X XXX 4567',
    amount: 1000,
    status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
    bankReferenceCode: 'TXN-99887766',
    senderBankName: 'مصرف الراجحي',
    uploadedAt: '2026-11-11T12:00:00.000Z',
    lockInfo: {
      isLocked: false,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: null,
      lockedByAdminName: null,
      lockedAt: null,
      lockExpiresAt: null,
      remainingSeconds: 0,
    },
    createdAt: '2026-11-11T11:00:00.000Z',
    expiresAt: '2026-11-18T11:00:00.000Z',
  };

  const stripHtmlComments = (str: string) => str.replace(/<!--.*?-->/g, '');

  it('renders queue header and summary', () => {
    const rawHtml = renderToString(
      <AdminContractFeesPage initialItems={[mockItem]} initialTotal={1} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('طابور تدقيق رسوم العقود والنشر الآلي');
    expect(html).toContain('1 إشعار');
    expect(html).toContain('جميع الإشعارات');
    expect(html).toContain('بانتظار التدقيق');
    expect(html).toContain('مؤكد ومعتمد');
  });

  it('renders fee payment row with property, owner, fee, bank metadata and claim action', () => {
    const rawHtml = renderToString(
      <AdminContractFeesPage initialItems={[mockItem]} initialTotal={1} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('فيلا فاخرة مودرن بحي النرجس');
    expect(html).toContain('عبدالله بن محمد المطيري');
    expect(html).toContain('1,000 ر.س');
    expect(html).toContain('TXN-99887766');
    expect(html).toContain('مصرف الراجحي');
    expect(html).toContain('تم رفع الإشعار (بانتظار التدقيق)');
    expect(html).toContain('متاح للمعاينة');
    expect(html).toContain('حجز ومراجعة');
  });

  it('renders active lease status when locked by current admin', () => {
    const lockedItem: ContractFeePaymentQueueItem = {
      ...mockItem,
      status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
      lockInfo: {
        isLocked: true,
        isLockedByCurrentAdmin: true,
        lockedByAdminId: 'admin-1',
        lockedByAdminName: 'مشرف أول',
        lockedAt: '2026-11-11T12:00:00.000Z',
        lockExpiresAt: '2026-11-11T12:15:00.000Z',
        remainingSeconds: 780,
      },
    };

    const rawHtml = renderToString(
      <AdminContractFeesPage initialItems={[lockedItem]} initialTotal={1} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('محجوز لك (13:00)');
    expect(html).toContain('متابعة التدقيق');
  });
});
