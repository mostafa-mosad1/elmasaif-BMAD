import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  DemandStatus,
  ListingStatus,
  ProposalStatus,
  UserRole,
  ProfileStatus,
  CreateProposalInput,
  MATCH_AREA_TOLERANCE_PERCENT,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
} from '@elmasaif/shared';
import {
  PROPOSAL_FORBIDDEN,
  PROPOSAL_NOT_FOUND,
  PROPOSAL_DUPLICATE,
  PROPOSAL_NOT_SELECTABLE,
} from '@elmasaif/shared';
import {
  MatchingDemandItem,
  ProposalItem,
} from './dto/proposal-item.dto';

const PROVIDER_PROFILE_ROLES: readonly string[] = [UserRole.MARKETER, UserRole.OWNER];

/**
 * Provider proposal submission + buyer proposal review / selection (Story 3.7 / FR-22,
 * FR-23, FR-24). Guarded by the caller's OWN profile scope throughout; the buyer only ever
 * sees APPROVED_FOR_BUYER proposals, and selection is terminal for THIS story — final approval
 * (Deal creation, listing→RESERVED, demand→CLOSED) is owned by Epic 5 / Story 5.1.
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Provider alert surface (FR-22 / `demand.matched`): the demands that match the caller's own
   * ACTIVE listings, newest-matched first, each carrying the subset of the caller's listings
   * that qualify. Backed by the persisted `DemandMatch` rows written by the matcher.
   */
  async getMatchingDemands(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ items: MatchingDemandItem[] }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: activeRole } },
    });
    if (!profile || !PROVIDER_PROFILE_ROLES.includes(profile.role)) {
      return { items: [] };
    }

    const matches = await this.prisma.demandMatch.findMany({
      where: { providerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        demand: { include: { city: true, district: true } },
        listing: {
          select: {
            id: true,
            title: true,
            askPrice: true,
            areaSquareMeters: true,
          },
        },
      },
    });

    // Group newest-first match rows by demand, preserving first-seen (newest) order.
    const byDemand = new Map<string, MatchingDemandItem>();
    for (const match of matches) {
      const demand = match.demand as any;
      if (!demand) continue;
      const listing = match.listing as any;

      let bucket = byDemand.get(demand.id);
      if (!bucket) {
        bucket = {
          demandId: demand.id,
          propertyType: demand.propertyType,
          status: demand.status,
          cityId: demand.cityId,
          districtId: demand.districtId ?? null,
          cityName: demand.city?.nameAr ?? null,
          districtName: demand.district?.nameAr ?? null,
          minBudget: Number(demand.minBudget),
          maxBudget: Number(demand.maxBudget),
          minArea: Number(demand.minArea),
          maxArea: Number(demand.maxArea),
          notes: demand.notes ?? null,
          createdAt: this.toIso(demand.createdAt) as string,
          matchedListings: [],
        };
        byDemand.set(demand.id, bucket);
      }

      if (listing) {
        bucket.matchedListings.push({
          listingId: listing.id,
          title: listing.title,
          askPrice: Number(listing.askPrice),
          areaSquareMeters: Number(listing.areaSquareMeters),
        });
      }
    }

    return { items: Array.from(byDemand.values()) };
  }

  /**
   * Binding proposal submission (FR-23). Re-validates server-side: provider owns the listing,
   * the listing is ACTIVE, it still satisfies the demand's match criteria, the price is within
   * the platform [MIN,MAX] envelope AND <= the buyer's maxBudget. A duplicate (demandId,
   * listingId) pair is a ConflictException.
   */
  async createProposal(
    userId: string,
    activeRole: UserRole,
    dto: CreateProposalInput,
  ): Promise<ProposalItem> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: activeRole } },
    });
    if (!profile || profile.status !== ProfileStatus.ACTIVE || !PROVIDER_PROFILE_ROLES.includes(profile.role)) {
      throw new ForbiddenException({
        code: PROPOSAL_FORBIDDEN,
        message: 'الحساب غير نشط أو غير مصرح له بتقديم العروض',
      });
    }

    const listing = await this.prisma.listing.findFirst({
      where: { id: dto.listingId, sellerProfileId: profile.id },
    });
    if (!listing) {
      throw new ForbiddenException({
        code: PROPOSAL_FORBIDDEN,
        message: 'لا يمكنك تقديم عرض على عقار لا تملكه',
      });
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException({
        code: PROPOSAL_NOT_FOUND,
        message: 'العقار غير نشط ولا يمكن تقديم عرض عليه',
      });
    }

    const demand = await this.prisma.demand.findUnique({
      where: { id: dto.demandId },
    });
    if (
      !demand ||
      (demand.status !== DemandStatus.ACTIVE && demand.status !== DemandStatus.MATCHED)
    ) {
      throw new NotFoundException({
        code: PROPOSAL_NOT_FOUND,
        message: 'طلب الشراء المطلوب غير موجود أو غير متاح للعروض',
      });
    }

    if (!this.qualifies(demand, listing)) {
      throw new BadRequestException({
        code: PROPOSAL_NOT_FOUND,
        message: 'العقار لا يطابق معايير طلب الشراء',
      });
    }

    const price = Number(dto.proposedPrice);
    if (
      Number.isNaN(price) ||
      price < MIN_LISTING_PRICE_SAR ||
      price > MAX_LISTING_PRICE_SAR ||
      price > Number(demand.maxBudget)
    ) {
      throw new BadRequestException({
        code: PROPOSAL_NOT_FOUND,
        message: 'السعر المقترح يتجاوز ميزانية المشتري أو حدود السعر المسموحة',
      });
    }

    try {
      const proposal = await this.prisma.proposal.create({
        data: {
          demandId: dto.demandId,
          listingId: dto.listingId,
          providerProfileId: profile.id,
          proposedPrice: price,
          status: ProposalStatus.PENDING_ADMIN_REVIEW,
          note: dto.note ?? null,
        },
      });
      this.logger.log(`Proposal ${proposal.id} submitted for demand ${dto.demandId}`);
      return this.toProposalItem(proposal);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: PROPOSAL_DUPLICATE,
          message: 'تم تقديم عرض على هذا العقار لهذا الطلب مسبقاً',
        });
      }
      throw err;
    }
  }

  /**
   * Buyer review (FR-24): ONLY APPROVED_FOR_BUYER proposals on the caller's OWN demand, oldest
   * first, each with a light listing summary + provider broker name. PENDING/REJECTED rows are
   * invisible here.
   */
  async getApprovedProposalsForDemand(
    userId: string,
    demandId: string,
  ): Promise<{ items: ProposalItem[] }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: UserRole.BUYER } },
    });
    if (!profile) {
      throw new NotFoundException({
        code: PROPOSAL_NOT_FOUND,
        message: 'طلب الشراء المطلوب غير موجود',
      });
    }

    const demand = await this.prisma.demand.findFirst({
      where: { id: demandId, buyerProfileId: profile.id },
    });
    if (!demand) {
      throw new NotFoundException({
        code: PROPOSAL_NOT_FOUND,
        message: 'طلب الشراء المطلوب غير موجود',
      });
    }

    const proposals = await this.prisma.proposal.findMany({
      where: { demandId, status: ProposalStatus.APPROVED_FOR_BUYER },
      orderBy: { createdAt: 'asc' },
      include: {
        listing: {
          include: {
            city: true,
            district: true,
            sellerProfile: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
    });

    return {
      items: proposals.map((proposal: any) => ({
        ...this.toProposalItem(proposal),
        listing: this.toListingSummary(proposal.listing),
        providerName:
          proposal.listing?.sellerProfile?.user?.fullName ?? null,
      })),
    };
  }

  /**
   * Buyer selection (FR-24 / UJ-4): approves one APPROVED_FOR_BUYER proposal on the caller's own
   * ACTIVE/MATCHED demand → SELECTED_PENDING_FINAL_ADMIN_APPROVAL and closes every OTHER open
   * proposal on that demand. NO Deal, NO listing→RESERVED, NO demand→CLOSED — that is Story 5.1.
   */
  async selectProposal(userId: string, proposalId: string): Promise<ProposalItem> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: UserRole.BUYER } },
    });
    if (!profile) {
      throw new NotFoundException({
        code: PROPOSAL_NOT_FOUND,
        message: 'العرض المطلوب غير موجود',
      });
    }

    const selectedAt = this.clockService.now();

    const proposal = await this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.proposal.findFirst({
        where: { id: proposalId, demand: { buyerProfileId: profile.id } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: PROPOSAL_NOT_FOUND,
          message: 'العرض المطلوب غير موجود',
        });
      }
      if (existing.status !== ProposalStatus.APPROVED_FOR_BUYER) {
        throw new ConflictException({
          code: PROPOSAL_NOT_SELECTABLE,
          message: 'لا يمكن اختيار هذا العرض في حالته الحالية',
        });
      }

      const demand = await tx.demand.findUnique({ where: { id: existing.demandId } });
      if (
        !demand ||
        (demand.status !== DemandStatus.ACTIVE && demand.status !== DemandStatus.MATCHED)
      ) {
        throw new ConflictException({
          code: PROPOSAL_NOT_SELECTABLE,
          message: 'طلب الشراء لم يعد متاحاً للاختيار',
        });
      }

      const updated = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
          selectedAt,
        },
      });

      await tx.proposal.updateMany({
        where: {
          demandId: existing.demandId,
          id: { not: proposalId },
          status: {
            in: [ProposalStatus.PENDING_ADMIN_REVIEW, ProposalStatus.APPROVED_FOR_BUYER],
          },
        },
        data: { status: ProposalStatus.CLOSED },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PROPOSAL_SELECTED',
          entityType: 'Proposal',
          entityId: proposalId,
          payload: {
            demandId: existing.demandId,
            selectedAt: selectedAt.toISOString(),
          },
        },
      });

      return updated;
    });

    // TODO(5.1): bind Deal + reserve listing on final admin approval of the selected proposal.
    return this.toProposalItem(proposal);
  }

  // ---- helpers -------------------------------------------------------------

  /** FR-22 match predicate re-validated at submission time. */
  private qualifies(demand: any, listing: any): boolean {
    const tol = MATCH_AREA_TOLERANCE_PERCENT;
    return (
      listing.propertyType === demand.propertyType &&
      listing.cityId === demand.cityId &&
      Number(listing.askPrice) <= Number(demand.maxBudget) &&
      Number(listing.areaSquareMeters) >= Number(demand.minArea) * (1 - tol) &&
      Number(listing.areaSquareMeters) <= Number(demand.maxArea) * (1 + tol)
    );
  }

  private toListingSummary(listing: any) {
    if (!listing) return null;
    return {
      id: listing.id,
      title: listing.title,
      propertyType: listing.propertyType,
      cityId: listing.cityId,
      districtId: listing.districtId,
      cityName: listing.city?.nameAr ?? null,
      districtName: listing.district?.nameAr ?? null,
      askPrice: Number(listing.askPrice),
      areaSquareMeters: Number(listing.areaSquareMeters),
    };
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  private toProposalItem(proposal: any): ProposalItem {
    return {
      id: proposal.id,
      demandId: proposal.demandId,
      listingId: proposal.listingId,
      providerProfileId: proposal.providerProfileId,
      status: proposal.status,
      proposedPrice: Number(proposal.proposedPrice),
      note: proposal.note ?? null,
      rejectReason: proposal.rejectReason ?? null,
      selectedAt: this.toIso(proposal.selectedAt),
      createdAt: this.toIso(proposal.createdAt) as string,
    };
  }
}
