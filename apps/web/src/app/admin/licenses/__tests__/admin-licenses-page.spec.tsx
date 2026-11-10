import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminLicensesPage from '../page';
import AdminLicenseReviewDetailPage from '../[id]/page';
import { formatLockCountdown } from '../licensing-helpers';
import { FalLicenseDetailResponse, FalLicenseQueueItem, ProfileStatus } from '@elmasaif/shared';

// Mock useRouter and useParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({
    id: 'fal-app-1',
  }),
}));

const mockItems: FalLicenseQueueItem[] = [
  {
    id: 'fal-app-1',
    licenseNumber: '1200012345',
    commercialName: 'شركة الأفق العقارية',
    crNumber: '1010123456',
    expiryDate: '2028-10-15T00:00:00.000Z',
    status: ProfileStatus.UNDER_REVIEW,
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    applicantName: 'محمد السالم',
    applicantPhone: '0501234567',
    applicantNationalId: '1012345678',
    isRenewal: false,
    suspendedListingsCount: 0,
    lockInfo: {
      isLocked: false,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: null,
      lockedByAdminName: null,
      lockedAt: null,
      lockExpiresAt: null,
      remainingSeconds: 0,
    },
  },
  {
    id: 'fal-app-2',
    licenseNumber: '1200098765',
    commercialName: 'مكتب الرياض المتقدم',
    crNumber: '1010654321',
    expiryDate: '2029-01-01T00:00:00.000Z',
    status: ProfileStatus.UNDER_REVIEW,
    createdAt: '2026-11-09T11:00:00.000Z',
    updatedAt: '2026-11-09T11:00:00.000Z',
    applicantName: 'عبدالله الشمري',
    applicantPhone: '0559876543',
    applicantNationalId: '1087654321',
    isRenewal: true,
    suspendedListingsCount: 4,
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: 'admin-other',
      lockedByAdminName: 'سارة المشرفة',
      lockedAt: '2026-11-09T11:05:00.000Z',
      lockExpiresAt: '2026-11-09T11:20:00.000Z',
      remainingSeconds: 540,
    },
  },
];

const mockRenewalDetail: FalLicenseDetailResponse = {
  id: 'fal-renew-detail-1',
  licenseNumber: '1100055555',
  commercialName: 'مكتب الرواد للتسويق',
  crNumber: '1010555555',
  expiryDate: '2028-11-10T00:00:00.000Z',
  certificateUrl: 'https://s3.example.com/certs/renew-cert.pdf',
  certificateDownloadUrl: 'https://s3.example.com/certs/renew-cert.pdf?signed=1',
  supportingDocumentUrls: [],
  supportingDocumentDownloadUrls: [],
  rejectionReason: null,
  status: ProfileStatus.UNDER_REVIEW,
  version: 2,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
  isRenewal: true,
  previousExpiryDate: '2026-11-01T00:00:00.000Z',
  suspendedListingsCount: 2,
  suspendedListings: [
    {
      id: 'lst-1',
      title: 'شقة فاخرة بحي الياسمين',
      propertyType: 'APARTMENT',
      askPrice: '1200000',
      cityName: 'الرياض',
      districtName: 'الياسمين',
    },
    {
      id: 'lst-2',
      title: 'فيلا مودرن بحي الملقا',
      propertyType: 'VILLA',
      askPrice: '3800000',
      cityName: 'الرياض',
      districtName: 'الملقا',
    },
  ],
  applicant: {
    id: 'user-1',
    fullName: 'خالد المطيري',
    phoneNumber: '0505555555',
    nationalId: '1055555555',
    profileStatus: ProfileStatus.COMPLIANCE_RESTRICTED,
  },
  lockInfo: {
    isLocked: false,
    isLockedByCurrentAdmin: false,
    lockedByAdminId: null,
    lockedByAdminName: null,
    lockedAt: null,
    lockExpiresAt: null,
    remainingSeconds: 0,
  },
};

describe('AdminLicensesPage', () => {
  it('formats lock countdown MM:SS correctly', () => {
    expect(formatLockCountdown(900)).toBe('15:00');
    expect(formatLockCountdown(540)).toBe('09:00');
    expect(formatLockCountdown(65)).toBe('01:05');
    expect(formatLockCountdown(0)).toBe('00:00');
    expect(formatLockCountdown(-10)).toBe('00:00');
  });

  it('renders header, tabs, and queue table with mock items', () => {
    const html = renderToString(
      <AdminLicensesPage initialItems={mockItems} initialTotal={2} initialLoading={false} />,
    );

    expect(html).toContain('طابور تدقيق واعتماد رخص فال (REGA)');
    expect(html).toContain('قيد المراجعة');
    expect(html).toContain('المعتمدة');
    expect(html).toContain('المرفوضة');
    expect(html).toContain('الكل');

    // Type filter tabs (Story 6.3 AC #4)
    expect(html).toContain('جميع الطلبات');
    expect(html).toContain('طلبات التجديد');
    expect(html).toContain('الطلبات الجديدة');

    // Item 1 (Initial application)
    expect(html).toContain('1200012345');
    expect(html).toContain('شركة الأفق العقارية');
    expect(html).toContain('محمد السالم');
    expect(html).toContain('طلب جديد');
    expect(html).toContain('متاح للمراجعة');

    // Item 2 (Renewal application)
    expect(html).toContain('1200098765');
    expect(html).toContain('مكتب الرياض المتقدم');
    expect(html).toContain('سارة المشرفة');
    expect(html).toContain('طلب تجديد');
    expect(html).toContain('إعلانات معلقة');
    expect(html).toContain('09:00');
  });
});

describe('Story 6.3: Admin License Review Detail Page (AC #2, #5)', () => {
  it('renders renewal inspection card with expiry date comparison and suspended listings panel', () => {
    const html = renderToString(
      <AdminLicenseReviewDetailPage initialLicense={mockRenewalDetail} initialLoading={false} />,
    );

    // Renewal Inspection Card
    expect(html).toContain('طلب تجديد رخصة فال');
    expect(html).toContain('مقارنة صلاحية الترخيص وتأثير التجديد على الإعلانات المعلقة');

    // Expiry date comparison
    expect(html).toContain('تاريخ الانتهاء السابق المسجل');
    expect(html).toContain('تاريخ الانتهاء الجديد المطلوب (تمديد)');
    expect(html).toContain('تمديد صلاحية سليم');

    // Suspended listings automatic reinstatement panel
    expect(html).toContain('إعلانات معلقة ستتم إعادتها آلياً فور الاعتماد');
    expect(html).toContain('شقة فاخرة بحي الياسمين');
    expect(html).toContain('فيلا مودرن بحي الملقا');
    expect(html).toContain('ر.س');
  });
});

