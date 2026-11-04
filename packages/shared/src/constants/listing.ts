import { PropertyType, ListingStatus, SuspensionCategory } from '../enums';

export const LISTING_NOT_FOUND = 'LISTING_NOT_FOUND';
export const LISTING_TITLE_INVALID = 'LISTING_TITLE_INVALID';
export const LISTING_PRICE_OUT_OF_RANGE = 'LISTING_PRICE_OUT_OF_RANGE';
export const LISTING_AREA_INVALID = 'LISTING_AREA_INVALID';
export const LISTING_MIN_PHOTOS_REQUIRED = 'LISTING_MIN_PHOTOS_REQUIRED';
export const LISTING_MAX_PHOTOS_EXCEEDED = 'LISTING_MAX_PHOTOS_EXCEEDED';
export const LISTING_PRIMARY_PHOTO_REQUIRED = 'LISTING_PRIMARY_PHOTO_REQUIRED';
export const LISTING_MARKETER_AUTH_DOC_REQUIRED = 'LISTING_MARKETER_AUTH_DOC_REQUIRED';
export const LISTING_OWNER_DEED_REQUIRED = 'LISTING_OWNER_DEED_REQUIRED';
export const LISTING_INVALID_IBAN = 'LISTING_INVALID_IBAN';
export const LISTING_COORDINATES_INVALID = 'LISTING_COORDINATES_INVALID';
export const LISTING_ROLE_UNAUTHORIZED = 'LISTING_ROLE_UNAUTHORIZED';
export const LISTING_FAL_LICENSE_REQUIRED = 'LISTING_FAL_LICENSE_REQUIRED';
export const LISTING_DOCUMENT_ACCESS_DENIED = 'LISTING_DOCUMENT_ACCESS_DENIED';
export const LISTING_MALWARE_DETECTED = 'LISTING_MALWARE_DETECTED';

// Moderation & Task Claim Locking Constants (Story 2.4 / AD-10)
export const LISTING_LOCK_DURATION_MINUTES = 15;
export const LISTING_LOCK_DURATION_MS = 15 * 60 * 1000;
export const LISTING_LOCK_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export const LISTING_LOCK_CONFLICT = 'LISTING_LOCK_CONFLICT';
export const LISTING_LOCK_REQUIRED = 'LISTING_LOCK_REQUIRED';
export const LISTING_LOCK_EXPIRED = 'LISTING_LOCK_EXPIRED';
export const LISTING_VERSION_CONFLICT = 'LISTING_VERSION_CONFLICT';
export const LISTING_INVALID_STATE_TRANSITION = 'LISTING_INVALID_STATE_TRANSITION';
export const LISTING_REJECTION_REASON_REQUIRED = 'LISTING_REJECTION_REASON_REQUIRED';
export const LISTING_FORCE_UNLOCK_REASON_REQUIRED = 'LISTING_FORCE_UNLOCK_REASON_REQUIRED';

// Admin Price Suggestion & Seller Response Constants (Story 2.5 / FR-57 / BR-16)
export const PRICE_SUGGESTION_NOT_FOUND = 'PRICE_SUGGESTION_NOT_FOUND';
export const PRICE_SUGGESTION_ALREADY_RESPONDED = 'PRICE_SUGGESTION_ALREADY_RESPONDED';
export const PRICE_SUGGESTION_SAME_AS_CURRENT = 'PRICE_SUGGESTION_SAME_AS_CURRENT';
export const PRICE_SUGGESTION_REASON_REQUIRED = 'PRICE_SUGGESTION_REASON_REQUIRED';

// Compliance and Archiving Constants (Story 2.6 / FR-14 / UC-38 / UC-66)
export const LISTING_ARCHIVE_BLOCKED_RESERVED = 'LISTING_ARCHIVE_BLOCKED_RESERVED';
export const LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL = 'LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL';
export const LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS = 'LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS';
export const LISTING_NOT_ARCHIVED = 'LISTING_NOT_ARCHIVED';
export const LISTING_NOT_SUSPENDED = 'LISTING_NOT_SUSPENDED';
export const LISTING_ALREADY_BLOCKED = 'LISTING_ALREADY_BLOCKED';
export const LISTING_PERMANENTLY_BLOCKED = 'LISTING_PERMANENTLY_BLOCKED';
export const LISTING_COMPLIANCE_REASON_REQUIRED = 'LISTING_COMPLIANCE_REASON_REQUIRED';
export const LISTING_COMPLIANCE_SUSPENDED = 'LISTING_COMPLIANCE_SUSPENDED';

export const MIN_LISTING_PRICE_SAR = 1;
export const MAX_LISTING_PRICE_SAR = 50_000_000;
export const MIN_LISTING_PHOTOS = 3;
export const MAX_LISTING_PHOTOS = 20;
export const MAX_LISTING_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SAUDI_BOUNDS = {
  minLat: 16.0,
  maxLat: 32.5,
  minLng: 34.5,
  maxLng: 55.7,
} as const;

export const PLATFORM_COMMISSION_RATE = 0.025;

export const PROPERTY_TYPE_LABELS_AR: Record<PropertyType, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'مكتب / تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

export const LISTING_STATUS_LABELS_AR: Record<ListingStatus, string> = {
  [ListingStatus.DRAFT]: 'مسودة',
  [ListingStatus.PENDING_REVIEW]: 'قيد المراجعة',
  [ListingStatus.PENDING_FEE]: 'في انتظار الرسوم',
  [ListingStatus.ACTIVE]: 'نشط',
  [ListingStatus.RESERVED]: 'محجوز',
  [ListingStatus.SOLD]: 'تم البيع',
  [ListingStatus.REJECTED]: 'مرفوض',
  [ListingStatus.UNDER_COMPLIANCE_REVIEW]: 'تحت تدقيق الامتثال',
  [ListingStatus.ARCHIVED]: 'مؤرشف',
  [ListingStatus.SUSPENDED]: 'معلق للامتثال',
  [ListingStatus.BLOCKED]: 'محظور',
};

export const SUSPENSION_CATEGORY_LABELS_AR: Record<SuspensionCategory, string> = {
  [SuspensionCategory.MISLEADING_SPECIFICATIONS]: 'مواصفات مضللة أو غير دقيقة',
  [SuspensionCategory.INVALID_FAL_LICENSE]: 'رخصة فال غير صالحة أو منتهية',
  [SuspensionCategory.UNAUTHORIZED_BROKERAGE]: 'وساطة غير مصرح بها',
  [SuspensionCategory.FRAUD_SUSPICION]: 'اشتباه في احتيال أو تلاعب',
  [SuspensionCategory.OTHER]: 'أسباب أخرى',
};

// Interactive Map Constants (Story 3.2 / FR-16)
export const MAX_MAP_RESULTS = 200;
export const SAUDI_CENTER: [number, number] = [24.7136, 46.6753]; // Riyadh, default map viewport
export const MAP_DEFAULT_ZOOM = 6;

export const PROPERTY_TYPE_MAP_COLORS: Record<PropertyType, string> = {
  [PropertyType.APARTMENT]: '#2563EB', // blue
  [PropertyType.VILLA]:     '#059669', // green (emerald)
  [PropertyType.LAND]:      '#D97706', // amber/orange
  [PropertyType.BUILDING]:  '#7C3AED', // purple
  [PropertyType.COMMERCIAL]: '#DC2626', // red
  [PropertyType.FARM]:      '#0D9488', // teal
};
