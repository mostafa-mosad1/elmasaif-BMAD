import {
  type AdminPaymentDetail,
  type AdminPaymentQueueItem,
  type ClaimLockInfo,
  type DealPaymentStatus,
  type DealPaymentType,
  type DealStatus,
  PAYMENT_CORRECTION_GRACE_HOURS,
  computeCorrectionWindowExpiresAt,
} from '@elmasaif/shared';
import { toIso } from '../offers/offer-thread.mapper';

/**
 * Story 5.3 / Task 4: Admin payment-proof review projections.
 *
 * Rules:
 * - Money is `String(payment.amount)` (BR-02, trap T-4). Never recomputed.
 * - Dates serialised through `toIso` (ISO string or null).
 * - `proofFileObjectId` maps from `Payment.proofFileUrl` (which stores the FileObject.id). Presigned URLs are never persisted.
 * - `correctionWindowExpiresAt` computed via shared `computeCorrectionWindowExpiresAt` pure helper.
 */

export function toAdminPaymentQueueItem(
  payment: any,
  deal: any,
  lockInfo: ClaimLockInfo,
): AdminPaymentQueueItem {
  return {
    id: payment.id,
    dealId: deal.id,
    dealNumber: deal.dealNumber,
    propertyTitle: deal.listing?.title ?? '',
    paymentType: payment.paymentType as DealPaymentType,
    amount: String(payment.amount),
    status: payment.status as DealPaymentStatus,
    uploadedAt: toIso(payment.uploadedAt),
    bankReferenceCode: payment.bankReferenceCode ?? null,
    senderBankName: payment.senderBankName ?? null,
    rejectionReason: payment.rejectionReason ?? null,
    proofFileObjectId: payment.proofFileUrl ?? null,
    correctionWindowExpiresAt: computeCorrectionWindowExpiresAt(
      payment,
      deal.paymentDeadline,
      PAYMENT_CORRECTION_GRACE_HOURS,
    ),
    lockInfo,
  };
}

export function toAdminPaymentDetail(
  payment: any,
  deal: any,
  lockInfo: ClaimLockInfo,
  adminNameMap: Map<string, string> | undefined,
  now: Date,
): AdminPaymentDetail {
  const queueItem = toAdminPaymentQueueItem(payment, deal, lockInfo);
  return {
    ...queueItem,
    dealStatus: deal.status as DealStatus,
    paymentDeadline: toIso(deal.paymentDeadline) ?? '',
    approvedByAdminId: deal.approvedByAdminId ?? null,
    verifiedByAdminId: payment.verifiedByAdminId ?? null,
    verifiedByAdminName: payment.verifiedByAdminId
      ? adminNameMap?.get(payment.verifiedByAdminId) ?? null
      : null,
    verifiedAt: toIso(payment.verifiedAt),
    serverNow: now.toISOString(),
    lockInfo,
  };
}
