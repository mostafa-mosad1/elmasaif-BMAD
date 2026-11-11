import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import OwnerContractSigningPage from '../contracts/[id]/page';
import {
  OwnerContractStatus,
  PropertyType,
  type OwnerContractDetailResponse,
} from '@elmasaif/shared';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'contract-test-1' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/app/owner/contracts/contract-test-1',
}));

describe('OwnerContractSigningPage (Story 7.2 / FR-9, UC-50, UC-53, UJ-3, UX-DR9)', () => {
  const pendingContract: OwnerContractDetailResponse = {
    id: 'contract-test-1',
    listingId: 'listing-test-1',
    ownerProfileId: 'profile-test-1',
    templateId: 'template-test-1',
    propertyTitle: 'فيلا فاخرة مودرن في النرجس',
    propertyType: PropertyType.VILLA,
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 3200000,
    areaSquareMeters: 450,
    contractTerms: 'أولاً: يلتزم الطرف الثاني بتسويق العقار موضوع العقد وفق الأنظمة واللوائح.\nثانياً: يقر الطرف الأول بصحة بيانات العقار وصك الملكية.',
    contractFee: 1000,
    feeOverrideReason: null,
    status: OwnerContractStatus.PENDING_SIGNATURE,
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-11-11T10:00:00.000Z',
    signedAt: null,
    signatureData: null,
    ownerName: 'عبدالله بن محمد المطيري',
    ownerMobile: '+966 5X XXX 4567',
  };

  const signedContract: OwnerContractDetailResponse = {
    ...pendingContract,
    id: 'contract-test-signed',
    status: OwnerContractStatus.PENDING_FEE,
    signedAt: '2026-11-11T12:30:00.000Z',
    signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Safari/605.1.15',
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const expiredContract: OwnerContractDetailResponse = {
    ...pendingContract,
    id: 'contract-test-expired',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // expired yesterday
  };

  it('renders contract page title, property specs, fee and terms', () => {
    const html = renderToString(
      <OwnerContractSigningPage initialContract={pendingContract} />,
    );

    expect(html).toContain('مراجعة وتوقيع عقد الوساطة والتسويق العقاري');
    expect(html).toContain('فيلا فاخرة مودرن في النرجس');
    expect(html).toContain('الرياض');
    expect(html).toContain('النرجس');
    expect(html).toContain('3,200,000 ر.س');
    expect(html).toContain('450 م²');
    expect(html).toContain('1,000 ريال سعودي');
    expect(html).toContain('يلتزم الطرف الثاني بتسويق العقار');
  });

  it('renders signature execution block and legal consent when PENDING_SIGNATURE', () => {
    const html = renderToString(
      <OwnerContractSigningPage initialContract={pendingContract} />,
    );

    expect(html).toContain('تنفيذ التوقيع الإلكتروني للمالك');
    expect(html).toContain('ارسم توقيعك هنا (باستخدام اللمس أو الفأرة أو القلم)');
    expect(html).toContain('أقر أنا الموقع أدناه بصفتي المالك النظامي للعقار');
    expect(html).toContain('اعتماد التوقيع وإرسال رمز التحقق');
  });

  it('renders green verified electronic signature stamp and fee payment instructions when PENDING_FEE', () => {
    const html = renderToString(
      <OwnerContractSigningPage initialContract={signedContract} />,
    );

    expect(html).toContain('عقد موثق وموقع إلكترونياً');
    expect(html).toContain('تم توثيق واعتماد التوقيع الإلكتروني بنجاح');
    expect(html).toContain('عبدالله بن محمد المطيري');
    expect(html).toContain('+966 5X XXX 4567');
    expect(html).toContain('IP: 192.168.1.100');
    expect(html).toContain('Mozilla/5.0 Safari/605.1.15');
    expect(html).toContain('المرحلة التالية: سداد رسوم العقد والتسويق');
    expect(html).toContain('مصرف الراجحي');
    expect(html).toContain('SA0380000000608010167519');
    expect(html).toContain('سداد رسوم العقد ورفع الإشعار البنكي');
  });

  it('renders expired contract warning banner when contract deadline passed', () => {
    const html = renderToString(
      <OwnerContractSigningPage initialContract={expiredContract} />,
    );

    expect(html).toContain('انتهت مهلة التوقيع على هذا العقد (7 أيام)');
    expect(html).toContain('لم تعد صلاحية التوقيع الإلكتروني سارية');
    // Signature execution block should not be rendered
    expect(html).not.toContain('تنفيذ التوقيع الإلكتروني للمالك');
  });
});

