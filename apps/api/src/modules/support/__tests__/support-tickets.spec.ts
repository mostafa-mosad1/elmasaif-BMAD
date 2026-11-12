import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupportTicketsService } from '../support-tickets.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  AdminRole,
  SUPPORT_TICKET_ASSIGNED,
  SUPPORT_TICKET_MESSAGE_ADDED,
  SUPPORT_TICKET_STATUS_UPDATED,
} from '@elmasaif/shared';

describe('SupportTicketsService (Story 8.5 / AC-4, FR-38)', () => {
  let service: SupportTicketsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;

  const mockNow = new Date('2026-11-12T10:00:00.000Z');
  const moderator = {
    id: 'admin-uuid-1',
    fullName: 'مشرف الدعم الفني',
    role: AdminRole.MODERATOR,
    permissions: ['Tickets.Handle', 'Notes.Manage'],
  };

  beforeEach(async () => {
    prisma = {
      supportTicket: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ticketMessage: {
        create: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    storageService = {
      getPresignedDownloadUrl: jest
        .fn()
        .mockImplementation((k: string) => Promise.resolve(`https://signed.cdn/${k}`)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<SupportTicketsService>(SupportTicketsService);
  });

  describe('createTicket', () => {
    it('creates ticket with 4h response SLA and 48h resolution SLA', async () => {
      prisma.supportTicket.count.mockResolvedValue(0);
      prisma.supportTicket.findUnique.mockResolvedValue(null);
      prisma.supportTicket.create.mockImplementation(({ data }: any) => ({
        id: 'tik-1',
        ...data,
      }));

      const res = await service.createTicket(
        {
          category: 'TECHNICAL_ISSUE',
          subject: 'مشكلة في تحميل الصك',
          description: 'تظهر شاشة بيضاء عند محاولة استعراض الصك العقاري.',
          priority: 'HIGH',
          contactName: 'عبدالله السبيعي',
          contactEmail: 'abdullah@example.com',
          contactPhone: '0555555555',
          attachments: ['err.png'],
        },
        'user-uuid-1',
      );

      expect(res.ticketNumber).toBe('TIK-2026-0001');
      expect(res.status).toBe('OPEN');

      const expectedFirstResponse = new Date(mockNow.getTime() + 4 * 3600 * 1000).toISOString();
      const expectedResolution = new Date(mockNow.getTime() + 48 * 3600 * 1000).toISOString();

      expect(res.firstResponseDueAt).toBe(expectedFirstResponse);
      expect(res.resolutionDueAt).toBe(expectedResolution);
    });
  });

  describe('calculateSlaStatus (Dynamic Deterministic SLA)', () => {
    it('detects ON_TRACK state when SLA deadlines are far in future', () => {
      const ticket = {
        firstResponseDueAt: new Date(mockNow.getTime() + 3 * 3600 * 1000), // 3 hours left
        firstRespondedAt: null,
        resolutionDueAt: new Date(mockNow.getTime() + 40 * 3600 * 1000),
        resolvedAt: null,
      };

      const result = service.calculateSlaStatus(ticket, mockNow);
      expect(result.firstResponseSla.state).toBe('ON_TRACK');
      expect(result.firstResponseSla.isBreached).toBe(false);
      expect(result.resolutionSla.state).toBe('ON_TRACK');
      expect(result.resolutionSla.isBreached).toBe(false);
    });

    it('detects NEARING_BREACH when first response has <= 60 minutes remaining', () => {
      const ticket = {
        firstResponseDueAt: new Date(mockNow.getTime() + 45 * 60 * 1000), // 45 mins left
        firstRespondedAt: null,
        resolutionDueAt: new Date(mockNow.getTime() + 30 * 3600 * 1000),
        resolvedAt: null,
      };

      const result = service.calculateSlaStatus(ticket, mockNow);
      expect(result.firstResponseSla.state).toBe('NEARING_BREACH');
      expect(result.firstResponseSla.remainingMinutes).toBe(45);
      expect(result.firstResponseSla.isBreached).toBe(false);
    });

    it('detects BREACHED when now > firstResponseDueAt and no response given', () => {
      const ticket = {
        firstResponseDueAt: new Date(mockNow.getTime() - 10 * 60 * 1000), // 10 mins past due
        firstRespondedAt: null,
        resolutionDueAt: new Date(mockNow.getTime() + 20 * 3600 * 1000),
        resolvedAt: null,
      };

      const result = service.calculateSlaStatus(ticket, mockNow);
      expect(result.firstResponseSla.state).toBe('BREACHED');
      expect(result.firstResponseSla.isBreached).toBe(true);
    });

    it('detects BREACHED when resolution deadline has passed and ticket is unresolved', () => {
      const ticket = {
        firstResponseDueAt: new Date(mockNow.getTime() - 40 * 3600 * 1000),
        firstRespondedAt: new Date(mockNow.getTime() - 41 * 3600 * 1000), // Responded in time
        resolutionDueAt: new Date(mockNow.getTime() - 1 * 3600 * 1000), // 1h past due
        resolvedAt: null,
      };

      const result = service.calculateSlaStatus(ticket, mockNow);
      expect(result.firstResponseSla.isBreached).toBe(false);
      expect(result.resolutionSla.state).toBe('BREACHED');
      expect(result.resolutionSla.isBreached).toBe(true);
    });
  });

  describe('getTicketById (Staff Internal Notes Separation)', () => {
    it('hides internal messages if canManageNotes is false', async () => {
      const mockTicket = {
        id: 'tik-1',
        ticketNumber: 'TIK-2026-0001',
        userId: 'user-1',
        contactName: 'عبدالله',
        contactEmail: 'a@example.com',
        contactPhone: null,
        category: 'TECHNICAL_ISSUE',
        priority: 'MEDIUM',
        subject: 'مشكلة فنية',
        description: 'تفاصيل المشكلة',
        attachments: [],
        status: 'OPEN',
        firstResponseDueAt: new Date(mockNow.getTime() + 4 * 3600 * 1000),
        firstRespondedAt: null,
        resolutionDueAt: new Date(mockNow.getTime() + 48 * 3600 * 1000),
        resolvedAt: null,
        closedAt: null,
        assignedAdminId: null,
        assignedAdmin: null,
        assignedAt: null,
        resolutionSummary: null,
        createdAt: mockNow,
        updatedAt: mockNow,
        messages: [
          {
            id: 'msg-1',
            ticketId: 'tik-1',
            authorAdminId: null,
            authorUserId: 'user-1',
            authorType: 'USER',
            authorName: 'عبدالله',
            message: 'مرحباً، أرجو المساعدة',
            attachments: [],
            isInternal: false,
            createdAt: mockNow,
          },
          {
            id: 'msg-2',
            ticketId: 'tik-1',
            authorAdminId: 'admin-1',
            authorUserId: null,
            authorType: 'ADMIN',
            authorName: 'مشرف الدعم',
            message: 'ملاحظة خاصة: تأكدنا من الخادم والخطأ من طرف بوابة النفاذ الوطني',
            attachments: [],
            isInternal: true,
            createdAt: mockNow,
          },
        ],
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);

      // Caller without Notes.Manage
      const detailWithoutNotes = await service.getTicketById('tik-1', false);
      expect(detailWithoutNotes.messages).toHaveLength(1);
      expect(detailWithoutNotes.messages[0].isInternal).toBe(false);

      // Caller with Notes.Manage
      const detailWithNotes = await service.getTicketById('tik-1', true);
      expect(detailWithNotes.messages).toHaveLength(2);
      expect(detailWithNotes.messages.some((m) => m.isInternal)).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('updates status to RESOLVED, sets resolvedAt & resolutionSummary, and writes AuditLog', async () => {
      const existing = {
        id: 'tik-1',
        ticketNumber: 'TIK-2026-0001',
        status: 'IN_PROGRESS',
      };
      prisma.supportTicket.findUnique.mockResolvedValue(existing);
      prisma.supportTicket.update.mockResolvedValue({
        ...existing,
        status: 'RESOLVED',
        resolvedAt: mockNow,
        resolutionSummary: 'تم حل المشكلة وتحديث الصك في النظام بنجاح',
      });

      await service.updateStatus(
        'tik-1',
        {
          status: 'RESOLVED',
          resolutionSummary: 'تم حل المشكلة وتحديث الصك في النظام بنجاح',
        },
        moderator,
        '127.0.0.1',
      );

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tik-1' },
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolvedAt: mockNow,
            resolutionSummary: 'تم حل المشكلة وتحديث الصك في النظام بنجاح',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SUPPORT_TICKET_STATUS_UPDATED,
            actorId: moderator.id,
          }),
        }),
      );
    });
  });

  describe('addMessage', () => {
    it('sets firstRespondedAt on initial staff response', async () => {
      const existing = {
        id: 'tik-1',
        ticketNumber: 'TIK-2026-0001',
        status: 'OPEN',
        firstRespondedAt: null,
      };
      prisma.supportTicket.findUnique.mockResolvedValue(existing);
      prisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-1',
        ticketId: 'tik-1',
        message: 'أهلاً بك، نحن نعمل على فحص طلبك حالياً',
        isInternal: false,
        createdAt: mockNow,
      });

      await service.addMessage(
        'tik-1',
        {
          message: 'أهلاً بك، نحن نعمل على فحص طلبك حالياً',
          isInternal: false,
          attachments: [],
        },
        {
          id: moderator.id,
          fullName: moderator.fullName,
          role: moderator.role,
          isStaff: true,
          permissions: moderator.permissions,
        },
        '127.0.0.1',
      );

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tik-1' },
          data: expect.objectContaining({
            firstRespondedAt: mockNow,
            status: 'IN_PROGRESS',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SUPPORT_TICKET_MESSAGE_ADDED,
          }),
        }),
      );
    });

    it('rejects internal notes if author is not staff or lacks Notes.Manage', async () => {
      const existing = {
        id: 'tik-1',
        ticketNumber: 'TIK-2026-0001',
      };
      prisma.supportTicket.findUnique.mockResolvedValue(existing);

      // Non-staff attempt
      await expect(
        service.addMessage(
          'tik-1',
          { message: 'سري للغاية', isInternal: true, attachments: [] },
          { id: 'user-1', fullName: 'مستخدم عادي', isStaff: false },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
