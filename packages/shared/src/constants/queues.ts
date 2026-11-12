import type {
  OperationalQueueMetadata,
  OperationalQueueSlug,
  OperationalQueueType,
} from '../types/locks';

/**
 * Story 8.3 / AD-10 / FR-51: Canonical 15-minute lease and 5-minute heartbeat constants.
 */
export const TASK_CLAIM_LEASE_DURATION_MINUTES = 15;
export const TASK_CLAIM_LEASE_DURATION_SECONDS = 15 * 60; // 900
export const TASK_CLAIM_LEASE_DURATION_MS = 15 * 60 * 1000; // 900_000

export const TASK_CLAIM_HEARTBEAT_INTERVAL_MINUTES = 5;
export const TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS = 5 * 60; // 300
export const TASK_CLAIM_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 300_000

export const TASK_FORCE_UNLOCK_MIN_REASON_LENGTH = 5;
export const FORCE_UNLOCK_MIN_REASON_LENGTH = 5;
export const TASK_FORCE_UNLOCK_MAX_REASON_LENGTH = 500;

/**
 * Story 8.3: Standardized Task Claim & Optimistic Concurrency Status / Error Codes.
 */
export const TASK_CLAIM_ACQUIRED = 'TASK_CLAIM_ACQUIRED';
export const TASK_CLAIM_RENEWED = 'TASK_CLAIM_RENEWED';
export const TASK_CLAIM_RELEASED = 'TASK_CLAIM_RELEASED';
export const TASK_CLAIM_FORCE_UNLOCKED = 'TASK_CLAIM_FORCE_UNLOCKED';

export const TASK_CLAIM_LOCK_CONFLICT = 'TASK_CLAIM_LOCK_CONFLICT';
export const TASK_CLAIM_LOCK_REQUIRED = 'TASK_CLAIM_LOCK_REQUIRED';
export const TASK_CLAIM_LOCK_EXPIRED = 'TASK_CLAIM_LOCK_EXPIRED';
export const TASK_CLAIM_NOT_CLAIMABLE = 'TASK_CLAIM_NOT_CLAIMABLE';
export const TASK_CLAIM_ENTITY_NOT_FOUND = 'TASK_CLAIM_ENTITY_NOT_FOUND';
export const TASK_FORCE_UNLOCK_REASON_REQUIRED = 'TASK_FORCE_UNLOCK_REASON_REQUIRED';
export const OPTIMISTIC_VERSION_CONFLICT = 'OPTIMISTIC_VERSION_CONFLICT';
export const OPERATIONAL_QUEUES_SUMMARY_RETRIEVED = 'OPERATIONAL_QUEUES_SUMMARY_RETRIEVED';

export const OPERATIONAL_QUEUE_TYPES: readonly OperationalQueueType[] = [
  'LISTING',
  'FAL_PROFILE',
  'OWNER_REQUEST',
  'PAYMENT',
  'CONTRACT_FEE',
  'CONVERSATION',
  'DISPUTE',
  'OFFER',
] as const;

export const OPERATIONAL_QUEUE_SLUGS: readonly OperationalQueueSlug[] = [
  'listings',
  'licenses',
  'fal-profiles',
  'owner-requests',
  'payments',
  'contract-fees',
  'conversations',
  'inquiries',
  'disputes',
  'offers',
] as const;

