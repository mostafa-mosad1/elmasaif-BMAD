import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_ACCOUNT_DELETION_EXPIRY,
  ProfileStatus
} from '@elmasaif/shared';
import {
  accountDeletionExpiryHandler,
  createAccountDeletionExpiryLogic,
  AccountDeletionDbClient
} from '../account-deletion-expiry.job';
import { workerClock } from '../../clock';

describe('account-deletion-expiry Worker Job (Story 1.9 PDPL) (AC: 6)', () => {
  let mockDb: AccountDeletionDbClient;
  const mockNow = new Date('2026-11-15T12:00:00.000Z');

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockDb = {
      user: {
        findMany: vi.fn(),
        update: vi.fn()
      },
      knownDevice: {
        deleteMany: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };
  });

  it('permanently anonymizes PII and deletes known devices for expired cooling-off accounts', async () => {
    const expiredUser = {
      id: 'usr-12345678-abcd-ef01-2345-6789abcdef01',
      fullName: 'عبدالله السبيعي',
      mobileNumber: '+966501234567',
      nationalId: '1098765432',
      username: 'abdullah_subaie',
      email: 'abdullah@example.com',
      pendingEmail: null,
      passwordHash: 'argon2_hashed_secret',
      status: ProfileStatus.DELETION_PENDING,
      deletionDueAt: new Date('2026-11-15T11:00:00.000Z')
    };

    (mockDb.user.findMany as any).mockResolvedValueOnce([expiredUser]);
    (mockDb.user.update as any).mockResolvedValueOnce({ ...expiredUser, status: ProfileStatus.SOFT_DELETED });
    (mockDb.knownDevice!.deleteMany as any).mockResolvedValueOnce({ count: 2 });
    (mockDb.auditLog!.create as any).mockResolvedValueOnce({ id: 'audit-erased-1' });

    const logic = createAccountDeletionExpiryLogic(mockDb);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(1);
    expect(result.details?.anonymizedCount).toBe(1);

    // Verify user update called with anonymized data
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: expiredUser.id },
        data: expect.objectContaining({
          fullName: 'مستخدم محذوف',
          email: null,
          pendingEmail: null,
          status: ProfileStatus.SOFT_DELETED,
          username: `deleted_${expiredUser.id.slice(0, 8)}`
        })
      })
    );

    // Verify random phone, nationalId and password hash
    const updateCall = (mockDb.user.update as any).mock.calls[0][0];
    expect(updateCall.data.mobileNumber).toMatch(/^\+966000000000[a-f0-9]{8}$/);
    expect(updateCall.data.nationalId).toMatch(/^0000000000[a-f0-9]{8}$/);
    expect(updateCall.data.passwordHash).toMatch(/^ERASED_PDPL_/);

    // Verify KnownDevice cleanup
    expect(mockDb.knownDevice!.deleteMany).toHaveBeenCalledWith({
      where: { userId: expiredUser.id }
    });

    // Verify AuditLog creation
    expect(mockDb.auditLog!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'ACCOUNT_PERMANENTLY_ERASED',
          entityType: 'User',
          entityId: expiredUser.id
        })
      })
    );
  });

  it('executes cleanly via jobHandler wrapper conforming to JobExecutionResult', async () => {
    const mockJob: any = { id: 'test-job-id', name: JOB_ACCOUNT_DELETION_EXPIRY, data: {} };
    const execResult = await accountDeletionExpiryHandler([mockJob]);

    expect(execResult).toBeDefined();
    expect(execResult.jobName).toBe(JOB_ACCOUNT_DELETION_EXPIRY);
    expect(execResult.success).toBe(true);
    expect(typeof execResult.durationMs).toBe('number');
    expect(typeof execResult.processedCount).toBe('number');
  });
});

