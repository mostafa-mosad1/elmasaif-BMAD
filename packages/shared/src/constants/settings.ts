/**
/**
 * Canonical default platform parameters, SLA durations, fraud thresholds, and error codes
 * (Story 8.6 / AC1, FR-68, FR-69, AD-3, AD-6).
 */

export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.025; // 2.5% platform commission fraction
export const DEFAULT_PLATFORM_COMMISSION_PERCENTAGE = 2.5; // 2.5%
export const DEFAULT_FIXED_COMMISSION_SAR = '0.00';
export const DEFAULT_OWNER_CONTRACT_FEE_SAR = 1000;
export const DEFAULT_VAT_RATE_PERCENTAGE = 15.0; // 15% Saudi ZATCA VAT rate
export const DEFAULT_PAYMENT_WINDOW_HOURS = 48; // 48 hours wire transfer deadline
export const DEFAULT_PAYMENT_CORRECTION_HOURS = 12; // 12 hours post-rejection correction window
export const DEFAULT_CONTRACT_FEE_DEADLINE_DAYS = 7; // 7 days for owner contract fee payment
export const DEFAULT_COOLING_OFF_PERIOD_DAYS = 14; // 14 days PDPL cooling-off period
export const DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS = 4; // 4 hours alert tier for payment proof review
export const DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS = 12; // 12 hours Super Admin escalation tier
export const DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS = 24; // 24 hours mandatory final decision tier
export const DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS = 4; // 4 hours technical support first response SLA
export const DEFAULT_TICKET_SLA_RESOLUTION_HOURS = 48; // 48 hours technical support resolution SLA
export const DEFAULT_TASK_CLAIM_LEASE_MINUTES = 15; // 15 minutes operational queue claim lock
export const DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES = 5; // 5 minutes client renewal heartbeat
export const DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD = 3; // 3 rejected proofs triggers fraud event
export const DEFAULT_FRAUD_WINDOW_HOURS = 72; // 72-hour sliding window for fraud alerts

// Status & Error codes
export const SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND';
export const SETTINGS_UPDATE_INVALID = 'SETTINGS_UPDATE_INVALID';
export const SETTINGS_COMMISSION_RATE_OUT_OF_BOUNDS = 'SETTINGS_COMMISSION_RATE_OUT_OF_BOUNDS';
export const SETTINGS_FEE_NEGATIVE = 'SETTINGS_FEE_NEGATIVE';
export const SETTINGS_VAT_RATE_INVALID = 'SETTINGS_VAT_RATE_INVALID';
export const SETTINGS_DEADLINE_OUT_OF_BOUNDS = 'SETTINGS_DEADLINE_OUT_OF_BOUNDS';
export const SETTINGS_IBAN_INVALID = 'SETTINGS_IBAN_INVALID';
export const SETTINGS_UNAUTHORIZED = 'SETTINGS_UNAUTHORIZED';

// Action constant for immutable audit
export const PLATFORM_SETTINGS_UPDATED = 'PLATFORM_SETTINGS_UPDATED';

