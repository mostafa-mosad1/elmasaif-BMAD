import { Test, TestingModule } from '@nestjs/testing';
import { AdminOwnerRequestsController } from '../admin-owner-requests.controller';
import { AdminOwnerRequestsService } from '../admin-owner-requests.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import { AdminRole, OwnerListingRequestStatus } from '@elmasaif/shared';

describe('AdminOwnerRequestsController', () => {
  let controller: AdminOwnerRequestsController;
  let service: any;

  const mockAdmin = {
    id: 'admin-1',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review', 'Contracts.Manage'],
  };

  const mockReq = {
    admin: mockAdmin,
  };

  beforeEach(async () => {
    service = {
      getQueue: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getDetail: jest.fn().mockResolvedValue({ id: 'req-1' }),
      claimLock: jest.fn().mockResolvedValue({ isLocked: true }),
      heartbeatLock: jest.fn().mockResolvedValue({ isLocked: true }),
      releaseLock: jest.fn().mockResolvedValue({ isLocked: false }),
      forceUnlock: jest.fn().mockResolvedValue({ success: true }),
      dispatchContract: jest.fn().mockResolvedValue({ success: true, contractId: 'c-1' }),
      rejectRequest: jest.fn().mockResolvedValue({ success: true }),
      requestModification: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOwnerRequestsController],
      providers: [
        { provide: AdminOwnerRequestsService, useValue: service },
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminOwnerRequestsController>(AdminOwnerRequestsController);
  });

  it('delegates getQueue to service', async () => {
    const query = { page: 1, limit: 20 };
    await controller.getQueue(mockReq, query);
    expect(service.getQueue).toHaveBeenCalledWith(query, mockAdmin.id);
  });

  it('delegates getDetail to service', async () => {
    await controller.getDetail(mockReq, '11111111-1111-1111-1111-111111111111');
    expect(service.getDetail).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin.id);
  });

  it('delegates claimLock to service', async () => {
    await controller.claimLock(mockReq, '11111111-1111-1111-1111-111111111111');
    expect(service.claimLock).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin.id);
  });

  it('delegates heartbeatLock to service', async () => {
    await controller.heartbeatLock(mockReq, '11111111-1111-1111-1111-111111111111');
    expect(service.heartbeatLock).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin.id);
  });

  it('delegates releaseLock to service', async () => {
    await controller.releaseLock(mockReq, '11111111-1111-1111-1111-111111111111');
    expect(service.releaseLock).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin.id);
  });

  it('delegates forceUnlock to service', async () => {
    const body = { reason: 'فحص عاجل' };
    await controller.forceUnlock(mockReq, '11111111-1111-1111-1111-111111111111', body);
    expect(service.forceUnlock).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin, body);
  });

  it('delegates dispatchContract to service', async () => {
    const body = { templateId: '77777777-0001-4000-8000-000000000001', contractFee: 1000 };
    await controller.dispatchContract(mockReq, '11111111-1111-1111-1111-111111111111', body);
    expect(service.dispatchContract).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin, body);
  });

  it('delegates rejectRequest to service', async () => {
    const body = { reason: 'الصك غير واضح' };
    await controller.rejectRequest(mockReq, '11111111-1111-1111-1111-111111111111', body);
    expect(service.rejectRequest).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin, body);
  });

  it('delegates requestModification to service', async () => {
    const body = { notes: 'يرجى توضيح المساحة' };
    await controller.requestModification(mockReq, '11111111-1111-1111-1111-111111111111', body);
    expect(service.requestModification).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', mockAdmin, body);
  });
});
