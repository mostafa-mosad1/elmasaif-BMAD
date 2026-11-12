import { AdminRole } from '../enums';

export const OTP_EXPIRY_SECONDS = 300;
export const OTP_THROTTLE_SECONDS = 60;
export const OTP_MAX_HOURLY_REQUESTS = 3;
export const OTP_LOCKOUT_ATTEMPTS = 3;
export const OTP_LOCKOUT_MINUTES = 15;

export const DEFAULT_TERMS_VERSION = '1.0';
export const DEFAULT_PRIVACY_VERSION = '1.0';

export const SESSION_COOKIE_NAME = 'elmasaif_session';
export const ADMIN_SESSION_COOKIE_NAME = 'elmasaif_admin_session';
export const SESSION_EXPIRY_DAYS = 30;

export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
export const DEVICE_COOKIE_NAME = 'elmasaif_device_id';

// Domain Auth Error Codes
export const AUTH_INVALID_PHONE = 'AUTH_INVALID_PHONE';
export const AUTH_PHONE_ALREADY_EXISTS = 'AUTH_PHONE_ALREADY_EXISTS';
export const AUTH_NATIONAL_ID_ALREADY_EXISTS = 'AUTH_NATIONAL_ID_ALREADY_EXISTS';
export const AUTH_USERNAME_ALREADY_EXISTS = 'AUTH_USERNAME_ALREADY_EXISTS';
export const AUTH_OTP_THROTTLED = 'AUTH_OTP_THROTTLED';
export const AUTH_OTP_MAX_EXCEEDED = 'AUTH_OTP_MAX_EXCEEDED';
export const AUTH_OTP_EXPIRED = 'AUTH_OTP_EXPIRED';
export const AUTH_OTP_INVALID = 'AUTH_OTP_INVALID';
export const AUTH_OTP_LOCKED = 'AUTH_OTP_LOCKED';
export const AUTH_CONSENT_REQUIRED = 'AUTH_CONSENT_REQUIRED';
export const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS';
export const AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED';
export const AUTH_ACCOUNT_DEACTIVATED = 'AUTH_ACCOUNT_DEACTIVATED';
export const AUTH_ACCOUNT_DISABLED = 'AUTH_ACCOUNT_DISABLED';
export const AUTH_STEP_UP_REQUIRED = 'AUTH_STEP_UP_REQUIRED';
export const AUTH_STEP_UP_INVALID = 'AUTH_STEP_UP_INVALID';
export const AUTH_STEP_UP_LOCKED = 'AUTH_STEP_UP_LOCKED';
export const AUTH_ROLE_NOT_AUTHORIZED = 'AUTH_ROLE_NOT_AUTHORIZED';
export const AUTH_MARKETER_NOT_APPROVED = 'AUTH_MARKETER_NOT_APPROVED';
export const AUTH_PROFILE_NOT_FOUND = 'AUTH_PROFILE_NOT_FOUND';
export const AUTH_NOT_AUTHORIZED = 'AUTH_NOT_AUTHORIZED';
export const ADMIN_AUTH_REQUIRED = 'ADMIN_AUTH_REQUIRED';

// Password Recovery & Change Error & Status Codes (Story 1.6)
export const AUTH_RESET_INITIATED = 'AUTH_RESET_INITIATED';
export const AUTH_RESET_OTP_VERIFIED = 'AUTH_RESET_OTP_VERIFIED';
export const AUTH_PASSWORD_SAME_AS_CURRENT = 'AUTH_PASSWORD_SAME_AS_CURRENT';
export const AUTH_RESET_TOKEN_INVALID = 'AUTH_RESET_TOKEN_INVALID';
export const AUTH_RESET_TOKEN_EXPIRED = 'AUTH_RESET_TOKEN_EXPIRED';
export const AUTH_PASSWORD_RESET_SUCCESS = 'AUTH_PASSWORD_RESET_SUCCESS';
export const AUTH_PASSWORD_CHANGE_SUCCESS = 'AUTH_PASSWORD_CHANGE_SUCCESS';
export const PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 900;

