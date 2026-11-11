import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminOwnerRequestsPage from '../page';
import AdminOwnerRequestDetailPage from '../[id]/page';
import { formatLockCountdown } from '../contracts-helpers';
import {
  OwnerListingRequestQueueItem,
  OwnerListingRequestDetailResponse,
  OwnerListingRequestStatus,
  PropertyType,
} from '@elmasaif/shared';

// Mock useRouter and useParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({
    id: 'req-test-1',
  }),
}));

const mockQueueItems: OwnerListingRequestQueueItem[] = [
  {
    id: 'req-test-1',
    listingId: 'listing-1',
    propertyTitle: 'فيلا فاخرة بحي النرجس',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    cityName: 'الرياض',
    districtId: 'dist-1',
    districtName: 'النرجس',
    askPrice: 4500000,
    submissionTimestamp: '2026-11-11T10:00:00.000Z',
    ownerLegalName: 'عبدالله بن فهد',
    maskedMobileNumber: '055***2334',
    ownerProfileId: 'owner-prof-1',
    status: OwnerListingRequestStatus.PENDING,
    titleDeedNumber: 'TD-9988776655',
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
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
    id: 'req-test-2',
    listingId: 'listing-2',
    propertyTitle: 'شقة أنيقة بحي الملقا',
    propertyType: PropertyType.APARTMENT,
    cityId: 'city-1',
    cityName: 'الرياض',
    districtId: 'dist-2',
    districtName: 'الملقا',
    askPrice: 75000,
    submissionTimestamp: '2026-11-11T09:00:00.000Z',
    ownerLegalName: 'سارة العبداللطيف',
    maskedMobileNumber: '050***8776',
    ownerProfileId: 'owner-prof-2',
    status: OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE,
    titleDeedNumber: 'TD-1122334455',
    createdAt: '2026-11-11T09:00:00.000Z',
    updatedAt: '2026-11-11T10:30:00.000Z',
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: 'admin-99',
      lockedByAdminName: 'سعد المشرف',
      lockedAt: '2026-11-11T11:00:00.000Z',
      lockExpiresAt: '2026-11-11T11:15:00.000Z',
      remainingSeconds: 600,
    },
  },
];

const mockDetailItem: OwnerListingRequestDetailResponse = {
  id: 'req-test-1',
  listingId: 'listing-1',
  ownerProfileId: 'owner-prof-1',
  propertyType: PropertyType.VILLA,
  cityId: 'city-1',
  cityName: 'الرياض',
  districtId: 'dist-1',
  districtName: 'النرجس',
  streetName: 'شارع أنس بن مالك',
  titleDeedNumber: 'TD-9988776655',
  titleDeedDocumentUrl: 'https://storage.elmasaif.sa/deeds/td1.pdf',
  status: OwnerListingRequestStatus.PENDING,
  rejectionReason: null,
  modificationNotes: null,
  createdAt: '2026-11-11T10:00:00.000Z',
  updatedAt: '2026-11-11T10:00:00.000Z',
  owner: {
    legalName: 'عبدالله بن فهد',
    maskedMobileNumber: '055***2334',
    nationalId: '1099887766',
    payoutIban: 'SA0380000000608010167519',
    isPayoutIbanVerified: true,
  },
  listing: {
    id: 'listing-1',
    title: 'فيلا فاخرة بحي النرجس',
    description: 'فيلا واسعة بتشطيبات مودرن ومسبح خاص',
    askPrice: 4500000,
    areaSquareMeters: 500,
    bedrooms: 5,
    yearBuilt: 2023,
    latitude: 24.8,
    longitude: 46.7,
    photos: [
      { fileUrl: 'https://storage.elmasaif.sa/listings/photo1.jpg', isPrimary: true },
      { fileUrl: 'https://storage.elmasaif.sa/listings/photo2.jpg', isPrimary: false },
    ],
    documents: [],
  },
  contract: null,
  lockInfo: {
    isLocked: true,
    isLockedByCurrentAdmin: true,
    lockedByAdminId: 'current-admin-id',
    lockedByAdminName: 'أنا (المشرف الحالي)',
    lockedAt: '2026-11-11T11:00:00.000Z',
    lockExpiresAt: '2026-11-11T11:15:00.000Z',
    remainingSeconds: 850,
  },
};

