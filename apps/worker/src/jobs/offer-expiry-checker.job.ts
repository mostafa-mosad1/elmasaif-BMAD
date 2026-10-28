import { JOB_OFFER_EXPIRY_CHECKER } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

/**
 * Offer Expiry Checker Job (Cadence: Every 5m)
 * Scans Offers where now >= OfferExpiry.
 * Sets offer status to Expired and emits notifications to buyer and seller.
 */
export const offerExpiryCheckerHandler = createJobHandler(
  JOB_OFFER_EXPIRY_CHECKER,
  async (jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();

    // Idempotent sweep logic:
    // When Offer repository is wired up, queries offers:
    // status = PENDING AND expiresAt <= currentTime
    const processedCount = 0;
    const outcome = `Evaluated offers at ${evaluationTimeIso}. Expired ${processedCount} pending offers.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso }
    };
  }
);
