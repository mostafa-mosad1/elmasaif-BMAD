import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NOTIFICATION_DEAL_CREATED,
  NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
  NOTIFICATION_SUPPORT_TICKET_SLA_ALERT,
  NOTIFICATION_NOT_FOUND,
} from '@elmasaif/shared';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { EmailTransportService } from '../../auth/email/email-transport.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;
  let mockClock: any;
  let mockEmail: any;

  const fixedDate = new Date('2026-11-13T12:00:00.000Z');

  beforeEach(async () => {
    mockClock = {
      now: jest.fn().mockReturnValue(fixedDate),
      nowIso: jest.fn().mockReturnValue(fixedDate.toISOString()),
    };

    mockEmail = {
      sendEmail: jest.fn().mockResolvedValue({ delivered: true }),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        { provide: EmailTransportService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('dispatch', () => {
    it('should create an in-app notification record and send email for mandatory critical events even if email preference is disabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'buyer@test.sa',
        fullName: 'أحمد المشتري',
        preferences: {
          emailNotifications: false, // Muted by user!
        },
      });

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        eventKey: NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
        channel: NotificationChannel.IN_APP,
        category: NotificationCategory.DEAL,
        title: 'تنبيه موعد السداد',
        message: 'متبقي 12 ساعة على سداد الصفقة',
        isCritical: true,
        isRead: false,
        createdAt: fixedDate,
      });

      const result = await service.dispatch({
        userId: 'user-1',
        eventKey: NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
        title: 'تنبيه موعد السداد',
        message: 'متبقي 12 ساعة على سداد الصفقة',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        category: NotificationCategory.DEAL,
        metadata: {
          dealNumber: 'DEAL-99',
          remainingHours: 12,
        },
      });

      expect(result.inAppNotificationId).toBe('notif-1');
      expect(result.emailDispatched).toBe(true);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          eventKey: NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
          isCritical: true,
        }),
      });

      // Verify email was sent despite emailNotifications: false because it is mandatory (A-09)
      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@test.sa',
          subject: expect.stringContaining('تنبيه اقتراب انتهاء مهلة سداد الصفقة'),
        }),
      );
    });

    it('should respect user preferences and skip email for non-critical notifications when email is muted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'user2@test.sa',
        fullName: 'سعد العتيبي',
        preferences: {
          emailNotifications: false,
        },
      });

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-2',
        userId: 'user-2',
        eventKey: NOTIFICATION_SUPPORT_TICKET_SLA_ALERT,
        isCritical: false,
        isRead: false,
        createdAt: fixedDate,
      });

      const result = await service.dispatch({
        userId: 'user-2',
        eventKey: NOTIFICATION_SUPPORT_TICKET_SLA_ALERT,
        title: 'تنبيه تذكرة دعم',
        message: 'تم تحديث التذكرة الخاصة بك',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        category: NotificationCategory.SUPPORT,
      });

      expect(result.inAppNotificationId).toBe('notif-2');
      expect(result.emailDispatched).toBe(false);
      expect(mockEmail.sendEmail).not.toHaveBeenCalled();
    });

    it('should send email for non-critical notification if user email preference is enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'user3@test.sa',
        fullName: 'خالد محمد',
        preferences: {
          emailNotifications: true,
        },
      });

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-3',
        userId: 'user-3',
        eventKey: NOTIFICATION_SUPPORT_TICKET_SLA_ALERT,
        isCritical: false,
        isRead: false,
        createdAt: fixedDate,
      });

      const result = await service.dispatch({
        userId: 'user-3',
        eventKey: NOTIFICATION_SUPPORT_TICKET_SLA_ALERT,
        title: 'تنبيه تذكرة دعم',
        message: 'تم تحديث التذكرة الخاصة بك',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        category: NotificationCategory.SUPPORT,
      });

      expect(result.emailDispatched).toBe(true);
      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user3@test.sa',
        }),
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications and accurate unread count', async () => {
      const mockItems = [
        {
          id: 'notif-1',
          userId: 'user-1',
          eventKey: NOTIFICATION_DEAL_CREATED,
          channel: NotificationChannel.IN_APP,
          category: NotificationCategory.DEAL,
          title: 'صفقة جديدة',
          message: 'تم إنشاء الصفقة',
          entityType: 'deal',
          entityId: 'deal-123',
          deepLink: '/app/buyer/deals/deal-123',
          metadata: {},
          isRead: false,
          readAt: null,
          isCritical: true,
          createdAt: fixedDate,
        },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockItems);
      mockPrisma.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unreadCount

      const result = await service.getUserNotifications('user-1', {
        page: 1,
        limit: 10,
        unreadOnly: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.items[0].id).toBe('notif-1');
      expect(result.items[0].isCritical).toBe(true);
    });

    it('should filter by unreadOnly when requested', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.getUserNotifications('user-1', {
        page: 1,
        limit: 20,
        unreadOnly: true,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            isRead: false,
          }),
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(7);
      const result = await service.getUnreadCount('user-1');
      expect(result.unreadCount).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark unread notification as read', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
        readAt: null,
        createdAt: fixedDate,
      });

      mockPrisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true,
        readAt: fixedDate,
        createdAt: fixedDate,
      });

      const result = await service.markAsRead('user-1', 'notif-1');
      expect(result.isRead).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true, readAt: fixedDate },
      });
    });

    it('should throw NotFoundException when notification belongs to another user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-x',
        userId: 'other-user',
      });

      await expect(service.markAsRead('user-1', 'notif-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read and return marked count', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');
      expect(result.markedCount).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true, readAt: fixedDate },
      });
    });
  });
});

