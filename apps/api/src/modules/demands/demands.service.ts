import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  DemandStatus,
  CreateDemandInput,
  DEMAND_EXPIRY_DAYS,
  DEMAND_NOT_FOUND,
  DEMAND_NOT_CANCELLABLE,
  DEMAND_FORBIDDEN,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
} from '@elmasaif/shared';
import { DemandItem } from './dto/demand-item.dto';

const MILLISECONDS_PER_DAY = 86400000;

@Injectable()
export class DemandsService {
  private readonly logger = new Logger(DemandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Broadcasts a structured buyer demand (Story 3.6 / FR-21, AD-9). Geography is
   * validated against the master tables exactly like listing creation, there is NO
   * admin approval — the demand goes live as ACTIVE with a 30-day expiry window
   * derived from ClockService (AD-11).
   */
  async createDemand(
    userId: string,
    activeRole: UserRole,
    dto: CreateDemandInput,
  ): Promise<DemandItem> {
    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: UserRole.BUYER,
        },
      },
    });

    if (!profile || profile.status !== ProfileStatus.ACTIVE || activeRole !== UserRole.BUYER) {
      throw new ForbiddenException({
        code: DEMAND_FORBIDDEN,
        message: 'الحساب غير نشط أو غير مصرح له بتقديم طلبات الشراء',
      });
    }

    // Structured geography only — free-text city/district is rejected at the Zod boundary.
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city || !city.isActive) {
      throw new BadRequestException({
        code: GEO_CITY_INACTIVE,
        message: 'المدينة المحددة غير موجودة أو غير مفعلة',
      });
    }

    if (dto.districtId) {
      const district = await this.prisma.district.findUnique({
        where: {
          id_cityId: {
            id: dto.districtId,
            cityId: dto.cityId,
          },
        },
      });
      if (!district || !district.isActive) {
        throw new BadRequestException({
          code: GEO_DISTRICT_INACTIVE,
          message: 'الحي المحدد غير موجود أو غير مفعل أو لا يتبع المدينة المحددة',
        });
      }
    }

    const expiresAt = new Date(
      this.clockService.now().getTime() + DEMAND_EXPIRY_DAYS * MILLISECONDS_PER_DAY,
    );

    const demand = await this.prisma.demand.create({
      data: {
        buyerProfileId: profile.id,
        propertyType: dto.propertyType,
        cityId: dto.cityId,
        districtId: dto.districtId ?? null,
        minBudget: dto.minBudget,
        maxBudget: dto.maxBudget,
        minArea: dto.minArea,
        maxArea: dto.maxArea,
        notes: dto.notes ?? null,
        status: DemandStatus.ACTIVE,
        expiresAt,
      },
      include: { city: true, district: true },
    });

    this.logger.log(`Demand ${demand.id} created ACTIVE for buyer profile ${profile.id}`);
    return this.toDemandItem(demand);
  }

  /**
   * Lifecycle list (FR-58): the buyer's own demands — active AND historical — newest
   * created first. No status filter, so EXPIRED / CANCELLED / CLOSED rows stay visible.
   */
  async getBuyerDemands(userId: string): Promise<{ items: DemandItem[] }> {
    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: UserRole.BUYER,
        },
      },
    });

    if (!profile) {
      return { items: [] };
    }

    const demands = await this.prisma.demand.findMany({
      where: { buyerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { city: true, district: true },
    });

    return { items: demands.map((demand: any) => this.toDemandItem(demand)) };
  }

  /**
   * Buyer cancel with structured reason (FR-58). Only ACTIVE or MATCHED demands are
   * cancellable; the status change, timestamp, reason and AuditLog row commit in one
   * transaction. A buyer can only reach their own demand — anything else is a 404.
   */
  async cancelDemand(
    userId: string,
    demandId: string,
    reason: string,
  ): Promise<DemandItem> {
    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: UserRole.BUYER,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: DEMAND_NOT_FOUND,
        message: 'طلب الشراء المطلوب غير موجود',
      });
    }

    const cancelledAt = this.clockService.now();

    const demand = await this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.demand.findFirst({
        where: { id: demandId, buyerProfileId: profile.id },
      });

      if (!existing) {
        throw new NotFoundException({
          code: DEMAND_NOT_FOUND,
          message: 'طلب الشراء المطلوب غير موجود',
        });
      }

      if (
        existing.status !== DemandStatus.ACTIVE &&
        existing.status !== DemandStatus.MATCHED
      ) {
        throw new ConflictException({
          code: DEMAND_NOT_CANCELLABLE,
          message: 'لا يمكن إلغاء طلب الشراء في حالته الحالية',
          details: { status: existing.status },
        });
      }

      const updated = await tx.demand.update({
        where: { id: demandId },
        data: {
          status: DemandStatus.CANCELLED,
          cancelReason: reason,
          cancelledAt,
        },
        include: { city: true, district: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'DEMAND_CANCELLED',
          entityType: 'Demand',
          entityId: demandId,
          payload: { reason, cancelledAt: cancelledAt.toISOString() },
        },
      });

      // TODO(3.7): close unselected proposals on cancel — no Proposal model exists yet.
      return updated;
    });

    return this.toDemandItem(demand);
  }

  private toDemandItem(demand: any): DemandItem {
    const toIso = (value: unknown): string | null => {
      if (!value) return null;
      return value instanceof Date ? value.toISOString() : String(value);
    };

    return {
      id: demand.id,
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
      expiresAt: toIso(demand.expiresAt) as string,
      cancelledAt: toIso(demand.cancelledAt),
      cancelReason: demand.cancelReason ?? null,
      createdAt: toIso(demand.createdAt) as string,
    };
  }
}
