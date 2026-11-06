import { DealStatus } from '../enums';

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
