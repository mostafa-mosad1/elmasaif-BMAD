import { JOB_NOTIFICATION_RETENTION } from '@elmasaif/shared';
import { createJobHandler, type JobHandlerLogic } from './job-wrapper';

export interface NotificationRetentionDbClient {
  notification: {
    deleteMany: (args: { where: { createdAt: { lt: Date } } }) => Promise<{ count: number }>;
  };
}

/**
 * Notification Retention Job (Cadence: Daily at 02:00 UTC / FR-44, addendum.md §3)
 * Scans notifications older than 90 days.
 * Hard deletes old notification records to optimize table size.
 */
export function createNotificationRetentionLogic(db?: NotificationRetentionDbClient): JobHandlerLogic {
  return async (_jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();
    const ninetyDaysAgo = new Date(currentTime.getTime() - 90 * 24 * 60 * 60 * 1000);

    let processedCount = 0;
    if (db) {
      const result = await db.notification.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });
      processedCount = result.count;
    }

    const outcome = `Evaluated notifications older than ${ninetyDaysAgo.toISOString()} at ${evaluationTimeIso}. Purged ${processedCount} records.`;

    return {
      processedCount,
      outcome,
      details: {
        evaluationTime: evaluationTimeIso,
        retentionCutoff: ninetyDaysAgo.toISOString(),
      },
    };
  };
}

export const notificationRetentionHandler = createJobHandler(
  JOB_NOTIFICATION_RETENTION,
  createNotificationRetentionLogic(),
);
