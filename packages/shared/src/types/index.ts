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
  inquiryQueueQuerySchema
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

export interface DealSummary {
  id: string;
  dealNumber: string;
  listingId: string;
  propertyTitle: string;
  dealPrice: string;
  platformCommission: string;
  totalPayable: string;
  platformIban: string;
  dealReferenceCode: string;
  sellerVerifiedIban: string;
  sellerName: string;
  status: DealStatus;
  paymentDeadline: string;
  hoursRemaining: number;
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
