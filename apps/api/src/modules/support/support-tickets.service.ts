import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  AdminTicketQueueQueryInput,
  CreateSupportTicketInput,
  CreateTicketMessageInput,
  resolveAdminPermissions,
  SUPPORT_TICKET_ASSIGNED,
  SUPPORT_TICKET_MESSAGE_ADDED,
  SUPPORT_TICKET_NOT_FOUND,
  SUPPORT_TICKET_STATUS_UPDATED,
  SupportTicketCountsDto,
  SupportTicketDetailDto,
  SupportTicketItemDto,
  SupportTicketsQueueResponseDto,
  TICKET_SLA_FIRST_RESPONSE_HOURS,
  TICKET_SLA_RESOLUTION_HOURS,
  TICKET_SLA_RESOLUTION_WARNING_THRESHOLD_HOURS,
  TICKET_SLA_WARNING_THRESHOLD_MINUTES,
  TicketMessageDto,
  TicketSlaStatusDto,
  UpdateSupportTicketStatusInput,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Generates a unique sequential ticket number: TIK-{year}-{seq}
   */
  private async generateTicketNumber(now: Date): Promise<string> {
    const year = now.getFullYear();
    const prefix = `TIK-${year}-`;
    const count = await this.prisma.supportTicket.count({
      where: {
        ticketNumber: {
          startsWith: prefix,
        },
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    let candidate = `${prefix}${seq}`;

    // Collision check guard
    let exists = await this.prisma.supportTicket.findUnique({
      where: { ticketNumber: candidate },
      select: { id: true },
    });

    if (exists) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Computes dynamic SLA status for first response and resolution based on ClockService.now()
   */
  calculateSlaStatus(
    ticket: {
      firstResponseDueAt: Date;
      firstRespondedAt: Date | null;
      resolutionDueAt: Date;
      resolvedAt: Date | null;
    },
    now: Date,
  ): { firstResponseSla: TicketSlaStatusDto; resolutionSla: TicketSlaStatusDto } {
    // First Response SLA
    let firstResponseSla: TicketSlaStatusDto;
    if (ticket.firstRespondedAt) {
      const isBreached =
        ticket.firstRespondedAt.getTime() > ticket.firstResponseDueAt.getTime();
      firstResponseSla = {
        state: isBreached ? 'BREACHED' : 'ON_TRACK',
        dueAt: ticket.firstResponseDueAt.toISOString(),
        remainingMinutes: 0,
        isBreached,
      };
    } else {
      const remainingMinutes = Math.floor(
        (ticket.firstResponseDueAt.getTime() - now.getTime()) / 60000,
      );
      const isBreached = now.getTime() > ticket.firstResponseDueAt.getTime();
      let state: TicketSlaStatusDto['state'] = 'ON_TRACK';
      if (isBreached) {
        state = 'BREACHED';
      } else if (remainingMinutes <= TICKET_SLA_WARNING_THRESHOLD_MINUTES) {
        state = 'NEARING_BREACH';
      }

      firstResponseSla = {
        state,
        dueAt: ticket.firstResponseDueAt.toISOString(),
        remainingMinutes: Math.max(0, remainingMinutes),
        isBreached,
      };
    }

    // Resolution SLA
    let resolutionSla: TicketSlaStatusDto;
    if (ticket.resolvedAt) {
      const isBreached =
        ticket.resolvedAt.getTime() > ticket.resolutionDueAt.getTime();
      resolutionSla = {
        state: isBreached ? 'BREACHED' : 'ON_TRACK',
        dueAt: ticket.resolutionDueAt.toISOString(),
        remainingMinutes: 0,
        isBreached,
      };
    } else {
      const remainingMinutes = Math.floor(
        (ticket.resolutionDueAt.getTime() - now.getTime()) / 60000,
      );
      const isBreached = now.getTime() > ticket.resolutionDueAt.getTime();
      let state: TicketSlaStatusDto['state'] = 'ON_TRACK';
      if (isBreached) {
        state = 'BREACHED';
      } else if (
        remainingMinutes <=
        TICKET_SLA_RESOLUTION_WARNING_THRESHOLD_HOURS * 60
      ) {
        state = 'NEARING_BREACH';
      }

      resolutionSla = {
        state,
        dueAt: ticket.resolutionDueAt.toISOString(),
        remainingMinutes: Math.max(0, remainingMinutes),
        isBreached,
      };
    }

    return { firstResponseSla, resolutionSla };
  }

  /**
   * User creates a support ticket (FR-38)
   */
  async createTicket(
    input: CreateSupportTicketInput,
    userId?: string | null,
  ) {
    const now = this.clockService.now();
    const ticketNumber = await this.generateTicketNumber(now);

    const firstResponseDueAt = new Date(
      now.getTime() + TICKET_SLA_FIRST_RESPONSE_HOURS * 60 * 60 * 1000,
    );
    const resolutionDueAt = new Date(
      now.getTime() + TICKET_SLA_RESOLUTION_HOURS * 60 * 60 * 1000,
    );

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: userId || null,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        category: input.category,
        priority: input.priority,
        subject: input.subject,
        description: input.description,
        attachments: input.attachments || [],
        status: 'OPEN',
        firstResponseDueAt,
        resolutionDueAt,
      },
    });

    this.logger.log(
      `Support ticket ${ticket.ticketNumber} opened by ${input.contactEmail} (priority: ${ticket.priority})`,
    );

    return {
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
      resolutionDueAt: ticket.resolutionDueAt.toISOString(),
      message: 'تم فتح تذكرة الدعم الفني بنجاح، وسيتواصل معك الفريق في أقرب وقت',
    };
  }

  /**
   * Retrieves paginated admin queue of support tickets with live SLA calculations
   */
  async getQueue(
    query: AdminTicketQueueQueryInput,
  ): Promise<SupportTicketsQueueResponseDto> {
    const now = this.clockService.now();
    const { status, category, priority, slaState, assignedAdminId, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }

    if (assignedAdminId) {
      if (assignedAdminId === 'UNASSIGNED') {
        where.assignedAdminId = null;
      } else if (assignedAdminId !== 'ALL') {
        where.assignedAdminId = assignedAdminId;
      }
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { contactName: { contains: term, mode: 'insensitive' } },
        { contactEmail: { contains: term, mode: 'insensitive' } },
        { contactPhone: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Compute basic status counts
    const [openCount, inProgressCount, resolvedCount, closedCount] =
      await Promise.all([
        this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
        this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
        this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
        this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      ]);

    const totalCount = openCount + inProgressCount + resolvedCount + closedCount;

    // SLA Counts on active tickets
    const activeTickets = await this.prisma.supportTicket.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: {
        firstResponseDueAt: true,
        firstRespondedAt: true,
        resolutionDueAt: true,
        resolvedAt: true,
      },
    });

    let slaNearingBreach = 0;
    let slaBreached = 0;

    for (const t of activeTickets) {
      const sla = this.calculateSlaStatus(t, now);
      if (sla.firstResponseSla.isBreached || sla.resolutionSla.isBreached) {
        slaBreached++;
      } else if (
        sla.firstResponseSla.state === 'NEARING_BREACH' ||
        sla.resolutionSla.state === 'NEARING_BREACH'
      ) {
        slaNearingBreach++;
      }
    }

    const counts: SupportTicketCountsDto = {
      total: totalCount,
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      closed: closedCount,
      slaNearingBreach,
      slaBreached,
    };

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          assignedAdmin: { select: { id: true, fullName: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    const mappedItems: SupportTicketItemDto[] = items.map((t) => {
      const sla = this.calculateSlaStatus(t, now);
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        userId: t.userId,
        contactName: t.contactName,
        contactEmail: t.contactEmail,
        contactPhone: t.contactPhone,
        category: t.category,
        priority: t.priority,
        subject: t.subject,
        description: t.description,
        attachments: t.attachments,
        status: t.status,
        firstResponseDueAt: t.firstResponseDueAt.toISOString(),
        firstRespondedAt: t.firstRespondedAt ? t.firstRespondedAt.toISOString() : null,
        resolutionDueAt: t.resolutionDueAt.toISOString(),
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        closedAt: t.closedAt ? t.closedAt.toISOString() : null,
        assignedAdminId: t.assignedAdminId,
        assignedAdminName: t.assignedAdmin?.fullName || null,
        assignedAt: t.assignedAt ? t.assignedAt.toISOString() : null,
        resolutionSummary: t.resolutionSummary,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        firstResponseSla: sla.firstResponseSla,
        resolutionSla: sla.resolutionSla,
        messagesCount: t._count.messages,
      };
    });

    // Optional SLA state filtering post-fetch or filter if requested
    let filteredItems = mappedItems;
    if (slaState && slaState !== 'ALL') {
      filteredItems = mappedItems.filter(
        (i) =>
          i.firstResponseSla.state === slaState ||
          i.resolutionSla.state === slaState,
      );
    }

    return {
      items: filteredItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      counts,
    };
  }

  /**
   * Retrieves full ticket details, messages (internal notes filtered by Notes.Manage), signed attachments, and audit trail
   */
  async getTicketById(
    id: string,
    canManageNotes: boolean,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        assignedAdmin: { select: { id: true, fullName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorAdmin: { select: { id: true, fullName: true } },
            authorUser: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: SUPPORT_TICKET_NOT_FOUND,
        message: 'تذكرة الدعم الفني غير موجودة',
      });
    }

    const now = this.clockService.now();
    const sla = this.calculateSlaStatus(ticket, now);

    // Filter messages: only users with Notes.Manage see isInternal === true
    const visibleMessages = ticket.messages.filter(
      (m) => !m.isInternal || canManageNotes,
    );

    // Sign URLs for ticket attachments
    const signedTicketAttachments = await Promise.all(
      (ticket.attachments || []).map(async (keyOrUrl) => {
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

    // Sign URLs for messages attachments
    const mappedMessages: TicketMessageDto[] = await Promise.all(
      visibleMessages.map(async (m) => {
        const signedMsgAttachments = await Promise.all(
          (m.attachments || []).map(async (keyOrUrl) => {
            if (
              keyOrUrl.startsWith('http://') ||
              keyOrUrl.startsWith('https://')
            ) {
              return keyOrUrl;
            }
            try {
              return await this.storageService.getPresignedDownloadUrl(
                keyOrUrl,
              );
            } catch {
              return keyOrUrl;
            }
          }),
        );

        return {
          id: m.id,
          ticketId: m.ticketId,
          authorAdminId: m.authorAdminId,
          authorUserId: m.authorUserId,
          authorType: m.authorType as 'ADMIN' | 'USER',
          authorName: m.authorName,
          message: m.message,
          attachments: m.attachments,
          signedAttachments: signedMsgAttachments,
          isInternal: m.isInternal,
          createdAt: m.createdAt.toISOString(),
        };
      }),
    );

    // Fetch audit trail
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'SUPPORT_TICKET',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

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

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: ticket.userId,
      contactName: ticket.contactName,
      contactEmail: ticket.contactEmail,
      contactPhone: ticket.contactPhone,
      category: ticket.category,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description,
      attachments: ticket.attachments,
      status: ticket.status,
      firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
      firstRespondedAt: ticket.firstRespondedAt
        ? ticket.firstRespondedAt.toISOString()
        : null,
      resolutionDueAt: ticket.resolutionDueAt.toISOString(),
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      assignedAdminId: ticket.assignedAdminId,
      assignedAdminName: ticket.assignedAdmin?.fullName || null,
      assignedAt: ticket.assignedAt ? ticket.assignedAt.toISOString() : null,
      resolutionSummary: ticket.resolutionSummary,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      firstResponseSla: sla.firstResponseSla,
      resolutionSla: sla.resolutionSla,
      signedAttachments: signedTicketAttachments,
      messages: mappedMessages,
      auditTrail,
    };
  }

  /**
   * Updates support ticket status with mandatory resolutionSummary for RESOLVED/CLOSED
   */
  async updateStatus(
    id: string,
    input: UpdateSupportTicketStatusInput,
    admin: { id: string; fullName: string; role: string },
    ipAddress?: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: SUPPORT_TICKET_NOT_FOUND,
        message: 'تذكرة الدعم الفني غير موجودة',
      });
    }

    const now = this.clockService.now();
    const updateData: Prisma.SupportTicketUpdateInput = {
      status: input.status,
    };

    if (input.status === 'RESOLVED') {
      updateData.resolvedAt = now;
      updateData.resolutionSummary = input.resolutionSummary;
    } else if (input.status === 'CLOSED') {
      updateData.closedAt = now;
      if (input.resolutionSummary) {
        updateData.resolutionSummary = input.resolutionSummary;
      }
    }

    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: SUPPORT_TICKET_STATUS_UPDATED,
          entityType: 'SUPPORT_TICKET',
          entityId: id,
          payload: {
            ticketNumber: ticket.ticketNumber,
            previousStatus: ticket.status,
            newStatus: input.status,
            resolutionSummary: input.resolutionSummary || null,
            updatedByAdminName: admin.fullName,
            updatedAt: now.toISOString(),
          },
          ipAddress: ipAddress || null,
          createdAt: now,
        },
      }),
    ]);

    this.logger.log(
      `Support ticket ${ticket.ticketNumber} status changed: ${ticket.status} -> ${input.status} by admin ${admin.id}`,
    );

    return updatedTicket;
  }

  /**
   * Assigns ticket to an administrator
   */
  async assignTicket(
    id: string,
    targetAdminId: string | null | undefined,
    admin: { id: string; fullName: string; role: string },
    ipAddress?: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: SUPPORT_TICKET_NOT_FOUND,
        message: 'تذكرة الدعم الفني غير موجودة',
      });
    }

    const assignedId = targetAdminId ?? admin.id;
    const now = this.clockService.now();

    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id },
        data: {
          assignedAdminId: assignedId,
          assignedAt: assignedId ? now : null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: SUPPORT_TICKET_ASSIGNED,
          entityType: 'SUPPORT_TICKET',
          entityId: id,
          payload: {
            ticketNumber: ticket.ticketNumber,
            previousAssignedAdminId: ticket.assignedAdminId,
            newAssignedAdminId: assignedId,
            assignedByAdminName: admin.fullName,
            assignedAt: now.toISOString(),
          },
          ipAddress: ipAddress || null,
          createdAt: now,
        },
      }),
    ]);

    this.logger.log(
      `Support ticket ${ticket.ticketNumber} assigned to ${assignedId} by ${admin.id}`,
    );

    return updatedTicket;
  }

  /**
   * Adds message or staff note to ticket
   */
  async addMessage(
    id: string,
    input: {
      message: string;
      isInternal?: boolean;
      attachments?: string[];
    },
    author: {
      id: string;
      fullName: string;
      role?: string;
      isStaff: boolean;
      permissions?: string[];
    },
    ipAddress?: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: SUPPORT_TICKET_NOT_FOUND,
        message: 'تذكرة الدعم الفني غير موجودة',
      });
    }

    if (input.isInternal) {
      if (!author.isStaff) {
        throw new ForbiddenException('الملاحظات الداخلية خاصة بالمشرفين فقط');
      }

      // Check Notes.Manage permission
      const permissions = resolveAdminPermissions(
        author.role as AdminRole,
        author.permissions || [],
      );
      const canManageNotes =
        author.role === AdminRole.SUPER_ADMIN ||
        permissions.includes('Notes.Manage');

      if (!canManageNotes) {
        throw new ForbiddenException(
          'لا تملك صلاحية كتابة ملاحظات داخلية (Notes.Manage)',
        );
      }
    }

    const now = this.clockService.now();

    const operations: Prisma.PrismaPromise<any>[] = [
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorAdminId: author.isStaff ? author.id : null,
          authorUserId: !author.isStaff ? author.id : null,
          authorType: author.isStaff ? 'ADMIN' : 'USER',
          authorName: author.fullName,
          message: input.message,
          attachments: input.attachments || [],
          isInternal: input.isInternal,
          createdAt: now,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: author.id,
          actorType: author.isStaff ? 'ADMIN' : 'USER',
          action: SUPPORT_TICKET_MESSAGE_ADDED,
          entityType: 'SUPPORT_TICKET',
          entityId: id,
          payload: {
            ticketNumber: ticket.ticketNumber,
            authorName: author.fullName,
            isInternal: input.isInternal,
            messageSnippet: input.message.slice(0, 100),
          },
          ipAddress: ipAddress || null,
          createdAt: now,
        },
      }),
    ];

    // If staff reply and first response has not been recorded yet, mark firstRespondedAt
    if (author.isStaff && !ticket.firstRespondedAt) {
      operations.push(
        this.prisma.supportTicket.update({
          where: { id },
          data: {
            firstRespondedAt: now,
            status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
          },
        }),
      );
    }

    const [createdMessage] = await this.prisma.$transaction(operations);

    this.logger.log(
      `Message added to ticket ${ticket.ticketNumber} by ${author.fullName} (internal: ${input.isInternal})`,
    );

    return createdMessage;
  }
}
