import { AuditActorType } from '../constants/audit';

export interface AuditLogListItemDto {
  id: string;
  actorId: string;
  actorType: AuditActorType | string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
  justificationReason: string | null;
  hasSnapshots: boolean;
}

export interface AuditLogDetailDto {
  id: string;
  actorId: string;
  actorType: AuditActorType | string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  justificationReason: string | null;
  beforeSnapshot: Record<string, any> | null;
  afterSnapshot: Record<string, any> | null;
  changedKeys: string[];
  metadata: Record<string, any> | null;
}

export interface PaginatedAuditLogsDto {
  items: AuditLogListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateAuditRecordInput {
  actorId: string;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorName?: string;
  actorRole?: string;
  justificationReason?: string | null;
  beforeSnapshot?: Record<string, any> | null;
  afterSnapshot?: Record<string, any> | null;
  changedKeys?: string[];
  metadata?: Record<string, any> | null;
}

export interface AuditLogPayload {
  actorName?: string;
  actorRole?: string;
  justificationReason?: string | null;
  beforeSnapshot?: Record<string, any> | null;
  afterSnapshot?: Record<string, any> | null;
  changedKeys?: string[];
  metadata?: Record<string, any> | null;
  userAgent?: string | null;
}

