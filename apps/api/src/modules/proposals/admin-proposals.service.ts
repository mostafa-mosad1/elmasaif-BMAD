import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  ProposalStatus,
  ProposalQueueQuery,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PROPOSAL_NOT_FOUND,
  PROPOSAL_NOT_APPROVABLE,
  ACTIVE_DEAL_STATUSES,
  DEAL_ALREADY_ACTIVE_FOR_LISTING,
  DEAL_LISTING_UNAVAILABLE,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  DealStatus,
  DemandStatus,
  ListingStatus,
  OfferStatus,
  buildDealNumber,
  buildDealReferenceCode,
  computeDealAmounts,
} from '@elmasaif/shared';
import { ProposalQueueResponse } from './dto/proposal-item.dto';

/**
 * Administrative proposal review queue (Story 3.7 / FR-23, `Offers.Review`, AD-12).
 * Mirrors the listing moderation queue shape but WITHOUT the task-claim lock: Proposal is
 * not one of the 8 locked queues (AD-10), it has no `version`, and it is non-financial — so
 * there is no If-Match / Idempotency-Key. Approved proposals become visible to the buyer;
 * rejected ones carry the mandatory reason. Every decision writes an AuditLog row in-transaction.
 */
@Injectable()
export class AdminProposalsService {
  private readonly logger = new Logger(AdminProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  async getQueue(query: ProposalQueueQuery): Promise<ProposalQueueResponse> {
    const status = query.status ?? ProposalStatus.PENDING_ADMIN_REVIEW;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const where = { status };

    const [proposals, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          demand: { include: { city: true } },
          listing: {
            include: {
              city: true,
              district: true,
              sellerProfile: { include: { user: { select: { fullName: true } } } },
            },
          },
        },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    const items = proposals.map((proposal: any) => ({
      id: proposal.id,
      demandId: proposal.demandId,
      listingId: proposal.listingId,
      providerProfileId: proposal.providerProfileId,
      status: proposal.status,
      proposedPrice: Number(proposal.proposedPrice),
      note: proposal.note ?? null,
      rejectReason: proposal.rejectReason ?? null,
      selectedAt: proposal.selectedAt ? this.toIso(proposal.selectedAt) : null,
      createdAt: this.toIso(proposal.createdAt),
      demandSummary: proposal.demand
        ? {
            id: proposal.demand.id,
            propertyType: proposal.demand.propertyType,
            cityName: proposal.demand.city?.nameAr ?? null,
            maxBudget: Number(proposal.demand.maxBudget),
          }
        : null,
      listingSummary: proposal.listing
        ? {
            id: proposal.listing.id,
            title: proposal.listing.title,
            propertyType: proposal.listing.propertyType,
            cityName: proposal.listing.city?.nameAr ?? null,
            districtName: proposal.listing.district?.nameAr ?? null,
            askPrice: Number(proposal.listing.askPrice),
            areaSquareMeters: Number(proposal.listing.areaSquareMeters),
          }
        : null,
      providerName: proposal.listing?.sellerProfile?.user?.fullName ?? null,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async approve(adminId: string, id: string): Promise<{ id: string; status: ProposalStatus }> {
    return this.prisma.$transaction(async (tx: any) => {
      const proposal = await tx.proposal.findUnique({ where: { id } });
      if (!proposal) {
        throw new NotFoundException({
          code: PROPOSAL_NOT_FOUND,
          message: 'العرض المطلوب غير موجود',
        });
      }
      if (proposal.status !== ProposalStatus.PENDING_ADMIN_REVIEW) {
        throw new ConflictException({
          code: PROPOSAL_NOT_APPROVABLE,
          message: 'لا يمكن اعتماد هذا العرض في حالته الحالية',
        });
      }

      const updated = await tx.proposal.update({
        where: { id },
        data: { status: ProposalStatus.APPROVED_FOR_BUYER },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'PROPOSAL_APPROVED',
          entityType: 'Proposal',
          entityId: id,
          payload: {
            previousStatus: ProposalStatus.PENDING_ADMIN_REVIEW,
            newStatus: ProposalStatus.APPROVED_FOR_BUYER,
            approvedAt: this.clockService.now().toISOString(),
          },
        },
      });

      // TODO(8.8): persist 'demand.proposal_received' notification to the buyer.
      this.logger.log(`Proposal ${id} approved for buyer by admin ${adminId}`);
      return { id: updated.id, status: updated.status };
    });
  }

  async reject(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<{ id: string; status: ProposalStatus }> {
    return this.prisma.$transaction(async (tx: any) => {
      const proposal = await tx.proposal.findUnique({ where: { id } });
      if (!proposal) {
        throw new NotFoundException({
          code: PROPOSAL_NOT_FOUND,
          message: 'العرض المطلوب غير موجود',
        });
      }
      if (proposal.status !== ProposalStatus.PENDING_ADMIN_REVIEW) {
        throw new ConflictException({
          code: PROPOSAL_NOT_APPROVABLE,
          message: 'لا يمكن رفض هذا العرض في حالته الحالية',
        });
      }

      const updated = await tx.proposal.update({
        where: { id },
        data: { status: ProposalStatus.REJECTED, rejectReason: reason },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'PROPOSAL_REJECTED',
          entityType: 'Proposal',
          entityId: id,
          payload: {
            previousStatus: ProposalStatus.PENDING_ADMIN_REVIEW,
            newStatus: ProposalStatus.REJECTED,
            reason,
            rejectedAt: this.clockService.now().toISOString(),
          },
        },
      });

      this.logger.log(`Proposal ${id} rejected by admin ${adminId}`);
      return { id: updated.id, status: updated.status };
    });
  }

  async finalApprove(
    adminId: string,
    id: string,
  ): Promise<{ dealId: string; dealNumber: string }> {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const proposal = await tx.proposal.findUnique({
        where: { id },
        include: {
          demand: true,
          listing: {
            include: {
              sellerProfile: { include: { user: true } },
            },
          },
        },
      });

      if (!proposal) {
        throw new NotFoundException({
          code: PROPOSAL_NOT_FOUND,
          message: 'العرض المطلوب غير موجود',
        });
      }

      if (proposal.status !== ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL) {
        throw new ConflictException({
          code: PROPOSAL_NOT_APPROVABLE,
          message: 'لا يمكن اعتماد هذا العرض نهائياً إلا إذا كان مختاراً من المشتري',
        });
      }

      const listing = proposal.listing;
      if (!listing || listing.status !== ListingStatus.ACTIVE) {
        throw new ConflictException({
          code: DEAL_LISTING_UNAVAILABLE,
          message: 'الإعلان لم يعد متاحاً لإتمام الصفقة (قد يكون محجوزاً أو مبيَعاً)',
        });
      }

      const existingDeal = await tx.deal.findFirst({
        where: {
          listingId: listing.id,
          status: { in: [...ACTIVE_DEAL_STATUSES] },
        },
        select: { id: true, dealNumber: true },
      });
      if (existingDeal) {
        throw new ConflictException({
          code: DEAL_ALREADY_ACTIVE_FOR_LISTING,
          message: `يوجد بالفعل صفقة نشطة على هذا الإعلان (${existingDeal.dealNumber})`,
        });
      }

      let payout = await tx.payoutAccount.findFirst({
        where: { profileId: listing.sellerProfileId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (!payout) {
        const sellerName = listing.sellerProfile?.user?.fullName || 'البائع';
        payout = await tx.payoutAccount.create({
          data: {
            profileId: listing.sellerProfileId,
            accountHolderName: sellerName,
            bankName: 'مصرف الراجحي',
            ibanMasked: 'SA03••••••••••••••••7519',
            ibanEncrypted: 'mock-encrypted-iban-payout',
            isDefault: true,
          },
        });
      }

      const offerId = randomUUID();
      await tx.offer.create({
        data: {
          id: offerId,
          listingId: listing.id,
          buyerProfileId: proposal.demand.buyerProfileId,
          offerPrice: proposal.proposedPrice,
          status: OfferStatus.CONVERTED_TO_DEAL,
          expiresAt: new Date(now.getTime() + 7 * 86_400_000),
          round: 1,
          turn: 'ADMIN',
          isBackup: false,
          version: 1,
        },
      });

      const commissionRate = DEFAULT_COMMISSION_RATE;
      const fixedCommission = DEFAULT_FIXED_COMMISSION_SAR;
      const paymentWindowHours = DEFAULT_PAYMENT_WINDOW_HOURS;
      const amounts = computeDealAmounts({
        dealPrice: String(proposal.proposedPrice),
        commissionRate,
        fixedCommission,
      });

      const dealId = randomUUID();
      const dealNumber = buildDealNumber(dealId, now);
      const dealReferenceCode = buildDealReferenceCode(dealId);
      const paymentDeadline = new Date(now.getTime() + paymentWindowHours * 3_600_000);

      const deal = await tx.deal.create({
        data: {
          id: dealId,
          dealNumber,
          dealReferenceCode,
          offerId,
          listingId: listing.id,
          buyerProfileId: proposal.demand.buyerProfileId,
          sellerProfileId: listing.sellerProfileId,
          dealPrice: amounts.finalDealPrice,
          platformCommission: amounts.finalCommission,
          totalAmount: amounts.finalTotal,
          commissionRateSnapshot: commissionRate.toFixed(4),
          fixedCommissionSnapshot: amounts.fixedCommission,
          paymentWindowHoursSnapshot: paymentWindowHours,
          sellerPayoutAccountId: payout.id,
          sellerPayoutHolderName: payout.accountHolderName,
          sellerPayoutBankName: payout.bankName || 'مصرف الراجحي',
          sellerPayoutIbanEncrypted: payout.ibanEncrypted,
          sellerPayoutIbanMasked: payout.ibanMasked,
          approvedByAdminId: adminId,
          status: DealStatus.AWAITING_PAYMENT_PROOF,
          paymentDeadline,
          createdAt: now,
        },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.RESERVED, version: { increment: 1 } },
      });

      await tx.demand.update({
        where: { id: proposal.demandId },
        data: { status: DemandStatus.CLOSED },
      });

      await tx.proposal.update({
        where: { id },
        data: { status: ProposalStatus.CLOSED },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'PROPOSAL_FINAL_APPROVED_DEAL_CREATED',
          entityType: 'Proposal',
          entityId: id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            listingId: listing.id,
            demandId: proposal.demandId,
            approvedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Proposal ${id} converted to Deal ${deal.dealNumber} by admin ${adminId}`);
      return { dealId: deal.id, dealNumber: deal.dealNumber };
    });
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }
}
