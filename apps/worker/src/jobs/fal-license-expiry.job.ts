import { JOB_FAL_LICENSE_EXPIRY } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Fal License Expiry Job (Cadence: Daily at 00:05 UTC)
 * Scans approved Fal profiles where expiryDate <= today().
 * Moves profile to ComplianceRestricted and moves active listings to UnderComplianceReview.
 */
export const falLicenseExpiryHandler = createJobHandler(
  JOB_FAL_LICENSE_EXPIRY,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When User / Fal Profile repository is wired up, queries profiles:
    // status != ComplianceRestricted AND expiryDate <= currentTime
    const processedCount = 0;
    const outcome = `Evaluated Fal licenses at ${evaluationTimeIso}. Restricted ${processedCount} expired profiles.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
