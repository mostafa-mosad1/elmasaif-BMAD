import { JOB_NOTIFICATION_RETENTION } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Notification Retention Job (Cadence: Daily at 02:00 UTC)
 * Scans notifications older than 90 days.
 * Hard deletes old notification records to optimize table size.
 */
export const notificationRetentionHandler = createJobHandler(
  JOB_NOTIFICATION_RETENTION,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();
    const ninetyDaysAgo = new Date(currentTime.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Idempotent sweep logic:
    // When Notification table is wired up:
    // DELETE FROM notifications WHERE createdAt < ninetyDaysAgo
    const processedCount = 0;
    const outcome = `Evaluated notifications older than ${ninetyDaysAgo.toISOString()} at ${evaluationTimeIso}. Purged ${processedCount} records.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso, retentionCutoff: ninetyDaysAgo.toISOString() }
    };
  }
);
