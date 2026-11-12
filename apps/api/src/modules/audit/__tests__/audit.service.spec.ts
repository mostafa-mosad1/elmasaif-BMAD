import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_ACTION,
  AUDIT_LOG_NOT_FOUND,
} from '@elmasaif/shared';

describe('AuditService (Story 8.7 / AC3)', () => {
  let service: AuditService;
  let prisma: any;

  const mockDbRow = {
    id: 'audit-log-uuid-1',
    actorId: 'admin-uuid-100',
    actorType: 'ADMIN',
    action: AUDIT_ACTION.PLATFORM_SETTINGS_UPDATED,
    entityType: 'PlatformSetting',
    entityId: 'default',
    ipAddress: '192.168.1.1',
    createdAt: new Date('2026-11-12T10:00:00.000Z'),
    payload: {
      actorName: 'سعود المشرف',
      actorRole: 'SUPER_ADMIN',
      justificationReason: 'تعديل عمولة المنصة بقرار مجلس الإدارة',
      changedKeys: ['commissionRate'],
      beforeSnapshot: { commissionRate: '0.025' },
      afterSnapshot: { commissionRate: '0.020' },
      metadata: { source: 'admin-console' },
      userAgent: 'Mozilla/5.0 Chrome/120',
    },
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'generated-uuid',
          createdAt: new Date('2026-11-12T12:00:00.000Z'),
          ...data,
        })),
        findMany: jest.fn().mockResolvedValue([mockDbRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === mockDbRow.id) return mockDbRow;
          return null;
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('Strict Immutability Contract', () => {
    it('must NOT expose any update or delete methods on AuditService', () => {
      expect((service as any).update).toBeUndefined();
      expect((service as any).updateMany).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
      expect((service as any).deleteMany).toBeUndefined();
    });
  });

  describe('record()', () => {
    it('creates an audit record with normalized payload and actor metadata', async () => {
      const result = await service.record(null, {
        actorId: 'admin-uuid-100',
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorName: 'سعود المشرف',
        actorRole: 'SUPER_ADMIN',
        action: AUDIT_ACTION.PLATFORM_SETTINGS_UPDATED,
        entityType: 'PlatformSetting',
        entityId: 'default',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        justificationReason: 'تعديل عمولة المنصة',
        beforeSnapshot: { commissionRate: '0.025' },
        afterSnapshot: { commissionRate: '0.020' },
        changedKeys: ['commissionRate'],
        metadata: { source: 'console' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-uuid-100',
          actorType: AUDIT_ACTOR_TYPE.ADMIN,
          action: AUDIT_ACTION.PLATFORM_SETTINGS_UPDATED,
          entityType: 'PlatformSetting',
          entityId: 'default',
          ipAddress: '192.168.1.1',
          payload: {
            actorName: 'سعود المشرف',
            actorRole: 'SUPER_ADMIN',
            justificationReason: 'تعديل عمولة المنصة',
            beforeSnapshot: { commissionRate: '0.025' },
            afterSnapshot: { commissionRate: '0.020' },
            changedKeys: ['commissionRate'],
            metadata: { source: 'console' },
            userAgent: 'Mozilla/5.0',
          },
        },
      });
      expect(result.id).toBe('generated-uuid');
    });

    it('uses transactional prisma client when provided', async () => {
      const txMock = {
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'tx-audit-uuid' }),
        },
      };

      const result = await service.record(txMock, {
        actorId: 'sys-cron',
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        action: AUDIT_ACTION.DEAL_TIMEOUT,
        entityType: 'Deal',
        entityId: 'deal-123',
      });

      expect(txMock.auditLog.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(result.id).toBe('tx-audit-uuid');
    });

    it('assigns default actorName for SYSTEM actor if omitted', async () => {
      await service.record(null, {
        actorId: 'system-job',
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        action: AUDIT_ACTION.DEAL_TIMEOUT,
        entityType: 'Deal',
        entityId: 'deal-999',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({
              actorName: 'النظام (System)',
            }),
          }),
        }),
      );
    });
  });

  describe('findAuditLogs()', () => {
    it('returns paginated items and calculates totalPages correctly', async () => {
      const result = await service.findAuditLogs({
        page: 1,
        limit: 20,
      });

      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]).toEqual({
        id: mockDbRow.id,
        actorId: mockDbRow.actorId,
        actorType: mockDbRow.actorType,
        actorName: 'سعود المشرف',
        actorRole: 'SUPER_ADMIN',
        action: mockDbRow.action,
        entityType: mockDbRow.entityType,
        entityId: mockDbRow.entityId,
        ipAddress: mockDbRow.ipAddress,
        createdAt: '2026-11-12T10:00:00.000Z',
        justificationReason: 'تعديل عمولة المنصة بقرار مجلس الإدارة',
        hasSnapshots: true,
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('builds dynamic query filters when arguments are passed', async () => {
      await service.findAuditLogs({
        page: 2,
        limit: 10,
        entityType: 'Deal',
        entityId: 'deal-xyz',
        action: AUDIT_ACTION.DEAL_FINAL_APPROVED,
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: 'admin-456',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-10T23:59:59.999Z',
        search: 'صفقة',
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'Deal',
          entityId: 'deal-xyz',
          action: AUDIT_ACTION.DEAL_FINAL_APPROVED,
          actorType: AUDIT_ACTOR_TYPE.ADMIN,
          actorId: 'admin-456',
          createdAt: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-10T23:59:59.999Z'),
          },
          OR: [
            { action: { contains: 'صفقة', mode: 'insensitive' } },
            { entityType: { contains: 'صفقة', mode: 'insensitive' } },
            { entityId: { contains: 'صفقة', mode: 'insensitive' } },
            { actorId: { contains: 'صفقة', mode: 'insensitive' } },
            { payload: { path: ['actorName'], string_contains: 'صفقة' } },
            {
              payload: {
                path: ['justificationReason'],
                string_contains: 'صفقة',
              },
            },
          ],
        },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAuditLogById()', () => {
    it('returns full detail DTO with snapshots and changedKeys', async () => {
      const result = await service.getAuditLogById(mockDbRow.id);

      expect(result).toEqual({
        id: mockDbRow.id,
        actorId: mockDbRow.actorId,
        actorType: mockDbRow.actorType,
        actorName: 'سعود المشرف',
        actorRole: 'SUPER_ADMIN',
        action: mockDbRow.action,
        entityType: mockDbRow.entityType,
        entityId: mockDbRow.entityId,
        ipAddress: mockDbRow.ipAddress,
        userAgent: 'Mozilla/5.0 Chrome/120',
        createdAt: '2026-11-12T10:00:00.000Z',
        justificationReason: 'تعديل عمولة المنصة بقرار مجلس الإدارة',
        beforeSnapshot: { commissionRate: '0.025' },
        afterSnapshot: { commissionRate: '0.020' },
        changedKeys: ['commissionRate'],
        metadata: { source: 'admin-console' },
      });
    });

    it('throws NotFoundException when ID does not exist', async () => {
      await expect(service.getAuditLogById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEntityAuditHistory()', () => {
    it('returns chronological array of entity logs', async () => {
      const result = await service.getEntityAuditHistory(
        'PlatformSetting',
        'default',
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'PlatformSetting', entityId: 'default' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(mockDbRow.id);
    });
  });
});

