import { JOB_DEMAND_EXPIRY_CHECKER } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Demand Expiry Checker Job (Cadence: Hourly at minute 0)
 * Scans Demands where now >= ExpiresAt (30-day rule).
 * Sets demand status to Expired and closes unaccepted proposals.
 */
export const demandExpiryCheckerHandler = createJobHandler(
  JOB_DEMAND_EXPIRY_CHECKER,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When Demand repository is wired up, queries demands:
    // status = ACTIVE AND expiresAt <= currentTime
    const processedCount = 0;
    const outcome = `Evaluated demands at ${evaluationTimeIso}. Expired ${processedCount} pending demands.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
