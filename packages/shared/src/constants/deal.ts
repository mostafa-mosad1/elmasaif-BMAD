import { DealStatus } from '../enums';
import { DEAL_PAYMENT_DEADLINE_HOURS, PLATFORM_COMMISSION_PERCENTAGE } from './index';

/*
 * Deal binding constants (Story 5.1 / FR-28, FR-29, BR-02, BR-07, AD-3, AD-4).
 */

// Final-approval refusal codes — shared so the API, the web hint table and the specs agree.
export const DEAL_ALREADY_ACTIVE_FOR_LISTING = 'DEAL_ALREADY_ACTIVE_FOR_LISTING';
export const DEAL_SELLER_PAYOUT_REQUIRED = 'DEAL_SELLER_PAYOUT_REQUIRED';
export const DEAL_LISTING_UNAVAILABLE = 'DEAL_LISTING_UNAVAILABLE';

/**
 * BR-07 / AD-4: the statuses that make a listing "already under deal".
 *
 * This is the exact complement of the terminal set, and it must stay in lock-step with the SQL
 * predicate of the `deal_single_active_listing` partial index
 * (`apps/api/prisma/sql/deal-invariants.sql`), which is written as `NOT IN (terminal…)` precisely
 * so a future non-terminal status is covered automatically. The index — not this list — is the
 * real guarantee; this list only drives the friendly pre-check and the account/payout guards.
 */
export const ACTIVE_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.AWAITING_PAYMENT_PROOF,
  DealStatus.UNDER_ADMIN_AUDIT,
  DealStatus.PAYMENT_REJECTED,
];

/** BR-07 / AD-4: a deal in one of these statuses no longer blocks a second deal for the listing. */
export const TERMINAL_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.COMPLETED,
  DealStatus.CANCELLED,
  DealStatus.TERMINATED,
];

/**
 * OQ-02: 2.5 % + 0 SAR today. Both are frozen into the Deal row at creation and are therefore
 * immutable afterwards, so changing them never rewrites history (Story 8.6 makes them
 * configurable — `DEFAULT_*` are the fallbacks that apply until then).
 */
export const DEFAULT_COMMISSION_RATE = PLATFORM_COMMISSION_PERCENTAGE;
export const DEFAULT_FIXED_COMMISSION_SAR = '0.00';
export const DEFAULT_PAYMENT_WINDOW_HOURS = DEAL_PAYMENT_DEADLINE_HOURS;

// Human-facing identifiers. `DL-yyyyMMdd-XXXXXXXXXX` is the internal number, `ELM-XXXXXXXXXX-C`
// the code the buyer types into a bank transfer (UX journey 1: `ELM-408-C`).
export const DEAL_NUMBER_PREFIX = 'DL';
export const DEAL_REFERENCE_PREFIX = 'ELM';
export const DEAL_REFERENCE_SUFFIX = 'C';
export const DEAL_SHORT_CODE_LENGTH = 10;
