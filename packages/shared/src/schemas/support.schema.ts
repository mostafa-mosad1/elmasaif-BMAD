import { z } from 'zod';
import {
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SLA_STATES,
  TICKET_STATUSES,
  VIOLATION_ACTIONS,
  VIOLATION_CATEGORIES,
  VIOLATION_REPORT_MAX_ATTACHMENTS,
  VIOLATION_REPORT_STATUSES,
  VIOLATION_TARGET_TYPES,
} from '../constants/support';

const SAUDI_PHONE_REGEX = /^(05|\+9665)[0-9]{8}$/;

/**
 * Public/User Schema to submit a violation report (FR-37)
 */
export const createViolationReportSchema = z.object({
  targetType: z.enum(VIOLATION_TARGET_TYPES),
  targetListingId: z.string().uuid().optional().nullable(),
  targetUserId: z.string().uuid().optional().nullable(),
  category: z.enum(VIOLATION_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  attachments: z
    .array(z.string().min(1))
    .max(VIOLATION_REPORT_MAX_ATTACHMENTS, `Maximum ${VIOLATION_REPORT_MAX_ATTACHMENTS} attachments allowed`)
    .default([]),
  reporterName: z.string().trim().min(2).max(100).optional().nullable(),
  reporterEmail: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  reporterPhone: z
    .string()
    .regex(SAUDI_PHONE_REGEX, 'Invalid Saudi mobile number (e.g. 05XXXXXXXX or +9665XXXXXXXX)')
    .optional()
    .nullable()
    .or(z.literal('')),
});

export type CreateViolationReportInput = z.infer<typeof createViolationReportSchema>;

/**
 * Admin Adjudication of a violation report (AC3)
 */
export const adjudicateViolationReportSchema = z.object({
  action: z.enum(VIOLATION_ACTIONS),
  notes: z
    .string()
    .trim()
    .min(5, 'Resolution notes must be at least 5 characters')
    .max(1000, 'Resolution notes cannot exceed 1000 characters'),
  status: z.enum(['RESOLVED', 'DISMISSED']).optional().default('RESOLVED'),
});

export type AdjudicateViolationReportInput = z.infer<typeof adjudicateViolationReportSchema>;

/**
 * Admin Dismissal of a violation report
 */
export const dismissViolationReportSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(5, 'Dismissal notes must be at least 5 characters')
    .max(1000, 'Dismissal notes cannot exceed 1000 characters'),
});

export type DismissViolationReportInput = z.infer<typeof dismissViolationReportSchema>;

/**
 * Admin query filters for violation report queue
 */
export const adminViolationQueueQuerySchema = z.object({
  status: z.enum([...VIOLATION_REPORT_STATUSES, 'ALL']).default('ALL'),
  category: z.enum([...VIOLATION_CATEGORIES, 'ALL']).optional(),
  targetType: z.enum([...VIOLATION_TARGET_TYPES, 'ALL']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminViolationQueueQueryInput = z.infer<typeof adminViolationQueueQuerySchema>;

/**
 * User/Customer creation of support ticket (FR-38)
 */
export const createSupportTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(150, 'Subject cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(3000, 'Description cannot exceed 3000 characters'),
  priority: z.enum(TICKET_PRIORITIES).default('MEDIUM'),
  contactName: z
    .string()
    .trim()
    .min(2, 'Contact name must be at least 2 characters')
    .max(100, 'Contact name cannot exceed 100 characters'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z
    .string()
    .regex(SAUDI_PHONE_REGEX, 'Invalid Saudi mobile number')
    .optional()
    .nullable()
    .or(z.literal('')),
  attachments: z
    .array(z.string().min(1))
    .max(SUPPORT_TICKET_MAX_ATTACHMENTS, `Maximum ${SUPPORT_TICKET_MAX_ATTACHMENTS} attachments allowed`)
    .default([]),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

/**
 * Admin lifecycle update of ticket status
 */
export const updateSupportTicketStatusSchema = z
  .object({
    status: z.enum(TICKET_STATUSES),
    resolutionSummary: z
      .string()
      .trim()
      .max(1000, 'Resolution summary cannot exceed 1000 characters')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
      if (!data.resolutionSummary || data.resolutionSummary.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resolutionSummary'],
          message: 'Resolution summary is mandatory (min 5 characters) when resolving or closing a ticket',
        });
      }
    }
  });

export type UpdateSupportTicketStatusInput = z.infer<typeof updateSupportTicketStatusSchema>;

/**
 * Admin Ticket Assignment Schema
 */
export const assignSupportTicketSchema = z.object({
  adminId: z.string().uuid('Invalid admin ID').optional().nullable(),
});

export type AssignSupportTicketInput = z.infer<typeof assignSupportTicketSchema>;

/**
 * Message addition schema for support tickets
 */
export const createTicketMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(3000, 'Message cannot exceed 3000 characters'),
  isInternal: z.boolean().default(false),
  attachments: z
    .array(z.string().min(1))
    .max(SUPPORT_TICKET_MAX_ATTACHMENTS, `Maximum ${SUPPORT_TICKET_MAX_ATTACHMENTS} attachments allowed`)
    .default([]),
});

export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;

/**
 * Admin query filters for support tickets queue
 */
export const adminTicketQueueQuerySchema = z.object({
  status: z.enum([...TICKET_STATUSES, 'ALL']).default('ALL'),
  category: z.enum([...TICKET_CATEGORIES, 'ALL']).optional(),
  priority: z.enum([...TICKET_PRIORITIES, 'ALL']).optional(),
  slaState: z.enum([...TICKET_SLA_STATES, 'ALL']).default('ALL'),
  assignedAdminId: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminTicketQueueQueryInput = z.infer<typeof adminTicketQueueQuerySchema>;

