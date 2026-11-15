import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  ExecutiveDashboardMetricsDto,
  DealStatus,
  ListingStatus,
  ProfileStatus,
} from '@elmasaif/shared';

@Injectable()
export class ExecutiveService {
  private readonly logger = new Logger(ExecutiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  async getDashboardMetrics(): Promise<ExecutiveDashboardMetricsDto> {
    const now = this.clockService.now();
    const h48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const h12Future = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeInPaymentWindow,
      completedLast48h,
      pendingReviewLast48h,
      volume48hAgg,
      listingsModeration,
      falVerifications,
      paymentProofReviews,
      contractFeeReviews,
      unassignedDisputes,
      openTickets,
      pendingViolationReports,
      activeLockedListings,
      activeLockedPayments,
      dealsExpiringSoon12h,
      ticketsSlaBreached,
      listingsPendingOver24h,
      deals30dAgg,
      contractFees30dAgg,
    ] = await Promise.all([
      // 48-Hour Deal Counts
      this.prisma.deal.count({
        where: {
          status: DealStatus.AWAITING_PAYMENT_PROOF,
          createdAt: { gte: h48Ago },
        },
      }),
      this.prisma.deal.count({
        where: {
          status: DealStatus.COMPLETED,
          updatedAt: { gte: h48Ago },
        },
      }),
      this.prisma.deal.count({
        where: {
          status: DealStatus.UNDER_ADMIN_AUDIT,
          updatedAt: { gte: h48Ago },
        },
      }),
      this.prisma.deal.aggregate({
        where: { createdAt: { gte: h48Ago } },
        _sum: { dealPrice: true },
      }),

      // Pending Operational Queues
      this.prisma.listing.count({
        where: {
          status: {
            in: [
              ListingStatus.PENDING_REVIEW,
              ListingStatus.UNDER_COMPLIANCE_REVIEW,
            ],
          },
        },
      }),
      this.prisma.falLicense.count({
        where: {
          status: {
            in: [ProfileStatus.UNDER_REVIEW, ProfileStatus.RENEWAL_UNDER_REVIEW],
          },
        },
      }),
      this.prisma.payment.count({
        where: { status: { in: ['PROOF_UPLOADED', 'UNDER_REVIEW'] } },
      }),
      this.prisma.contractFeePayment.count({
        where: { status: { in: ['PROOF_UPLOADED', 'UNDER_REVIEW', 'PENDING'] } },
      }),
      this.prisma.deal.count({
        where: { status: DealStatus.DISPUTED },
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.violationReport.count({
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),

      // Active Task Claims currently leased
      this.prisma.listing.count({
        where: { lockExpiresAt: { gt: now } },
      }),
      this.prisma.payment.count({
        where: { lockExpiresAt: { gt: now } },
      }),

      // SLA Warnings
      this.prisma.deal.count({
        where: {
          status: DealStatus.AWAITING_PAYMENT_PROOF,
          paymentDeadline: {
            lte: h12Future,
            gt: now,
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          OR: [
            { firstResponseDueAt: { lte: now } },
            { resolutionDueAt: { lte: now } },
          ],
        },
      }),
      this.prisma.listing.count({
        where: {
          status: ListingStatus.PENDING_REVIEW,
          createdAt: { lte: h24Ago },
        },
      }),

      // Financial Throughput (30 Days)
      this.prisma.deal.aggregate({
        where: {
          status: DealStatus.COMPLETED,
          updatedAt: { gte: d30Ago },
        },
        _sum: {
          dealPrice: true,
          platformCommission: true,
        },
      }),
      this.prisma.contractFeePayment.aggregate({
        where: {
          status: { in: ['APPROVED', 'CONFIRMED'] },
          updatedAt: { gte: d30Ago },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      dealCounts48h: {
        activeInPaymentWindow,
        completedLast48h,
        pendingReviewLast48h,
        totalVolumeLast48hSar: Number(volume48hAgg._sum.dealPrice ?? 0),
      },
      pendingQueues: {
        listingsModeration,
        falVerifications,
        paymentProofReviews,
        contractFeeReviews,
        unassignedDisputes,
        openTickets,
        pendingViolationReports,
        activeTaskClaims: activeLockedListings + activeLockedPayments,
      },
      slaWarnings: {
        dealsExpiringSoon12h,
        ticketsSlaBreached,
        listingsPendingOver24h,
      },
      financialThroughput30d: {
        grossVolumeSar: Number(deals30dAgg._sum.dealPrice ?? 0),
        commissionsSar: Number(deals30dAgg._sum.platformCommission ?? 0),
        contractFeesSar: Number(contractFees30dAgg._sum.amount ?? 0),
      },
    };
  }
}
