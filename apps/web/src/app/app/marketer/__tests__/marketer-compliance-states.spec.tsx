import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MarketerDashboardPage from '../page';
import MarketerOnboardingPage from '../onboarding/page';
import { ListingStatusBadge } from '../../../../components/listings/listing-status-badge';
import { ListingStatus, ProfileStatus, PropertyType } from '@elmasaif/shared';

describe('Story 6.2: Marketer Compliance Restriction & Expiry Warnings UI (AC #6)', () => {
  describe('Marketer Dashboard - Compliance Restricted State', () => {
    it('renders red compliance restriction card, disables new listing button, and shows renewal CTA', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.COMPLIANCE_RESTRICTED },
            falLicense: {
              id: 'lic-1',
              status: ProfileStatus.COMPLIANCE_RESTRICTED,
              daysRemaining: -1,
              isExpired: true,
            },
          }}
          initialListings={[]}
        />,
      );

      // Header restricted badge
      expect(html).toContain('حساب مقيد لانتهاء رخصة فال');

      // Prominent Red compliance restriction card
      expect(html).toContain('تم تقييد حسابك لانتهاء صلاحية رخصة فال');
      expect(html).toContain(
        'تم تقييد حسابك لانتهاء صلاحية رخصة فال. تم تعليق ظهور إعلاناتك النشطة آلياً، بينما تستمر الصفقات الجارية دون انقطاع. يرجى تجديد الرخصة لاستعادة نشاط الحساب.',
      );

      // Primary CTA to renew Fal license
      expect(html).toContain('تجديد رخصة فال');
      expect(html).toContain('/app/marketer/fal-license');

      // New listing button is disabled
      expect(html).toContain('disabled');
      expect(html).toContain('لا يمكن إنشاء إعلانات جديدة نظراً لانتهاء صلاحية رخصة فال');
    });

    it('renders listings table with UNDER_COMPLIANCE_REVIEW status badge (معلق للامتثال)', () => {
      const mockListings = [
        {
          id: 'listing-suspended-1',
          title: 'فيلا حي النرجس المعلقة',
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          propertyType: PropertyType.VILLA,
          askPrice: '2500000',
          areaSquareMeters: 450,
          cityName: 'الرياض',
          districtName: 'النرجس',
          complianceReason:
            'انتهت صلاحية رخصة فال للمسوق وتم تعليق الإعلان آلياً لحين تجديد الرخصة والامتثال',
          complianceCategory: 'FAL_LICENSE_EXPIRED',
        },
      ];

      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.COMPLIANCE_RESTRICTED },
            falLicense: {
              id: 'lic-1',
              status: ProfileStatus.COMPLIANCE_RESTRICTED,
              daysRemaining: -2,
              isExpired: true,
            },
          }}
          initialListings={mockListings}
        />,
      );

      // Verifies the status badge displays 'معلق للامتثال'
      expect(html).toContain('معلق للامتثال');
      expect(html).toContain('فيلا حي النرجس المعلقة');
      expect(html).toContain('إعلان موقوف مؤقتاً للامتثال والرقابة:');
      expect(html).toContain('FAL_LICENSE_EXPIRED');
    });
  });

  describe('Marketer Dashboard - Amber Expiry Warning Banner (<= 30 Days Remaining)', () => {
    it('renders amber warning banner when license is active but <= 30 days remaining', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: {
              id: 'lic-1',
              status: ProfileStatus.ACTIVE,
              daysRemaining: 7,
              isExpired: false,
            },
          }}
          initialListings={[]}
        />,
      );

      // Warning banner present
      expect(html).toContain('تنبيه: اقتراب انتهاء صلاحية رخصة فال');
      expect(html).toContain('تنبيه: تنتهي صلاحية رخصة فال خلال 7 يوم');
      expect(html).toContain('متبقي 7 يوم');

      // New listing button remains enabled
      expect(html).toContain('إضافة عقار جديد');
      expect(html).toContain('/app/marketer/listings/new');
    });
  });

  describe('Marketer Onboarding - Compliance Restricted Renewal State', () => {
    it('renders renewal header and explanation card for expired restricted licenses', () => {
      const html = renderToString(
        <MarketerOnboardingPage
          initialLoading={false}
          initialLicense={{
            status: ProfileStatus.COMPLIANCE_RESTRICTED,
            licenseNumber: '1100009999',
            commercialName: 'مكتب الرياض للتسويق',
            crNumber: '1010999999',
          }}
        />,
      );

      // Renewal Title
      expect(html).toContain('تجديد رخصة فال العقارية (منتهية الصلاحية)');

      // Pre-filled fields
      expect(html).toContain('1100009999');
      expect(html).toContain('مكتب الرياض للتسويق');
      expect(html).toContain('1010999999');

      // Restriction alert
      expect(html).toContain('تم تقييد حسابك لانتهاء صلاحية رخصة فال');
      expect(html).toContain('انتهت صلاحية رخصة فال السابقة وتم تعليق ظهور إعلاناتك النشطة آلياً');
    });
  });

  describe('ListingStatusBadge - UNDER_COMPLIANCE_REVIEW support', () => {
    it('renders UNDER_COMPLIANCE_REVIEW with amber styling and "معلق للامتثال"', () => {
      const html = renderToString(
        <ListingStatusBadge status={ListingStatus.UNDER_COMPLIANCE_REVIEW} />,
      );
      expect(html).toContain('معلق للامتثال');
      expect(html).toContain('bg-amber-100');
    });
  });
});