// Phone Change Error & Status Codes (Story 1.7)
export const AUTH_PHONE_IN_USE = 'AUTH_PHONE_IN_USE';
export const AUTH_PHONE_SAME_AS_CURRENT = 'AUTH_PHONE_SAME_AS_CURRENT';
export const AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK = 'AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK';
export const AUTH_PHONE_CHANGE_EXPIRED = 'AUTH_PHONE_CHANGE_EXPIRED';
export const AUTH_PHONE_CHANGE_NOT_FOUND = 'AUTH_PHONE_CHANGE_NOT_FOUND';
export const AUTH_PHONE_CHANGE_ALREADY_VERIFIED = 'AUTH_PHONE_CHANGE_ALREADY_VERIFIED';
export const AUTH_PHONE_CHANGE_INITIATED = 'AUTH_PHONE_CHANGE_INITIATED';
export const AUTH_PHONE_OLD_VERIFIED = 'AUTH_PHONE_OLD_VERIFIED';
export const AUTH_PHONE_NEW_VERIFIED = 'AUTH_PHONE_NEW_VERIFIED';
export const AUTH_PHONE_CHANGE_SUCCESS = 'AUTH_PHONE_CHANGE_SUCCESS';
export const ADMIN_PHONE_CHANGE_SUCCESS = 'ADMIN_PHONE_CHANGE_SUCCESS';
export const PHONE_CHANGE_OTP_EXPIRY_SECONDS = 900;

export const IDENTITY_ALREADY_VERIFIED = 'IDENTITY_ALREADY_VERIFIED';
export const IDENTITY_DOCUMENT_REQUIRED = 'IDENTITY_DOCUMENT_REQUIRED';
export const IDENTITY_INVALID_DOCUMENT = 'IDENTITY_INVALID_DOCUMENT';
export const IDENTITY_FILE_TOO_LARGE = 'IDENTITY_FILE_TOO_LARGE';
export const IDENTITY_UNSUPPORTED_TYPE = 'IDENTITY_UNSUPPORTED_TYPE';
export const IDENTITY_INVALID_ID_NUMBER = 'IDENTITY_INVALID_ID_NUMBER';
export const IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND';
export const IDENTITY_REJECTED = 'IDENTITY_REJECTED';
export const IDENTITY_MALWARE_DETECTED = 'IDENTITY_MALWARE_DETECTED';

export const PAYOUT_INVALID_IBAN = 'PAYOUT_INVALID_IBAN';
export const PAYOUT_ACTIVE_DEAL_RESTRICTION = 'PAYOUT_ACTIVE_DEAL_RESTRICTION';
export const PAYOUT_ACCOUNT_NOT_FOUND = 'PAYOUT_ACCOUNT_NOT_FOUND';
export const PAYOUT_ROLE_NOT_AUTHORIZED = 'PAYOUT_ROLE_NOT_AUTHORIZED';
export const PAYOUT_NAME_MISMATCH_WARNING = 'PAYOUT_NAME_MISMATCH_WARNING';
export const PAYOUT_ALREADY_EXISTS = 'PAYOUT_ALREADY_EXISTS';

// Profile & Email Verification Error & Status Codes (Story 1.8)
export const AUTH_EMAIL_IN_USE = 'AUTH_EMAIL_IN_USE';
export const AUTH_EMAIL_SAME_AS_CURRENT = 'AUTH_EMAIL_SAME_AS_CURRENT';
export const AUTH_EMAIL_VERIFICATION_INITIATED = 'AUTH_EMAIL_VERIFICATION_INITIATED';
export const AUTH_EMAIL_VERIFICATION_EXPIRED = 'AUTH_EMAIL_VERIFICATION_EXPIRED';
export const AUTH_EMAIL_VERIFICATION_INVALID = 'AUTH_EMAIL_VERIFICATION_INVALID';
export const AUTH_EMAIL_VERIFICATION_STALE = 'AUTH_EMAIL_VERIFICATION_STALE';
export const AUTH_EMAIL_VERIFIED_SUCCESS = 'AUTH_EMAIL_VERIFIED_SUCCESS';
export const AUTH_EMAIL_VERIFICATION_RESENT = 'AUTH_EMAIL_VERIFICATION_RESENT';
export const AUTH_EMAIL_PENDING_CANCELLED = 'AUTH_EMAIL_PENDING_CANCELLED';
export const AUTH_NO_PENDING_EMAIL = 'AUTH_NO_PENDING_EMAIL';
export const COMMERCIAL_NAME_MISMATCH = 'COMMERCIAL_NAME_MISMATCH';

export const EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS = 86400;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

