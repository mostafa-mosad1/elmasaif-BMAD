import { z } from 'zod';
import {
  createListingSchema,
  listingPhotoItemSchema,
  listingDocumentItemSchema,
} from '../schemas/listing.schema';
import { PropertyType, ListingStatus, DocumentVisibility, ScanStatus } from '../enums';

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingPhotoItem = z.infer<typeof listingPhotoItemSchema>;
export type ListingDocumentItem = z.infer<typeof listingDocumentItemSchema>;

export interface PropertyDocumentResponse {
  id: string;
  documentType: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  visibility: DocumentVisibility;
  scanStatus: ScanStatus;
  createdAt: string;
}

export interface ListingDetailResponse {
  id: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  streetName?: string | null;
  latitude: number;
  longitude: number;
  askPrice: number | string;
  areaSquareMeters: number;
  bedrooms?: number | null;
  yearBuilt?: number | null;
  status: ListingStatus;
  sellerProfileId: string;
  payoutIban?: string;
  version: number;
  photos: PropertyDocumentResponse[];
  documents: PropertyDocumentResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummaryItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityId: string;
  districtId: string;
  cityName?: string;
  districtName?: string;
  askPrice: number | string;
  areaSquareMeters: number;
  bedrooms?: number | null;
  status: ListingStatus;
  primaryPhotoUrl?: string;
  createdAt: string;
}

