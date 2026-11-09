import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
  DEAL_CANCELLED_BY_TIMEOUT,
  DEAL_DISPUTE_SYSTEM_ESCALATION,
  DEAL_NOT_FOUND,
  DEAL_PAYMENT_STATUS,
  DISPUTE_STATUS,
  DealStatus,
  ListingStatus,
  TERMINAL_DEAL_STATUSES,
  evaluatePostDeadlineOutcome,
  hasActiveDispute,
  hasPaymentInGracePeriod,
  hasProtectedPaymentProof,
  isDealEligibleForTimeout,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';

export interface CancelDealTimeoutOptions {
  force?: boolean;
}

export interface CancelDealTimeoutResult {
  cancelled: boolean;
  outcome?: string;
  reason?: string;
  deal?: any;
}

export interface SweepExpiredDealsResult {
  processedCount: number;
  cancelledDealsCount: number;
  skippedDealsCount: number;
  results: Array<{
    dealId: string;
    result: CancelDealTimeoutResult | null;
    error?: string;
  }>;
}

/**
 * Story 5.5 / AC-2, AC-3, AC-4, AC-5, AC-6, AC-7: Atomic Deal Timeout Service.
 *
 * Implements strict row locking and atomic transactional cancellation of deals past payment deadline.
 * Lock hierarchy:
 * 1. Deal (SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE)
 * 2. Listing (SELECT "id" FROM "listings" WHERE "id" = ${listingId}::text FOR UPDATE)
 * 3. Payments (SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE)
 *
 * All UUIDs cast explicitly to ::text to prevent PostgreSQL error 42883 (trap T-1).
 * Reverts Listing to ACTIVE and writes DEAL_CANCELLED_BY_TIMEOUT audit log record.
 */