// Account Deletion Error & Status Codes (Story 1.9)
export const AUTH_DELETION_INITIATED = 'AUTH_DELETION_INITIATED';
export const AUTH_DELETION_ACTIVE_DEAL_BLOCK = 'AUTH_DELETION_ACTIVE_DEAL_BLOCK';
export const AUTH_DELETION_OPEN_DISPUTE_BLOCK = 'AUTH_DELETION_OPEN_DISPUTE_BLOCK';
export const AUTH_DELETION_ACTIVE_CONTRACT_BLOCK = 'AUTH_DELETION_ACTIVE_CONTRACT_BLOCK';
export const AUTH_DELETION_COOLING_OFF = 'AUTH_DELETION_COOLING_OFF';
export const AUTH_ACCOUNT_DEACTIVATED_STATUTORY = 'AUTH_ACCOUNT_DEACTIVATED_STATUTORY';
export const AUTH_DELETION_CANCELLED = 'AUTH_DELETION_CANCELLED';
export const AUTH_DELETION_TOKEN_INVALID = 'AUTH_DELETION_TOKEN_INVALID';
export const AUTH_DELETION_TOKEN_EXPIRED = 'AUTH_DELETION_TOKEN_EXPIRED';
export const AUTH_ACCOUNT_PERMANENTLY_ERASED = 'AUTH_ACCOUNT_PERMANENTLY_ERASED';

export const DELETION_COOLING_OFF_DAYS = 14;
export const DELETION_TOKEN_EXPIRY_SECONDS = 900;


// User Preferences Codes (Story 1.10)
export const USER_PREFERENCES_RETRIEVED = 'USER_PREFERENCES_RETRIEVED';
export const USER_PREFERENCES_UPDATED = 'USER_PREFERENCES_UPDATED';
export const PREFERENCES_CRITICAL_ALERTS_IMMUTABLE = 'PREFERENCES_CRITICAL_ALERTS_IMMUTABLE';

// Isolated Admin Authentication & Password Reset Constants & Codes (Story 8.1)
export const ADMIN_SESSION_INACTIVITY_HOURS = 8;
export const ADMIN_SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000;
export const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOGIN_LOCKOUT_MINUTES = 15;
export const ADMIN_PASSWORD_RESET_EXPIRY_SECONDS = 900;

export const ADMIN_INVALID_CREDENTIALS = 'ADMIN_INVALID_CREDENTIALS';
export const ADMIN_ACCOUNT_LOCKED = 'ADMIN_ACCOUNT_LOCKED';
export const ADMIN_ACCOUNT_DISABLED = 'ADMIN_ACCOUNT_DISABLED';
export const ADMIN_LOGIN_SUCCESS = 'ADMIN_LOGIN_SUCCESS';
export const ADMIN_LOGOUT_SUCCESS = 'ADMIN_LOGOUT_SUCCESS';
export const ADMIN_SESSION_PROFILE = 'ADMIN_SESSION_PROFILE';
export const ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND';
export const ADMIN_RESET_DISPATCHED = 'ADMIN_RESET_DISPATCHED';
export const ADMIN_RESET_TOKEN_INVALID = 'ADMIN_RESET_TOKEN_INVALID';
export const ADMIN_RESET_TOKEN_EXPIRED = 'ADMIN_RESET_TOKEN_EXPIRED';
export const ADMIN_PASSWORD_RESET_SUCCESS = 'ADMIN_PASSWORD_RESET_SUCCESS';

// Granular Dynamic RBAC & Staff/User Lifecycle Codes (Story 8.2)
export const ADMIN_USERNAME_ALREADY_EXISTS = 'ADMIN_USERNAME_ALREADY_EXISTS';
export const ADMIN_EMAIL_ALREADY_EXISTS = 'ADMIN_EMAIL_ALREADY_EXISTS';
export const ADMIN_SELF_MODIFICATION_FORBIDDEN = 'ADMIN_SELF_MODIFICATION_FORBIDDEN';
export const ADMIN_LAST_SUPER_ADMIN_BLOCK = 'ADMIN_LAST_SUPER_ADMIN_BLOCK';
export const ADMIN_HARD_DELETE_HISTORY_EXISTS = 'ADMIN_HARD_DELETE_HISTORY_EXISTS';
export const USER_HARD_DELETE_HISTORY_EXISTS = 'USER_HARD_DELETE_HISTORY_EXISTS';
export const USER_NOT_FOUND = 'USER_NOT_FOUND';

