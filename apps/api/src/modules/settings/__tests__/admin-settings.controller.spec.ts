import { Test, TestingModule } from '@nestjs/testing';
import { AdminSettingsController } from '../admin-settings.controller';
import { PlatformSettingsService } from '../platform-settings.service';
import { Reflector } from '@nestjs/core';
import { ADMIN_PERMISSION_METADATA_KEY } from '../../auth/decorators/require-admin-permission.decorator';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';

describe('AdminSettingsController (Story 8.6 / AC3)', () => {
  let controller: AdminSettingsController;
  let service: any;

  const mockAdmin = {
    id: 'admin-1',
    fullName: 'مدير الصلاحيات',
    role: 'SUPER_ADMIN',
    permissions: ['Settings.Manage', 'Settings.Commission'],
  };

  const mockSettings = {
    id: 'default',
    commissionRate: 0.025,
    commissionRatePercentage: 2.5,
    fixedFeeAmountSar: 0,
    ownerContractFeeSar: 1000,
    vatRatePercentage: 15,
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
    updatedByAdminId: 'admin-1',
    updatedByAdminName: 'مدير الصلاحيات',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      getSettings: jest.fn().mockResolvedValue(mockSettings),
      updateSettings: jest.fn().mockResolvedValue({
        ...mockSettings,
        commissionRatePercentage: 3.0,
      }),
      getAuditHistory: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          actorId: 'admin-1',
          actorName: 'مدير الصلاحيات',
          action: 'PLATFORM_SETTINGS_UPDATED',
          timestamp: '2026-11-12T10:00:00.000Z',
          justificationReason: 'تحديث هوامش العمليات',
          previousValues: {},
          newValues: {},
          changedKeys: ['commissionRatePercentage'],
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSettingsController],
      providers: [
        { provide: PlatformSettingsService, useValue: service },
        AdminPermissionGuard,
        Reflector,
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminSettingsController>(AdminSettingsController);
  });

  it('declares required admin permissions (Settings.Manage, Settings.Commission)', () => {
    const reflector = new Reflector();
    const permissions = reflector.get(
      ADMIN_PERMISSION_METADATA_KEY,
      AdminSettingsController,
    );
    expect(permissions).toEqual(['Settings.Manage', 'Settings.Commission']);
  });

  describe('getSettings', () => {
    it('returns full platform settings payload', async () => {
      const req = { admin: mockAdmin, headers: { 'x-request-id': 'req-123' } };
      const res = await controller.getSettings(req);

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual(mockSettings);
      expect(res.requestId).toBe('req-123');
      expect(service.getSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSettings', () => {
    it('delegates update with admin context and client IP', async () => {
      const req = {
        admin: mockAdmin,
        ip: '10.0.0.1',
        headers: { 'x-request-id': 'req-456' },
      };
      const body = {
        commissionRatePercentage: 3.0,
        justificationReason: 'تحديث الهامش للربع القادم',
      };

      const res = await controller.updateSettings(req, body);

      expect(res.statusCode).toBe(200);
      expect(res.data.commissionRatePercentage).toBe(3.0);
      expect(service.updateSettings).toHaveBeenCalledWith(
        body,
        mockAdmin,
        '10.0.0.1',
      );
    });
  });

  describe('getAuditHistory', () => {
    it('returns chronological audit records', async () => {
      const req = { admin: mockAdmin, headers: {} };
      const res = await controller.getAuditHistory(req);

      expect(res.statusCode).toBe(200);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].justificationReason).toBe('تحديث هوامش العمليات');
      expect(service.getAuditHistory).toHaveBeenCalledTimes(1);
    });
  });
});
