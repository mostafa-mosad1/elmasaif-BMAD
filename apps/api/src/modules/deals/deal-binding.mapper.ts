import { DealBinding, DealStatus } from '@elmasaif/shared';
import { toIso } from '../offers/offer-thread.mapper';

/**
 * Story 5.1 / AC-1, AC-4, AC-5: the one place the `deals` row becomes an API payload.
 *
 * Every money field is `String(...)`'d, never `Number(...)` (BR-02): the wire contract is a
 * decimal string so a client can never re-round a frozen amount on its way to a bank transfer.
 * The FR-29 column-name mapping (D1) is applied here, not in the schema.
 */
export function toDealBinding(deal: any, payout: any): DealBinding {
  return {
    id: deal.id,
    dealNumber: deal.dealNumber,
    dealReferenceCode: deal.dealReferenceCode,
    status: deal.status as DealStatus,
    offerId: deal.offerId,
    listingId: deal.listingId,
    buyerProfileId: deal.buyerProfileId,
    sellerProfileId: deal.sellerProfileId,
    dealPrice: String(deal.dealPrice),
    platformCommission: String(deal.platformCommission),
    totalAmount: String(deal.totalAmount),
    commissionRateSnapshot: String(deal.commissionRateSnapshot),
    fixedCommissionSnapshot: String(deal.fixedCommissionSnapshot),
    paymentWindowHoursSnapshot: Number(deal.paymentWindowHoursSnapshot),
    paymentDeadline: toIso(deal.paymentDeadline) as string,
    createdAt: toIso(deal.createdAt) as string,
    approvedByAdminId: deal.approvedByAdminId,
    sellerPayout: {
      accountId: deal.sellerPayoutAccountId,
      accountHolderName: deal.sellerPayoutHolderName,
      bankName: deal.sellerPayoutBankName ?? payout?.bankName ?? null,
      ibanMasked: deal.sellerPayoutIbanMasked,
    },
  };
}