export const ADMIN_STAFF_CREATED = 'ADMIN_STAFF_CREATED';
export const ADMIN_PERMISSIONS_UPDATED = 'ADMIN_PERMISSIONS_UPDATED';
export const ADMIN_STAFF_STATUS_CHANGED = 'ADMIN_STAFF_STATUS_CHANGED';
export const ADMIN_STAFF_SOFT_DELETED = 'ADMIN_STAFF_SOFT_DELETED';
export const ADMIN_STAFF_HARD_DELETED = 'ADMIN_STAFF_HARD_DELETED';
export const ADMIN_USER_STATUS_CHANGED = 'ADMIN_USER_STATUS_CHANGED';
export const ADMIN_USER_HARD_DELETED = 'ADMIN_USER_HARD_DELETED';

export interface AdminPermissionItemMeta {
  key: string;
  labelAr: string;
  descriptionAr?: string;
}

export interface AdminPermissionGroupMeta {
  groupKey: string;
  groupLabelAr: string;
  permissions: AdminPermissionItemMeta[];
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'مشرف عام (Super Admin)',
  [AdminRole.MODERATOR]: 'مشرف عمليات (Moderator)',
  [AdminRole.FINANCIAL_AUDITOR]: 'مدقق مالي (Financial Auditor)',
  [AdminRole.COMPLIANCE_OFFICER]: 'مسؤول امتثال (Compliance Officer)',
};

