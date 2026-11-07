import { DealStatus } from '../enums';
import type { DealPaymentStatus, DealPaymentType } from '../constants/deal';
import type { ClaimLockInfo } from './locks';

/**
 * The frozen seller payout snapshot stored on the Deal (Story 5.1 / FR-29 / AC-5).
 *
 * Every field is a *copy*, never a relation: editing or deleting the source `PayoutAccount` must
 * not be able to change what the buyer was asked to pay. `ibanMasked` is the only IBAN form that
 * ever leaves the API — the ciphertext stays at rest.
 */
export interface DealPayoutSnapshot {
  accountId: string;
  accountHolderName: string;
  bankName: string | null;
  ibanMasked: string;
}

/**
 * The `POST /api/v1/admin/deals/final-approve` response body (Story 5.1 / AC-1).
 *
 * A binding view, not the buyer-facing deal projection (`DealSummary` is Story 5.2's, and the
 * frozen `platformIban` it wants has no source of truth yet — Story 8.6 owns settings).
 *
 * Column-name mapping (D1 — the existing Deal columns keep their names because `prisma db push`
 * cannot rename without dropping): `dealPrice` = FinalDealPrice, `platformCommission` =
 * FinalCommission, `totalAmount` = FinalTotal. Money is a decimal *string*, always.
 */
export interface DealBinding {
  id: string;
  dealNumber: string;
  dealReferenceCode: string;
  status: DealStatus;
  offerId: string;
  listingId: string;
  buyerProfileId: string;
  sellerProfileId: string;
  /** FinalDealPrice — the agreed price. */
  dealPrice: string;
  /** FinalCommission — the platform's rounded share. */
  platformCommission: string;
  /** FinalTotal — `dealPrice + platformCommission`. */
  totalAmount: string;
  /**
   * The frozen 2.5 % fraction, stored as `Decimal(5,4)` (`0.0250`). Read back through Prisma the
   * text form is `'0.025'` — trailing zeros are dropped, so never parse this for a digit count.
   */
  commissionRateSnapshot: string;
  /** The frozen flat fee, `'0.00'` in the column and `'0'` on the wire. */
  fixedCommissionSnapshot: string;
  paymentWindowHoursSnapshot: number;
  /** AD-11: `createdAt + paymentWindowHoursSnapshot` hours, exactly. */
  paymentDeadline: string;
  createdAt: string;
  approvedByAdminId: string;
  sellerPayout: DealPayoutSnapshot;
}

/** The admin final-approval request body (Story 5.1 / AC-1, AD-2). */
export interface FinalApproveDealInput {
  offerId: string;
}

/**
 * One leg of the dual wire transfer (Story 5.2 / AC-4, AC-5, AC-7).
 *
 * `proofFileObjectId` is the `FileObject` id, never a URL and never the ciphertext: NFR-2 forbids
 * persisting a presigned link, and the download is minted on demand for 300 s.
 */
export interface DealPaymentSlot {
  id: string;
  paymentType: DealPaymentType;
  /** The frozen amount, copied from the deal at materialization. Decimal string. */
  amount: string;
  status: DealPaymentStatus;
  hasProof: boolean;
  proofFileObjectId: string | null;
  bankReferenceCode: string | null;
  senderBankName: string | null;
  uploadedAt: string | null;
  /** Populated by Story 5.3's rejection; this story only ever clears it. */
  rejectionReason: string | null;
}

/** The platform's collection account (D5) — env-backed until Story 8.6 adds the settings table. */
export interface DealPlatformAccount {
  iban: string;
  ibanFormatted: string;
  accountHolderName: string;
  bankName: string | null;
}

/** Released verified contact details upon deal completion (Story 5.4 / FR-32, BR-06). */
export interface ReleasedPartyContact {
  fullName: string;
  mobileNumber: string;
  email: string | null;
}

/** Invoice summary projected for completed deal view and invoice endpoints (Story 5.4 / FR-68). */
export interface DealInvoiceSummary {
  id: string;
  invoiceNumber: string;
  subtotalAmount: string;
  vatAmount: string;
  vatRate: string;
  totalAmount: string;
  vatTreatment: string;
  createdAt: string;
}

