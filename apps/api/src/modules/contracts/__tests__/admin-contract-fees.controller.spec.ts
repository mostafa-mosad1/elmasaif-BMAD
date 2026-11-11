import { Test, TestingModule } from '@nestjs/testing';
import { AdminContractFeesController } from '../admin-contract-fees.controller';
import { AdminContractFeesService } from '../admin-contract-fees.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import { AdminRole } from '@elmasaif/shared';

describe('AdminContractFeesController (Story 7.3)', () => {
  let controller: AdminContractFeesController;
  let service: any;

  const mockAdmin = {
    id: 'admin-1',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review', 'Contracts.Manage'],
  };

  const mockReq = {
    admin: mockAdmin,
  };

  const sampleUuid = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    service = {
      getQueue: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getDetail: jest.fn().mockResolvedValue({ payment: { id: sampleUuid } }),
      getProofDownloadUrl: jest.fn().mockResolvedValue({ downloadUrl: 'https://test/url', expiresInSeconds: 300 }),
      claimLock: jest.fn().mockResolvedValue({ isLocked: true }),
      heartbeatLock: jest.fn().mockResolvedValue({ isLocked: true }),
      releaseLock: jest.fn().mockResolvedValue({ isLocked: false }),
      confirmPayment: jest.fn().mockResolvedValue({ success: true }),
      rejectPayment: jest.fn().mockResolvedValue({ success: true }),
      forceUnlock: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminContractFeesController],
      providers: [
        { provide: AdminContractFeesService, useValue: service },
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminContractFeesController>(AdminContractFeesController);
  });

  it('delegates getQueue to service', async () => {
    const query = { page: 1, limit: 20, status: 'ALL' };
    await controller.getQueue(mockReq, query);
    expect(service.getQueue).toHaveBeenCalledWith(query, mockAdmin.id);
  });

  it('delegates getDetail to service', async () => {
    await controller.getDetail(mockReq, sampleUuid);
    expect(service.getDetail).toHaveBeenCalledWith(sampleUuid, mockAdmin.id);
  });

  it('delegates getProofDownloadUrl to service', async () => {
    await controller.getProofDownloadUrl(mockReq, sampleUuid);
    expect(service.getProofDownloadUrl).toHaveBeenCalledWith(sampleUuid, mockAdmin.id);
  });

  it('delegates claimLock to service', async () => {
    await controller.claimLock(mockReq, sampleUuid);
    expect(service.claimLock).toHaveBeenCalledWith(sampleUuid, mockAdmin.id);
  });

  it('delegates heartbeatLock to service', async () => {
    await controller.heartbeatLock(mockReq, sampleUuid);
    expect(service.heartbeatLock).toHaveBeenCalledWith(sampleUuid, mockAdmin.id);
  });

  it('delegates releaseLock to service', async () => {
    await controller.releaseLock(mockReq, sampleUuid);
    expect(service.releaseLock).toHaveBeenCalledWith(sampleUuid, mockAdmin.id);
  });

  it('delegates confirmPayment to service', async () => {
    await controller.confirmPayment(mockReq, sampleUuid);
    expect(service.confirmPayment).toHaveBeenCalledWith(sampleUuid, mockAdmin);
  });

  it('delegates rejectPayment to service', async () => {
    const body = { reason: 'إشعار غير واضح' };
    await controller.rejectPayment(mockReq, sampleUuid, body);
    expect(service.rejectPayment).toHaveBeenCalledWith(sampleUuid, mockAdmin, body);
  });

  it('delegates forceUnlock to service', async () => {
    const body = { reason: 'فك إجباري لانتهاء الدوام' };
    await controller.forceUnlock(mockReq, sampleUuid, body);
    expect(service.forceUnlock).toHaveBeenCalledWith(sampleUuid, mockAdmin, body);
  });
});

