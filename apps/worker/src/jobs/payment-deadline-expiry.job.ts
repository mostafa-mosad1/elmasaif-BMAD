import {
  ACTIVE_DEAL_STATUSES,
  DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
  DEAL_CANCELLED_BY_TIMEOUT,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  JOB_PAYMENT_DEADLINE_EXPIRY,
  ListingStatus,
  evaluatePostDeadlineOutcome,
  hasPaymentInGracePeriod,
  isDealEligibleForTimeout,
} from '@elmasaif/shared';
import { createJobHandler, type JobHandlerLogic } from './job-wrapper';

export interface PaymentDeadlineExpiryDbClient {
  deal: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  listing: {
    update: (args: any) => Promise<any>;
  };
  payment: {
    updateMany?: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  auditLog?: {
    create: (args: any) => Promise<any>;
  };
}

/**
 * Payment Deadline Expiry Job (Cadence: Every 60s / FR-33, AD-7, AD-11, OQ-13).
 *
 * Scans active deals past payment deadline.
 * Cancels expired deals lacking valid or protected payment proofs, reverting listing to Active.
 * Protects on-time uploads (PROOF_UPLOADED / UNDER_REVIEW), active disputes, and 12h grace periods.
 * Writes audit log entries for all cancellations.
 */
export function createPaymentDeadlineExpiryLogic(
  db?: PaymentDeadlineExpiryDbClient,
  options?: { graceHours?: number },
): JobHandlerLogic {
  const graceHours = options?.graceHours ?? 12;

  return async (_jobs, currentTime) => {
    const evaluationTimeIso = currentTime.toISOString();
    let processedCount = 0;
    let cancelledDealsCount = 0;
    let expiredPaymentsCount = 0;

    if (db) {
      const candidateDeals = await db.deal.findMany({
        where: {
          status: { in: [...ACTIVE_DEAL_STATUSES] },
          paymentDeadline: { lte: currentTime },
        },
        include: {
          payments: true,
          disputes: true,
          listing: true,
        },
      });

      for (const deal of candidateDeals) {
        // Run pure eligibility check through all 3 protection gates
        if (!isDealEligibleForTimeout(deal, currentTime, graceHours)) {
          continue;
        }

        // Expire eligible individual payments:
        // - PENDING payments past deadline
        // - REJECTED payments whose 12-hour grace period elapsed
        const updatedPayments = [...(deal.payments || [])];
        for (let i = 0; i < updatedPayments.length; i++) {
          const payment = updatedPayments[i];
          if (
            payment.status === DEAL_PAYMENT_STATUS.PENDING ||
            (payment.status === DEAL_PAYMENT_STATUS.REJECTED &&
              !hasPaymentInGracePeriod([payment], deal.paymentDeadline, currentTime, graceHours))
          ) {
            await db.payment.update({
              where: { id: payment.id },
              data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
            });
            updatedPayments[i] = { ...payment, status: DEAL_PAYMENT_STATUS.EXPIRED };
            expiredPaymentsCount++;
          }
        }

        // Evaluate deal outcome based on updated payment states
        const outcome = evaluatePostDeadlineOutcome(updatedPayments);

        if (outcome === 'BOTH_EXPIRED') {
          // Standard timeout cancellation
          await db.deal.update({
            where: { id: deal.id },
            data: {
              status: DealStatus.CANCELLED,
              version: { increment: 1 },
            },
          });

          if (deal.listingId) {
            await db.listing.update({
              where: { id: deal.listingId },
              data: {
                status: ListingStatus.ACTIVE,
                version: { increment: 1 },
              },
            });
          }

          if (db.auditLog) {
            await db.auditLog.create({
              data: {
                actorId: 'SYSTEM',
                actorType: 'SYSTEM',
                action: DEAL_CANCELLED_BY_TIMEOUT,
                entityType: 'Deal',
                entityId: deal.id,
                payload: {
                  dealId: deal.id,
                  dealNumber: deal.dealNumber,
                  listingId: deal.listingId,
                  reason: DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
                  cancelledAt: evaluationTimeIso,
                },
              },
            });
          }

          cancelledDealsCount++;
          processedCount++;
        } else if (outcome === 'COMMISSION_CONFIRMED_PRICE_EXPIRED') {
          // OQ-13: Commission collected, seller purchase price expired
          await db.deal.update({
            where: { id: deal.id },
            data: {
              status: DealStatus.CANCELLED,
              version: { increment: 1 },
            },
          });

          if (deal.listingId) {
            await db.listing.update({
              where: { id: deal.listingId },
              data: {
                status: ListingStatus.ACTIVE,
                version: { increment: 1 },
              },
            });
          }

          if (db.auditLog) {
            await db.auditLog.create({
              data: {
                actorId: 'SYSTEM',
                actorType: 'SYSTEM',
                action: DEAL_CANCELLED_BY_TIMEOUT,
                entityType: 'Deal',
                entityId: deal.id,
                payload: {
                  dealId: deal.id,
                  dealNumber: deal.dealNumber,
                  listingId: deal.listingId,
                  reason: DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
                  cancelledAt: evaluationTimeIso,
                  flag: 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED',
                },
              },
            });
          }

          cancelledDealsCount++;
          processedCount++;
        } else if (outcome === 'PRICE_CONFIRMED_COMMISSION_EXPIRED') {
          // Anomaly: price confirmed, commission missing. Flag for review without auto-completing.
          if (db.auditLog) {
            await db.auditLog.create({
              data: {
                actorId: 'SYSTEM',
                actorType: 'SYSTEM',
                action: 'DEAL_TIMEOUT_ANOMALY',
                entityType: 'Deal',
                entityId: deal.id,
                payload: {
                  dealId: deal.id,
                  dealNumber: deal.dealNumber,
                  listingId: deal.listingId,
                  reason: 'PRICE_CONFIRMED_COMMISSION_EXPIRED',
                  flag: 'SUPER_ADMIN_PAYMENT_ANOMALY_REVIEW',
                  evaluatedAt: evaluationTimeIso,
                },
              },
            });
          }
          processedCount++;
        }
      }
    }

    const outcome = `Evaluated deals at ${evaluationTimeIso}. Processed ${processedCount} deals (${cancelledDealsCount} cancelled, ${expiredPaymentsCount} payments expired).`;

    return {
      processedCount,
      outcome,
      details: {
        evaluationTime: evaluationTimeIso,
        processedCount,
        cancelledDealsCount,
        expiredPaymentsCount,
      },
    };
  };
}

export const paymentDeadlineExpiryHandler = createJobHandler(
  JOB_PAYMENT_DEADLINE_EXPIRY,
  createPaymentDeadlineExpiryLogic(),
);
