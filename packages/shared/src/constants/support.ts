/**
 * Story 8.5 / FR-37 / FR-38: Support Ticketing & Violation Reporting Constants
 */

// SLA Constants (FR-38)
export const TICKET_SLA_FIRST_RESPONSE_HOURS = 4; // Default 4 hours for first response
export const TICKET_SLA_RESOLUTION_HOURS = 48; // Default 2 business days / 48 hours for resolution
export const TICKET_SLA_WARNING_THRESHOLD_MINUTES = 60; // 1 hour remaining triggers warning state
export const TICKET_SLA_RESOLUTION_WARNING_THRESHOLD_HOURS = 12; // 12 hours remaining triggers warning state

// Attachment Constraints (FR-37, FR-38)
export const VIOLATION_REPORT_MAX_ATTACHMENTS = 5;
export const SUPPORT_TICKET_MAX_ATTACHMENTS = 5;
export const SUPPORT_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Core Enums and Unions
export const VIOLATION_TARGET_TYPES = ['LISTING', 'BROKER', 'USER', 'OTHER'] as const;
export type ViolationTargetType = (typeof VIOLATION_TARGET_TYPES)[number];

export const VIOLATION_CATEGORIES = [
  'FRAUDULENT_LISTING',
  'UNAUTHORIZED_BROKER',
  'ABUSIVE_BEHAVIOR',
  'MISLEADING_INFORMATION',
  'OFF_PLATFORM_PAYMENT_BYPASS',
  'PRICE_MANIPULATION',
  'OTHER',
] as const;
export type ViolationCategory = (typeof VIOLATION_CATEGORIES)[number];

export const VIOLATION_REPORT_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ViolationReportStatus = (typeof VIOLATION_REPORT_STATUSES)[number];

export const VIOLATION_ACTIONS = [
  'NO_ACTION',
  'LISTING_REMOVED',
  'BROKER_WARNED',
  'ACCOUNT_SUSPENDED',
  'FLAGGED_FOR_COMPLIANCE',
  'OTHER',
] as const;
export type ViolationAction = (typeof VIOLATION_ACTIONS)[number];

export const TICKET_CATEGORIES = [
  'TECHNICAL_ISSUE',
  'ACCOUNT_ACCESS',
  'PAYMENT_ISSUE',
  'LISTING_ASSISTANCE',
  'GENERAL_INQUIRY',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_SLA_STATES = ['ON_TRACK', 'NEARING_BREACH', 'BREACHED'] as const;
export type TicketSlaState = (typeof TICKET_SLA_STATES)[number];

export const TICKET_MESSAGE_AUTHOR_TYPES = ['ADMIN', 'USER'] as const;
export type TicketMessageAuthorType = (typeof TICKET_MESSAGE_AUTHOR_TYPES)[number];

// Arabic Metadata Labels
export const VIOLATION_TARGET_TYPE_LABELS_AR: Record<ViolationTargetType, string> = {
  LISTING: 'إعلان عقاري',
  BROKER: 'وسيط عقاري',
  USER: 'مستخدم',
  OTHER: 'أخرى',
};

export const VIOLATION_CATEGORY_LABELS_AR: Record<ViolationCategory, string> = {
  FRAUDULENT_LISTING: 'إعلان احتيالي / وهمي',
  UNAUTHORIZED_BROKER: 'وسيط غير مرخص',
  ABUSIVE_BEHAVIOR: 'سلوك مسيء أو مضايقة',
  MISLEADING_INFORMATION: 'معلومات مضللة أو غير دقيقة',
  OFF_PLATFORM_PAYMENT_BYPASS: 'طلب تحويل مالي خارج المنصة',
  PRICE_MANIPULATION: 'تلاعب بالأسعار أو مواصفات وهمية',
  OTHER: 'أخرى',
};

export const VIOLATION_REPORT_STATUS_LABELS_AR: Record<ViolationReportStatus, string> = {
  PENDING: 'قيد الانتظار',
  UNDER_REVIEW: 'قيد المراجعة',
  RESOLVED: 'تم اتخاذ إجراء',
  DISMISSED: 'مستبعد',
};

export const VIOLATION_ACTION_LABELS_AR: Record<ViolationAction, string> = {
  NO_ACTION: 'لا يتطلب إجراء',
  LISTING_REMOVED: 'حذف الإعلان المخالف',
  BROKER_WARNED: 'إنذار الوسيط العقاري',
  ACCOUNT_SUSPENDED: 'تجميد حساب المستخدم',
  FLAGGED_FOR_COMPLIANCE: 'إحالة إلى وحدة الامتثال',
  OTHER: 'إجراء آخر',
};

export const TICKET_CATEGORY_LABELS_AR: Record<TicketCategory, string> = {
  TECHNICAL_ISSUE: 'مشكلة فنية أو تقنية',
  ACCOUNT_ACCESS: 'تسجيل الدخول والوصول للحساب',
  PAYMENT_ISSUE: 'استفسار أو مشكلة في المدفوعات',
  LISTING_ASSISTANCE: 'مساعدة في إدارة الإعلانات',
  GENERAL_INQUIRY: 'استفسار عام',
  OTHER: 'أخرى',
};

export const TICKET_PRIORITY_LABELS_AR: Record<TicketPriority, string> = {
  LOW: 'منخفضة',
  MEDIUM: 'متوسطة',
  HIGH: 'مرتفعة',
  URGENT: 'حرجة / عاجلة',
};

export const TICKET_STATUS_LABELS_AR: Record<TicketStatus, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلقة',
};

export const TICKET_SLA_STATE_LABELS_AR: Record<TicketSlaState, string> = {
  ON_TRACK: 'ضمن المهلة',
  NEARING_BREACH: 'أوشكت على الانتهاء',
  BREACHED: 'تجاوزت المهلة المحددة',
};

// Status and Error Codes
export const VIOLATION_REPORT_CREATED = 'VIOLATION_REPORT_CREATED';
export const VIOLATION_REPORT_NOT_FOUND = 'VIOLATION_REPORT_NOT_FOUND';
export const VIOLATION_REPORT_STATUS_UPDATED = 'VIOLATION_REPORT_STATUS_UPDATED';
export const VIOLATION_REPORT_ADJUDICATED = 'VIOLATION_REPORT_ADJUDICATED';
export const VIOLATION_REPORT_DISMISSED = 'VIOLATION_REPORT_DISMISSED';

export const SUPPORT_TICKET_CREATED = 'SUPPORT_TICKET_CREATED';
export const SUPPORT_TICKET_NOT_FOUND = 'SUPPORT_TICKET_NOT_FOUND';
export const SUPPORT_TICKET_STATUS_UPDATED = 'SUPPORT_TICKET_STATUS_UPDATED';
export const SUPPORT_TICKET_MESSAGE_ADDED = 'SUPPORT_TICKET_MESSAGE_ADDED';
export const SUPPORT_TICKET_ASSIGNED = 'SUPPORT_TICKET_ASSIGNED';
export const SUPPORT_TICKET_RESOLVED = 'SUPPORT_TICKET_RESOLVED';
export const SUPPORT_TICKET_CLOSED = 'SUPPORT_TICKET_CLOSED';

