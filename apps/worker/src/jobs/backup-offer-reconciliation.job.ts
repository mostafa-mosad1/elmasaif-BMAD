import {
  JOB_BACKUP_OFFER_RECONCILIATION,
  ListingStatus,
  OFFER_HISTORY_ACTIONS,
  OfferStatus,
} from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

export interface BackupOfferReconciliationDbClient {
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
 * Backup offer reconciliation sweep (Story 4.3 / FR-27, AD-7). Kept as a factory so the logic is
 * unit-testable through an injected client — the worker has no Prisma dependency and no job in
 * this repo is runtime-db-wired yet (same shape as `offer-expiry-checker`).
 *
 * This is the only automatic closure path that exists before Story 5.1 wires the synchronous
 * `BackupOffersService.closeRemainingBackupOffersForListing` call inside its completion
 * transaction. It closes approved, never-activated backup offers whose listing reached `SOLD`,
 * because PRD FR-32 mandates that "all competing/backup offers = Closed" once the primary deal
 * completes.
 *
 * Idempotent by construction: only offers still in `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` with
 * `activatedAt = null` are selected, so an already-`CLOSED_BACKUP` offer is never re-processed.
 * The `activatedAt = null` guard is also what protects the winning candidate — Story 5.1 owns its
 * terminal transition.
 */
export function createBackupOfferReconciliationLogic(db?: BackupOfferReconciliationDbClient) {
  return async (jobs: any[], currentTime: Date) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;

    if (db) {
      const staleBackups = await db.offer.findMany({
        where: {
          isBackup: true,
          status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
          activatedAt: null,
          listing: { status: ListingStatus.SOLD },
        },
      });

      for (const offer of staleBackups) {
        await db.offer.update({
          where: { id: offer.id },
          data: {
            status: OfferStatus.CLOSED_BACKUP,
            version: { increment: 1 },
          },
        });

        if (db.offerHistory) {
          await db.offerHistory.create({
            data: {
              offerId: offer.id,
              action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED,
              priceSnapshot: Number(offer.offerPrice),
              notes: 'PRIMARY_DEAL_COMPLETED',
              roundNumber: Number(offer.negotiationRound ?? 0),
            },
          });
        }

        if (db.auditLog) {
          await db.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              actorType: 'SYSTEM',
              action: 'OFFER_BACKUP_CLOSED',
              entityType: 'Offer',
              entityId: offer.id,
              payload: {
                listingId: offer.listingId ?? offer.listing?.id ?? null,
                reason: 'PRIMARY_DEAL_COMPLETED',
                previousStatus: offer.status,
                closedAt: evaluationTimeIso,
              },
            },
          });
        }

        processedCount++;
      }
    }

    const outcome = `Evaluated backup offers at ${evaluationTimeIso}. Closed ${processedCount} backup offers whose primary deal completed.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso, processedCount },
    };
  };
}

/**
 * Backup Offer Reconciliation Job (Cadence: Every 10m)
 * Scans approved backup offers held in reserve on a `SOLD` listing and closes them, writing a
 * history row plus a SYSTEM audit row per offer. The synchronous primitive in
 * `BackupOffersService` is Story 5.1's correctness path; this sweep keeps the AC demonstrable
 * until then and repairs anything a future code path misses.
 */
export const backupOfferReconciliationHandler = createJobHandler(
  JOB_BACKUP_OFFER_RECONCILIATION,
  createBackupOfferReconciliationLogic(),
);
