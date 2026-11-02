import {
  ListingDetailResponse,
  PropertyDocumentResponse,
  ListingStatus,
  PropertyType,
} from '@elmasaif/shared';

export class ListingResponseDto implements ListingDetailResponse {
  id!: string;
  title!: string;
  description!: string;
  propertyType!: PropertyType;
  cityId!: string;
  districtId!: string;
  cityName?: string;
  districtName?: string;
  streetName?: string | null;
  latitude!: number;
  longitude!: number;
  askPrice!: number | string;
  areaSquareMeters!: number;
  bedrooms?: number | null;
  yearBuilt?: number | null;
  status!: ListingStatus;
  sellerProfileId!: string;
  payoutIban?: string;
  version!: number;
  photos!: PropertyDocumentResponse[];
  documents!: PropertyDocumentResponse[];
  createdAt!: string;
  updatedAt!: string;
}

