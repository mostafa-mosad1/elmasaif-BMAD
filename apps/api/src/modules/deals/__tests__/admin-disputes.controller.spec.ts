import { Test, TestingModule } from '@nestjs/testing';
import { AdminDisputesController } from '../admin-disputes.controller';
import { DisputesService } from '../disputes.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';

describe('AdminDisputesController (Story 5.6)', () => {
  let controller: AdminDisputesController;
  let service: any;

  const adminActor: any = { id: 'admin-super-1', fullName: 'Super Admin' };
  const mockReq: any = { admin: adminActor };

  beforeEach(async () => {
    service = {
      getDisputesQueue: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getDisputeById: jest.fn().mockResolvedValue({ id: 'disp-1' }),
      claimDispute: jest.fn().mockResolvedValue({ id: 'disp-1', lockedByAdminId: adminActor.id }),
      renewDisputeLock: jest.fn().mockResolvedValue({ id: 'disp-1' }),
      releaseDisputeLock: jest.fn().mockResolvedValue({ released: true }),
      forceUnlockDispute: jest.fn().mockResolvedValue({ unlocked: true }),
      adjudicateDispute: jest.fn().mockResolvedValue({ disputeId: 'disp-1', status: 'RESOLVED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDisputesController],
      providers: [
        { provide: DisputesService, useValue: service },
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminDisputesController>(AdminDisputesController);
  });

  it('getQueue queries queue with pagination and admin id', async () => {
    const res = await controller.getQueue('OPEN', 1, 20, mockReq);
    expect(res.statusCode).toBe(200);
    expect(service.getDisputesQueue).toHaveBeenCalledWith(
      { status: 'OPEN', page: 1, limit: 20 },
      adminActor.id,
    );
  });

  it('getById returns dispute details', async () => {
    const res = await controller.getById('disp-1', mockReq);
    expect(res.statusCode).toBe(200);
    expect(service.getDisputeById).toHaveBeenCalledWith('disp-1', adminActor.id);
  });

  it('claim acquires claim lock', async () => {
    const res = await controller.claim('disp-1', mockReq);
    expect(res.statusCode).toBe(200);
    expect(service.claimDispute).toHaveBeenCalledWith('disp-1', adminActor.id);
  });

  it('renew extends claim lease', async () => {
    const res = await controller.renew('disp-1', mockReq);
    expect(res.statusCode).toBe(200);
    expect(service.renewDisputeLock).toHaveBeenCalledWith('disp-1', adminActor.id);
  });

  it('release drops claim lease', async () => {
    const res = await controller.release('disp-1', mockReq);
    expect(res.statusCode).toBe(200);
    expect(service.releaseDisputeLock).toHaveBeenCalledWith('disp-1', adminActor.id);
  });

  it('forceUnlock overrides active lock with reason', async () => {
    const res = await controller.forceUnlock(
      'disp-1',
      { reason: 'Administrator unavailable for urgent adjudication' },
      mockReq,
    );
    expect(res.statusCode).toBe(200);
    expect(service.forceUnlockDispute).toHaveBeenCalledWith(
      'disp-1',
      adminActor.id,
      'Administrator unavailable for urgent adjudication',
    );
  });

  it('adjudicate issues binding verdict', async () => {
    const res = await controller.adjudicate(
      'disp-1',
      { action: 'COMPLETE', notes: 'Transfer verified by finance audit' },
      mockReq,
    );
    expect(res.statusCode).toBe(200);
    expect(service.adjudicateDispute).toHaveBeenCalledWith(
      'disp-1',
      adminActor,
      { action: 'COMPLETE', notes: 'Transfer verified by finance audit' },
    );
  });
});

