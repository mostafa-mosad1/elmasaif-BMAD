import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationBell } from '../notification-bell';
import {
  NotificationItem,
  formatRelativeArabicTime,
  getCategoryStyle,
} from '../notification-item';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationDto,
} from '@elmasaif/shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('../../../lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({ unreadCount: 3, items: [] }),
}));

describe('Notification UI Components (Story 8.8 / AC-7)', () => {
  describe('NotificationBell', () => {
    it('renders bell trigger button with accessible aria-label', () => {
      const html = renderToString(<NotificationBell />);
      expect(html).toContain('aria-label="الإشعارات والتنبيهات"');
      expect(html).toContain('<button');
    });
  });

  describe('NotificationItem', () => {
    const mockNotification: NotificationDto = {
      id: 'notif-101',
      userId: 'user-1',
      eventKey: 'deal.created',
      channel: NotificationChannel.IN_APP,
      category: NotificationCategory.DEAL,
      title: 'تم إنشاء الصفقة العقارية #DEAL-100',
      message: 'يرجى مراجعة تفاصيل الحساب البنكي وسداد العربون قبل انتهاء المهلة',
      deepLink: '/app/buyer/deals/deal-100',
      isRead: false,
      isCritical: true,
      createdAt: new Date().toISOString(),
    };

    it('renders notification title, message snippet, and deep link action', () => {
      const html = renderToString(
        <NotificationItem notification={mockNotification} />,
      );

      expect(html).toContain('تم إنشاء الصفقة العقارية #DEAL-100');
      expect(html).toContain('يرجى مراجعة تفاصيل الحساب البنكي وسداد العربون');
      expect(html).toContain('عرض التفاصيل');
      expect(html).toContain('href="/app/buyer/deals/deal-100"');
    });

    it('renders unread indicator dot for unread notifications', () => {
      const html = renderToString(
        <NotificationItem notification={mockNotification} />,
      );
      expect(html).toContain('aria-label="غير مقروء"');
    });

    it('does not render unread dot for read notifications', () => {
      const readNotif: NotificationDto = {
        ...mockNotification,
        isRead: true,
      };
      const html = renderToString(<NotificationItem notification={readNotif} />);
      expect(html).not.toContain('aria-label="غير مقروء"');
    });
  });

  describe('formatRelativeArabicTime', () => {
    it('returns الآن for events created moments ago', () => {
      const recent = new Date().toISOString();
      expect(formatRelativeArabicTime(recent)).toBe('الآن');
    });

    it('returns منذ X دقيقة for recent minutes', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeArabicTime(fiveMinsAgo)).toBe('منذ 5 دقيقة');
    });

    it('returns أمس for 1 day ago', () => {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      expect(formatRelativeArabicTime(yesterday)).toBe('أمس');
    });
  });

  describe('getCategoryStyle', () => {
    it('returns rose styling for critical notifications', () => {
      const style = getCategoryStyle(NotificationCategory.DEAL, true);
      expect(style.bg).toContain('rose');
    });

    it('returns emerald styling for DEAL category', () => {
      const style = getCategoryStyle(NotificationCategory.DEAL, false);
      expect(style.bg).toContain('emerald');
    });

    it('returns amber styling for LICENSING category', () => {
      const style = getCategoryStyle(NotificationCategory.LICENSING, false);
      expect(style.bg).toContain('amber');
    });
  });
});