export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroupMeta[] = [
  {
    groupKey: 'Users',
    groupLabelAr: 'إدارة المستخدمين وتوثيق الهويات (Users)',
    permissions: [
      { key: 'Users.View', labelAr: 'عرض حسابات المستخدمين' },
      { key: 'Users.Verify', labelAr: 'التحقق من وثائق الهوية الوطنية والإقامة' },
      { key: 'Users.Status', labelAr: 'تفعيل وتعطيل والحذف الناعم لحسابات المستخدمين' },
      { key: 'Users.HardDelete', labelAr: 'الحذف النهائي المشروط لحسابات المستخدمين (بدون سجل معاملات)' },
      { key: 'Users.PhoneChange', labelAr: 'تحديث رقم الجوال الإداري عبر الدعم الفني' },
    ],
  },
  {
    groupKey: 'Listings',
    groupLabelAr: 'الإعلانات العقارية (Listings)',
    permissions: [
      { key: 'Listings.View', labelAr: 'عرض الإعلانات العقارية' },
      { key: 'Listings.Review', labelAr: 'مراجعة واعتماد أو رفض الإعلانات العقارية' },
      { key: 'Listings.Edit', labelAr: 'تعديل بيانات الإعلانات العقارية' },
      { key: 'Listings.Lifecycle', labelAr: 'إدارة دورة حياة الإعلان (أرشفة، تعليق، إيقاف)' },
      { key: 'Listings.PriceSuggest', labelAr: 'اقتراح تعديل سعر العقار للمعلن' },
      { key: 'Listings.Feature', labelAr: 'تمييز الإعلانات العقارية' },
      { key: 'Listings.Compliance', labelAr: 'الإجراءات الرقابية والامتثال على الإعلانات' },
      { key: 'Price.Suggest', labelAr: 'إرسال مقترحات الأسعار (توافقية)' },
    ],
  },
  {
    groupKey: 'Licenses',
    groupLabelAr: 'تراخيص فال العقارية (Licenses)',
    permissions: [
      { key: 'Licenses.View', labelAr: 'عرض تراخيص فال العقارية' },
      { key: 'Licenses.Verify', labelAr: 'التحقق واعتماد تراخيص فال العقارية' },
      { key: 'Licenses.Compliance', labelAr: 'مراقبة امتثال وصلاحية تراخيص فال' },
      { key: 'Licenses.Review', labelAr: 'مراجعة طلبات تراخيص فال (توافقية)' },
    ],
  },
  {
    groupKey: 'Contracts',
    groupLabelAr: 'عقود الملاك والوساطة (Contracts)',
    permissions: [
      { key: 'Contracts.View', labelAr: 'عرض طلبات الملاك وعقود الوساطة' },
      { key: 'Contracts.Manage', labelAr: 'إدارة قوالب وبنود عقود الوساطة' },
      { key: 'Contracts.Assign', labelAr: 'إسناد وإرسال عقود الوساطة للملاك' },
      { key: 'Contracts.Review', labelAr: 'مراجعة طلبات الملاك المباشرين (توافقية)' },
      { key: 'Contracts.FeeOverride', labelAr: 'تعديل رسوم العقود استثنائياً' },
      { key: 'ContractFees.Review', labelAr: 'مراجعة وتدقيق إيصالات رسوم العقود' },
    ],
  },
  {
    groupKey: 'Offers',
    groupLabelAr: 'عروض الشراء والتفاوض (Offers)',
    permissions: [
      { key: 'Offers.View', labelAr: 'عرض عروض الشراء والمقترحات' },
      { key: 'Offers.Manage', labelAr: 'إدارة التفاوض وعروض الشراء والاحتياط' },
      { key: 'Offers.Review', labelAr: 'مراجعة وتمرير عروض الشراء (توافقية)' },
    ],
  },
  {
    groupKey: 'Deals',
    groupLabelAr: 'الصفقات العقارية والنزاعات (Deals)',
    permissions: [
      { key: 'Deals.View', labelAr: 'عرض الصفقات العقارية' },
      { key: 'Deals.FinalApprove', labelAr: 'الاعتماد النهائي للصفقات وإتمام الإغلاق' },
      { key: 'Deals.ExtendTimer', labelAr: 'تمديد مهلة السداد للصفقات' },
      { key: 'Deals.DisputeResolve', labelAr: 'الفصل في النزاعات العقارية وإغلاقها' },
      { key: 'Deals.StatusOverride', labelAr: 'تجاوز حالة الصفقة إدارياً' },
    ],
  },
  {
    groupKey: 'Payments',
    groupLabelAr: 'المدفوعات والتحويلات البنكية (Payments)',
    permissions: [
      { key: 'Payments.View', labelAr: 'عرض سجلات المدفوعات وإيصالات التحويل' },
      { key: 'Payments.Verify', labelAr: 'تدقيق واعتماد إيصالات التحويل البنكي' },
      { key: 'Payments.Refund', labelAr: 'إدارة عمليات الاسترداد المالي' },
      { key: 'Payments.Review', labelAr: 'مراجعة إثباتات الدفع (توافقية)' },
    ],
  },
  {
    groupKey: 'Conversations',
    groupLabelAr: 'المحادثات والاستفسارات (Conversations)',
    permissions: [
      { key: 'Conversations.View', labelAr: 'عرض محادثات واستفسارات العقارات' },
      { key: 'Conversations.Relay', labelAr: 'تمرير رسائل الاستفسارات بين الأطراف' },
      { key: 'Conversations.Redact', labelAr: 'حجب بيانات التواصل المخالفة في المحادثات' },
      { key: 'Conversations.Handle', labelAr: 'إدارة طابور المحادثات (توافقية)' },
    ],
  },
  {
    groupKey: 'Reviews',
    groupLabelAr: 'التقييمات والمراجعات (Reviews)',
    permissions: [
      { key: 'Reviews.View', labelAr: 'عرض التقييمات والمراجعات' },
      { key: 'Reviews.Moderate', labelAr: 'الإشراف على التقييمات وإخفاء المخالف منها' },
    ],
  },
  {
    groupKey: 'Geo',
    groupLabelAr: 'البيانات الجغرافية (Geo)',
    permissions: [
      { key: 'Geo.Manage', labelAr: 'إدارة المدن والأحياء والبيانات الجغرافية' },
    ],
  },
  {
    groupKey: 'Tasks',
    groupLabelAr: 'طوابير المهام وأقفال المراجعة (Tasks)',
    permissions: [
      { key: 'Tasks.View', labelAr: 'عرض طوابير المهام التشغيلية' },
      { key: 'Tasks.Claim', labelAr: 'استلام وحجز المهام التشغيلية' },
      { key: 'Tasks.ForceUnlock', labelAr: 'فك قفل المهام التشغيلية المحجوزة قسرياً' },
    ],
  },
  {
    groupKey: 'Finance',
    groupLabelAr: 'المالية والفواتير والتقارير (Finance)',
    permissions: [
      { key: 'Finance.View', labelAr: 'عرض التقارير المالية والفواتير' },
      { key: 'Finance.Export', labelAr: 'تصدير التقارير المالية والضريبية' },
      { key: 'Finance.Audit', labelAr: 'التدقيق المالي الشامل ومطابقة العمولات' },
    ],
  },
  {
    groupKey: 'Security & Compliance',
    groupLabelAr: 'الأمن والامتثال ومكافحة الاحتيال (Security & Compliance)',
    permissions: [
      { key: 'Compliance.View', labelAr: 'عرض تقارير الامتثال والمخالفات' },
      { key: 'Compliance.Manage', labelAr: 'إدارة إجراءات الامتثال والقيود النظامية' },
      { key: 'Security.Manage', labelAr: 'إدارة إعدادات الأمان وحظر الحسابات المشبوهة' },
      { key: 'Fraud.View', labelAr: 'عرض سجل مؤشرات الاحتيال' },
      { key: 'Penalties.Apply', labelAr: 'تطبيق الجزاءات والمخالفات' },
      { key: 'Tickets.Handle', labelAr: 'معالجة تذاكر الدعم الفني' },
      { key: 'Reports.Handle', labelAr: 'معالجة بلاغات المخالفات' },
      { key: 'Reports.Analytics', labelAr: 'عرض تحليلات البلاغات والعمليات' },
    ],
  },
  {
    groupKey: 'System & RBAC',
    groupLabelAr: 'النظام والمحتوى والصلاحيات (System & RBAC)',
    permissions: [
      { key: 'Settings.Manage', labelAr: 'إدارة إعدادات المنصة العامة والعمولات' },
      { key: 'Settings.Commission', labelAr: 'تعديل نسب العمولات والمهل الزمنية' },
      { key: 'CMS.Manage', labelAr: 'إدارة المحتوى الثابت والصفحات التعريفية' },
      { key: 'Content.Manage', labelAr: 'إدارة محتوى المنصة (توافقية)' },
      { key: 'Audit.View', labelAr: 'عرض سجل التدقيق الرقابي غير القابل للتعديل' },
      { key: 'Rbac.Manage', labelAr: 'إدارة حسابات الموظفين ومصفوفة الصلاحيات (RBAC)' },
      { key: 'Notes.Manage', labelAr: 'إدارة الملاحظات الإدارية الداخلية' },
      { key: 'Bulk.Execute', labelAr: 'تنفيذ العمليات الإدارية الجماعية' },
    ],
  },
];

