import { z } from 'zod';
import {
  submitOfferSchema,
  counterOfferSchema,
  uploadPaymentProofSchema,
  createDemandSchema,
  cancelDemandSchema,
  createProposalSchema,
  rejectProposalSchema,
  proposalQueueQuerySchema,
  offerListQuerySchema,
  rejectOfferSchema,
  adminRejectOfferSchema,
  offerQueueQuerySchema,
  backupOfferQueueQuerySchema,
  createInquirySchema,
  appendInquiryMessageSchema,
  relayInquirySchema,
  closeInquirySchema,
  inquiryQueueQuerySchema,
  paymentQueueQuerySchema,
  adminRejectPaymentSchema,
  adminRejectPaymentBodySchema,
  paymentForceUnlockSchema,
  createOwnerListingRequestSchema,
  dispatchOwnerContractSchema,
  rejectOwnerListingRequestSchema,
  requestModificationSchema,
  forceUnlockOwnerRequestSchema,
  ownerRequestsQueueQuerySchema
} from '../schemas';
import { ListingStatus, DealStatus, PropertyType } from '../enums';

export type SubmitOfferInput = z.infer<typeof submitOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;
export type CreateDemandInput = z.infer<typeof createDemandSchema>;
export type CancelDemandInput = z.infer<typeof cancelDemandSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type RejectProposalInput = z.infer<typeof rejectProposalSchema>;
export type ProposalQueueQuery = z.infer<typeof proposalQueueQuerySchema>;
export type OfferListQuery = z.infer<typeof offerListQuerySchema>;
export type RejectOfferInput = z.infer<typeof rejectOfferSchema>;
export type AdminRejectOfferInput = z.infer<typeof adminRejectOfferSchema>;
export type OfferQueueQuery = z.infer<typeof offerQueueQuerySchema>;
export type BackupOfferQueueQuery = z.infer<typeof backupOfferQueueQuerySchema>;
export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type AppendInquiryMessageInput = z.infer<typeof appendInquiryMessageSchema>;
export type RelayInquiryInput = z.infer<typeof relayInquirySchema>;
export type CloseInquiryInput = z.infer<typeof closeInquirySchema>;
export type InquiryQueueQuery = z.infer<typeof inquiryQueueQuerySchema>;
export type PaymentQueueQuery = z.infer<typeof paymentQueueQuerySchema>;
export type AdminRejectPaymentInput = z.infer<typeof adminRejectPaymentSchema>;
export type AdminRejectPaymentBodyInput = z.infer<typeof adminRejectPaymentBodySchema>;
export type PaymentForceUnlockInput = z.infer<typeof paymentForceUnlockSchema>;
export type CreateOwnerListingRequestInput = z.infer<typeof createOwnerListingRequestSchema>;
export type DispatchOwnerContractInput = z.infer<typeof dispatchOwnerContractSchema>;
export type RejectOwnerListingRequestInput = z.infer<typeof rejectOwnerListingRequestSchema>;
export type RequestModificationInput = z.infer<typeof requestModificationSchema>;
export type ForceUnlockOwnerRequestInput = z.infer<typeof forceUnlockOwnerRequestSchema>;
export type OwnerRequestsQueueQuery = z.infer<typeof ownerRequestsQueueQuerySchema>;

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PropertyListingSummary {
  id: string;
  title: string;
  propertyType: PropertyType;
  city: string;
  district: string;
  askPrice: string;
  areaSquareMeters: number;
  bedrooms?: number;
  bathrooms?: number;
  status: ListingStatus;
  primaryImageUrl?: string;
  isFalVerified: boolean;
  marketerLicenseNumber?: string;
  createdAt: string;
}

/**
 * `GET /api/v1/deals/my` (Story 5.2 / AC-2, D8) — the buyer's deal list.
 *
 * Rewritten, not extended: the previous shape carried `hoursRemaining` and a frozen
 * `platformIban`, neither of which can be served from a single clock-safe payload (the list is
 * not the payment screen, so `serverNow` does not travel with every row). The list renders the
 * title, the frozen amounts, the deadline and whether each receipt has landed.
 */
export interface DealSummary {
  id: string;
  dealNumber: string;
  listingId: string;
  propertyTitle: string;
  status: DealStatus;
  dealPrice: string;
  platformCommission: string;
  totalAmount: string;
  paymentDeadline: string;
  platformFeeProofUploaded: boolean;
  sellerPriceProofUploaded: boolean;
}

export * from './geo';
export * from './clock';
export * from './jobs';
export * from './storage';
export * from './ui';
export * from './auth';
export * from './identity';
export * from './payout';
export * from './preferences';
export * from './listing';
export * from './locks';
export * from './offer';
export * from './inquiry';
export * from './deal';
export * from './licensing';
export * from './broker';
export * from './contracts';
export * from './support';
export * from './settings';
export * from './audit';
export * from './notification';
export * from './fraud';
export * from './finance';
export * from './cms';
export * from './notes';
export * from './executive';
