import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import OwnerContractSigningPage from '../contracts/[id]/page';
import { ContractFeeProofModal } from '../../../../components/contracts/contract-fee-proof-modal';
import {
  OwnerContractStatus,
  PropertyType,
  type OwnerContractDetailResponse,
} from '@elmasaif/shared';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'contract-fee-test-1' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/app/owner/contracts/contract-fee-test-1',
}));

describe('Owner Contract Fee Payment & Proof Verification (Story 7.3 / AC: 1, 2)', () => {
  const baseContract: OwnerContractDetailResponse = {
    id: 'contract-fee-test-1',
    listingId: 'listing-uuid-888',
    ownerProfileId: 'profile-uuid-1',
    templateId: 'template-uuid-1',
    propertyTitle: 'فيلا فاخرة مودرن بحي النرجس',
    propertyType: PropertyType.VILLA,
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 2500000,
    areaSquareMeters: 400,
    contractTerms: 'شروط وبنود عقد تسويق عقاري إلكتروني...',
    contractFee: 1000,
    feeOverrideReason: null,
    status: OwnerContractStatus.PENDING_FEE,
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-11-11T10:00:00.000Z',
    signedAt: '2026-11-11T11:00:00.000Z',
    signatureData: 'data:image/png;base64,mock',
    ownerName: 'عبدالله بن محمد المطيري',
    ownerMobile: '+966 5X XXX 4567',
  };

  describe('OwnerContractSigningPage Fee States', () => {
    it('renders initial fee payment instructions with bank details and enabled CTA', () => {
      const html = renderToString(
        <OwnerContractSigningPage initialContract={baseContract} />,
      );

      expect(html).toContain('المرحلة التالية: سداد رسوم العقد والتسويق (1,000 ريال)');
      expect(html).toContain('شركة المصايف العقارية');
      expect(html).toContain('مصرف الراجحي');
      expect(html).toContain('SA0380000000608010167519');
      expect(html).toContain('سداد رسوم العقد ورفع الإشعار البنكي');
      expect(html).toContain('fee-payment-banner');
    });

    it('renders active certified banner with marketplace listing link when contract is ACTIVE', () => {
      const activeContract: OwnerContractDetailResponse = {
        ...baseContract,
        status: OwnerContractStatus.ACTIVE,
      };

      const html = renderToString(
        <OwnerContractSigningPage initialContract={activeContract} />,
      );

      expect(html).toContain('عقد سارٍ ومعتمد');
      expect(html).toContain('تم تأكيد سداد الرسوم ونشر العقار في السوق العام بنجاح');
      expect(html).toContain('عرض الإعلان في المنصة');
      expect(html).toContain('/listings/listing-uuid-888');
      expect(html).toContain('active-contract-banner');
    });
  });

  describe('ContractFeeProofModal', () => {
    it('renders file upload dropzone and metadata inputs', () => {
      const html = renderToString(
        <ContractFeeProofModal
          open={true}
          onClose={() => {}}
          contractId={baseContract.id}
          onSuccess={() => {}}
        />,
      );

      expect(html).toContain('رفع إشعار سداد رسوم العقد والتسويق');
      expect(html).toContain('اسحب وأفلت إشعار التحويل هنا');
      expect(html).toContain('رقم العملية / مرجع التحويل البنكي');
      expect(html).toContain('اسم البنك المحول منه');
      expect(html).toContain('تأكيد ورفع الإشعار');
      expect(html).toContain('خوادم سيادية مشفرة');
    });

    it('does not render content when open is false', () => {
      const html = renderToString(
        <ContractFeeProofModal
          open={false}
          onClose={() => {}}
          contractId={baseContract.id}
          onSuccess={() => {}}
        />,
      );

      expect(html).toBe('');
    });
  });
});