export const ALL_ADMIN_PERMISSIONS: string[] = Array.from(
  new Set(
    ADMIN_PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((perm) => perm.key)
    )
  )
);

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  [AdminRole.SUPER_ADMIN]: [...ALL_ADMIN_PERMISSIONS],
  [AdminRole.MODERATOR]: [
    'Users.View',
    'Users.Verify',
    'Licenses.View',
    'Licenses.Verify',
    'Licenses.Review',
    'Listings.View',
    'Listings.Review',
    'Listings.Edit',
    'Listings.Lifecycle',
    'Listings.PriceSuggest',
    'Listings.Feature',
    'Price.Suggest',
    'Contracts.View',
    'Contracts.Assign',
    'Contracts.Review',
    'ContractFees.Review',
    'Offers.View',
    'Offers.Manage',
    'Offers.Review',
    'Deals.View',
    'Deals.ExtendTimer',
    'Payments.View',
    'Payments.Verify',
    'Payments.Review',
    'Conversations.View',
    'Conversations.Relay',
    'Conversations.Redact',
    'Conversations.Handle',
    'Tickets.Handle',
    'Reports.Handle',
    'Notes.Manage',
    'Reviews.View',
    'Reviews.Moderate',
    'Tasks.View',
    'Tasks.Claim',
  ],
  [AdminRole.FINANCIAL_AUDITOR]: [
    'Users.View',
    'Contracts.View',
    'Deals.View',
    'Payments.View',
    'Payments.Verify',
    'Payments.Refund',
    'Payments.Review',
    'ContractFees.Review',
    'Finance.View',
    'Finance.Export',
    'Finance.Audit',
    'Notes.Manage',
    'Audit.View',
    'Tasks.View',
    'Tasks.Claim',
  ],
  [AdminRole.COMPLIANCE_OFFICER]: [
    'Users.View',
    'Users.Verify',
    'Licenses.View',
    'Licenses.Verify',
    'Licenses.Compliance',
    'Licenses.Review',
    'Listings.View',
    'Listings.Review',
    'Listings.Lifecycle',
    'Listings.Compliance',
    'Deals.View',
    'Reviews.View',
    'Reports.Handle',
    'Fraud.View',
    'Compliance.View',
    'Compliance.Manage',
    'Notes.Manage',
    'Audit.View',
    'Tasks.View',
    'Tasks.Claim',
  ],
};

export function resolveAdminPermissions(
  role: AdminRole,
  customPermissions?: string[] | null
): string[] {
  if (role === AdminRole.SUPER_ADMIN) {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  if (Array.isArray(customPermissions) && customPermissions.length > 0) {
    return Array.from(new Set(customPermissions));
  }
  return [...(ADMIN_ROLE_PERMISSIONS[role] ?? [])];
}
