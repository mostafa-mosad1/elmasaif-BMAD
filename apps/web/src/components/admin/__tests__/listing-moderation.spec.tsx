import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  AdminRole,
  DocumentVisibility,
  ListingStatus,
  ModerationQueueItem,
  PriceSuggestionStatus,
  PropertyType,
  ScanStatus,
  UserRole,
} from '@elmasaif/shared';
import { ListingModerationQueue } from '../listing-moderation-queue';
import { ListingModerationReview } from '../listing-moderation-review';
import { AdminAuthContext } from '../../providers/admin-auth-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/listings/moderation',
}));

const mockModerator = {
  id: 'admin-mod-1',
  username: 'ahmed.mod',
  email: 'ahmed@elmasaif.sa',
  fullName: 'أحمد المراجع',
  role: AdminRole.MODERATOR,
  isActive: true,
  permissions: ['Listings.Review', 'Licenses.Review'],
};

const mockSuperAdmin = {
  id: 'admin-super-1',
  username: 'super.admin',
  email: 'super@elmasaif.sa',
  fullName: 'سلمان المشرف العام',
  role: AdminRole.SUPER_ADMIN,
  isActive: true,
  permissions: ['Listings.Review', 'Tasks.ForceUnlock'],
};

const sampleQueueItems: ModerationQueueItem[] = [
  {
    id: 'listing-1',
    title: 'فيلا فاخرة في حي الملقا',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'dist-1',
    cityName: 'الرياض',
    districtName: 'الملقا',
    askPrice: 4500000,
    areaSquareMeters: 450,
    status: ListingStatus.PENDING_REVIEW,
    version: 1,
    sellerRole: UserRole.MARKETER,
    sellerName: 'عبدالله الوسيط',
    sellerProfileId: 'prof-1',
    photoCount: 5,
    documentCount: 2,
    rejectionReason: null,
    createdAt: '2026-11-03T08:00:00.000Z',
    updatedAt: '2026-11-03T08:00:00.000Z',
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
    id: 'listing-2',
    title: 'أرض تجارية على طريق الملك فهد',
    propertyType: PropertyType.LAND,
    cityId: 'city-1',
    districtId: 'dist-2',
    cityName: 'الرياض',
    districtName: 'العليا',
    askPrice: 12000000,
    areaSquareMeters: 1200,
    status: ListingStatus.PENDING_REVIEW,
    version: 1,
    sellerRole: UserRole.OWNER,
    sellerName: 'فهد المالك',
    sellerProfileId: 'prof-2',
    photoCount: 3,
    documentCount: 1,
    rejectionReason: null,
    createdAt: '2026-11-03T08:30:00.000Z',
    updatedAt: '2026-11-03T08:30:00.000Z',
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: 'admin-other-99',
      lockedByAdminName: 'خالد المشرف المناوب',
      lockedAt: '2026-11-03T09:50:00.000Z',
      lockExpiresAt: '2026-11-03T10:05:00.000Z',
      remainingSeconds: 540,
    },
  },
  {
    id: 'listing-3',
    title: 'شقة تمليك في حي الشاطئ',
    propertyType: PropertyType.APARTMENT,
    cityId: 'city-2',
    districtId: 'dist-3',
    cityName: 'جدة',
    districtName: 'الشاطئ',
    askPrice: 1850000,
    areaSquareMeters: 210,
    status: ListingStatus.PENDING_REVIEW,
    version: 1,
    sellerRole: UserRole.MARKETER,
    sellerName: 'مؤسسة الإعمار العقارية',
    sellerProfileId: 'prof-3',
    photoCount: 4,
    documentCount: 2,
    rejectionReason: null,
    createdAt: '2026-11-03T09:00:00.000Z',
    updatedAt: '2026-11-03T09:00:00.000Z',
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: true,
      lockedByAdminId: 'admin-mod-1',
      lockedByAdminName: 'أحمد المراجع',
      lockedAt: '2026-11-03T09:55:00.000Z',
      lockExpiresAt: '2026-11-03T10:10:00.000Z',
      remainingSeconds: 870,
    },
  },
];

