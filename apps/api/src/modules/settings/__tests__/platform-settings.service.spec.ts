import { Test, TestingModule } from '@nestjs/testing';
import { PlatformSettingsService } from '../platform-settings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_PLATFORM_COMMISSION_PERCENTAGE,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  PLATFORM_SETTINGS_UPDATED,
} from '@elmasaif/shared';
import { Prisma } from '@prisma/client';

describe('PlatformSettingsService (Story 8.6 / AC3, AC4)', () => {
  let service: PlatformSettingsService;
  let prisma: any;

  const admin = {
    id: 'admin-super-id',
    fullName: 'مدير النظام التنفيذي',
  };

  const dbRow = {
    id: 'default',
    commissionRate: new Prisma.Decimal(0.0250),
    fixedFeeSar: new Prisma.Decimal(0.00),
    ownerContractFeeSar: new Prisma.Decimal(1000.00),
    vatRate: new Prisma.Decimal(15.00),
    platformCollectionIban: 'SA0380000000608010167519',
    platformAccountHolderName: 'شركة المصايف العقارية المحدودة',
    platformBankName: 'البنك الأهلي السعودي',
    paymentWindowHours: 48,
    paymentCorrectionHours: 12,
    contractFeeDeadlineDays: 7,
    coolingOffPeriodDays: 14,
    dealReviewSlaAlertHours: 4,
    dealReviewSlaEscalationHours: 12,
    dealReviewSlaSuperAdminHours: 24,
    ticketSlaFirstResponseHours: 4,
    ticketSlaResolutionHours: 48,
    taskClaimLeaseMinutes: 15,
    taskClaimHeartbeatMinutes: 5,
    fraudRejectedProofThreshold: 3,
    fraudWindowHours: 72,
    updatedByAdminId: 'admin-super-id',
    updatedByAdmin: { fullName: 'مدير النظام التنفيذي' },
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      platformSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
  });

  describe('getSettings', () => {
    it('returns canonical fallback when no DB record exists', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(null);

      const settings = await service.getSettings();

      expect(settings.commissionRate).toBe(DEFAULT_PLATFORM_COMMISSION_RATE);
      expect(settings.commissionRatePercentage).toBe(DEFAULT_PLATFORM_COMMISSION_PERCENTAGE);
      expect(settings.paymentWindowHours).toBe(DEFAULT_PAYMENT_WINDOW_HOURS);
      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns mapped DTO from database and caches it', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(dbRow);

      const firstCall = await service.getSettings();
      expect(firstCall.id).toBe('default');
      expect(firstCall.commissionRate).toBe(0.025);
      expect(firstCall.commissionRatePercentage).toBe(2.5);
      expect(firstCall.platformCollectionIban).toBe('SA0380000000608010167519');

      // Second call should hit in-memory cache without calling prisma
      const secondCall = await service.getSettings();
      expect(secondCall).toEqual(firstCall);
      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPublicSettings', () => {
    it('returns safe public subset of configuration', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(dbRow);

      const publicSettings = await service.getPublicSettings();

      expect(publicSettings).toEqual({
        commissionRate: 0.025,
        commissionRatePercentage: 2.5,
        fixedFeeAmountSar: 0,
        ownerContractFeeSar: 1000,
        vatRatePercentage: 15,
        paymentWindowHours: 48,
      });
      // Ensure sensitive internal fields are omitted
      expect((publicSettings as any).platformCollectionIban).toBeUndefined();
      expect((publicSettings as any).dealReviewSlaSuperAdminHours).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    it('updates parameters in a transaction, creates AuditLog and refreshes cache', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(dbRow);

      const updatedRow = {
        ...dbRow,
        commissionRate: new Prisma.Decimal(0.0300),
        paymentWindowHours: 72,
        updatedAt: new Date('2026-11-12T12:00:00.000Z'),
      };
      prisma.platformSetting.upsert.mockResolvedValue(updatedRow);

      const input = {
        commissionRatePercentage: 3.0,
        paymentWindowHours: 72,
        justificationReason: 'رفع نسبة العمولة وتمديد مهلة السداد للربع الرابع',
      };

      const result = await service.updateSettings(input, admin, '192.168.1.100');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: admin.id,
            action: PLATFORM_SETTINGS_UPDATED,
            entityType: 'PLATFORM_SETTING',
            entityId: 'default',
            ipAddress: '192.168.1.100',
            payload: expect.objectContaining({
              actorName: admin.fullName,
              justificationReason: input.justificationReason,
              changedKeys: expect.arrayContaining(['commissionRatePercentage', 'paymentWindowHours']),
            }),
          }),
        }),
      );

      expect(result.commissionRate).toBe(0.03);
      expect(result.commissionRatePercentage).toBe(3);
      expect(result.paymentWindowHours).toBe(72);

      // Cache should be refreshed immediately: next getSettings() returns new values without querying DB again
      prisma.platformSetting.findUnique.mockClear();
      const fresh = await service.getSettings();
      expect(fresh.commissionRatePercentage).toBe(3);
      expect(prisma.platformSetting.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getAuditHistory', () => {
    it('returns chronological audit records', async () => {
      const mockAuditLogs = [
        {
          id: 'log-1',
          actorId: admin.id,
          action: PLATFORM_SETTINGS_UPDATED,
          entityType: 'PLATFORM_SETTING',
          entityId: 'default',
          payload: {
            actorName: admin.fullName,
            justificationReason: 'تعديل سنوي',
            changedKeys: ['commissionRatePercentage'],
            previousValues: { commissionRatePercentage: 2.5 },
            newValues: { commissionRatePercentage: 3.0 },
          },
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-11-12T10:00:00.000Z'),
        },
      ];
      prisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const logs = await service.getAuditHistory();

      expect(logs).toHaveLength(1);
      expect(logs[0].actorName).toBe(admin.fullName);
      expect(logs[0].justificationReason).toBe('تعديل سنوي');
      expect(logs[0].changedKeys).toEqual(['commissionRatePercentage']);
    });
  });
});
