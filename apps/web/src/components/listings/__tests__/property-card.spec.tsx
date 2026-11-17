import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ListingStatus,
  PropertyType,
  UserRole,
  ListingSummaryItem,
} from '@elmasaif/shared';
import { PropertyCard } from '../property-card';
import { PropertyMediaCarousel } from '../property-media-carousel';

describe('PropertyMediaCarousel & PropertyCard (Story 2.3)', () => {
  const baseListing: ListingSummaryItem = {
    id: 'listing-card-1',
    title: 'فيلا درج صالة مودرن مع مسبح ومصعد',
    description: 'فيلا فاخرة بتشطيبات سوبر ديلوكس',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'dist-1',
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 3200000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2025,
    status: ListingStatus.ACTIVE,
    sellerRole: UserRole.MARKETER,
    isFalVerified: true,
    photoCount: 3,
    photos: [
      'https://s3.local/p1.jpg',
      'https://s3.local/p2.jpg',
      'https://s3.local/p3.jpg',
    ],
    primaryPhotoUrl: 'https://s3.local/p1.jpg',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  it('enforces a strict 16:9 aspect-video viewport and renders photo counter pill with dir="ltr" and font-mono (AC #1)', () => {
    const html = renderToString(
      React.createElement(PropertyCard, { listing: baseListing }),
    );

    expect(html).toContain('aspect-video');
    expect(html).toContain('1/3');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('font-mono');
  });

  it('renders previous and next navigation controls when multiple photos exist and hides them for a single photo (AC #1)', () => {
    const multiPhotoHtml = renderToString(
      React.createElement(PropertyMediaCarousel, {
        photos: ['https://s3.local/p1.jpg', 'https://s3.local/p2.jpg'],
        alt: 'فيلا النرجس',
      }),
    );

    expect(multiPhotoHtml).toContain('aria-label="الصورة السابقة"');
    expect(multiPhotoHtml).toContain('aria-label="الصورة التالية"');

    const singlePhotoHtml = renderToString(
      React.createElement(PropertyMediaCarousel, {
        photos: ['https://s3.local/p1.jpg'],
        alt: 'فيلا النرجس',
      }),
    );

    expect(singlePhotoHtml).not.toContain('aria-label="الصورة السابقة"');
    expect(singlePhotoHtml).not.toContain('aria-label="الصورة التالية"');
    expect(singlePhotoHtml).toContain('1/1');
  });

  it('renders dignified institutional placeholder when photos array is empty (AC #1)', () => {
    const emptyPhotoListing: ListingSummaryItem = {
      ...baseListing,
      photos: [],
      primaryPhotoUrl: null,
      photoCount: 12,
    };

    const html = renderToString(
      React.createElement(PropertyCard, { listing: emptyPhotoListing }),
    );

    expect(html).toContain('bg-primary');
    expect(html).toContain('فيلا درج صالة مودرن مع مسبح ومصعد');
    expect(html).toContain('1/12');
    expect(html).not.toContain('<img');
  });

  it('renders Fal-verified badge for Marketer listings and direct owner badge for Owner listings (AC #2)', () => {
    const marketerHtml = renderToString(
      React.createElement(PropertyCard, { listing: baseListing }),
    );
    expect(marketerHtml).toContain('معلن مرخص (فال)');
    expect(marketerHtml).not.toContain('عرض مالك مباشر');

    const ownerListing: ListingSummaryItem = {
      ...baseListing,
      sellerRole: UserRole.OWNER,
      isFalVerified: false,
    };
    const ownerHtml = renderToString(
      React.createElement(PropertyCard, { listing: ownerListing }),
    );
    expect(ownerHtml).toContain('عرض مالك مباشر');
    expect(ownerHtml).not.toContain('معلن مرخص (فال)');
  });

  it('renders RESERVED and SOLD status badges when listing is not ACTIVE (AC #2)', () => {
    const reservedHtml = renderToString(
      React.createElement(PropertyCard, {
        listing: { ...baseListing, status: ListingStatus.RESERVED },
      }),
    );
    expect(reservedHtml).toContain('محجوز بصفقة نشطة');

    const soldHtml = renderToString(
      React.createElement(PropertyCard, {
        listing: { ...baseListing, status: ListingStatus.SOLD },
      }),
    );
    expect(soldHtml).toContain('تم البيع');
  });

  it('displays formatted Ask Price in SAR (ر.س), 2.5% platform commission preview, property type label, and location tag (AC #3)', () => {
    const html = renderToString(
      React.createElement(PropertyCard, { listing: baseListing }),
    );

    expect(html).toContain('3,200,000');
    expect(html).toContain('ر.س');
    expect(html).not.toContain('$');
    // 2.5% of 3,200,000 = 80,000
    expect(html).toContain('سعي المنصة (2.5%):');
    expect(html).toContain('80,000 ر.س');
    expect(html).toContain('الرياض، حي النرجس');
    expect(html).toContain('فيلا');
  });

  it('renders Area in square meters (م²) and Bedrooms count while strictly omitting bathrooms per BR-13 (AC #4)', () => {
    const html = renderToString(
      React.createElement(PropertyCard, { listing: baseListing }),
    );

    expect(html).toContain('450 م²');
    expect(html).toContain('5 غرف نوم');

    // Guardrail: zero bathroom references
    expect(html).not.toContain('حمام');
    expect(html).not.toContain('دورات');
    expect(html.toLowerCase()).not.toContain('bathroom');
  });

  it('renders fallback bedroom label when bedrooms is null or 0 (e.g., Land / Commercial) (AC #4)', () => {
    const landListing: ListingSummaryItem = {
      ...baseListing,
      propertyType: PropertyType.LAND,
      bedrooms: null,
      areaSquareMeters: 920,
    };

    const html = renderToString(
      React.createElement(PropertyCard, { listing: landListing }),
    );

    expect(html).toContain('أرض');
    expect(html).toContain('920 م²');
    expect(html).toContain('غير محدد / أرض');
    expect(html).not.toContain('حمام');
    expect(html).not.toContain('دورات');
  });

  it('renders optional href link and favorite toggle button when provided', () => {
    const html = renderToString(
      React.createElement(PropertyCard, {
        listing: baseListing,
        href: '/listings/listing-card-1',
        onFavoriteToggle: () => {},
        isFavorited: true,
      }),
    );

    expect(html).toContain('href="/listings/listing-card-1"');
    expect(html).toContain('aria-label="إزالة من المفضلة"');
  });
});
