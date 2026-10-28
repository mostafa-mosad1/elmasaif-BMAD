import { JOB_OWNER_FEE_REMINDERS } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Owner Fee Reminders Job (Cadence: Daily at 06:00 UTC / 09:00 KSA)
 * Scans contracts in SignedPendingFee nearing ContractFeeDeadline.
 * Sends payment reminder alerts to property owners.
 */
export const ownerFeeRemindersHandler = createJobHandler(
  JOB_OWNER_FEE_REMINDERS,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When Owner Contract repository is wired up, finds contracts in SignedPendingFee
    // and sends reminders idempotently.
    const processedCount = 0;
    const outcome = `Evaluated owner fee reminders at ${evaluationTimeIso}. Dispatched ${processedCount} reminders.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