/** Rating summary for completed deals (Story 5.4 / FR-54). */
export interface DealRatingSummary {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

/** Request payload for submitting a buyer deal rating (Story 5.4 / FR-54). */
export interface SubmitDealRatingInput {
  score: number;
  comment?: string;
}

/**
 * `GET /api/v1/deals/:id` (Story 5.2 / AC-1, AC-3, AC-4, AC-5) — the buyer's payment screen.
 *
 * Extended in Story 5.4 to project seller contact details, tax invoice summary, and rating summary
 * once the deal status is `COMPLETED`.
 *
 * `serverNow` is the authority the countdown measures against (UX-DR5, trap T-5): the client
 * never compares `paymentDeadline` to `Date.now()`.
 *
 * The seller's *plaintext* IBAN is present because the buyer is the paying party (NFR-3). The
 * ciphertext, the seller's mobile number and their email are never part of this payload until
 * the deal status reaches COMPLETED (FR-32).
 */
export interface DealPaymentView {
  id: string;
  dealNumber: string;
  dealReferenceCode: string;
  status: DealStatus;
  listingId: string;
  propertyTitle: string;
  dealPrice: string;
  platformCommission: string;
  totalAmount: string;
  commissionRateSnapshot: string;
  paymentWindowHoursSnapshot: number;
  paymentDeadline: string;
  createdAt: string;
  /** ISO timestamp when deal was marked COMPLETED. */
  completedAt?: string | null;
  /** The API clock, ISO — always present, even when the countdown has expired. */
  serverNow: string;
  platformAccount: DealPlatformAccount;
  sellerPayout: {
    accountHolderName: string;
    bankName: string | null;
    iban: string;
    ibanFormatted: string;
    ibanMasked: string;
  };
  /** Released only when deal.status === COMPLETED, else null/undefined. */
  sellerContact?: ReleasedPartyContact | null;
  /** Tax invoice record summary generated upon completion. */
  invoice?: DealInvoiceSummary | null;
  /** Submitted rating if already rated. */
  rating?: DealRatingSummary | null;
  /** Whether the authenticated buyer can submit a rating. */
  canRate?: boolean;
  /** Exactly two slots, `PLATFORM_COMMISSION` first (RTL reading order). */
  payments: DealPaymentSlot[];
}

/** AC-7: the upload response body carries the updated slot, never the whole deal. */
export type DealPaymentProofUploadResult = DealPaymentSlot;

/** AC-12: a 5-minute, single-use download link — never persisted (NFR-2). */
export interface DealPaymentProofDownload {
  downloadUrl: string;
  expiresInSeconds: number;
}

/*
 * Story 5.3 — the administrative proof-review queue (FR-31, AD-10).
 */

/**
 * One row of `GET /api/v1/admin/payments` (AC-1): a proof awaiting an admin decision, its parent
 * deal summary, and the live AD-10 lease. `ClaimLockInfo` is imported, never redeclared — the
 * offer/inquiry/listing queues project the exact same shape. `proofFileObjectId` is a
 * `FileObject.id`, never a URL (NFR-2).
 */
export interface AdminPaymentQueueItem {
  id: string;
  dealId: string;
  dealNumber: string;
  propertyTitle: string;
  paymentType: DealPaymentType;
  /** The frozen amount, decimal string (BR-02 / trap T-4) — never recomputed. */
  amount: string;
  status: DealPaymentStatus;
  uploadedAt: string | null;
  bankReferenceCode: string | null;
  senderBankName: string | null;
  rejectionReason: string | null;
  proofFileObjectId: string | null;
  /** FR-31 / AC-5: rejection `verifiedAt + 12 h` when the rejection landed at/after the deadline, else null. */
  correctionWindowExpiresAt: string | null;
  lockInfo: ClaimLockInfo;
}

/**
 * `GET /api/v1/admin/payments/:id` (AC-1, AC-3, AC-6): the queue row plus the deal-level context
 * the reviewer needs — the audit status, the payment deadline the grace period is measured
 * against, and `approvedByAdminId` for the FR-51 separation-of-duties gate.
 */
export interface AdminPaymentDetail extends Omit<AdminPaymentQueueItem, 'lockInfo'> {
  dealStatus: DealStatus;
  paymentDeadline: string;
  approvedByAdminId: string | null;
  verifiedByAdminId: string | null;
  verifiedByAdminName: string | null;
  verifiedAt: string | null;
  /** The API clock, ISO — the countdown and the grace banner measure against this, never local time. */
  serverNow: string;
  lockInfo: ClaimLockInfo;
}

