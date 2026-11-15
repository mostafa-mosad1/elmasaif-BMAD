import { z } from 'zod';
import { FraudEventType, FraudSeverity, FraudStatus } from '../enums/fraud';
import { createFraudLogSchema, resolveFraudLogSchema } from '../schemas/fraud.schema';

export type CreateFraudLogInput = z.infer<typeof createFraudLogSchema>;
export type ResolveFraudLogInput = z.infer<typeof resolveFraudLogSchema>;

export interface FraudLogDto {
  id: string;
  caseNumber: string;
  eventType: FraudEventType;
  severity: FraudSeverity;
  status: FraudStatus;
  targetUserId?: string | null;
  targetListingId?: string | null;
  targetDealId?: string | null;
  detectedReasons: string[];
  description: string;
  penaltySar?: number | null;
  penaltyReason?: string | null;
  marketerSuspended: boolean;
  loggedByAdminId?: string | null;
  loggedByAdminName?: string | null;
  resolvedByAdminId?: string | null;
  resolvedByAdminName?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, any> | null;
  targetUser?: {
    id: string;
    fullName: string;
    mobileNumber: string;
    email: string;
    profileStatus: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedFraudLogsDto {
  items: FraudLogDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RecordPenaltyInputDto {
  penaltySar: number;
  penaltyReason: string;
}

export interface SuspendMarketerInputDto {
  reason: string;
}

