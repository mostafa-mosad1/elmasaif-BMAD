import {
  EXPIRABLE_OFFER_STATUSES,
  JOB_OFFER_EXPIRY_CHECKER,
  OFFER_HISTORY_ACTIONS,
  OfferStatus,
} from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

export interface OfferExpiryDbClient {
  offer: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  offerHistory?: {
    create: (args: any) => Promise<any>;
  };
  auditLog?: {
    create: (args: any) => Promise<any>;
  };
}

/**
 * Offer expiry sweep (Story 4.2 / FR-26, AD-7 job #2). Kept as a factory so the logic is
 * unit-testable through an injected client — the worker has no Prisma dependency and no expiry
 * job is runtime-db-wired yet (same shape as `demand-expiry-checker`).
 *
 * Idempotent by construction: only `EXPIRABLE_OFFER_STATUSES` whose `expiresAt` has passed are
 * selected, so an already-EXPIRED offer is never re-processed by a later run.
 *
 * The target set is deliberately `EXPIRABLE_OFFER_STATUSES`, **not** `ACTIVE_OFFER_STATUSES`:
 * `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` is a mutually-agreed offer — answered, not unanswered —
 * and must survive until Story 5.1 binds it into a `Deal` (the same exclusion
 * `demand-expiry-checker` applies to selected proposals).
 */
export function createOfferExpiryCheckerLogic(db?: OfferExpiryDbClient) {
  return async (jobs: any[], currentTime: Date) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;

    if (db) {
      const staleOffers = await db.offer.findMany({
        where: {
          status: { in: [...EXPIRABLE_OFFER_STATUSES] },
          expiresAt: { lte: currentTime },
        },
      });

      for (const offer of staleOffers) {
        await db.offer.update({
          where: { id: offer.id },
          data: {
            status: OfferStatus.EXPIRED,
            version: { increment: 1 },
          },
        });

        if (db.offerHistory) {
          await db.offerHistory.create({
            data: {
              offerId: offer.id,
              action: OFFER_HISTORY_ACTIONS.EXPIRED,
              priceSnapshot: Number(offer.offerPrice),
              notes: null,
              roundNumber: Number(offer.negotiationRound ?? 0),
            },
          });
        }

        if (db.auditLog) {
          await db.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              actorType: 'SYSTEM',
              action: OFFER_HISTORY_ACTIONS.EXPIRED,
              entityType: 'Offer',
              entityId: offer.id,
              payload: {
                reason: `7-day offer window elapsed (expiresAt ${
                  offer.expiresAt instanceof Date
                    ? offer.expiresAt.toISOString()
                    : String(offer.expiresAt)
                })`,
                previousStatus: offer.status,
                expiredAt: evaluationTimeIso,
              },
            },
          });
        }

        processedCount++;
      }
    }

    const outcome = `Evaluated offers at ${evaluationTimeIso}. Expired ${processedCount} pending offers.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso, processedCount },
    };
  };
}

/**
 * Offer Expiry Checker Job (Cadence: Every 5m)
 * Scans Offers where now >= OfferExpiry for every unanswered status.
 * Sets offer status to Expired with a history + SYSTEM audit row.
 */
export const offerExpiryCheckerHandler = createJobHandler(
  JOB_OFFER_EXPIRY_CHECKER,
  createOfferExpiryCheckerLogic(),
);
