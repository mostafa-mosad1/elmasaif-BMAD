import type {
  TicketCategory,
  TicketMessageAuthorType,
  TicketPriority,
  TicketSlaState,
  TicketStatus,
  ViolationAction,
  ViolationCategory,
  ViolationReportStatus,
  ViolationTargetType,
} from '../constants/support';

/**
 * Target preview summary for violation queues
 */
export interface ViolationTargetPreviewDto {
  title?: string | null;
  price?: number | null;
  brokerName?: string | null;
  licenseNumber?: string | null;
}

/**
 * Violation report item in queues
 */
export interface ViolationReportItemDto {
  id: string;
  reportNumber: string;
  reporterUserId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  targetType: ViolationTargetType;
  targetListingId: string | null;
  targetUserId: string | null;
  category: ViolationCategory;
  description: string;
  attachments: string[];
  status: ViolationReportStatus;
  resolutionAction: ViolationAction | null;
  resolutionNotes: string | null;
  assignedAdminId: string | null;
  assignedAdminName?: string | null;
  assignedAt: string | null;
  resolvedByAdminId: string | null;
  resolvedByAdminName?: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  targetPreview?: ViolationTargetPreviewDto | null;
}

/**
 * Audit log entry snippet for details view
 */
export interface SupportAuditTrailItemDto {
  id: string;
  action: string;
  actorAdminName?: string | null;
  timestamp: string;
  details?: Record<string, unknown> | null;
}

/**
 * Full detail of a violation report
 */
export interface ViolationReportDetailDto extends ViolationReportItemDto {
  signedAttachments: string[];
  auditTrail?: SupportAuditTrailItemDto[];
}

/**
 * KPI summary counts for violation reports queue
 */
export interface ViolationReportCountsDto {
  total: number;
  pending: number;
  underReview: number;
  resolved: number;
  dismissed: number;
}

/**
 * Paginated violation reports response
 */
export interface ViolationReportsQueueResponseDto {
  items: ViolationReportItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: ViolationReportCountsDto;
}

/**
 * Calculated SLA status for first response or resolution
 */
export interface TicketSlaStatusDto {
  state: TicketSlaState;
  dueAt: string;
  remainingMinutes: number;
  isBreached: boolean;
}

/**
 * Support Ticket Message DTO
 */
export interface TicketMessageDto {
  id: string;
  ticketId: string;
  authorAdminId: string | null;
  authorUserId: string | null;
  authorType: TicketMessageAuthorType;
  authorName: string;
  message: string;
  attachments: string[];
  signedAttachments?: string[];
  isInternal: boolean;
  createdAt: string;
}

/**
 * Support ticket item in queues
 */
export interface SupportTicketItemDto {
  id: string;
  ticketNumber: string;
  userId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  attachments: string[];
  status: TicketStatus;
  firstResponseDueAt: string;
  firstRespondedAt: string | null;
  resolutionDueAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  assignedAdminId: string | null;
  assignedAdminName?: string | null;
  assignedAt: string | null;
  resolutionSummary: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseSla: TicketSlaStatusDto;
  resolutionSla: TicketSlaStatusDto;
  messagesCount?: number;
}

/**
 * Full detail of a support ticket
 */
export interface SupportTicketDetailDto extends SupportTicketItemDto {
  signedAttachments: string[];
  messages: TicketMessageDto[];
  auditTrail?: SupportAuditTrailItemDto[];
}

/**
 * KPI summary counts for support tickets queue
 */
export interface SupportTicketCountsDto {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  slaNearingBreach: number;
  slaBreached: number;
}

/**
 * Paginated support tickets response
 */
export interface SupportTicketsQueueResponseDto {
  items: SupportTicketItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: SupportTicketCountsDto;
}

