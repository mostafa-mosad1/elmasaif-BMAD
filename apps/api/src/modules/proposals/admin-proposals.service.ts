import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  ProposalStatus,
  ProposalQueueQuery,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PROPOSAL_NOT_FOUND,
  PROPOSAL_NOT_APPROVABLE,
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

  private toIso(value: unknown): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }
}
