/**
 * Story 8.7: Immutable Domain Audit Logging & Inspection
 * Audit constants, actor types, standardized actions, error codes, and presentation maps.
 */

export const AUDIT_ACTOR_TYPE = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPE)[keyof typeof AUDIT_ACTOR_TYPE];

export const AUDIT_ACTION = {
  // Identity & Governance
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  PHONE_CHANGE_INITIATED: 'PHONE_CHANGE_INITIATED',
  PHONE_CHANGE_VERIFIED: 'PHONE_CHANGE_VERIFIED',
  ACCOUNT_DELETION_INITIATED: 'ACCOUNT_DELETION_INITIATED',
  ACCOUNT_DELETION_CANCELLED: 'ACCOUNT_DELETION_CANCELLED',
  ACCOUNT_PERMANENTLY_ERASED: 'ACCOUNT_PERMANENTLY_ERASED',
  PAYOUT_ACCOUNT_CREATED: 'PAYOUT_ACCOUNT_CREATED',
  PAYOUT_ACCOUNT_UPDATED: 'PAYOUT_ACCOUNT_UPDATED',
  PAYOUT_ACCOUNT_DEACTIVATED: 'PAYOUT_ACCOUNT_DEACTIVATED',
  FAL_LICENSE_APPROVED: 'FAL_LICENSE_APPROVED',
  FAL_LICENSE_REJECTED: 'FAL_LICENSE_REJECTED',
  FAL_LICENSE_RENEWED: 'FAL_LICENSE_RENEWED',

  // Listings & Moderation
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  LISTING_SUSPENDED: 'LISTING_SUSPENDED',
  LISTING_ARCHIVED: 'LISTING_ARCHIVED',
  PRICE_SUGGESTION_CREATED: 'PRICE_SUGGESTION_CREATED',
  PRICE_SUGGESTION_ACCEPTED: 'PRICE_SUGGESTION_ACCEPTED',
  PRICE_SUGGESTION_REJECTED: 'PRICE_SUGGESTION_REJECTED',

  // Negotiation & Deals
  OFFER_SUBMITTED: 'OFFER_SUBMITTED',
  COUNTER_OFFER_SUBMITTED: 'COUNTER_OFFER_SUBMITTED',
  DEAL_FINAL_APPROVED: 'DEAL_FINAL_APPROVED',
  DEAL_CANCELLED: 'DEAL_CANCELLED',
  DEAL_DISPUTED: 'DEAL_DISPUTED',
  DEAL_COMPLETED: 'DEAL_COMPLETED',
  DEAL_TIMEOUT: 'DEAL_TIMEOUT',
  CONTACT_DETAILS_DISCLOSED: 'CONTACT_DETAILS_DISCLOSED',

  // Financials & Proofs
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  CONTRACT_FEE_CONFIRMED: 'CONTRACT_FEE_CONFIRMED',
  CONTRACT_FEE_REJECTED: 'CONTRACT_FEE_REJECTED',
  OWNER_REQUEST_APPROVED: 'OWNER_REQUEST_APPROVED',
  OWNER_REQUEST_REJECTED: 'OWNER_REQUEST_REJECTED',
  OWNER_CONTRACT_DISPATCHED: 'OWNER_CONTRACT_DISPATCHED',

  // Back-Office & Claims
  TASK_CLAIM_FORCE_UNLOCKED: 'TASK_CLAIM_FORCE_UNLOCKED',
  PLATFORM_SETTINGS_UPDATED: 'PLATFORM_SETTINGS_UPDATED',
  ADMIN_USER_CREATED: 'ADMIN_USER_CREATED',
  ADMIN_USER_UPDATED: 'ADMIN_USER_UPDATED',
  ADMIN_PERMISSIONS_CHANGED: 'ADMIN_PERMISSIONS_CHANGED',
  ADMIN_STATUS_CHANGED: 'ADMIN_STATUS_CHANGED',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
  TICKET_STATUS_UPDATED: 'TICKET_STATUS_UPDATED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/**
 * Standardized Audit Error Codes
 */
export const AUDIT_LOG_NOT_FOUND = 'AUDIT_LOG_NOT_FOUND';
export const AUDIT_LOG_IMMUTABLE = 'AUDIT_LOG_IMMUTABLE';
export const AUDIT_UNAUTHORIZED = 'AUDIT_UNAUTHORIZED';
export const AUDIT_QUERY_INVALID = 'AUDIT_QUERY_INVALID';

/**
 * Arabic human-readable action labels
 */
export const AUDIT_ACTION_LABELS_AR: Record<string, string> = {
  // Identity & Governance
  USER_SUSPENDED: 'تعليق حساب مستخدم',
  USER_ACTIVATED: 'تنشيط حساب مستخدم',
  PHONE_CHANGE_INITIATED: 'بدء تغيير رقم الجوال',
  PHONE_CHANGE_VERIFIED: 'توثيق رقم الجوال الجديد',
  ACCOUNT_DELETION_INITIATED: 'طلب حذف الحساب',
  ACCOUNT_DELETION_CANCELLED: 'إلغاء حذف الحساب',
  ACCOUNT_PERMANENTLY_ERASED: 'الحذف النهائي للحساب',
  PAYOUT_ACCOUNT_CREATED: 'إضافة حساب بنكي / آيبان',
  PAYOUT_ACCOUNT_UPDATED: 'تحديث حساب بنكي / آيبان',
  PAYOUT_ACCOUNT_DEACTIVATED: 'تعطيل حساب بنكي',
  FAL_LICENSE_APPROVED: 'اعتماد رخصة فال',
  FAL_LICENSE_REJECTED: 'رفض رخصة فال',
  FAL_LICENSE_RENEWED: 'تجديد رخصة فال',

  // Listings & Moderation
  LISTING_APPROVED: 'الموافقة على العقار',
  LISTING_REJECTED: 'رفض العقار',
  LISTING_SUSPENDED: 'تعليق العقار',
  LISTING_ARCHIVED: 'أرشفة العقار',
  PRICE_SUGGESTION_CREATED: 'اقتراح تعديل السعر',
  PRICE_SUGGESTION_ACCEPTED: 'قبول السعر المقترح',
  PRICE_SUGGESTION_REJECTED: 'رفض السعر المقترح',

  // Negotiation & Deals
  OFFER_SUBMITTED: 'تقديم عرض سعر',
  COUNTER_OFFER_SUBMITTED: 'تقديم عرض مقابل',
  DEAL_FINAL_APPROVED: 'الاعتماد النهائي للصفقة',
  DEAL_CANCELLED: 'إلغاء الصفقة',
  DEAL_DISPUTED: 'فتح نزاع على الصفقة',
  DEAL_COMPLETED: 'إتمام الصفقة',
  DEAL_TIMEOUT: 'انتهاء مهلة السداد للصفقة',
  CONTACT_DETAILS_DISCLOSED: 'كشف بيانات الاتصال للأطراف',

  // Financials & Proofs
  PAYMENT_CONFIRMED: 'اعتماد إشعار التحويل البنكي',
  PAYMENT_REJECTED: 'رفض إشعار التحويل البنكي',
  CONTRACT_FEE_CONFIRMED: 'اعتماد رسوم عقد الوساطة',
  CONTRACT_FEE_REJECTED: 'رفض إشعار رسوم العقد',
  OWNER_REQUEST_APPROVED: 'الموافقة على طلب المالك',
  OWNER_REQUEST_REJECTED: 'رفض طلب المالك',
  OWNER_CONTRACT_DISPATCHED: 'إرسال عقد المالك الموثق',

  // Back-Office & Claims
  TASK_CLAIM_FORCE_UNLOCKED: 'فك قفل المهمة إدارياً',
  PLATFORM_SETTINGS_UPDATED: 'تحديث إعدادات المنصة والعمولات',
  ADMIN_USER_CREATED: 'إنشاء حساب مشرف جديد',
  ADMIN_USER_UPDATED: 'تحديث بيانات مشرف',
  ADMIN_PERMISSIONS_CHANGED: 'تعديل صلاحيات المشرف (RBAC)',
  ADMIN_STATUS_CHANGED: 'تعديل حالة حساب المشرف',
  REVIEW_APPROVED: 'اعتماد التقييم',
  REVIEW_REJECTED: 'رفض التقييم',
  TICKET_STATUS_UPDATED: 'تحديث حالة تذكرة الدعم',
  REPORT_RESOLVED: 'معالجة بلاغ المخالفة',
};

export type AuditActionCategory = 'approval' | 'rejection' | 'update' | 'security' | 'financial' | 'system';

/**
 * Semantic categorization for styling and visual badges
 */
export const AUDIT_ACTION_CATEGORY_MAP: Record<string, AuditActionCategory> = {
  // Approvals (emerald)
  USER_ACTIVATED: 'approval',
  FAL_LICENSE_APPROVED: 'approval',
  FAL_LICENSE_RENEWED: 'approval',
  LISTING_APPROVED: 'approval',
  PRICE_SUGGESTION_ACCEPTED: 'approval',
  DEAL_FINAL_APPROVED: 'approval',
  DEAL_COMPLETED: 'approval',
  PAYMENT_CONFIRMED: 'approval',
  CONTRACT_FEE_CONFIRMED: 'approval',
  OWNER_REQUEST_APPROVED: 'approval',
  OWNER_CONTRACT_DISPATCHED: 'approval',
  REVIEW_APPROVED: 'approval',
  REPORT_RESOLVED: 'approval',

  // Rejections / Suspensions (rose)
  USER_SUSPENDED: 'rejection',
  FAL_LICENSE_REJECTED: 'rejection',
  LISTING_REJECTED: 'rejection',
  LISTING_SUSPENDED: 'rejection',
  PRICE_SUGGESTION_REJECTED: 'rejection',
  DEAL_CANCELLED: 'rejection',
  DEAL_DISPUTED: 'rejection',
  DEAL_TIMEOUT: 'rejection',
  PAYMENT_REJECTED: 'rejection',
  CONTRACT_FEE_REJECTED: 'rejection',
  OWNER_REQUEST_REJECTED: 'rejection',
  REVIEW_REJECTED: 'rejection',

  // Updates / Overrides (amber)
  PHONE_CHANGE_INITIATED: 'update',
  PHONE_CHANGE_VERIFIED: 'update',
  ACCOUNT_DELETION_INITIATED: 'update',
  ACCOUNT_DELETION_CANCELLED: 'update',
  PAYOUT_ACCOUNT_CREATED: 'update',
  PAYOUT_ACCOUNT_UPDATED: 'update',
  PAYOUT_ACCOUNT_DEACTIVATED: 'update',
  LISTING_ARCHIVED: 'update',
  PRICE_SUGGESTION_CREATED: 'update',
  OFFER_SUBMITTED: 'update',
  COUNTER_OFFER_SUBMITTED: 'update',
  PLATFORM_SETTINGS_UPDATED: 'update',
  ADMIN_USER_CREATED: 'update',
  ADMIN_USER_UPDATED: 'update',
  TICKET_STATUS_UPDATED: 'update',

  // Security / Claims / Disclosure (blue / purple)
  TASK_CLAIM_FORCE_UNLOCKED: 'security',
  CONTACT_DETAILS_DISCLOSED: 'security',
  ADMIN_PERMISSIONS_CHANGED: 'security',
  ADMIN_STATUS_CHANGED: 'security',
  ACCOUNT_PERMANENTLY_ERASED: 'security',
};

export const AUDIT_CATEGORY_STYLES: Record<
  AuditActionCategory,
  { label: string; badgeClass: string; dotClass: string }
> = {
  approval: {
    label: 'اعتماد / إتمام',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  rejection: {
    label: 'رفض / تعليق / إلغاء',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
  update: {
    label: 'تعديل / تحديث',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  security: {
    label: 'أمان / كشف / قفل',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    dotClass: 'bg-sky-500',
  },
  financial: {
    label: 'مالي',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    dotClass: 'bg-teal-500',
  },
  system: {
    label: 'النظام',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
};

