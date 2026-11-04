import { JOB_DEMAND_EXPIRY_CHECKER, DemandStatus, ProposalStatus } from '@elmasaif/shared';
import { createJobHandler } from './job-wrapper';

export interface DemandExpiryDbClient {
  demand: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  auditLog?: {
    create: (args: any) => Promise<any>;
  };
  proposal?: {
    updateMany: (args: any) => Promise<any>;
  };
}

/**
 * Demand expiry sweep (Story 3.6 / FR-21, AD-7). Kept as a factory so the logic is
 * unit-testable with an injected client — the worker has no Prisma dependency and no
 * expiry job is runtime-db-wired yet (same shape as account-deletion-expiry).
 *
 * Idempotent by construction: only `ACTIVE` demands whose `expiresAt` has passed are
 * selected, so an already-EXPIRED demand is never re-processed by a later hourly run.
 */
export function createDemandExpiryCheckerLogic(db?: DemandExpiryDbClient) {
  return async (jobs: any[], currentTime: Date) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;

    if (db) {
      const staleDemands = await db.demand.findMany({
        where: {
          status: DemandStatus.ACTIVE,
          expiresAt: { lte: currentTime },
        },
      });

      for (const demand of staleDemands) {
        await db.demand.update({
          where: { id: demand.id },
          data: { status: DemandStatus.EXPIRED },
        });

        // Story 3.7 / FR-58 (AD-7 job #3 closing half): on expiry, close the demand's
        // unaccepted proposals. A selected proposal (SELECTED_PENDING_FINAL_ADMIN_APPROVAL)
        // is left for Epic 5, so only every OTHER status transitions to CLOSED.
        if (db.proposal) {
          await db.proposal.updateMany({
            where: {
              demandId: demand.id,
              status: { notIn: [ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL] },
            },
            data: { status: ProposalStatus.CLOSED },
          });
        }

        if (db.auditLog) {
          await db.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              actorType: 'SYSTEM',
              action: 'DEMAND_EXPIRED',
              entityType: 'Demand',
              entityId: demand.id,
              payload: {
                reason: `30-day demand window elapsed (expiresAt ${demand.expiresAt instanceof Date ? demand.expiresAt.toISOString() : String(demand.expiresAt)})`,
                expiredAt: evaluationTimeIso,
              },
            },
          });
        }

        processedCount++;
      }
    }

    const outcome = `Evaluated demands at ${evaluationTimeIso}. Expired ${processedCount} pending demands.`;

    return {
      processedCount,
      outcome,
      details: { evaluationTime: evaluationTimeIso, processedCount },
    };
  };
}

/**
 * Demand Expiry Checker Job (Cadence: Hourly at minute 0)
 * Scans Demands where now >= ExpiresAt (30-day rule).
 * Sets demand status to Expired and closes unaccepted proposals.
 */
export const demandExpiryCheckerHandler = createJobHandler(
  JOB_DEMAND_EXPIRY_CHECKER,
  createDemandExpiryCheckerLogic()
);
