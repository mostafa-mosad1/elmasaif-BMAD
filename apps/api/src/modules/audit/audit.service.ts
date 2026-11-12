import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AuditLog } from '@prisma/client';
import {
  AuditLogListItemDto,
  AuditLogDetailDto,
  PaginatedAuditLogsDto,
  CreateAuditRecordInput,
  AuditLogQueryInput,
  AuditLogPayload,
  AUDIT_LOG_NOT_FOUND,
} from '@elmasaif/shared';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only forensic audit record creation (Story 8.7 / BR-19)
   *
   * Accepts optional PrismaClient or TransactionClient to participate
   * atomically in multi-step domain workflows.
   */
  async record(
    prismaClientOrTx: any,
    input: CreateAuditRecordInput,
  ): Promise<AuditLog> {
    const client = prismaClientOrTx?.auditLog ? prismaClientOrTx : this.prisma;

    const payload: AuditLogPayload = {
      actorName:
        input.actorName ||
        (input.actorType === 'SYSTEM' ? 'النظام (System)' : undefined),
      actorRole: input.actorRole || input.actorType,
      justificationReason: input.justificationReason || null,
      beforeSnapshot: input.beforeSnapshot || null,
      afterSnapshot: input.afterSnapshot || null,
      changedKeys: input.changedKeys || [],
      metadata: input.metadata || null,
      userAgent: input.userAgent || null,
    };

    return await client.auditLog.create({
      data: {
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress || null,
        payload: payload as any,
      },
    });
  }

  /**
   * Query paginated audit log entries with dynamic multi-attribute filtering
   * and free-text search across actions, entities, and justification reasons.
   */
  async findAuditLogs(
    query: AuditLogQueryInput,
  ): Promise<PaginatedAuditLogsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.actorType) {
      where.actorType = query.actorType;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (typeof query.endDate === 'string' && query.endDate.length === 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { entityId: { contains: term, mode: 'insensitive' } },
        { actorId: { contains: term, mode: 'insensitive' } },
        { payload: { path: ['actorName'], string_contains: term } },
        { payload: { path: ['justificationReason'], string_contains: term } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: rows.map((row) => this.mapToListItemDto(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve single audit log detail with complete before/after state snapshots.
   */
  async getAuditLogById(id: string): Promise<AuditLogDetailDto> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException({
        code: AUDIT_LOG_NOT_FOUND,
        message: 'سجل التدقيق المطلوب غير موجود',
      });
    }

    return this.mapToDetailDto(log);
  }

  /**
   * Retrieve chronological audit history for a specific entity.
   */
  async getEntityAuditHistory(
    entityType: string,
    entityId: string,
  ): Promise<AuditLogDetailDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.mapToDetailDto(row));
  }

  /**
   * Map raw AuditLog database row to projection DTO for table views.
   */
  private mapToListItemDto(log: AuditLog): AuditLogListItemDto {
    const payload = (log.payload || {}) as AuditLogPayload;
    const actorName =
      payload.actorName ||
      (log.actorType === 'SYSTEM' ? 'النظام (System)' : log.actorId);
    const actorRole = payload.actorRole || log.actorType;
    const hasSnapshots = Boolean(
      payload.beforeSnapshot || payload.afterSnapshot,
    );

    return {
      id: log.id,
      actorId: log.actorId,
      actorType: log.actorType,
      actorName,
      actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
      justificationReason: payload.justificationReason || null,
      hasSnapshots,
    };
  }

  /**
   * Map raw AuditLog database row to complete forensic Detail DTO.
   */
  private mapToDetailDto(log: AuditLog): AuditLogDetailDto {
    const payload = (log.payload || {}) as AuditLogPayload;
    const actorName =
      payload.actorName ||
      (log.actorType === 'SYSTEM' ? 'النظام (System)' : log.actorId);
    const actorRole = payload.actorRole || log.actorType;

    return {
      id: log.id,
      actorId: log.actorId,
      actorType: log.actorType,
      actorName,
      actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: payload.userAgent || null,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
      justificationReason: payload.justificationReason || null,
      beforeSnapshot: payload.beforeSnapshot || null,
      afterSnapshot: payload.afterSnapshot || null,
      changedKeys: Array.isArray(payload.changedKeys) ? payload.changedKeys : [],
      metadata: payload.metadata || null,
    };
  }
}

