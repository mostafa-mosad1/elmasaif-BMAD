import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminListingsController } from '../admin-listings.controller';
import { AdminListingsService } from '../admin-listings.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import { AdminRole, ListingStatus, AUTH_NOT_AUTHORIZED } from '@elmasaif/shared';

describe('AdminListingsController & AdminPermissionGuard (Story 2.4)', () => {
  let controller: AdminListingsController;
  let service: any;
  let permissionGuard: AdminPermissionGuard;
  let reflector: Reflector;

  const mockAdminModerator = {
    id: 'admin-mod-1',
    username: 'mod1',
    email: 'mod1@elmasaif.sa',
    fullName: 'أحمد المراجع',
    role: AdminRole.MODERATOR,
    isActive: true,
    permissions: ['Listings.Review', 'Licenses.Review', 'Reviews.Moderate'],
  };

  const mockAdminAuditor = {
    id: 'admin-auditor-1',
    username: 'auditor1',
    email: 'auditor1@elmasaif.sa',
    fullName: 'سعد المدقق المالي',
    role: AdminRole.FINANCIAL_AUDITOR,
    isActive: true,
    permissions: ['Deals.View', 'Payments.Review'],
  };

  const mockSuperAdmin = {
    id: 'super-admin-1',
    username: 'super1',
    email: 'super1@elmasaif.sa',
    fullName: 'المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    permissions: ['Listings.Review', 'Tasks.ForceUnlock'],
  };

  beforeEach(async () => {
    service = {
      getModerationQueue: jest.fn(),
      getAdminListingDetail: jest.fn(),
      claimListing: jest.fn(),
      heartbeatListingLock: jest.fn(),
      releaseListingLock: jest.fn(),
      forceUnlockListing: jest.fn(),
      approveListing: jest.fn(),
      rejectListing: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminListingsController],
      providers: [
        { provide: AdminListingsService, useValue: service },
        AdminPermissionGuard,
        Reflector,
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminListingsController>(AdminListingsController);
    permissionGuard = module.get<AdminPermissionGuard>(AdminPermissionGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('AdminPermissionGuard', () => {
    const createMockContext = (admin: any, handler: Function): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ admin }),
        }),
        getHandler: () => handler,
        getClass: () => AdminListingsController,
      }) as unknown as ExecutionContext;

    it('allows MODERATOR with Listings.Review to access getModerationQueue', () => {
      const ctx = createMockContext(
        mockAdminModerator,
        controller.getModerationQueue,
      );
      expect(permissionGuard.canActivate(ctx)).toBe(true);
    });

    it('blocks FINANCIAL_AUDITOR without Listings.Review with 403 AUTH_NOT_AUTHORIZED', () => {
      const ctx = createMockContext(
        mockAdminAuditor,
        controller.getModerationQueue,
      );
      expect(() => permissionGuard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        permissionGuard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_NOT_AUTHORIZED);
      }
    });

    it('blocks MODERATOR from forceUnlockListing (requires Tasks.ForceUnlock)', () => {
      const ctx = createMockContext(
        mockAdminModerator,
        controller.forceUnlockListing,
      );
      expect(() => permissionGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('allows SUPER_ADMIN with Tasks.ForceUnlock to access forceUnlockListing', () => {
      const ctx = createMockContext(
        mockSuperAdmin,
        controller.forceUnlockListing,
      );
      expect(permissionGuard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Controller Endpoints', () => {
    it('delegates getModerationQueue with parsed query and admin.id', async () => {
      service.getModerationQueue.mockResolvedValue({ items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
      const res = await controller.getModerationQueue(
        { status: ListingStatus.PENDING_REVIEW, page: 1, limit: 20 },
        { admin: mockAdminModerator },
      );
      expect(service.getModerationQueue).toHaveBeenCalledWith(
        { status: ListingStatus.PENDING_REVIEW, page: 1, limit: 20 },
        mockAdminModerator.id,
      );
      expect(res.data.items).toEqual([]);
    });

    it('delegates claimListing to service', async () => {
      service.claimListing.mockResolvedValue({ id: 'l-1', lockInfo: { isLocked: true } });
      const res = await controller.claimListing('l-1', { admin: mockAdminModerator });
      expect(service.claimListing).toHaveBeenCalledWith('l-1', mockAdminModerator);
      expect(res.data.id).toBe('l-1');
    });

    it('delegates heartbeatListingLock to service', async () => {
      service.heartbeatListingLock.mockResolvedValue({ id: 'l-1', lockInfo: { isLocked: true } });
      const res = await controller.heartbeatListingLock('l-1', { admin: mockAdminModerator });
      expect(service.heartbeatListingLock).toHaveBeenCalledWith('l-1', mockAdminModerator);
      expect(res.data.id).toBe('l-1');
    });

    it('delegates releaseListingLock to service', async () => {
      service.releaseListingLock.mockResolvedValue({ id: 'l-1', lockInfo: { isLocked: false } });
      const res = await controller.releaseListingLock('l-1', { admin: mockAdminModerator });
      expect(service.releaseListingLock).toHaveBeenCalledWith('l-1', mockAdminModerator);
      expect(res.data.lockInfo.isLocked).toBe(false);
    });

    it('delegates forceUnlockListing to service', async () => {
      service.forceUnlockListing.mockResolvedValue({ id: 'l-1', lockInfo: { isLocked: false } });
      const dto = { reason: 'انقطاع اتصال المراجع' };
      const res = await controller.forceUnlockListing('l-1', dto, { admin: mockSuperAdmin });
      expect(service.forceUnlockListing).toHaveBeenCalledWith('l-1', mockSuperAdmin, dto);
      expect(res.data.lockInfo.isLocked).toBe(false);
    });

    it('delegates approveListing to service', async () => {
      service.approveListing.mockResolvedValue({ id: 'l-1', status: ListingStatus.ACTIVE, version: 2 });
      const dto = { version: 1, notes: 'معتمد' };
      const res = await controller.approveListing('l-1', dto, { admin: mockAdminModerator });
      expect(service.approveListing).toHaveBeenCalledWith('l-1', mockAdminModerator, dto);
      expect(res.data.status).toBe(ListingStatus.ACTIVE);
    });

    it('delegates rejectListing to service', async () => {
      service.rejectListing.mockResolvedValue({ id: 'l-1', status: ListingStatus.REJECTED, version: 2 });
      const dto = { version: 1, rejectionReason: 'صورة صك الملكية غير واضحة' };
      const res = await controller.rejectListing('l-1', dto, { admin: mockAdminModerator });
      expect(service.rejectListing).toHaveBeenCalledWith('l-1', mockAdminModerator, dto);
      expect(res.data.status).toBe(ListingStatus.REJECTED);
    });
  });
});

