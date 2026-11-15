import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  FraudEventType,
  FraudSeverity,
  FraudStatus,
  ProfileStatus,
  ListingStatus,
  CreateFraudLogInput,
  ResolveFraudLogInput,
  FraudLogDto,
  PaginatedFraudLogsDto,
  AUDIT_ACTION_FRAUD_LOGGED,
  AUDIT_ACTION_FRAUD_RESOLVED,
  AUDIT_ACTION_PENALTY_RECORDED,
  AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED,
} from '@elmasaif/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly clockService: ClockService,
  ) {}

  async getFraudLogs(query: {
    status?: FraudStatus;
    severity?: FraudSeverity;
    eventType?: FraudEventType;
    targetUserId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedFraudLogsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FraudLogWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.eventType) {
      where.eventType = query.eventType;
    }
    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { caseNumber: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { targetUser: { fullName: { contains: term, mode: 'insensitive' } } },
        { targetUser: { mobileNumber: { contains: term } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.fraudLog.count({ where }),
      this.prisma.fraudLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          targetUser: {
            select: {
              id: true,
              fullName: true,
              mobileNumber: true,
              email: true,
              status: true,
            },
          },
          loggedByAdmin: {
            select: {
              id: true,
              fullName: true,
            },
          },
          resolvedByAdmin: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => this.mapToDto(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createFraudLog(
    adminId: string,
    input: CreateFraudLogInput,
  ): Promise<FraudLogDto> {
    const now = this.clockService.now();
    const year = now.getFullYear();

    // Generate sequential caseNumber: FRD-YYYY-XXXX
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const countThisYear = await this.prisma.fraudLog.count({
      where: {
        createdAt: { gte: startOfYear },
      },
    });
    const caseNumber = `FRD-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    const created = await this.prisma.fraudLog.create({
      data: {
        caseNumber,
        eventType: input.eventType,
        severity: input.severity,
        status: FraudStatus.OPEN,
        targetUserId: input.targetUserId ?? null,
        targetListingId: input.targetListingId ?? null,
        targetDealId: input.targetDealId ?? null,
        detectedReasons: input.detectedReasons,
        description: input.description,
        penaltySar: input.penaltySar ? new Prisma.Decimal(input.penaltySar) : null,
        penaltyReason: input.penaltyReason ?? null,
        marketerSuspended: Boolean(input.suspendMarketer),
        loggedByAdminId: adminId,
      },
      include: {
        targetUser: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
            email: true,
            status: true,
          },
        },
        loggedByAdmin: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Handle marketer suspension if requested
    if (input.suspendMarketer && input.targetUserId) {
      await this.suspendMarketer(adminId, input.targetUserId, input.description);
    }

    // Handle penalty audit recording if specified
    if (input.penaltySar && input.targetUserId) {
      await this.auditService.record(this.prisma, {
        actorId: adminId,
        actorType: 'ADMIN',
        action: AUDIT_ACTION_PENALTY_RECORDED,
        entityType: 'USER',
        entityId: input.targetUserId,
        justificationReason: input.penaltyReason || 'تسجيل غرامة امتثال مالية',
        metadata: {
          fraudLogId: created.id,
          caseNumber: created.caseNumber,
          penaltySar: Number(input.penaltySar),
        },
      });
    }

    // Record creation audit log
    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_FRAUD_LOGGED,
      entityType: 'FRAUD_LOG',
      entityId: created.id,
      justificationReason: input.description,
      metadata: {
        caseNumber: created.caseNumber,
        eventType: input.eventType,
        severity: input.severity,
        targetUserId: input.targetUserId,
        detectedReasons: input.detectedReasons,
      },
    });

    return this.mapToDto(created);
  }

  async resolveFraudLog(
    adminId: string,
    id: string,
    input: ResolveFraudLogInput,
  ): Promise<FraudLogDto> {
    const existing = await this.prisma.fraudLog.findUnique({
      where: { id },
      include: {
        targetUser: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('حالة الاشتباه غير موجودة');
    }

    const updated = await this.prisma.fraudLog.update({
      where: { id },
      data: {
        status: input.status,
        resolutionNotes: input.resolutionNotes,
        resolvedByAdminId: adminId,
        penaltySar: input.penaltySar
          ? new Prisma.Decimal(input.penaltySar)
          : existing.penaltySar,
        penaltyReason: input.penaltyReason ?? existing.penaltyReason,
        marketerSuspended:
          input.suspendMarketer !== undefined
            ? input.suspendMarketer
            : existing.marketerSuspended,
      },
      include: {
        targetUser: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
            email: true,
            status: true,
          },
        },
        loggedByAdmin: {
          select: {
            id: true,
            fullName: true,
          },
        },
        resolvedByAdmin: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (input.suspendMarketer && existing.targetUserId) {
      await this.suspendMarketer(adminId, existing.targetUserId, input.resolutionNotes);
    }

    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_FRAUD_RESOLVED,
      entityType: 'FRAUD_LOG',
      entityId: updated.id,
      justificationReason: input.resolutionNotes,
      metadata: {
        caseNumber: updated.caseNumber,
        status: updated.status,
        resolutionNotes: input.resolutionNotes,
      },
    });

    return this.mapToDto(updated);
  }

  async suspendMarketer(
    adminId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    // 1. Update User to COMPLIANCE_RESTRICTED
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
      },
    });

    // 2. Update user profiles to COMPLIANCE_RESTRICTED
    await this.prisma.userProfile.updateMany({
      where: { userId },
      data: {
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
      },
    });

    // 3. Transition active listings to UNDER_COMPLIANCE_REVIEW
    await this.prisma.listing.updateMany({
      where: {
        sellerProfile: { userId },
        status: {
          in: [
            ListingStatus.ACTIVE,
            ListingStatus.PENDING_REVIEW,
            ListingStatus.RESERVED,
          ],
        },
      },
      data: {
        status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
      },
    });

    // 4. Emit Audit Log
    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_MARKETER_FRAUD_SUSPENDED,
      entityType: 'USER',
      entityId: userId,
      justificationReason: reason,
      metadata: {
        targetUserId: userId,
        reason,
      },
    });

    this.logger.warn(`User ${userId} suspended for compliance/fraud by admin ${adminId}`);
  }

  async recordAutomatedFraudEventIfThresholdReached(
    userId: string,
    triggerType: FraudEventType,
  ): Promise<FraudLogDto | null> {
    const settings = await this.prisma.platformSetting.findUnique({
      where: { id: 'default' },
    });

    const windowHours = settings?.fraudWindowHours ?? 72;
    const rejectedProofThreshold = settings?.fraudRejectedProofThreshold ?? 3;
    const now = this.clockService.now();
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    if (triggerType === FraudEventType.REPEATED_REJECTED_PROOFS) {
      // Check rejected payments within window
      const rejectedProofsCount = await this.prisma.payment.count({
        where: {
          deal: {
            buyerProfile: { userId },
          },
          status: 'REJECTED',
          updatedAt: { gte: windowStart },
        },
      });

      if (rejectedProofsCount >= rejectedProofThreshold) {
        // Check if open case already exists for this user and event type
        const existingOpenCase = await this.prisma.fraudLog.findFirst({
          where: {
            targetUserId: userId,
            eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
            status: { in: [FraudStatus.OPEN, FraudStatus.INVESTIGATING] },
          },
        });

        if (!existingOpenCase) {
          const year = now.getFullYear();
          const countThisYear = await this.prisma.fraudLog.count({
            where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
          });
          const caseNumber = `FRD-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

          const created = await this.prisma.fraudLog.create({
            data: {
              caseNumber,
              eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
              severity: FraudSeverity.HIGH,
              status: FraudStatus.OPEN,
              targetUserId: userId,
              detectedReasons: [
                `رصد ${rejectedProofsCount} إيصالات سداد مرفوضة خلال ${windowHours} ساعة (الحد المسموح به: ${rejectedProofThreshold})`,
              ],
              description:
                'تم رصد تكرار رفض إيصالات السداد البنكي بنظام التنبيه الآلي لمكافحة الاحتيال',
            },
          });

          await this.auditService.record(this.prisma, {
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
            action: AUDIT_ACTION_FRAUD_LOGGED,
            entityType: 'FRAUD_LOG',
            entityId: created.id,
            justificationReason: 'رصد آلي لتجاوز حد إيصالات السداد المرفوضة',
            metadata: {
              caseNumber: created.caseNumber,
              eventType: created.eventType,
              severity: created.severity,
              targetUserId: userId,
            },
          });

          return this.mapToDto(created);
        }
      }
    } else if (triggerType === FraudEventType.REPEATED_IBAN_CHANGES) {
      // Check IBAN change audit logs within window
      const ibanChangesCount = await this.prisma.auditLog.count({
        where: {
          entityType: 'PayoutAccount',
          actorId: userId,
          createdAt: { gte: windowStart },
        },
      });

      if (ibanChangesCount > 2) {
        const existingOpenCase = await this.prisma.fraudLog.findFirst({
          where: {
            targetUserId: userId,
            eventType: FraudEventType.REPEATED_IBAN_CHANGES,
            status: { in: [FraudStatus.OPEN, FraudStatus.INVESTIGATING] },
          },
        });

        if (!existingOpenCase) {
          const year = now.getFullYear();
          const countThisYear = await this.prisma.fraudLog.count({
            where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
          });
          const caseNumber = `FRD-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

          const created = await this.prisma.fraudLog.create({
            data: {
              caseNumber,
              eventType: FraudEventType.REPEATED_IBAN_CHANGES,
              severity: FraudSeverity.MEDIUM,
              status: FraudStatus.OPEN,
              targetUserId: userId,
              detectedReasons: [
                `تعديل الحساب البنكي ${ibanChangesCount} مرات خلال ${windowHours} ساعة`,
              ],
              description:
                'تم رصد تكرار تعديل الآيبان البنكي بنظام التنبيه الآلي لمكافحة الاحتيال',
            },
          });

          await this.auditService.record(this.prisma, {
            actorId: 'SYSTEM',
            actorType: 'SYSTEM',
            action: AUDIT_ACTION_FRAUD_LOGGED,
            entityType: 'FRAUD_LOG',
            entityId: created.id,
            justificationReason: 'رصد آلي لتكرار تعديل الحسابات البنكية',
            metadata: {
              caseNumber: created.caseNumber,
              eventType: created.eventType,
              severity: created.severity,
              targetUserId: userId,
            },
          });

          return this.mapToDto(created);
        }
      }
    }

    return null;
  }

  private mapToDto(log: any): FraudLogDto {
    return {
      id: log.id,
      caseNumber: log.caseNumber,
      eventType: log.eventType as FraudEventType,
      severity: log.severity as FraudSeverity,
      status: log.status as FraudStatus,
      targetUserId: log.targetUserId ?? null,
      targetListingId: log.targetListingId ?? null,
      targetDealId: log.targetDealId ?? null,
      detectedReasons: log.detectedReasons ?? [],
      description: log.description,
      penaltySar: log.penaltySar ? Number(log.penaltySar) : null,
      penaltyReason: log.penaltyReason ?? null,
      marketerSuspended: Boolean(log.marketerSuspended),
      loggedByAdminId: log.loggedByAdminId ?? null,
      loggedByAdminName: log.loggedByAdmin?.fullName ?? null,
      resolvedByAdminId: log.resolvedByAdminId ?? null,
      resolvedByAdminName: log.resolvedByAdmin?.fullName ?? null,
      resolutionNotes: log.resolutionNotes ?? null,
      metadata: log.metadata ?? null,
      targetUser: log.targetUser
        ? {
            id: log.targetUser.id,
            fullName: log.targetUser.fullName,
            mobileNumber: log.targetUser.mobileNumber,
            email: log.targetUser.email,
            profileStatus: log.targetUser.status,
          }
        : null,
      createdAt: log.createdAt?.toISOString?.() ?? String(log.createdAt),
      updatedAt: log.updatedAt?.toISOString?.() ?? String(log.updatedAt),
    };
  }
}
