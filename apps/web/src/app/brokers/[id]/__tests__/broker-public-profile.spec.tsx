import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BrokerPublicProfileDto, ListingStatus, PropertyType, UserRole } from '@elmasaif/shared';
import { BrokerProfileHeader } from '../../../../components/brokers/broker-profile-header';
import { BrokerRatingsBreakdown } from '../../../../components/brokers/broker-ratings-breakdown';
import { BrokerReviewsList } from '../../../../components/brokers/broker-reviews-list';
import { BrokerListingsGrid } from '../../../../components/brokers/broker-listings-grid';

describe('Public Broker Profile UI Components (Story 6.5 / AC: #1-#5, #10)', () => {
  const mockProfile: BrokerPublicProfileDto = {
    id: 'profile-1',
    userId: 'user-1',
    commercialName: 'مؤسسة صرح العقارية',
    fullName: 'أحمد بن خالد السبيعي',
    createdAt: '2026-01-15T00:00:00.000Z',
    isFalVerified: true,
    falLicense: {
      licenseNumber: '1200098765',
      status: 'ACTIVE',
      expiryDate: '2027-04-10T00:00:00.000Z',
    },
    stats: {
      averageRating: 4.8,
      totalReviews: 25,
      completedDealsCount: 34,
      activeListingsCount: 2,
      ratingDistribution: {
        '5': 20,
        '4': 4,
        '3': 1,
        '2': 0,
        '1': 0,
      },
    },
    reviews: [
      {
        id: 'rev-1',
        score: 5,
        comment: 'وسيط ممتاز وملتزم بالمواعيد وسرعة الإفراغ.',
        createdAt: '2026-10-01T10:00:00.000Z',
        rater: {
          maskedName: 'ط*** ش***',
        },
      },
    ],
    activeListings: [
      {
        id: 'prop-1',
        title: 'فيلا مستقلة مودرن بالياسمين',
        description: 'فيلا فاخرة بمسبح ومصعد',
        propertyType: PropertyType.VILLA,
        cityId: 'city-1',
        districtId: 'dist-1',
        cityName: 'الرياض',
        districtName: 'الياسمين',
        askPrice: 3200000,
        areaSquareMeters: 450,
        bedrooms: 5,
        yearBuilt: 2025,
        status: ListingStatus.ACTIVE,
        sellerRole: UserRole.MARKETER,
        isFalVerified: true,
        photoCount: 1,
        photos: ['https://example.com/photo.jpg'],
        primaryPhotoUrl: 'https://example.com/photo.jpg',
        totalViews: 80,
        totalFavorites: 12,
        isFavorited: false,
        createdAt: '2026-10-15T00:00:00.000Z',
      },
    ],
  };

  describe('BrokerProfileHeader (AC: #1, #10, BR-06)', () => {
    it('renders commercial name, verified Fal license badge, join date, and counters', () => {
      const html = renderToString(React.createElement(BrokerProfileHeader, { profile: mockProfile }));

      // Commercial name and verified Fal badge
      expect(html).toContain('مؤسسة صرح العقارية');
      expect(html).toContain('مرخص وموثق من فال REGA');
      expect(html).toContain('1200098765');

      // Summary counters
      expect(html).toContain('34');
      expect(html).toContain('صفقات مكتملة');
      expect(html).toContain('2');
      expect(html).toContain('عقارات معروضة');

      // Star rating headline
      expect(html).toContain('4.8');
      expect(html).toContain('25 تقييم');

      // Contact concealment guardrail (BR-06): no phone or email in HTML
      expect(html).not.toContain('05');
      expect(html).not.toContain('@');
    });

    it('renders unverified badge when broker has no active Fal license', () => {
      const unverifiedProfile: BrokerPublicProfileDto = {
        ...mockProfile,
        isFalVerified: false,
        falLicense: null,
      };

      const html = renderToString(React.createElement(BrokerProfileHeader, { profile: unverifiedProfile }));
      expect(html).toContain('وسيط عقاري');
      expect(html).not.toContain('مرخص وموثق من فال REGA');
    });
  });

  describe('BrokerRatingsBreakdown (AC: #2)', () => {
    it('renders average score and star distribution progress breakdown', () => {
      const html = renderToString(
        React.createElement(BrokerRatingsBreakdown, { stats: mockProfile.stats }),
      );

      expect(html).toContain('4.8');
      expect(html).toContain('25 تقييم معتمد');
      expect(html).toContain('5 نجوم');
      expect(html).toContain('4 نجوم');
      expect(html).toContain('20'); // 5-star count
      expect(html).toContain('4');  // 4-star count
    });

    it('renders empty rating state when total reviews is 0', () => {
      const emptyStats = {
        averageRating: null,
        totalReviews: 0,
        completedDealsCount: 0,
        activeListingsCount: 0,
        ratingDistribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      };

      const html = renderToString(React.createElement(BrokerRatingsBreakdown, { stats: emptyStats }));
      expect(html).toContain('لا توجد تقييمات معتمدة بعد');
    });
  });

  describe('BrokerReviewsList (AC: #4, #5)', () => {
    it('renders review card with masked counterparty identity and qualitative feedback', () => {
      const html = renderToString(React.createElement(BrokerReviewsList, { reviews: mockProfile.reviews }));

      expect(html).toContain('ط*** ش***');
      expect(html).toContain('وسيط ممتاز وملتزم بالمواعيد وسرعة الإفراغ.');
      expect(html).not.toContain('طارق الشمري'); // Verified masking
    });

    it('renders empty state when there are no reviews', () => {
      const html = renderToString(React.createElement(BrokerReviewsList, { reviews: [] }));
      expect(html).toContain('لا توجد تقييمات معتمدة لهذا الوسيط حتى الآن');
    });
  });

  describe('BrokerListingsGrid (AC: #3)', () => {
    it('renders grid of active properties marketed by broker', () => {
      const html = renderToString(
        React.createElement(BrokerListingsGrid, {
          listings: mockProfile.activeListings,
          brokerName: mockProfile.commercialName,
        }),
      );

      expect(html).toContain('فيلا مستقلة مودرن بالياسمين');
      expect(html).toContain('3,200,000');
      expect(html).toContain('الياسمين');
    });

    it('renders empty state when broker has 0 active listings', () => {
      const html = renderToString(
        React.createElement(BrokerListingsGrid, {
          listings: [],
          brokerName: mockProfile.commercialName,
        }),
      );

      expect(html).toContain('لا توجد عقارات معروضة حالياً لهذا الوسيط');
    });
  });
});