export const OPERATIONAL_QUEUE_METADATA: Record<OperationalQueueType, OperationalQueueMetadata> = {
  LISTING: {
    queueType: 'LISTING',
    slug: 'listings',
    primarySlug: 'listings',
    aliasSlugs: ['listings'],
    labelAr: 'مراجعة الإعلانات العقارية',
    descriptionAr: 'تدقيق واعتماد الإعلانات العقارية ومرفقات الملكية والتفويض',
    adminWorkspaceHref: '/admin/listings/moderation',
    reviewPermission: 'Listings.Review',
    viewPermissions: ['Listings.View', 'Listings.Review', 'Tasks.View'],
    claimPermissions: ['Listings.Review', 'Listings.Compliance', 'Tasks.Claim'],
  },
  FAL_PROFILE: {
    queueType: 'FAL_PROFILE',
    slug: 'licenses',
    primarySlug: 'licenses',
    aliasSlugs: ['licenses', 'fal-profiles'],
    labelAr: 'توثيق وتجديد تراخيص فال',
    descriptionAr: 'التحقق من رخص فال العقارية وطلبات التجديد للمسوقين',
    adminWorkspaceHref: '/admin/licenses',
    reviewPermission: 'Licenses.Verify',
    viewPermissions: ['Licenses.View', 'Licenses.Verify', 'Licenses.Review', 'Tasks.View'],
    claimPermissions: ['Licenses.Verify', 'Licenses.Review', 'Tasks.Claim'],
  },
  OWNER_REQUEST: {
    queueType: 'OWNER_REQUEST',
    slug: 'owner-requests',
    primarySlug: 'owner-requests',
    aliasSlugs: ['owner-requests'],
    labelAr: 'طلبات الملاك وعقود الوساطة',
    descriptionAr: 'مراجعة طلبات الإدراج المباشر للملاك وإرسال عقود الوساطة',
    adminWorkspaceHref: '/admin/owner-requests',
    reviewPermission: 'Contracts.Review',
    viewPermissions: ['Contracts.View', 'Contracts.Review', 'Contracts.Assign', 'Tasks.View'],
    claimPermissions: ['Contracts.Review', 'Contracts.Assign', 'Contracts.Manage', 'Tasks.Claim'],
  },
  PAYMENT: {
    queueType: 'PAYMENT',
    slug: 'payments',
    primarySlug: 'payments',
    aliasSlugs: ['payments'],
    labelAr: 'تدقيق إيصالات سداد الصفقات',
    descriptionAr: 'مطابقة الحوالات البنكية لعمولة المنصة وقيمة العقار',
    adminWorkspaceHref: '/admin/payments',
    reviewPermission: 'Payments.Verify',
    viewPermissions: ['Payments.View', 'Payments.Verify', 'Payments.Review', 'Tasks.View'],
    claimPermissions: ['Payments.Verify', 'Payments.Review', 'Tasks.Claim'],
  },
  CONTRACT_FEE: {
    queueType: 'CONTRACT_FEE',
    slug: 'contract-fees',
    primarySlug: 'contract-fees',
    aliasSlugs: ['contract-fees'],
    labelAr: 'إيصالات رسوم عقود الملاك',
    descriptionAr: 'مراجعة إشعارات سداد رسوم عقود الملاك المباشرين (1,000 ر.س)',
    adminWorkspaceHref: '/admin/contract-fees',
    reviewPermission: 'ContractFees.Review',
    viewPermissions: ['Contracts.View', 'ContractFees.Review', 'Payments.View', 'Tasks.View'],
    claimPermissions: ['ContractFees.Review', 'Payments.Verify', 'Tasks.Claim'],
  },
  CONVERSATION: {
    queueType: 'CONVERSATION',
    slug: 'inquiries',
    primarySlug: 'inquiries',
    aliasSlugs: ['inquiries', 'conversations'],
    labelAr: 'وساطة المحادثات والاستفسارات',
    descriptionAr: 'مراجعة وتمرير استفسارات المشترين وردود البائعين مع حجب بيانات التواصل',
    adminWorkspaceHref: '/admin/conversations',
    reviewPermission: 'Conversations.Relay',
    viewPermissions: ['Conversations.View', 'Conversations.Relay', 'Conversations.Handle', 'Tasks.View'],
    claimPermissions: ['Conversations.Relay', 'Conversations.Redact', 'Conversations.Handle', 'Tasks.Claim'],
  },
  DISPUTE: {
    queueType: 'DISPUTE',
    slug: 'disputes',
    primarySlug: 'disputes',
    aliasSlugs: ['disputes'],
    labelAr: 'الفصل في النزاعات العقارية',
    descriptionAr: 'دراسة نزاعات الصفقات المعلقة والبت الإداري فيها',
    adminWorkspaceHref: '/admin/disputes',
    reviewPermission: 'Deals.DisputeResolve',
    viewPermissions: ['Deals.View', 'Deals.DisputeResolve', 'Tasks.View'],
    claimPermissions: ['Deals.DisputeResolve', 'Tasks.Claim'],
  },
  OFFER: {
    queueType: 'OFFER',
    slug: 'offers',
    primarySlug: 'offers',
    aliasSlugs: ['offers'],
    labelAr: 'وساطة عروض الشراء والتفاوض',
    descriptionAr: 'مراجعة عروض الشراء والعروض المضادة وعروض الاحتياط',
    adminWorkspaceHref: '/admin/negotiations',
    reviewPermission: 'Offers.Review',
    viewPermissions: ['Offers.View', 'Offers.Manage', 'Offers.Review', 'Tasks.View'],
    claimPermissions: ['Offers.Manage', 'Offers.Review', 'Tasks.Claim'],
  },
};

const SLUG_TO_QUEUE_TYPE: Record<string, OperationalQueueType> = {
  LISTING: 'LISTING',
  listings: 'LISTING',
  FAL_PROFILE: 'FAL_PROFILE',
  FAL_LICENSE: 'FAL_PROFILE',
  licenses: 'FAL_PROFILE',
  'fal-profiles': 'FAL_PROFILE',
  OWNER_REQUEST: 'OWNER_REQUEST',
  'owner-requests': 'OWNER_REQUEST',
  PAYMENT: 'PAYMENT',
  payments: 'PAYMENT',
  CONTRACT_FEE: 'CONTRACT_FEE',
  'contract-fees': 'CONTRACT_FEE',
  CONVERSATION: 'CONVERSATION',
  INQUIRY: 'CONVERSATION',
  conversations: 'CONVERSATION',
  inquiries: 'CONVERSATION',
  DISPUTE: 'DISPUTE',
  disputes: 'DISPUTE',
  OFFER: 'OFFER',
  offers: 'OFFER',
};

export function resolveOperationalQueueType(typeOrSlug: string): OperationalQueueType | null {
  if (!typeOrSlug) return null;
  const trimmed = typeOrSlug.trim();
  return (
    SLUG_TO_QUEUE_TYPE[trimmed] ??
    SLUG_TO_QUEUE_TYPE[trimmed.toLowerCase()] ??
    SLUG_TO_QUEUE_TYPE[trimmed.toUpperCase()] ??
    null
  );
}
