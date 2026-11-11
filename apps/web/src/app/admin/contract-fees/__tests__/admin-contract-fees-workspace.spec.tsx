import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminContractFeeDetailPage from '../[id]/page';
import {
  PropertyType,
  OwnerContractStatus,
  CONTRACT_FEE_PAYMENT_STATUS,
  type ContractFeePaymentDetailResponse,
} from '@elmasaif/shared';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'pay-uuid-001' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('../../../../components/providers/admin-auth-provider', () => ({
  useAdminAuth: () => ({
    admin: { id: 'admin-1', fullName: 'مشرف العقود', role: 'MODERATOR' },
    hasPermission: (perm: string) => perm === 'Contracts.Review' || perm === 'Tasks.ForceUnlock',
  }),
}));

describe('AdminContractFeeDetailPage Workspace (Story 7.3 / AC: 3, 4, 5, 6, 7, 8)', () => {
  const mockDetail: ContractFeePaymentDetailResponse = {
    payment: {
      id: 'pay-uuid-001',
      ownerContractId: 'contract-uuid-001',
      amount: 1000,
      status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
      proofFileUrl: 'https://storage.example.com/receipt.pdf',
      bankReferenceCode: 'TXN-99887766',
      senderBankName: 'مصرف الراجحي',
      uploadedAt: '2026-11-11T12:00:00.000Z',
      verifiedByAdminId: null,
      verifiedAt: null,
      rejectionReason: null,
      createdAt: '2026-11-11T11:00:00.000Z',
    },
    contract: {
      id: 'contract-uuid-001',
      listingId: 'listing-uuid-001',
      contractFee: 1000,
      feeOverrideReason: null,
      contractTerms: 'شروط وبنود عقد التسويق المعتمد بين المنصة والمالك...',
      status: OwnerContractStatus.PENDING_FEE,
      expiresAt: '2026-11-18T11:00:00.000Z',
      signedAt: '2026-11-11T11:30:00.000Z',
      signatureData: 'data:image/png;base64,mock',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Safari',
    },
    listing: {
      id: 'listing-uuid-001',
      title: 'فيلا فاخرة مودرن بحي النرجس',
      propertyType: PropertyType.VILLA,
      askPrice: 2800000,
      areaSquareMeters: 400,
      cityName: 'الرياض',
      districtName: 'النرجس',
      titleDeedNumber: '1234567890',
      photos: [],
    },
    owner: {
      id: 'profile-uuid-001',
      legalName: 'عبدالله بن محمد المطيري',
      maskedMobileNumber: '+966 5X XXX 4567',
      nationalId: '1098765432',
      payoutIban: 'SA03 8000 **** **** 7519',
    },
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: true,
      lockedByAdminId: 'admin-1',
      lockedByAdminName: 'مشرف العقود',
      lockedAt: '2026-11-11T12:00:00.000Z',
      lockExpiresAt: '2026-11-11T12:15:00.000Z',
      remainingSeconds: 840,
    },
  };

  const stripHtmlComments = (str: string) => str.replace(/<!--.*?-->/g, '');

  it('renders review dossier with property title, payment amount and lease lock countdown', () => {
    const rawHtml = renderToString(
      <AdminContractFeeDetailPage initialDetail={mockDetail} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('ملف تدقيق سداد الرسوم: فيلا فاخرة مودرن بحي النرجس');
    expect(html).toContain('قيد التدقيق الإداري');
    expect(html).toContain('قفل المعاينة محجوز لحسابك (15 دقيقة)');
    expect(html).toContain('14:00'); // 840 seconds formatted
    expect(html).toContain('تمديد القفل');
    expect(html).toContain('تحرير المهمة');
  });

  it('renders bank transfer metadata, owner details and contract terms', () => {
    const rawHtml = renderToString(
      <AdminContractFeeDetailPage initialDetail={mockDetail} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('TXN-99887766');
    expect(html).toContain('مصرف الراجحي');
    expect(html).toContain('1,000 ر.س');
    expect(html).toContain('عبدالله بن محمد المطيري');
    expect(html).toContain('+966 5X XXX 4567');
    expect(html).toContain('SA03 8000 **** **** 7519');
    expect(html).toContain('شروط وبنود عقد التسويق المعتمد');
  });

  it('renders PDF inline viewer and download action', () => {
    const rawHtml = renderToString(
      <AdminContractFeeDetailPage initialDetail={mockDetail} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('مستند إشعار التحويل البنكي');
    expect(html).toContain('تنزيل الإيصال');
    expect(html).toContain('proof-pdf-frame');
  });

  it('renders enabled decision actions when lock is held by current admin', () => {
    const rawHtml = renderToString(
      <AdminContractFeeDetailPage initialDetail={mockDetail} />,
    );
    const html = stripHtmlComments(rawHtml);

    expect(html).toContain('تأكيد استلام الرسوم واعتماد نشر العقار');
    expect(html).toContain('رفض إشعار التحويل');
    expect(html).toContain('open-confirm-modal-btn');
    expect(html).toContain('open-reject-modal-btn');
  });
});
