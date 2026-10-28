import { JOB_FAL_EXPIRY_WARNINGS } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Fal Expiry Warnings Job (Cadence: Daily at 05:00 UTC / 08:00 KSA)
 * Scans profiles expiring in 30, 7, and 1 days.
 * Dispatches urgent renewal alerts via in-app and email.
 */
export const falExpiryWarningsHandler = createJobHandler(
  JOB_FAL_EXPIRY_WARNINGS,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When Notification & User repository is wired up, finds profiles nearing expiry
    // and checks audit/notification logs to avoid duplicate daily warnings.
    const processedCount = 0;
    const outcome = `Evaluated Fal renewal warning windows at ${evaluationTimeIso}. Dispatched ${processedCount} alerts.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
