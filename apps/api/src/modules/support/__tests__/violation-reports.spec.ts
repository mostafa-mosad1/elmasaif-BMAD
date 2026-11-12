import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ViolationReportsService } from '../violation-reports.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  VIOLATION_REPORT_ADJUDICATED,
  VIOLATION_REPORT_DISMISSED,
} from '@elmasaif/shared';

describe('ViolationReportsService (Story 8.5 / AC-3, FR-37)', () => {
  let service: ViolationReportsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;

  const mockNow = new Date('2026-11-12T10:00:00.000Z');
  const admin = {
    id: 'admin-uuid-1',
    fullName: 'مشرف الامتثال الأول',
    role: 'MODERATOR',
  };

  beforeEach(async () => {
    prisma = {
      violationReport: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
        ViolationReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<ViolationReportsService>(ViolationReportsService);
  });

  describe('createReport', () => {
    it('creates report with sequential report number and PENDING status', async () => {
      prisma.violationReport.count.mockResolvedValue(0);
      prisma.violationReport.findUnique.mockResolvedValue(null);
      prisma.violationReport.create.mockImplementation(({ data }: any) => ({
        id: 'rep-1',
        ...data,
      }));

      const res = await service.createReport(
        {
          targetType: 'LISTING',
          targetListingId: 'listing-1',
          category: 'FRAUDULENT_LISTING',
          description: 'إعلان وهمي بسعر غير منطقي وصور غير مطابقة للواقع',
          attachments: ['doc1.png'],
          reporterName: 'سالم الشمري',
          reporterEmail: 'salem@example.com',
          reporterPhone: '0501234567',
        },
        'user-uuid-1',
      );

      expect(res.reportNumber).toBe('VR-2026-0001');
      expect(res.status).toBe('PENDING');
      expect(prisma.violationReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reportNumber: 'VR-2026-0001',
            reporterUserId: 'user-uuid-1',
            category: 'FRAUDULENT_LISTING',
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('getQueue', () => {
    it('returns filtered violation reports queue and KPI summary counts', async () => {
      const mockItems = [
        {
          id: 'rep-1',
          reportNumber: 'VR-2026-0001',
          reporterUserId: null,
          reporterName: 'مبلغ مجهول',
          reporterEmail: null,
          reporterPhone: null,
          targetType: 'LISTING',
          targetListingId: 'listing-1',
          targetUserId: null,
          category: 'FRAUDULENT_LISTING',
          description: 'إعلان وهمي وصك غير معتمد',
          attachments: [],
          status: 'PENDING',
          resolutionAction: null,
          resolutionNotes: null,
          assignedAdminId: null,
          assignedAdmin: null,
          assignedAt: null,
          resolvedByAdminId: null,
          resolvedByAdmin: null,
          resolvedAt: null,
          createdAt: mockNow,
          updatedAt: mockNow,
          targetListing: {
            title: 'شقة فاخرة على البحر',
            askPrice: '750000.00',
            sellerProfile: {
              user: { fullName: 'خالد المطيري' },
              falLicense: { licenseNumber: '1100012345' },
            },
          },
        },
      ];

      prisma.violationReport.findMany.mockResolvedValue(mockItems);
      prisma.violationReport.count
        .mockResolvedValueOnce(1) // total matching
        .mockResolvedValueOnce(1) // pending
        .mockResolvedValueOnce(0) // underReview
        .mockResolvedValueOnce(0) // resolved
        .mockResolvedValueOnce(0); // dismissed

      const queue = await service.getQueue({
        status: 'PENDING',
        page: 1,
        limit: 20,
      });

      expect(queue.items).toHaveLength(1);
      expect(queue.items[0].targetPreview).toEqual({
        title: 'شقة فاخرة على البحر',
        price: 750000,
        brokerName: 'خالد المطيري',
        licenseNumber: '1100012345',
      });
      expect(queue.counts).toEqual({
        total: 1,
        pending: 1,
        underReview: 0,
        resolved: 0,
        dismissed: 0,
      });
    });
  });

  describe('getReportById', () => {
    it('throws NotFoundException if report does not exist', async () => {
      prisma.violationReport.findUnique.mockResolvedValue(null);

      await expect(service.getReportById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns detail with signed attachments and audit trail', async () => {
      const mockReport = {
        id: 'rep-1',
        reportNumber: 'VR-2026-0001',
        reporterUserId: null,
        reporterName: 'مبلغ مجهول',
        reporterEmail: null,
        reporterPhone: null,
        targetType: 'LISTING',
        targetListingId: 'listing-1',
        targetUserId: null,
        category: 'FRAUDULENT_LISTING',
        description: 'إعلان وهمي وصك غير معتمد',
        attachments: ['evidence/fake-deed.pdf'],
        status: 'PENDING',
        resolutionAction: null,
        resolutionNotes: null,
        assignedAdminId: null,
        assignedAdmin: null,
        assignedAt: null,
        resolvedByAdminId: null,
        resolvedByAdmin: null,
        resolvedAt: null,
        createdAt: mockNow,
        updatedAt: mockNow,
        targetListing: null,
      };

      prisma.violationReport.findUnique.mockResolvedValue(mockReport);
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'VIOLATION_REPORT_CREATED',
          actorId: 'admin-uuid-1',
          createdAt: mockNow,
          payload: {},
        },
      ]);
      prisma.adminUser.findMany.mockResolvedValue([
        { id: 'admin-uuid-1', fullName: 'مشرف الامتثال الأول' },
      ]);

      const detail = await service.getReportById('rep-1');
      expect(detail.id).toBe('rep-1');
      expect(detail.signedAttachments).toEqual(['https://signed.cdn/evidence/fake-deed.pdf']);
      expect(detail.auditTrail).toHaveLength(1);
      expect(detail.auditTrail?.[0].actorAdminName).toBe('مشرف الامتثال الأول');
    });
  });

  describe('adjudicateReport and dismissReport', () => {
    it('adjudicates report, updates status to RESOLVED, and writes AuditLog', async () => {
      const existing = {
        id: 'rep-1',
        reportNumber: 'VR-2026-0001',
        status: 'PENDING',
      };
      prisma.violationReport.findUnique.mockResolvedValue(existing);
      prisma.violationReport.update.mockResolvedValue({
        ...existing,
        status: 'RESOLVED',
        resolutionAction: 'LISTING_REMOVED',
        resolutionNotes: 'تم حجب الإعلان المخالف بعد ثبوت عدم ملكية المعلن',
      });
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const updated = await service.adjudicateReport(
        'rep-1',
        {
          action: 'LISTING_REMOVED',
          notes: 'تم حجب الإعلان المخالف بعد ثبوت عدم ملكية المعلن',
        },
        admin,
        '127.0.0.1',
      );

      expect(prisma.violationReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rep-1' },
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolutionAction: 'LISTING_REMOVED',
            resolvedByAdminId: admin.id,
            resolvedAt: mockNow,
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: VIOLATION_REPORT_ADJUDICATED,
            actorId: admin.id,
            entityType: 'VIOLATION_REPORT',
            entityId: 'rep-1',
          }),
        }),
      );
    });

    it('dismisses report, sets status to DISMISSED, and writes AuditLog', async () => {
      const existing = {
        id: 'rep-1',
        reportNumber: 'VR-2026-0001',
        status: 'PENDING',
      };
      prisma.violationReport.findUnique.mockResolvedValue(existing);
      prisma.violationReport.update.mockResolvedValue({
        ...existing,
        status: 'DISMISSED',
        resolutionAction: 'NO_ACTION',
        resolutionNotes: 'بلاغ كيدي وتم التحقق من صحة ترخيص وصك العقار',
      });

      await service.dismissReport(
        'rep-1',
        {
          notes: 'بلاغ كيدي وتم التحقق من صحة ترخيص وصك العقار',
        },
        admin,
        '127.0.0.1',
      );

      expect(prisma.violationReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rep-1' },
          data: expect.objectContaining({
            status: 'DISMISSED',
            resolutionAction: 'NO_ACTION',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: VIOLATION_REPORT_DISMISSED,
            actorId: admin.id,
          }),
        }),
      );
    });
  });
});
