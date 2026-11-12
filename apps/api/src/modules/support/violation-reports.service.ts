import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjudicateViolationReportInput,
  AdminViolationQueueQueryInput,
  CreateViolationReportInput,
  DismissViolationReportInput,
  VIOLATION_REPORT_ADJUDICATED,
  VIOLATION_REPORT_DISMISSED,
  VIOLATION_REPORT_NOT_FOUND,
  ViolationReportDetailDto,
  ViolationReportItemDto,
  ViolationReportsQueueResponseDto,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ViolationReportsService {
  private readonly logger = new Logger(ViolationReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Generates a unique sequential report number: VR-{year}-{seq}
   */
  private async generateReportNumber(now: Date): Promise<string> {
    const year = now.getFullYear();
    const prefix = `VR-${year}-`;
    const count = await this.prisma.violationReport.count({
      where: {
        reportNumber: {
          startsWith: prefix,
        },
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    let candidate = `${prefix}${seq}`;

    // Collision check guard
    let exists = await this.prisma.violationReport.findUnique({
      where: { reportNumber: candidate },
      select: { id: true },
    });

    if (exists) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Public or Authenticated Violation Report submission (FR-37)
   */
  async createReport(
    input: CreateViolationReportInput,
    reporterUserId?: string | null,
  ) {
    const now = this.clockService.now();
    const reportNumber = await this.generateReportNumber(now);

    const report = await this.prisma.violationReport.create({
      data: {
        reportNumber,
        reporterUserId: reporterUserId || null,
        reporterName: input.reporterName || null,
        reporterEmail: input.reporterEmail || null,
        reporterPhone: input.reporterPhone || null,
        targetType: input.targetType,
        targetListingId: input.targetListingId || null,
        targetUserId: input.targetUserId || null,
        category: input.category,
        description: input.description,
        attachments: input.attachments || [],
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Violation report ${report.reportNumber} created for ${report.targetType} (ID: ${report.targetListingId || report.targetUserId || 'N/A'})`,
    );

    return {
      reportNumber: report.reportNumber,
      status: report.status,
      message: 'تم إرسال البلاغ بنجاح وسيتم تدقيقه من قبل فريق الامتثال',
    };
  }

  /**
   * Retrieves paginated admin queue of violation reports with KPI counts
   */
  async getQueue(
    query: AdminViolationQueueQueryInput,
  ): Promise<ViolationReportsQueueResponseDto> {
    const { status, category, targetType, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ViolationReportWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (targetType && targetType !== 'ALL') {
      where.targetType = targetType;
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { reportNumber: { contains: term, mode: 'insensitive' } },
        { reporterName: { contains: term, mode: 'insensitive' } },
        { reporterEmail: { contains: term, mode: 'insensitive' } },
        { reporterPhone: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total, pending, underReview, resolved, dismissed] =
      await Promise.all([
        this.prisma.violationReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            assignedAdmin: { select: { id: true, fullName: true, email: true } },
            resolvedByAdmin: { select: { id: true, fullName: true, email: true } },
            targetListing: {
              select: {
                id: true,
                title: true,
                askPrice: true,
                sellerProfile: {
                  select: {
                    user: { select: { fullName: true } },
                    falLicense: { select: { licenseNumber: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.violationReport.count({ where }),
        this.prisma.violationReport.count({ where: { status: 'PENDING' } }),
        this.prisma.violationReport.count({ where: { status: 'UNDER_REVIEW' } }),
        this.prisma.violationReport.count({ where: { status: 'RESOLVED' } }),
        this.prisma.violationReport.count({ where: { status: 'DISMISSED' } }),
      ]);

    const mappedItems: ViolationReportItemDto[] = items.map((r) => {
      let targetPreview: ViolationReportItemDto['targetPreview'] = null;
      if (r.targetListing) {
        targetPreview = {
          title: r.targetListing.title,
          price: r.targetListing.askPrice ? Number(r.targetListing.askPrice) : null,
          brokerName: r.targetListing.sellerProfile?.user?.fullName || null,
          licenseNumber:
            r.targetListing.sellerProfile?.falLicense?.licenseNumber || null,
        };
      }

      return {
        id: r.id,
        reportNumber: r.reportNumber,
        reporterUserId: r.reporterUserId,
        reporterName: r.reporterName,
        reporterEmail: r.reporterEmail,
        reporterPhone: r.reporterPhone,
        targetType: r.targetType,
        targetListingId: r.targetListingId,
        targetUserId: r.targetUserId,
        category: r.category,
        description: r.description,
        attachments: r.attachments,
        status: r.status,
        resolutionAction: r.resolutionAction,
        resolutionNotes: r.resolutionNotes,
        assignedAdminId: r.assignedAdminId,
        assignedAdminName: r.assignedAdmin?.fullName || null,
        assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
        resolvedByAdminId: r.resolvedByAdminId,
        resolvedByAdminName: r.resolvedByAdmin?.fullName || null,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        targetPreview,
      };
    });

    const totalAll = pending + underReview + resolved + dismissed;

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      counts: {
        total: totalAll,
        pending,
        underReview,
        resolved,
        dismissed,
      },
    };
  }

  /**
   * Retrieves full report detail, signed attachments, and audit trail
   */
  async getReportById(id: string): Promise<ViolationReportDetailDto> {
    const report = await this.prisma.violationReport.findUnique({
      where: { id },
      include: {
        assignedAdmin: { select: { id: true, fullName: true, email: true } },
        resolvedByAdmin: { select: { id: true, fullName: true, email: true } },
        targetListing: {
          select: {
            id: true,
            title: true,
            askPrice: true,
            sellerProfile: {
              select: {
                user: { select: { fullName: true } },
                falLicense: { select: { licenseNumber: true } },
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException({
        code: VIOLATION_REPORT_NOT_FOUND,
        message: 'بلاغ المخالفة غير موجود',
      });
    }

    // Generate signed URLs for attachments
    const signedAttachments = await Promise.all(
      (report.attachments || []).map(async (keyOrUrl) => {
        if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
          return keyOrUrl;
        }
        try {
          return await this.storageService.getPresignedDownloadUrl(keyOrUrl);
        } catch {
          return keyOrUrl;
        }
      }),
    );

    // Fetch Audit trail
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'VIOLATION_REPORT',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Resolve actor names
    const actorIds = [...new Set(auditLogs.map((l) => l.actorId))];
    const admins = await this.prisma.adminUser.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true },
    });
    const adminMap = new Map(admins.map((a) => [a.id, a.fullName]));

    const auditTrail = auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actorAdminName: adminMap.get(log.actorId) || 'النظام الإداري',
      timestamp: log.createdAt.toISOString(),
      details: (log.payload as Record<string, unknown>) || null,
    }));

    let targetPreview: ViolationReportDetailDto['targetPreview'] = null;
    if (report.targetListing) {
      targetPreview = {
        title: report.targetListing.title,
        price: report.targetListing.askPrice ? Number(report.targetListing.askPrice) : null,
        brokerName: report.targetListing.sellerProfile?.user?.fullName || null,
        licenseNumber:
          report.targetListing.sellerProfile?.falLicense?.licenseNumber || null,
      };
    }

    return {
      id: report.id,
      reportNumber: report.reportNumber,
      reporterUserId: report.reporterUserId,
      reporterName: report.reporterName,
      reporterEmail: report.reporterEmail,
      reporterPhone: report.reporterPhone,
      targetType: report.targetType,
      targetListingId: report.targetListingId,
      targetUserId: report.targetUserId,
      category: report.category,
      description: report.description,
      attachments: report.attachments,
      status: report.status,
      resolutionAction: report.resolutionAction,
      resolutionNotes: report.resolutionNotes,
      assignedAdminId: report.assignedAdminId,
      assignedAdminName: report.assignedAdmin?.fullName || null,
      assignedAt: report.assignedAt ? report.assignedAt.toISOString() : null,
      resolvedByAdminId: report.resolvedByAdminId,
      resolvedByAdminName: report.resolvedByAdmin?.fullName || null,
      resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      targetPreview,
      signedAttachments,
      auditTrail,
    };
  }

  /**
   * Adjudicate report with mandatory action, notes, and audit log
   */
  async adjudicateReport(
    id: string,
    input: {
      action: ViolationReportItemDto['resolutionAction'] & string;
      notes: string;
      status?: 'RESOLVED' | 'DISMISSED';
    },
    admin: { id: string; fullName: string; role: string },
    ipAddress?: string,
  ) {
    const report = await this.prisma.violationReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException({
        code: VIOLATION_REPORT_NOT_FOUND,
        message: 'بلاغ المخالفة غير موجود',
      });
    }

    const now = this.clockService.now();
    const newStatus = input.status || 'RESOLVED';

    const [updatedReport] = await this.prisma.$transaction([
      this.prisma.violationReport.update({
        where: { id },
        data: {
          status: newStatus,
          resolutionAction: input.action,
          resolutionNotes: input.notes,
          resolvedByAdminId: admin.id,
          resolvedAt: now,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: VIOLATION_REPORT_ADJUDICATED,
          entityType: 'VIOLATION_REPORT',
          entityId: id,
          payload: {
            reportNumber: report.reportNumber,
            previousStatus: report.status,
            newStatus,
            action: input.action,
            notes: input.notes,
            resolvedByAdminName: admin.fullName,
            resolvedAt: now.toISOString(),
          },
          ipAddress: ipAddress || null,
          createdAt: now,
        },
      }),
    ]);

    this.logger.log(
      `Violation report ${report.reportNumber} adjudicated by admin ${admin.id}: action=${input.action}`,
    );

    return updatedReport;
  }

  /**
   * Dismiss report with explanatory notes and audit log
   */
  async dismissReport(
    id: string,
    input: DismissViolationReportInput,
    admin: { id: string; fullName: string; role: string },
    ipAddress?: string,
  ) {
    const report = await this.prisma.violationReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException({
        code: VIOLATION_REPORT_NOT_FOUND,
        message: 'بلاغ المخالفة غير موجود',
      });
    }

    const now = this.clockService.now();

    const [updatedReport] = await this.prisma.$transaction([
      this.prisma.violationReport.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          resolutionAction: 'NO_ACTION',
          resolutionNotes: input.notes,
          resolvedByAdminId: admin.id,
          resolvedAt: now,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: VIOLATION_REPORT_DISMISSED,
          entityType: 'VIOLATION_REPORT',
          entityId: id,
          payload: {
            reportNumber: report.reportNumber,
            previousStatus: report.status,
            notes: input.notes,
            dismissedByAdminName: admin.fullName,
            dismissedAt: now.toISOString(),
          },
          ipAddress: ipAddress || null,
          createdAt: now,
        },
      }),
    ]);

    this.logger.log(
      `Violation report ${report.reportNumber} dismissed by admin ${admin.id}`,
    );

    return updatedReport;
  }
}
