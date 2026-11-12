import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuditController } from '../admin-audit.controller';
import { AuditService } from '../audit.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import { AdminRole, AUTH_NOT_AUTHORIZED } from '@elmasaif/shared';

describe('AdminAuditController (Story 8.7 / AC4)', () => {
  let controller: AdminAuditController;
  let auditService: any;
  let permissionGuard: AdminPermissionGuard;
  let reflector: Reflector;

  const mockDetail = {
    id: 'audit-log-1',
    actorId: 'admin-1',
    actorType: 'ADMIN',
    actorName: 'سعود المشرف',
    actorRole: 'SUPER_ADMIN',
    action: 'PLATFORM_SETTINGS_UPDATED',
    entityType: 'PlatformSetting',
    entityId: 'default',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-11-12T10:00:00.000Z',
    justificationReason: 'تحديث العمولات',
    beforeSnapshot: null,
    afterSnapshot: null,
    changedKeys: [],
    metadata: null,
  };

  const mockPaginated = {
    items: [mockDetail],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    auditService = {
      findAuditLogs: jest.fn().mockResolvedValue(mockPaginated),
      getAuditLogById: jest.fn().mockResolvedValue(mockDetail),
      getEntityAuditHistory: jest.fn().mockResolvedValue([mockDetail]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        {
          provide: AuditService,
          useValue: auditService,
        },
        Reflector,
        AdminPermissionGuard,
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
    permissionGuard = module.get<AdminPermissionGuard>(AdminPermissionGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Endpoints functionality', () => {
    it('GET /admin/audit calls auditService.findAuditLogs and formats response', async () => {
      const query = { page: 1, limit: 20 };
      const req = { headers: { 'x-request-id': 'req-123' } };

      const response = await controller.getAuditLogs(query as any, req);

      expect(auditService.findAuditLogs).toHaveBeenCalledWith(query);
      expect(response).toEqual({
        statusCode: HttpStatus.OK,
        message: 'تم استرجاع سجلات التدقيق بنجاح',
        data: mockPaginated,
        requestId: 'req-123',
      });
    });

    it('GET /admin/audit/:id calls auditService.getAuditLogById', async () => {
      const req = { headers: { 'x-request-id': 'req-456' } };
      const response = await controller.getAuditLogById('audit-log-1', req);

      expect(auditService.getAuditLogById).toHaveBeenCalledWith('audit-log-1');
      expect(response.data).toEqual(mockDetail);
    });

    it('GET /admin/audit/entity/:entityType/:entityId calls auditService.getEntityAuditHistory', async () => {
      const req = { headers: { 'x-request-id': 'req-789' } };
      const response = await controller.getEntityAuditHistory(
        'PlatformSetting',
        'default',
        req,
      );

      expect(auditService.getEntityAuditHistory).toHaveBeenCalledWith(
        'PlatformSetting',
        'default',
      );
      expect(response.data).toEqual([mockDetail]);
    });
  });

  describe('RBAC Guard and Permission Verification (Audit.View)', () => {
    function createMockContext(adminPayload: any): ExecutionContext {
      return {
        getHandler: () => AdminAuditController.prototype.getAuditLogs,
        getClass: () => AdminAuditController,
        switchToHttp: () => ({
          getRequest: () => ({
            admin: adminPayload,
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows Super Admin unconditionally', () => {
      const context = createMockContext({
        id: 'super-admin-id',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        deletedAt: null,
      });

      expect(permissionGuard.canActivate(context)).toBe(true);
    });

    it('allows staff with Audit.View explicit permission', () => {
      const context = createMockContext({
        id: 'staff-id',
        role: AdminRole.MODERATOR,
        isActive: true,
        deletedAt: null,
        permissions: ['Audit.View'],
      });

      expect(permissionGuard.canActivate(context)).toBe(true);
    });

    it('allows Compliance Officer or Financial Auditor via built-in role permissions', () => {
      const complianceContext = createMockContext({
        id: 'compliance-id',
        role: AdminRole.COMPLIANCE_OFFICER,
        isActive: true,
        deletedAt: null,
      });

      expect(permissionGuard.canActivate(complianceContext)).toBe(true);

      const auditorContext = createMockContext({
        id: 'auditor-id',
        role: AdminRole.FINANCIAL_AUDITOR,
        isActive: true,
        deletedAt: null,
      });

      expect(permissionGuard.canActivate(auditorContext)).toBe(true);
    });

    it('throws ForbiddenException if staff lacks Audit.View', () => {
      const context = createMockContext({
        id: 'moderator-id',
        role: AdminRole.MODERATOR,
        isActive: true,
        deletedAt: null,
        permissions: ['Listings.Moderate'],
      });

      expect(() => permissionGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });

    it('rejects inactive or deleted admin', () => {
      const context = createMockContext({
        id: 'super-admin-id',
        role: AdminRole.SUPER_ADMIN,
        isActive: false,
        deletedAt: null,
      });

      expect(() => permissionGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });
  });
});