@Injectable()
export class DealTimeoutService {
  private readonly logger = new Logger(DealTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Evaluates and atomically cancels an individual deal past payment deadline.
   */
  async cancelDealByTimeout(
    dealId: string,
    options?: CancelDealTimeoutOptions,
  ): Promise<CancelDealTimeoutResult> {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE casting ${dealId}::text (trap T-1)
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          payments: true,
          disputes: true,
          listing: true,
        },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      // If already cancelled, return cleanly (idempotent)
      if (deal.status === DealStatus.CANCELLED) {
        this.logger.log(`Deal ${dealId} is already CANCELLED. Returning without changes.`);
        return { cancelled: false, reason: 'ALREADY_CANCELLED', deal };
      }

      // If deal is in another terminal state (COMPLETED or TERMINATED)
      if ((TERMINAL_DEAL_STATUSES as readonly string[]).includes(deal.status)) {
        this.logger.log(`Deal ${dealId} is in terminal status ${deal.status}. Skipping timeout.`);
        return { cancelled: false, reason: 'DEAL_TERMINAL', deal };
      }

      // 2. Lock Listing row FOR UPDATE casting ${listingId}::text
      if (deal.listingId) {
        await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${deal.listingId}::text FOR UPDATE`;
      }

      // 3. Lock Payments rows FOR UPDATE casting ${dealId}::text
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "dealId" = ${dealId}::text FOR UPDATE`;

      // Check protection gates unless forced
      if (!options?.force) {
        // Gate 1: Formal Dispute Freeze
        if (hasActiveDispute(deal)) {
          this.logger.log(`Deal ${dealId} has active dispute; timeout frozen.`);
          return { cancelled: false, reason: 'ACTIVE_DISPUTE', deal };
        }

        // Gate 2: On-Time Proof Upload / Active Admin Review
        if (hasProtectedPaymentProof(deal.payments)) {
          this.logger.log(`Deal ${dealId} has payment proof uploaded or under review; cancellation paused.`);
          return { cancelled: false, reason: 'PAYMENT_UNDER_REVIEW', deal };
        }

        // Gate 3: 12-Hour Grace Period
        if (hasPaymentInGracePeriod(deal.payments, deal.paymentDeadline, now)) {
          this.logger.log(`Deal ${dealId} has rejected payment within active 12-hour grace period; cancellation paused.`);
          return { cancelled: false, reason: 'PAYMENT_IN_GRACE_PERIOD', deal };
        }

        // Overall eligibility check
        if (!isDealEligibleForTimeout(deal, now)) {
          return { cancelled: false, reason: 'NOT_ELIGIBLE', deal };
        }
      }

      // Expire eligible payments:
      // - PENDING payments past deadline
      // - REJECTED payments whose 12-hour grace period elapsed
      const updatedPayments = [...(deal.payments || [])];
      for (let i = 0; i < updatedPayments.length; i++) {
        const payment = updatedPayments[i];
        if (
          payment.status === DEAL_PAYMENT_STATUS.PENDING ||
          (payment.status === DEAL_PAYMENT_STATUS.REJECTED &&
            !hasPaymentInGracePeriod([payment], deal.paymentDeadline, now))
        ) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
          });
          updatedPayments[i] = { ...payment, status: DEAL_PAYMENT_STATUS.EXPIRED };
        }
      }

      // Evaluate outcome based on updated payment states
      const outcome = evaluatePostDeadlineOutcome(updatedPayments);

      if (outcome === 'BOTH_EXPIRED') {
        // Standard timeout cancellation
        const cancelledDeal = await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: DealStatus.CANCELLED,
            version: { increment: 1 },
          },
        });

        if (deal.listingId) {
          await tx.listing.update({
            where: { id: deal.listingId },
            data: {
              status: ListingStatus.ACTIVE,
              version: { increment: 1 },
            },
          });
        }

        await tx.auditLog.create({
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
              cancelledAt: now.toISOString(),
            },
          },
        });

        return { cancelled: true, outcome, deal: cancelledDeal };
      }

      if (outcome === 'COMMISSION_CONFIRMED_PRICE_EXPIRED') {
        // OQ-13: Commission confirmed, seller purchase price expired -> cancel deal & flag for refund review
        const cancelledDeal = await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: DealStatus.CANCELLED,
            version: { increment: 1 },
          },
        });

        if (deal.listingId) {
          await tx.listing.update({
            where: { id: deal.listingId },
            data: {
              status: ListingStatus.ACTIVE,
              version: { increment: 1 },
            },
          });
        }

        await tx.auditLog.create({
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
              cancelledAt: now.toISOString(),
              flag: 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED',
            },
          },
        });

        return { cancelled: true, outcome, deal: cancelledDeal };
      }

      if (outcome === 'PRICE_CONFIRMED_COMMISSION_EXPIRED') {
        // Story 5.6 / AC-6: Price confirmed, platform fee expired -> auto-escalate to Dispute with status DISPUTED
        const disputedDeal = await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: DealStatus.DISPUTED,
            version: { increment: 1 },
          },
        });

        const dispute = await tx.dispute.create({
          data: {
            dealId: deal.id,
            initiatorId: 'SYSTEM',
            reason: 'PRICE_CONFIRMED_COMMISSION_EXPIRED',
            status: DISPUTE_STATUS.OPEN,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
            action: DEAL_DISPUTE_SYSTEM_ESCALATION,
            entityType: 'Dispute',
            entityId: dispute.id,
            payload: {
              dealId: deal.id,
              dealNumber: deal.dealNumber,
              listingId: deal.listingId,
              reason: 'PRICE_CONFIRMED_COMMISSION_EXPIRED',
              flag: 'SUPER_ADMIN_PAYMENT_ANOMALY_REVIEW',
              evaluatedAt: now.toISOString(),
            },
          },
        });

        this.logger.log(
          `Deal ${deal.dealNumber} automatically escalated to DISPUTED due to PRICE_CONFIRMED_COMMISSION_EXPIRED`,
        );

        return {
          cancelled: false,
          outcome,
          reason: 'ANOMALY_ESCALATED_TO_DISPUTE',
          deal: disputedDeal,
        };
      }

      return { cancelled: false, outcome, reason: 'PENDING_REVIEW', deal };
    });
  }

  /**
   * Sweeps all candidate deals whose payment deadlines have expired.
   */
  async sweepExpiredDeals(currentTime?: Date): Promise<SweepExpiredDealsResult> {
    const now = currentTime ?? this.clockService.now();
    const candidateDeals = await this.prisma.deal.findMany({
      where: {
        status: { in: [...ACTIVE_DEAL_STATUSES] },
        paymentDeadline: { lte: now },
      },
      select: { id: true },
    });

    let processedCount = 0;
    let cancelledDealsCount = 0;
    let skippedDealsCount = 0;
    const results: Array<{
      dealId: string;
      result: CancelDealTimeoutResult | null;
      error?: string;
    }> = [];

    for (const candidate of candidateDeals) {
      try {
        const result = await this.cancelDealByTimeout(candidate.id);
        processedCount++;
        if (result.cancelled) {
          cancelledDealsCount++;
        } else {
          skippedDealsCount++;
        }
        results.push({ dealId: candidate.id, result });
      } catch (err: any) {
        this.logger.error(
          `Failed to cancel deal ${candidate.id} during timeout sweep: ${err?.message}`,
          err,
        );
        results.push({ dealId: candidate.id, result: null, error: err?.message || String(err) });
      }
    }

    return {
      processedCount,
      cancelledDealsCount,
      skippedDealsCount,
      results,
    };
  }
}

