import { HttpStatus } from '@nestjs/common';
import {
  AdminRole,
  OPERATIONAL_QUEUES_SUMMARY_RETRIEVED,
  TASK_CLAIM_ACQUIRED,
  TASK_CLAIM_FORCE_UNLOCKED,
  TASK_CLAIM_RELEASED,
  TASK_CLAIM_RENEWED,
} from '@elmasaif/shared';
import { AdminQueuesController } from '../admin-queues.controller';

describe('Story 8.3: AdminQueuesController (/api/v1/admin/queues)', () => {
  const mockAdmin = {
    id: 'admin-1',
    username: 'moderator_1',
    fullName: 'مشرف العمليات',
    role: AdminRole.SUPER_ADMIN,
    permissions: ['Tasks.View', 'Tasks.Claim', 'Tasks.ForceUnlock'],
  };

  const mockLockInfo = {
    isLocked: true,
    isLockedByCurrentAdmin: true,
    lockedByAdminId: mockAdmin.id,
    lockedByAdminName: mockAdmin.fullName,
    lockedAt: '2026-11-12T10:00:00.000Z',
    lockExpiresAt: '2026-11-12T10:15:00.000Z',
    remainingSeconds: 900,
  };

  const buildController = () => {
    const service: any = {
      getOperationalQueuesHub: jest.fn().mockResolvedValue({
        serverNow: '2026-11-12T10:00:00.000Z',
        leaseDurationSeconds: 900,
        heartbeatIntervalSeconds: 300,
        summary: {
          totalPending: 4,
          activelyLocked: 1,
          lockedByCurrentAdmin: 1,
          unlockedAvailable: 3,
        },
        queues: [],
        items: [],
        meta: { total: 4, page: 1, limit: 20, totalPages: 1 },
      }),
      claimTask: jest.fn().mockResolvedValue({
        code: TASK_CLAIM_ACQUIRED,
        queueType: 'LISTING',
        entityId: 'listing-1',
        lockInfo: mockLockInfo,
      }),
      heartbeatTask: jest.fn().mockResolvedValue({
        code: TASK_CLAIM_RENEWED,
        queueType: 'LISTING',
        entityId: 'listing-1',
        lockInfo: mockLockInfo,
      }),
      releaseTask: jest.fn().mockResolvedValue({
        code: TASK_CLAIM_RELEASED,
        queueType: 'LISTING',
        entityId: 'listing-1',
        lockInfo: {
          ...mockLockInfo,
          isLocked: false,
          isLockedByCurrentAdmin: false,
          lockedByAdminId: null,
          lockedByAdminName: null,
          lockedAt: null,
          lockExpiresAt: null,
          remainingSeconds: 0,
        },
      }),
      forceUnlockTask: jest.fn().mockResolvedValue({
        code: TASK_CLAIM_FORCE_UNLOCKED,
        queueType: 'DISPUTE',
        entityId: 'dispute-1',
        previousLockedByAdminId: 'admin-2',
        previousLockedByAdminName: 'مشرف سابق',
        reason: 'انتهاء مناوبة المشرف السابق مع وجود حالة طارئة',
        lockInfo: {
          ...mockLockInfo,
          isLocked: false,
          isLockedByCurrentAdmin: false,
          lockedByAdminId: null,
          lockedByAdminName: null,
          lockedAt: null,
          lockExpiresAt: null,
          remainingSeconds: 0,
        },
      }),
    };

    const controller = new AdminQueuesController(service);
    return { controller, service };
  };

  it('GET /admin/queues returns summary and queue items', async () => {
    const { controller, service } = buildController();
    const res = await controller.getQueuesHub(
      { lockState: 'ALL', page: 1, limit: 20 },
      { admin: mockAdmin },
    );

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.code).toBe(OPERATIONAL_QUEUES_SUMMARY_RETRIEVED);
    expect(res.data.summary.totalPending).toBe(4);
    expect(service.getOperationalQueuesHub).toHaveBeenCalledWith(mockAdmin, {
      lockState: 'ALL',
      page: 1,
      limit: 20,
    });
  });

  it('POST /admin/queues/:queue/:id/claim delegates to TaskClaimLockService.claimTask', async () => {
    const { controller, service } = buildController();
    const res = await controller.claimQueueTask('listings', 'listing-1', {
      admin: mockAdmin,
    });

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.code).toBe(TASK_CLAIM_ACQUIRED);
    expect(res.data.lockInfo.remainingSeconds).toBe(900);
    expect(service.claimTask).toHaveBeenCalledWith('listings', 'listing-1', mockAdmin);
  });

  it('POST /admin/queues/:queue/:id/heartbeat delegates to TaskClaimLockService.heartbeatTask', async () => {
    const { controller, service } = buildController();
    const res = await controller.heartbeatQueueTask('listings', 'listing-1', {
      admin: mockAdmin,
    });

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.code).toBe(TASK_CLAIM_RENEWED);
    expect(service.heartbeatTask).toHaveBeenCalledWith('listings', 'listing-1', mockAdmin);
  });

  it('POST /admin/queues/:queue/:id/release delegates to TaskClaimLockService.releaseTask', async () => {
    const { controller, service } = buildController();
    const res = await controller.releaseQueueTask('listings', 'listing-1', {
      admin: mockAdmin,
    });

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.code).toBe(TASK_CLAIM_RELEASED);
    expect(res.data.lockInfo.isLocked).toBe(false);
    expect(service.releaseTask).toHaveBeenCalledWith('listings', 'listing-1', mockAdmin);
  });

  it('POST /admin/queues/:queue/:id/force-unlock delegates to TaskClaimLockService.forceUnlockTask with reason', async () => {
    const { controller, service } = buildController();
    const reason = 'انتهاء مناوبة المشرف السابق مع وجود حالة طارئة';
    const res = await controller.forceUnlockQueueTask(
      'disputes',
      'dispute-1',
      { reason },
      { admin: mockAdmin },
    );

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.code).toBe(TASK_CLAIM_FORCE_UNLOCKED);
    expect(res.data.previousLockedByAdminId).toBe('admin-2');
    expect(service.forceUnlockTask).toHaveBeenCalledWith(
      'disputes',
      'dispute-1',
      mockAdmin,
      reason,
    );
  });
});