const baseListingDetail = {
  id: 'listing-1',
  title: 'فيلا فاخرة في حي الملقا',
  description: 'فيلا مستقلة بتصميم حديث ومسبح داخلي',
  propertyType: PropertyType.VILLA,
  cityId: 'city-1',
  districtId: 'dist-1',
  cityName: 'الرياض',
  districtName: 'الملقا',
  streetName: 'شارع أنس بن مالك',
  latitude: 24.8123,
  longitude: 46.6234,
  askPrice: 4500000,
  areaSquareMeters: 450,
  bedrooms: 5,
  yearBuilt: 2025,
  status: ListingStatus.PENDING_REVIEW,
  sellerProfileId: 'prof-1',
  payoutIban: 'SA0380000000608010167519',
  version: 1,
  sellerProfile: {
    id: 'prof-1',
    userId: 'user-1',
    role: UserRole.MARKETER,
    user: {
      id: 'user-1',
      fullName: 'عبدالله الوسيط',
      username: 'abdullah_broker',
      mobileNumber: '0501234567',
      email: 'abdullah@broker.sa',
    },
  },
  photos: [
    {
      id: 'p-1',
      documentType: 'PHOTO',
      fileUrl: 'https://s3.local/p1.jpg?signed=1',
      mimeType: 'image/jpeg',
      fileSize: 120000,
      visibility: DocumentVisibility.PUBLIC,
      scanStatus: ScanStatus.CLEAN,
      createdAt: '2026-11-03T08:00:00.000Z',
    },
  ],
  documents: [
    {
      id: 'd-1',
      documentType: 'TITLE_DEED',
      fileUrl: 'https://s3.local/deed.pdf?signed=1',
      mimeType: 'application/pdf',
      fileSize: 450000,
      visibility: DocumentVisibility.ADMIN_ONLY,
      scanStatus: ScanStatus.CLEAN,
      createdAt: '2026-11-03T08:00:00.000Z',
    },
    {
      id: 'd-2',
      documentType: 'OWNER_AUTHORIZATION',
      fileUrl: 'https://s3.local/auth.pdf?signed=1',
      mimeType: 'application/pdf',
      fileSize: 380000,
      visibility: DocumentVisibility.ADMIN_ONLY,
      scanStatus: ScanStatus.CLEAN,
      createdAt: '2026-11-03T08:00:00.000Z',
    },
  ],
  createdAt: '2026-11-03T08:00:00.000Z',
  updatedAt: '2026-11-03T08:00:00.000Z',
};

function renderWithAdmin(ui: React.ReactElement, admin = mockModerator) {
  return renderToString(
    <AdminAuthContext.Provider
      value={{
        admin,
        isLoading: false,
        logoutAdmin: async () => {},
        refreshAdminSession: async () => {},
        setSessionAdmin: () => {},
        hasPermission: (perm: string) => admin.permissions.includes(perm),
      }}
    >
      {ui}
    </AdminAuthContext.Provider>,
  );
}

