import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ListingStatus } from '@elmasaif/shared';
import { ListingStatusBadge } from '../listing-status-badge';
import { SellerListingArchiveActions } from '../seller-listing-archive-modal';

describe('SellerListingArchiveActions & ListingStatusBadge (Story 2.6 / AC #1, #2, #6, #7)', () => {
  describe('ListingStatusBadge', () => {
    it('renders ACTIVE status with emerald styling and market publication label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.ACTIVE} />);
      expect(html).toContain('معتمد ومنشور في السوق');
      expect(html).toContain('bg-emerald-100');
    });

    it('renders ARCHIVED status with slate styling and archived label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.ARCHIVED} />);
      expect(html).toContain('مؤرشف');
      expect(html).toContain('bg-slate-100');
    });

    it('renders SUSPENDED status with amber styling and compliance label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.SUSPENDED} />);
      expect(html).toContain('معلق للامتثال');
      expect(html).toContain('bg-amber-100');
    });

    it('renders BLOCKED status with rose styling and blocked label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.BLOCKED} />);
      expect(html).toContain('محظور');
      expect(html).toContain('bg-rose-100');
    });

    it('renders REJECTED status with red styling and rejection label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.REJECTED} />);
      expect(html).toContain('مرفوض من الإدارة');
      expect(html).toContain('bg-red-100');
    });

    it('renders PENDING_REVIEW status with pending moderation label', () => {
      const html = renderToString(<ListingStatusBadge status={ListingStatus.PENDING_REVIEW} />);
      expect(html).toContain('بانتظار المراجعة الإدارية');
      expect(html).toContain('bg-amber-100');
    });
  });

  describe('SellerListingArchiveActions', () => {
    it('renders archive action button when listing status is ACTIVE', () => {
      const html = renderToString(
        <SellerListingArchiveActions
          listingId="listing-1"
          status={ListingStatus.ACTIVE}
        />,
      );
      expect(html).toContain('أرشفة الإعلان');
      expect(html).not.toContain('إعادة النشر (تنشيط)');
    });

    it('renders unarchive reactivation button when listing status is ARCHIVED', () => {
      const html = renderToString(
        <SellerListingArchiveActions
          listingId="listing-1"
          status={ListingStatus.ARCHIVED}
          archiveReason="رغبة البائع في تأجيل الصفقة"
        />,
      );
      expect(html).toContain('إعادة النشر (تنشيط)');
      expect(html).not.toContain('أرشفة الإعلان');
    });

    it('does not render archive or unarchive buttons for SUSPENDED or BLOCKED listings', () => {
      const suspendedHtml = renderToString(
        <SellerListingArchiveActions
          listingId="listing-1"
          status={ListingStatus.SUSPENDED}
        />,
      );
      expect(suspendedHtml).not.toContain('أرشفة الإعلان');
      expect(suspendedHtml).not.toContain('إعادة النشر (تنشيط)');

      const blockedHtml = renderToString(
        <SellerListingArchiveActions
          listingId="listing-1"
          status={ListingStatus.BLOCKED}
        />,
      );
      expect(blockedHtml).not.toContain('أرشفة الإعلان');
      expect(blockedHtml).not.toContain('إعادة النشر (تنشيط)');
    });
  });
});

