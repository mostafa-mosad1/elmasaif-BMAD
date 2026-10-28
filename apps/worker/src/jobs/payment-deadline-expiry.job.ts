import { JOB_PAYMENT_DEADLINE_EXPIRY } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Payment Deadline Expiry Job (Cadence: Every 60s)
 * Scans Deals where now >= PaymentDeadline.
 * Cancels deals lacking confirmed proofs, subject to 12h grace period for unreviewed on-time proofs.
 * Reverts listing to Active and logs DealCancelledByTimeout audit record.
 */
export const paymentDeadlineExpiryHandler = createJobHandler(
  JOB_PAYMENT_DEADLINE_EXPIRY,
  async (jobs, currentTime) => {
    // Current time evaluated against workerClock.now()
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When Prisma / Deal repository is wired up in Epic 3, queries deals:
    // status = PENDING_PAYMENT AND paymentDeadline <= currentTime
    const processedCount = 0;
    const outcome = `Evaluated deals at ${evaluationTimeIso}. Expired ${processedCount} pending deals.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