describe('ListingModerationQueue & ListingModerationReview SSR (Story 2.4)', () => {
  describe('ListingModerationQueue (AC #1, #2)', () => {
    it('renders queue items, status tabs, lock badges, and Claim & Review actions', () => {
      const html = renderWithAdmin(
        <ListingModerationQueue initialItems={sampleQueueItems} initialTotal={3} />,
      );

      // Status tabs
      expect(html).toContain('بانتظار المراجعة');
      expect(html).toContain('معتمدة');
      expect(html).toContain('مرفوضة');

      // Queue rows
      expect(html).toContain('فيلا فاخرة في حي الملقا');
      expect(html).toContain('أرض تجارية على طريق الملك فهد');
      expect(html).toContain('شقة تمليك في حي الشاطئ');

      // Lock badges
      expect(html).toContain('متاح للمراجعة');
      expect(html).toContain('مقفول بواسطة خالد المشرف المناوب');
      expect(html).toContain('قيد المراجعة بواسطتك');

      // Actions
      expect(html).toContain('استلام ومراجعة الإعلان');
      expect(html).toContain('معاينة وتفاصيل الإعلان');
    });
  });

  describe('ListingModerationReview (AC #3, #4, #5, #6)', () => {
    it('renders active 15-minute lease banner, MM:SS countdown, and enabled Approve/Reject controls when locked by current admin', () => {
      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-1"
          initialDetail={{
            ...baseListingDetail,
            lockInfo: {
              isLocked: true,
              isLockedByCurrentAdmin: true,
              lockedByAdminId: mockModerator.id,
              lockedByAdminName: mockModerator.fullName,
              lockedAt: '2026-11-03T10:00:00.000Z',
              lockExpiresAt: '2026-11-03T10:15:00.000Z',
              remainingSeconds: 870, // 14:30
            },
          }}
        />,
        mockModerator,
      );

      expect(html).toContain('قفل المراجعة الحصري نشط باسمك');
      expect(html).toContain('14:30');
      expect(html).toContain('تمديد القفل');
      expect(html).toContain('تحرير المهمة');
      expect(html).toContain('اعتماد ونشر الإعلان');
      expect(html).toContain('رفض الإعلان مع الملاحظات');
      expect(html).toContain('SA0380000000608010167519');
      expect(html).toContain('سري للإدارة فقط (ADMIN_ONLY)');
    });

    it('renders Amber Read-Only Lock Banner and disables actions when locked by another admin (Moderator view)', () => {
      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-1"
          initialDetail={{
            ...baseListingDetail,
            lockInfo: {
              isLocked: true,
              isLockedByCurrentAdmin: false,
              lockedByAdminId: 'admin-other-99',
              lockedByAdminName: 'خالد المشرف المناوب',
              lockedAt: '2026-11-03T10:00:00.000Z',
              lockExpiresAt: '2026-11-03T10:15:00.000Z',
              remainingSeconds: 605, // 10:05
            },
          }}
        />,
        mockModerator,
      );

      expect(html).toContain('bg-amber-50');
      expect(html).toContain('هذا الإعلان قيد المراجعة حالياً بواسطة خالد المشرف المناوب');
      expect(html).toContain('10:05');
      expect(html).toContain('وضع القراءة فقط');
      // Moderator does NOT have Tasks.ForceUnlock
      expect(html).not.toContain('فك القفل الإجباري (Force Unlock)');
    });

    it('renders Force Unlock button in Amber Read-Only Banner when viewed by SUPER_ADMIN with Tasks.ForceUnlock', () => {
      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-1"
          initialDetail={{
            ...baseListingDetail,
            lockInfo: {
              isLocked: true,
              isLockedByCurrentAdmin: false,
              lockedByAdminId: 'admin-other-99',
              lockedByAdminName: 'خالد المشرف المناوب',
              lockedAt: '2026-11-03T10:00:00.000Z',
              lockExpiresAt: '2026-11-03T10:15:00.000Z',
              remainingSeconds: 605,
            },
          }}
        />,
        mockSuperAdmin,
      );

      expect(html).toContain('هذا الإعلان قيد المراجعة حالياً بواسطة خالد المشرف المناوب');
      expect(html).toContain('فك القفل الإجباري (Force Unlock)');
    });

    it('renders price suggestion card, input controls, and historical suggestion items with badges (Story 2.5)', () => {
      const detailWithSuggestions = {
        ...baseListingDetail,
        priceSuggestions: [
          {
            id: 'sug-1',
            listingId: 'listing-1',
            currentAskPrice: 4500000,
            suggestedPrice: 4100000,
            reason: 'متوسط سعر المتر في الملقا للفلل المماثلة بناءً على الصفقات المعتمدة',
            status: PriceSuggestionStatus.PENDING,
            suggestedByAdminId: 'admin-mod-1',
            suggestedByAdminName: 'أحمد المراجع',
            sellerResponseNote: null,
            respondedAt: null,
            createdAt: '2026-11-03T09:00:00.000Z',
          },
          {
            id: 'sug-0',
            listingId: 'listing-1',
            currentAskPrice: 4500000,
            suggestedPrice: 4300000,
            reason: 'اقتراح أولي سابق تم تجاوزه',
            status: PriceSuggestionStatus.SUPERSEDED,
            suggestedByAdminId: 'admin-super-1',
            suggestedByAdminName: 'سلمان المشرف العام',
            sellerResponseNote: null,
            respondedAt: '2026-11-03T08:50:00.000Z',
            createdAt: '2026-11-03T08:30:00.000Z',
          },
        ],
      };

      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-1"
          initialDetail={detailWithSuggestions}
        />,
        mockModerator,
      );

      expect(html).toContain('اقتراح تعديل السعر الاسترشادي (FR-57)');
      expect(html).toContain('BR-16: استقلالية تسعير البائع');
      expect(html).toContain('إرسال مقترح السعر للبائع');
      expect(html).toContain('4,100,000 SAR');
      expect(html).toContain('بانتظار رد البائع');
      expect(html).toContain('تم استبداله');
      expect(html).toContain('متوسط سعر المتر في الملقا للفلل المماثلة بناءً على الصفقات المعتمدة');
    });
  });

  describe('ListingModerationQueue Price Suggestion Badges (Story 2.5)', () => {
    it('renders pending price suggestion badge on listings with active suggestion', () => {
      const itemsWithBadge: ModerationQueueItem[] = [
        {
          ...sampleQueueItems[0],
          activePriceSuggestion: {
            id: 'sug-1',
            listingId: 'listing-1',
            currentAskPrice: 4500000,
            suggestedPrice: 4100000,
            reason: 'مبررات السوق',
            status: PriceSuggestionStatus.PENDING,
            suggestedByAdminId: 'admin-1',
            suggestedByAdminName: 'أحمد',
            sellerResponseNote: null,
            respondedAt: null,
            createdAt: '2026-11-03T10:00:00.000Z',
          },
        },
      ];

      const html = renderWithAdmin(
        <ListingModerationQueue initialItems={itemsWithBadge} initialTotal={1} />,
      );

      expect(html).toContain('مقترح سعر معلّق');
    });
  });
});

