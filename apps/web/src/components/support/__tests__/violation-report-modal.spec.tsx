import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ViolationReportModal } from '../violation-report-modal';
import { SupportTicketModal } from '../support-ticket-modal';

describe('Customer Support Modals (Story 8.5 / AC-5, FR-37, FR-38)', () => {
  describe('ViolationReportModal', () => {
    it('renders null when closed', () => {
      const html = renderToString(
        <ViolationReportModal isOpen={false} onClose={() => {}} />,
      );
      expect(html).toBe('');
    });

    it('renders report form with RTL direction and violation categories when open', () => {
      const html = renderToString(
        <ViolationReportModal
          isOpen={true}
          onClose={() => {}}
          targetType="LISTING"
          targetListingId="listing-uuid-1"
          targetListingTitle="فيلا مودرن في الهدا"
        />,
      );

      expect(html).toContain('إبلاغ عن مخالفة أو احتيال');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('فيلا مودرن في الهدا');
      expect(html).toContain('إعلان احتيالي / وهمي');
      expect(html).toContain('وسيط غير مرخص');
      expect(html).toContain('طلب تحويل مالي خارج المنصة');
      expect(html).toContain('تفاصيل البلاغ والأدلة');
      expect(html).toContain('إرسال البلاغ');
    });

    it('renders broker target context when targeting broker', () => {
      const html = renderToString(
        <ViolationReportModal
          isOpen={true}
          onClose={() => {}}
          targetType="BROKER"
          targetUserId="broker-user-1"
          targetBrokerName="مكتب الأفق العقاري"
        />,
      );

      expect(html).toContain('مكتب الأفق العقاري');
      expect(html).toContain('الوسيط &quot;مكتب الأفق العقاري&quot;');
    });
  });

  describe('SupportTicketModal', () => {
    it('renders null when closed', () => {
      const html = renderToString(
        <SupportTicketModal isOpen={false} onClose={() => {}} />,
      );
      expect(html).toBe('');
    });

    it('renders support ticket form with 4-hour SLA commitment and categories', () => {
      const html = renderToString(
        <SupportTicketModal
          isOpen={true}
          onClose={() => {}}
          defaultContactName="عبدالله"
          defaultContactEmail="abdullah@example.com"
        />,
      );

      expect(html).toContain('طلب دعم فني ومساعدة');
      expect(html).toContain('4 ساعات');
      expect(html).toContain('48 ساعة');
      expect(html).toContain('مشكلة فنية أو تقنية');
      expect(html).toContain('عنوان التذكرة');
      expect(html).toContain('شرح المشكلة بالتفصيل');
      expect(html).toContain('فتح التذكرة');
      expect(html).toContain('abdullah@example.com');
    });
  });
});

