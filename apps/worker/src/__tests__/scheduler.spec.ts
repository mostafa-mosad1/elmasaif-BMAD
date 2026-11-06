import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_PAYMENT_DEADLINE_EXPIRY,
  JOB_OFFER_EXPIRY_CHECKER,
  JOB_DEMAND_EXPIRY_CHECKER,
  JOB_FAL_LICENSE_EXPIRY,
  JOB_FAL_EXPIRY_WARNINGS,
  JOB_OWNER_FEE_REMINDERS,
  JOB_NOTIFICATION_RETENTION,
  JOB_ACCOUNT_DELETION_EXPIRY,
  JOB_BACKUP_OFFER_RECONCILIATION,
  BACKGROUND_JOB_DEFINITIONS
} from '@elmasaif/shared';
import { WorkerScheduler } from '../scheduler';

// Mock pg-boss
vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(() => {
    const listeners: Record<string, ((...args: any[]) => any)[]> = {};

    return {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue(undefined),
      work: vi.fn().mockResolvedValue('worker-id-123'),
      on: vi.fn().mockImplementation((event: string, handler: (...args: any[]) => any) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      }),
      emit: vi.fn().mockImplementation((event: string, ...args: any[]) => {
        (listeners[event] || []).forEach((fn) => fn(...args));
      })
    };
  });

  return {
    default: MockPgBoss
  };
});

describe('WorkerScheduler (AC: 1, 2)', () => {
  let scheduler: WorkerScheduler;
  let errorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    scheduler = new WorkerScheduler({
      databaseUrl: 'postgresql://test_user:test_pass@localhost:5432/test_db',
      bossSchema: 'pgboss',
      gracefulShutdownTimeoutMs: 10000
    });
  });

  it('initializes and starts PgBoss successfully', async () => {
    await scheduler.start();

    const boss = scheduler.getBossInstance();
    expect(boss.start).toHaveBeenCalledTimes(1);
    expect(boss.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('registers all 9 cataloged jobs with exact crons and singleton keys', async () => {
    await scheduler.start();

    const boss = scheduler.getBossInstance();
    const expectedJobNames = [
      JOB_PAYMENT_DEADLINE_EXPIRY,
      JOB_OFFER_EXPIRY_CHECKER,
      JOB_DEMAND_EXPIRY_CHECKER,
      JOB_FAL_LICENSE_EXPIRY,
      JOB_FAL_EXPIRY_WARNINGS,
      JOB_OWNER_FEE_REMINDERS,
      JOB_NOTIFICATION_RETENTION,
      JOB_ACCOUNT_DELETION_EXPIRY,
      JOB_BACKUP_OFFER_RECONCILIATION
    ];

    expect(boss.schedule).toHaveBeenCalledTimes(9);

    for (const jobName of expectedJobNames) {
      const def = BACKGROUND_JOB_DEFINITIONS[jobName];
      expect(boss.schedule).toHaveBeenCalledWith(
        jobName,
        def.cadence,
        {},
        expect.objectContaining({
          singletonKey: def.singletonKey,
          retryLimit: def.retryLimit,
          retryDelay: def.retryDelay,
          retryBackoff: def.retryBackoff,
          expireInMinutes: def.expireInMinutes
        })
      );
    }
  });

  it('registers workers for all 9 cataloged queues', async () => {
    await scheduler.start();

    const boss = scheduler.getBossInstance();
    const expectedJobNames = [
      JOB_PAYMENT_DEADLINE_EXPIRY,
      JOB_OFFER_EXPIRY_CHECKER,
      JOB_DEMAND_EXPIRY_CHECKER,
      JOB_FAL_LICENSE_EXPIRY,
      JOB_FAL_EXPIRY_WARNINGS,
      JOB_OWNER_FEE_REMINDERS,
      JOB_NOTIFICATION_RETENTION,
      JOB_ACCOUNT_DELETION_EXPIRY,
      JOB_BACKUP_OFFER_RECONCILIATION
    ];

    expect(boss.work).toHaveBeenCalledTimes(9);
    for (const jobName of expectedJobNames) {
      expect(boss.work).toHaveBeenCalledWith(jobName, expect.any(Function));
    }
  });

  it('performs graceful shutdown with configured timeout on stop()', async () => {
    await scheduler.start();
    await scheduler.stop();

    const boss = scheduler.getBossInstance();
    expect(boss.stop).toHaveBeenCalledWith({
      graceful: true,
      timeout: 10000
    });
  });

  it('handles boss error events via console.error', async () => {
    await scheduler.start();
    const boss = scheduler.getBossInstance();

    const testError = new Error('Test PG Connection Drop');
    boss.emit('error', testError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PgBoss Error]'),
      testError
    );
  });
});
