import { describe, it, expect, vi } from 'vitest';
import {
  createNotificationRetentionLogic,
  NotificationRetentionDbClient,
} from '../notification-retention.job';

describe('Notification Retention Job', () => {
  it('should purge notifications older than 90 days from the evaluation time', async () => {
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 142 });
    const mockDb: NotificationRetentionDbClient = {
      notification: {
        deleteMany: mockDeleteMany,
      },
    };

    const logic = createNotificationRetentionLogic(mockDb);
    const fixedNow = new Date('2026-11-13T02:00:00.000Z');
    const expectedNinetyDaysAgo = new Date(
      fixedNow.getTime() - 90 * 24 * 60 * 60 * 1000,
    );

    const result = await logic([], fixedNow);

    expect(result.processedCount).toBe(142);
    expect(result.outcome).toContain('Purged 142 records');
    expect(result.details?.retentionCutoff).toBe(expectedNinetyDaysAgo.toISOString());

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expectedNinetyDaysAgo,
        },
      },
    });
  });

  it('should run idempotently and report 0 when no old notifications exist', async () => {
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockDb: NotificationRetentionDbClient = {
      notification: {
        deleteMany: mockDeleteMany,
      },
    };

    const logic = createNotificationRetentionLogic(mockDb);
    const fixedNow = new Date('2026-11-13T02:00:00.000Z');

    const result = await logic([], fixedNow);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('Purged 0 records');
  });

  it('should safely handle execution when db client is not provided (standalone dry run)', async () => {
    const logic = createNotificationRetentionLogic();
    const fixedNow = new Date('2026-11-13T02:00:00.000Z');

    const result = await logic([], fixedNow);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('Purged 0 records');
  });
});

