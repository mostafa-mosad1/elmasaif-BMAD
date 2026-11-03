import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  AdminRole,
  ListingStatus,
  PropertyType,
  SuspensionCategory,
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

const mockComplianceOfficer = {
  id: 'admin-comp-1',
  username: 'mona.compliance',
  email: 'mona@elmasaif.sa',
  fullName: 'منى مسؤول الامتثال',
  role: AdminRole.COMPLIANCE_OFFICER,
  isActive: true,
  permissions: ['Listings.Review', 'Listings.Compliance'],
};

const mockModeratorNoCompliance = {
  id: 'admin-mod-1',
  username: 'ahmed.mod',
  email: 'ahmed@elmasaif.sa',
  fullName: 'أحمد المراجع',
  role: AdminRole.MODERATOR,
  isActive: true,
  permissions: ['Listings.Review'],
};

const sampleDetailBase = {
  id: 'listing-comp-100',
  title: 'قصر فاخر للبيع بحي حطين النموذجي',
  description: 'قصر فخم بتشطيبات راقية',
  propertyType: PropertyType.VILLA,
  cityId: 'city-1',
  districtId: 'dist-1',
  cityName: 'الرياض',
  districtName: 'حطين',
  streetName: 'شارع الأمير تركي الأول',
  latitude: 24.774265,
  longitude: 46.623456,
  askPrice: 15000000,
  areaSquareMeters: 1200,
  bedrooms: 7,
  yearBuilt: 2024,
  status: ListingStatus.ACTIVE,
  sellerProfileId: 'prof-100',
  sellerProfile: {
    id: 'prof-100',
    userId: 'user-seller-100',
    role: UserRole.MARKETER,
    user: {
      id: 'user-seller-100',
      fullName: 'خالد المسوق العقاري',
      username: 'khaled_broker',
      email: 'khaled@broker.sa',
      mobileNumber: '+966551234567',
    },
  },
  version: 2,
  lockInfo: {
    isLocked: false,
    isLockedByCurrentAdmin: false,
    lockedByAdminId: null,
    lockedByAdminName: null,
    lockedAt: null,
    lockExpiresAt: null,
    remainingSeconds: 0,
  },
  photos: [],
  documents: [],
  priceSuggestions: [],
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

function renderWithAdmin(ui: React.ReactElement, admin = mockComplianceOfficer) {
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

describe('Admin Compliance Controls & Moderation Queue (Story 2.6 / AC #3, #4, #5, #7)', () => {
  describe('ListingModerationQueue Filter Tabs (AC #7)', () => {
    it('renders filter tabs for معلق للامتثال (SUSPENDED) and محظور (BLOCKED)', () => {
      const html = renderWithAdmin(
        <ListingModerationQueue initialItems={[]} initialTotal={0} />,
      );

      expect(html).toContain('معلق للامتثال');
      expect(html).toContain('محظور');
      expect(html).toContain('بانتظار المراجعة');
      expect(html).toContain('معتمدة');
      expect(html).toContain('مرفوضة');
    });
  });

  describe('ListingModerationReview Compliance Panel & Permission Gating (AC #3, #4, #7)', () => {
    it('renders dedicated compliance actions panel with Suspend and Block buttons when admin has Listings.Compliance', () => {
      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-comp-100"
          initialDetail={sampleDetailBase}
        />,
        mockComplianceOfficer,
      );

      expect(html).toContain('إجراءات الامتثال والرقابة (FR-14)');
      expect(html).toContain('صلاحيات الامتثال');
      expect(html).toContain('إيقاف مؤقت للامتثال (Suspend)');
      expect(html).toContain('حظر نهائي للإعلان (Permanent Block)');
    });

    it('does NOT render compliance actions panel when admin lacks Listings.Compliance permission', () => {
      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-comp-100"
          initialDetail={sampleDetailBase}
        />,
        mockModeratorNoCompliance,
      );

      expect(html).not.toContain('إجراءات الامتثال والرقابة (FR-14)');
      expect(html).not.toContain('إيقاف مؤقت للامتثال (Suspend)');
      expect(html).not.toContain('حظر نهائي للإعلان (Permanent Block)');
    });
  });

  describe('ListingModerationReview Suspended State & Unsuspend (AC #3, #5, #7)', () => {
    it('renders amber suspended banner with reason and Unsuspend button when listing is SUSPENDED', () => {
      const suspendedDetail = {
        ...sampleDetailBase,
        status: ListingStatus.SUSPENDED,
        complianceReason: 'شبهة وساطة عقارية بدون ترخيص إعلاني معتمد من فال',
        complianceCategory: SuspensionCategory.UNAUTHORIZED_BROKERAGE,
      };

      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-comp-100"
          initialDetail={suspendedDetail}
        />,
        mockComplianceOfficer,
      );

      expect(html).toContain('الإعلان موقوف مؤقتاً للامتثال والرقابة');
      expect(html).toContain('شبهة وساطة عقارية بدون ترخيص إعلاني معتمد من فال');
      expect(html).toContain(SuspensionCategory.UNAUTHORIZED_BROKERAGE);
      expect(html).toContain('رفع الإيقاف وإعادة التنشيط (Unsuspend)');
    });
  });

  describe('ListingModerationReview Blocked & Archived States (AC #4, #6, #7)', () => {
    it('renders red blocked banner with reason when listing is BLOCKED', () => {
      const blockedDetail = {
        ...sampleDetailBase,
        status: ListingStatus.BLOCKED,
        complianceReason: 'تزوير في مستند صك الملكية وسجل مخالفات جسيمة',
      };

      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-comp-100"
          initialDetail={blockedDetail}
        />,
        mockComplianceOfficer,
      );

      expect(html).toContain('الإعلان محظور نهائياً بموجب قرار الامتثال');
      expect(html).toContain('تزوير في مستند صك الملكية وسجل مخالفات جسيمة');
      expect(html).toContain('هذا الإعلان محظور نهائياً ولا يمكن تنشيطه أو تعديله.');
      expect(html).not.toContain('إيقاف مؤقت للامتثال (Suspend)');
    });

    it('renders archived notice when listing is ARCHIVED by seller', () => {
      const archivedDetail = {
        ...sampleDetailBase,
        status: ListingStatus.ARCHIVED,
        archiveReason: 'تم تأجيل البيع بناءً على طلب المالك المباشر',
      };

      const html = renderWithAdmin(
        <ListingModerationReview
          listingId="listing-comp-100"
          initialDetail={archivedDetail}
        />,
        mockComplianceOfficer,
      );

      expect(html).toContain('الإعلان مؤرشف من قبل البائع');
      expect(html).toContain('تم تأجيل البيع بناءً على طلب المالك المباشر');
    });
  });
});

