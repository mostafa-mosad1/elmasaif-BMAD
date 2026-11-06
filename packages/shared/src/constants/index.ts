export const PLATFORM_COMMISSION_PERCENTAGE = 0.025; // 2.5%
export const OWNER_CONTRACT_FEE_SAR = '1000.00';
export const DEAL_PAYMENT_DEADLINE_HOURS = 48;
export const DEAL_ADMIN_REVIEW_GRACE_PERIOD_HOURS = 12;
export const DEMAND_EXPIRY_DAYS = 30;
export const OFFER_EXPIRY_HOURS = 168;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'];
export const SAUDI_IBAN_LENGTH = 24;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const STATIC_DEV_OTP = '123456';
export const CURRENCY_CODE_SAR = 'SAR';
export const CURRENCY_SYMBOL_AR = 'ر.س';

// Security and Startup Guard Error Codes
export const CLOCK_MOCK_DISALLOWED_IN_PRODUCTION = 'CLOCK_MOCK_DISALLOWED_IN_PRODUCTION';
export const STATIC_OTP_DISALLOWED_IN_PRODUCTION = 'STATIC_OTP_DISALLOWED_IN_PRODUCTION';

export * from './jobs';
export * from './storage';
export * from './ui';
export * from './auth';
export * from './geo';
export * from './listing';
export * from './demand';
export * from './proposal';
export * from './offer';
export * from './masking';
export * from './inquiry';
