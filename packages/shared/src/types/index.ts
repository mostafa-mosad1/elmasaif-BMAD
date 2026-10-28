import { z } from 'zod';
import {
  createListingSchema,
  submitOfferSchema,
  counterOfferSchema,
  uploadPaymentProofSchema,
  createDemandSchema,
  loginSchema,
  registerSchema
} from '../schemas';
import { ListingStatus, DealStatus, PropertyType } from '../enums';

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type SubmitOfferInput = z.infer<typeof submitOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;
export type CreateDemandInput = z.infer<typeof createDemandSchema>;

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