describe('AdminOwnerRequestsPage & Helpers (Story 7.1)', () => {
  it('formats lock countdown MM:SS correctly', () => {
    expect(formatLockCountdown(900)).toBe('15:00');
    expect(formatLockCountdown(540)).toBe('09:00');
    expect(formatLockCountdown(65)).toBe('01:05');
    expect(formatLockCountdown(0)).toBe('00:00');
    expect(formatLockCountdown(-15)).toBe('00:00');
  });

  it('renders queue page with table, status filters, and items', () => {
    const html = renderToString(
      <AdminOwnerRequestsPage
        initialItems={mockQueueItems}
        initialTotal={2}
        initialLoading={false}
      />,
    );

    expect(html).toContain('طابور مراجعة طلبات الملاك وإرسال العقود');
    expect(html).toContain('الكل');
    expect(html).toContain('قيد المراجعة');
    expect(html).toContain('بانتظار التوقيع');
    expect(html).toContain('مطلوب تعديلات');
    expect(html).toContain('مرفوض');

    // Item 1 (Available for review)
    expect(html).toContain('فيلا فاخرة بحي النرجس');
    expect(html).toContain('عبدالله بن فهد');
    expect(html).toContain('4,500,000');
    expect(html).toContain('متاح للاستلام');
    expect(html).toContain('استلام');

    // Item 2 (Locked by another admin)
    expect(html).toContain('شقة أنيقة بحي الملقا');
    expect(html).toContain('سارة العبداللطيف');
    expect(html).toContain('سعد المشرف');
    expect(html).toContain('بانتظار التوقيع');
  });

  it('renders request detail page with property specs, owner IBAN, and contract dispatch card', () => {
    const html = renderToString(
      <AdminOwnerRequestDetailPage
        initialDetail={mockDetailItem}
        initialLoading={false}
      />,
    );

    // Property overview
    expect(html).toContain('فيلا فاخرة بحي النرجس');
    expect(html).toContain('4,500,000');
    expect(html).toContain('ر.س');
    expect(html).toContain('العودة لطابور طلبات الملاك');

    // Lock banner for current admin
    expect(html).toContain('أنت مستلم هذه المهمة الآن');
    expect(html).toContain('الوقت المتبقي في القفل:');
    expect(html).toContain('14:10');
    expect(html).toContain('إلغاء القفل وإعادة الإتاحة');

    // Title deed verification
    expect(html).toContain('TD-9988776655');
    expect(html).toContain('تحميل الصك للمعاينة (300 ثانية)');

    // Payout verification
    expect(html).toContain('SA0380000000608010167519');
    expect(html).toContain('موثق ومسجل');

    // Dispatch contract action card
    expect(html).toContain('إرسال العقد الإلكتروني واتخاذ القرار');
    expect(html).toContain('إرسال العقد للمالك للتوقيع');
  });

  it('renders locked-by-other banner when request is leased by another admin', () => {
    const lockedByOtherDetail: OwnerListingRequestDetailResponse = {
      ...mockDetailItem,
      lockInfo: {
        isLocked: true,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: 'other-admin-1',
        lockedByAdminName: 'خالد المشرف',
        lockedAt: '2026-11-11T11:00:00.000Z',
        lockExpiresAt: '2026-11-11T11:15:00.000Z',
        remainingSeconds: 600,
      },
    };

    const html = renderToString(
      <AdminOwnerRequestDetailPage
        initialDetail={lockedByOtherDetail}
        initialLoading={false}
      />,
    );

    expect(html).toContain('وضع المعاينة للقراءة فقط (محجوز)');
    expect(html).toContain('خالد المشرف');
  });

  it('renders available-for-claim banner when request is currently unlocked', () => {
    const unlockedDetail: OwnerListingRequestDetailResponse = {
      ...mockDetailItem,
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

    const html = renderToString(
      <AdminOwnerRequestDetailPage
        initialDetail={unlockedDetail}
        initialLoading={false}
      />,
    );

    expect(html).toContain('الطلب متاح للاستلام');
    expect(html).toContain('استلام المهمة الآن');
  });
});
