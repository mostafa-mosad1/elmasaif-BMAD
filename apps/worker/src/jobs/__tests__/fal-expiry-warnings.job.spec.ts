import { describe, it, expect, vi } from 'vitest';
import {
  AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
  NOTIFICATION_FAL_EXPIRY_WARNING,
  ProfileStatus,
} from '@elmasaif/shared';
import {
  createFalExpiryWarningsLogic,
  type FalExpiryWarningsDbClient,
} from '../fal-expiry-warnings.job';

describe('Story 6.2: Fal Expiry Warnings Worker Job', () => {
  const currentTime = new Date('2026-11-10T05:00:00.000Z');

  // Exact 30, 7, and 1 days in UTC
  const expiry30Days = new Date('2026-12-10T05:00:00.000Z');
  const expiry7Days = new Date('2026-11-17T05:00:00.000Z');
  const expiry1Day = new Date('2026-11-11T05:00:00.000Z');
  const expiry15Days = new Date('2026-11-25T05:00:00.000Z');

  const createMockDb = (licenses: any[] = [], auditLogs: any[] = []) => {
    const calls = {
      auditLogs: [] as any[],
    };

    const db: FalExpiryWarningsDbClient = {
      falLicense: {
        findMany: vi.fn().mockImplementation((args: any) => {
          return Promise.resolve(
            licenses.filter((l) => {
              const statusMatch = args?.where?.status
                ? l.status === args.where.status
                : true;
              const dateMatch = args?.where?.expiryDate?.gt
                ? new Date(l.expiryDate) > args.where.expiryDate.gt
                : true;
              return statusMatch && dateMatch;
            }),
          );
        }),
      },
      auditLog: {
        findFirst: vi.fn().mockImplementation((args: any) => {
          const found = auditLogs.find((a) => {
            const matchEntity = args?.where?.entityId
              ? a.entityId === args.where.entityId
              : true;
            const matchAction = args?.where?.action
              ? a.action === args.where.action
              : true;
            const matchCreated = args?.where?.createdAt?.gte
              ? new Date(a.createdAt) >= args.where.createdAt.gte
              : true;
            return matchEntity && matchAction && matchCreated;
          });
          return Promise.resolve(found || null);
        }),
        create: vi.fn().mockImplementation((args: any) => {
          calls.auditLogs.push(args);
          return Promise.resolve(args);
        }),
      },
    };

    return { db, calls };
  };

  it('completes cleanly with processedCount = 0 when no active licenses near expiration', async () => {
    const { db } = createMockDb([]);
    const logic = createFalExpiryWarningsLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('0 alerts');
  });

  it('ignores licenses that are not in the 30, 7, or 1 day warning windows', async () => {
    const license15Days = {
      id: 'lic-15',
      profileId: 'prof-15',
      licenseNumber: '1100001515',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiry15Days,
      profile: { id: 'prof-15', userId: 'user-15' },
    };

    const { db, calls } = createMockDb([license15Days], []);
    const logic = createFalExpiryWarningsLogic(db);
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(0);
    expect(calls.auditLogs).toHaveLength(0);
  });

  it('dispatches warning audit log and event for 30, 7, and 1 day windows', async () => {
    const l30 = {
      id: 'lic-30',
      profileId: 'prof-30',
      licenseNumber: '1100000030',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiry30Days,
      profile: { id: 'prof-30', userId: 'user-30' },
    };
    const l7 = {
      id: 'lic-7',
      profileId: 'prof-7',
      licenseNumber: '1100000007',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiry7Days,
      profile: { id: 'prof-7', userId: 'user-7' },
    };
    const l1 = {
      id: 'lic-1',
      profileId: 'prof-1',
      licenseNumber: '1100000001',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiry1Day,
      profile: { id: 'prof-1', userId: 'user-1' },
    };

    const { db, calls } = createMockDb([l30, l7, l1], []);
    const mockDispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    };

    const logic = createFalExpiryWarningsLogic(db, {
      notificationDispatcher: mockDispatcher,
    });
    const result = await logic([], currentTime);

    expect(result.processedCount).toBe(3);
    expect(calls.auditLogs).toHaveLength(3);

    // Verify 30-day audit log
    const audit30 = calls.auditLogs.find((a: any) => a.data.entityId === 'lic-30');
    expect(audit30.data).toMatchObject({
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
      action: AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
      entityType: 'FalLicense',
      entityId: 'lic-30',
      payload: {
        daysRemaining: 30,
        licenseNumber: '1100000030',
      },
    });

    // Verify notification dispatches
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(3);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      NOTIFICATION_FAL_EXPIRY_WARNING,
      expect.objectContaining({
        daysRemaining: 30,
        licenseNumber: '1100000030',
        marketerUserId: 'user-30',
      }),
    );
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      NOTIFICATION_FAL_EXPIRY_WARNING,
      expect.objectContaining({
        daysRemaining: 7,
        licenseNumber: '1100000007',
        marketerUserId: 'user-7',
      }),
    );
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      NOTIFICATION_FAL_EXPIRY_WARNING,
      expect.objectContaining({
        daysRemaining: 1,
        licenseNumber: '1100000001',
        marketerUserId: 'user-1',
      }),
    );
  });

  it('idempotency guard: skips licenses already warned on the current calendar day', async () => {
    const l30 = {
      id: 'lic-30',
      profileId: 'prof-30',
      licenseNumber: '1100000030',
      status: ProfileStatus.ACTIVE,
      expiryDate: expiry30Days,
      profile: { id: 'prof-30', userId: 'user-30' },
    };

    const existingAuditLog = {
      id: 'audit-prior',
      actorId: 'SYSTEM',
      action: AUDIT_ACTION_FAL_EXPIRY_WARNING_DISPATCHED,
      entityType: 'FalLicense',
      entityId: 'lic-30',
      createdAt: new Date('2026-11-10T02:00:00.000Z'), // Earlier today
      payload: { daysRemaining: 30 },
    };

    const { db, calls } = createMockDb([l30], [existingAuditLog]);
    const mockDispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    };

    const logic = createFalExpiryWarningsLogic(db, {
      notificationDispatcher: mockDispatcher,
    });
    const result = await logic([], currentTime);

    // Should skip duplicate warning
    expect(result.processedCount).toBe(0);
    expect(calls.auditLogs).toHaveLength(0);
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });
});

