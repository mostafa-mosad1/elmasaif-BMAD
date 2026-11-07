import {
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPES,
  DealInvoiceSummary,
  DealPaymentSlot,
  DealPaymentStatus,
  DealPaymentType,
  DealPaymentView,
  DealPlatformAccount,
  DealRatingSummary,
  DealStatus,
  DealSummary,
  PaymentType,
  ReleasedPartyContact,
  formatSaudiIban,
  isPaymentProofUploaded,
} from '@elmasaif/shared';
import { toIso } from '../offers/offer-thread.mapper';

/**
 * Story 5.2 / Task 4.4: the one place a `Deal`/`Payment` row pair becomes a buyer payload.
 *
 * Two rules hold for every function below:
 * - Money is `String(decimal)` and nothing else (BR-02, trap T-4). No amount is recomputed from
 *   `commissionRateSnapshot`; the frozen columns are the contract (FR-29).
 * - `serverNow` is passed in from `ClockService` — the mapper never reads a clock (AD-11).
 */

/** RTL reading order: the platform commission card comes first (`DEAL_PAYMENT_TYPES` order). */
function sortSlots<T extends { paymentType: string }>(payments: T[]): T[] {
  const rank = (paymentType: string) => {
    const index = DEAL_PAYMENT_TYPES.indexOf(paymentType as DealPaymentType);
    return index === -1 ? DEAL_PAYMENT_TYPES.length : index;
  };
  return [...payments].sort((a, b) => rank(a.paymentType) - rank(b.paymentType));
}

export function toDealPaymentSlot(payment: any): DealPaymentSlot {
  return {
    id: payment.id,
    paymentType: payment.paymentType as DealPaymentType,
    amount: String(payment.amount),
    // `Payment.status` is a `String` column, so nothing type-checks this read (trap T-9). An
    // unknown value degrades to PENDING rather than crashing the buyer's screen.
    status: (payment.status as DealPaymentStatus) ?? DEAL_PAYMENT_STATUS.PENDING,
    hasProof: Boolean(payment.proofFileUrl),
    proofFileObjectId: payment.proofFileUrl ?? null,
    bankReferenceCode: payment.bankReferenceCode ?? null,
    senderBankName: payment.senderBankName ?? null,
    uploadedAt: toIso(payment.uploadedAt),
    rejectionReason: payment.rejectionReason ?? null,
  };
}

function hasUploadedProof(payments: any[], paymentType: DealPaymentType): boolean {
  const payment = payments.find((row) => row.paymentType === paymentType);
  return Boolean(payment) && isPaymentProofUploaded(payment.status);
}

/** `GET /deals/my` — the list projection. No `serverNow`, so no countdown here (D8). */
export function toDealSummary(
  deal: any,
  listingTitle: string | null | undefined,
  payments: any[],
): DealSummary {
  return {
    id: deal.id,
    dealNumber: deal.dealNumber,
    listingId: deal.listingId,
    propertyTitle: listingTitle ?? '',
    status: deal.status as DealStatus,
    dealPrice: String(deal.dealPrice),
    platformCommission: String(deal.platformCommission),
    totalAmount: String(deal.totalAmount),
    paymentDeadline: toIso(deal.paymentDeadline) as string,
    platformFeeProofUploaded: hasUploadedProof(payments, PaymentType.PLATFORM_COMMISSION),
    sellerPriceProofUploaded: hasUploadedProof(payments, PaymentType.SELLER_PURCHASE_PRICE),
  };
}

export function toDealInvoiceSummary(invoice: any): DealInvoiceSummary | null {
  if (!invoice) return null;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    subtotalAmount: String(invoice.subtotalAmount),
    vatAmount: String(invoice.vatAmount),
    vatRate: String(invoice.vatRate),
    totalAmount: String(invoice.totalAmount),
    vatTreatment: invoice.vatTreatment,
    createdAt: toIso(invoice.createdAt) as string,
  };
}

export function toDealRatingSummary(rating: any): DealRatingSummary | null {
  if (!rating) return null;
  return {
    id: rating.id,
    score: rating.score,
    comment: rating.comment ?? null,
    createdAt: toIso(rating.createdAt) as string,
  };
}

/**
 * `GET /deals/:id` — the payment screen.
 *
 * `sellerIbanPlain` is the decrypted IBAN, produced only for the buyer of that deal: they are
 * wiring money to it, so masking it would be absurd. The ciphertext never leaves the server
 * (trap T-11), and the seller's contacts are released strictly when status is COMPLETED (FR-32).
 */
export function toDealPaymentView(
  deal: any,
  payments: any[],
  platformAccount: DealPlatformAccount,
  sellerIbanPlain: string,
  now: Date,
  extra?: {
    sellerContact?: ReleasedPartyContact | null;
    invoiceRecord?: any;
    rating?: any;
  },
): DealPaymentView {
  const isCompleted = deal.status === DealStatus.COMPLETED;
  const ratingData = extra?.rating ?? deal.rating;

  return {
    id: deal.id,
    dealNumber: deal.dealNumber,
    dealReferenceCode: deal.dealReferenceCode,
    status: deal.status as DealStatus,
    listingId: deal.listingId,
    propertyTitle: deal.listing?.title ?? '',
    dealPrice: String(deal.dealPrice),
    platformCommission: String(deal.platformCommission),
    totalAmount: String(deal.totalAmount),
    commissionRateSnapshot: String(deal.commissionRateSnapshot),
    paymentWindowHoursSnapshot: Number(deal.paymentWindowHoursSnapshot),
    paymentDeadline: toIso(deal.paymentDeadline) as string,
    createdAt: toIso(deal.createdAt) as string,
    completedAt: isCompleted ? toIso(deal.completedAt) : null,
    serverNow: now.toISOString(),
    platformAccount,
    sellerPayout: {
      accountHolderName: deal.sellerPayoutHolderName,
      bankName: deal.sellerPayoutBankName ?? null,
      iban: sellerIbanPlain,
      ibanFormatted: formatSaudiIban(sellerIbanPlain),
      ibanMasked: deal.sellerPayoutIbanMasked,
    },
    sellerContact: isCompleted ? (extra?.sellerContact ?? null) : null,
    invoice: isCompleted ? toDealInvoiceSummary(extra?.invoiceRecord) : null,
    rating: isCompleted ? toDealRatingSummary(ratingData) : null,
    canRate: isCompleted && !ratingData,
    payments: sortSlots(payments).map((payment) => toDealPaymentSlot(payment)),
  };
}
