/**
 * The shared arithmetic-free rules of a deal payment slot (Story 5.2 / FR-29, FR-30, NFR-13).
 *
 * Two rules keep this module honest:
 *
 * - **No money maths.** The deal froze `dealPrice`, `platformCommission` and `totalAmount` at
 *   approval; a `Payment` row copies one of those values verbatim. Recomputing the commission from
 *   `commissionRateSnapshot` here would silently rewrite a contractual amount (FR-29).
 * - **No actor.** Nothing in this module knows whether the caller is a buyer, a seller or an
 *   administrator, so the payloads it feeds can never leak a counterparty's identity (NFR-3).
 */
import { MAX_FILE_SIZE_BYTES } from '../constants/index';
import {
  DEAL_PAYMENT_PROOF_MIME_TYPES,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPES,
  UPLOADABLE_PAYMENT_STATUSES,
  type DealPaymentProofMimeType,
  type DealPaymentStatus,
  type DealPaymentType,
} from '../constants/deal';

/** The two `Payment` columns the slots are created from, in display order. */
export const DEAL_PAYMENT_AMOUNT_SOURCES: ReadonlyArray<{
  paymentType: DealPaymentType;
  amountField: 'platformCommission' | 'dealPrice';
}> = [
  { paymentType: DEAL_PAYMENT_TYPES[0], amountField: 'platformCommission' },
  { paymentType: DEAL_PAYMENT_TYPES[1], amountField: 'dealPrice' },
];

/** AC-7: `OWNER_CONTRACT_FEE` and anything else unknown is a deal-payment type error. */
export function isDealPaymentType(value: unknown): value is DealPaymentType {
  return typeof value === 'string' && (DEAL_PAYMENT_TYPES as readonly string[]).includes(value);
}

/** FR-30: the buyer may upload (or replace) a receipt only in `PENDING | PROOF_UPLOADED | REJECTED`. */
export function isPaymentUploadable(status: string | null | undefined): boolean {
  if (!status) return false;
  return UPLOADABLE_PAYMENT_STATUSES.includes(status as DealPaymentStatus);
}

export interface DealPaymentProofFileInput {
  size: number;
  mimeType: string;
}

export type DealPaymentProofValidationError =
  | typeof DEAL_PAYMENT_PROOF_REQUIRED
  | typeof DEAL_PAYMENT_PROOF_TOO_LARGE
  | typeof DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE;

/**
 * FR-30, in the order the guardrails run: the file must exist, then fit under 10 MB, then be one
 * of PDF / JPEG / PNG. WebP is accepted by the generic storage hook but is **not** a receipt
 * format, which is why this check runs before staging rather than after.
 */
export function validateDealPaymentProofFile(
  file: DealPaymentProofFileInput | null | undefined,
): DealPaymentProofValidationError | null {
  const size = Number(file?.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) return DEAL_PAYMENT_PROOF_REQUIRED;
  if (size > MAX_FILE_SIZE_BYTES) return DEAL_PAYMENT_PROOF_TOO_LARGE;
  if (!isDealPaymentProofMimeType(file?.mimeType)) return DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE;
  return null;
}

export function isDealPaymentProofMimeType(value: unknown): value is DealPaymentProofMimeType {
  return (
    typeof value === 'string' && (DEAL_PAYMENT_PROOF_MIME_TYPES as readonly string[]).includes(value)
  );
}

/**
 * The frozen amount of one slot, read straight off the deal. `String()` because the wire contract
 * is a decimal string; `Number()` on a price is a BR-02 defect (trap T-4).
 */
export function resolveDealPaymentAmount(
  paymentType: DealPaymentType,
  deal: { platformCommission: unknown; dealPrice: unknown },
): string {
  return paymentType === DEAL_PAYMENT_TYPES[1]
    ? String(deal.dealPrice)
    : String(deal.platformCommission);
}

/** The list projection's `platformFeeProofUploaded` / `sellerPriceProofUploaded` flags. */
export function isPaymentProofUploaded(status: string | null | undefined): boolean {
  return status === DEAL_PAYMENT_STATUS.PROOF_UPLOADED;
}
