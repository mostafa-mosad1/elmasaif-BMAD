import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  PropertyType,
  CreateListingInput,
  ListingPhotoItem,
  ListingDocumentItem,
} from '@elmasaif/shared';

export class CreateListingDto implements CreateListingInput {
  @ApiProperty({ description: 'Property title', minLength: 5, maxLength: 150 })
  @Allow()
  title!: string;

  @ApiProperty({ description: 'Detailed property description', minLength: 10, maxLength: 3000 })
  @Allow()
  description!: string;

  @ApiProperty({ enum: PropertyType, description: 'Property category/type' })
  @Allow()
  propertyType!: PropertyType;

  @ApiProperty({ description: 'City UUID', format: 'uuid' })
  @Allow()
  cityId!: string;

  @ApiProperty({ description: 'District UUID', format: 'uuid' })
  @Allow()
  districtId!: string;

  @ApiPropertyOptional({ description: 'Optional street name', maxLength: 150 })
  @Allow()
  streetName?: string | null;

  @ApiProperty({ description: 'Latitude coordinate (within KSA 16.0 to 32.5)', minimum: 16.0, maximum: 32.5 })
  @Allow()
  latitude!: number;

  @ApiProperty({ description: 'Longitude coordinate (within KSA 34.5 to 55.7)', minimum: 34.5, maximum: 55.7 })
  @Allow()
  longitude!: number;

  @ApiProperty({ description: 'Single ask price in SAR (1 to 50,000,000)', minimum: 1, maximum: 50000000 })
  @Allow()
  askPrice!: number;

  @ApiProperty({ description: 'Total land/property area in square meters', minimum: 1, maximum: 10000000 })
  @Allow()
  areaSquareMeters!: number;

  @ApiPropertyOptional({ description: 'Number of bedrooms (0 to 100)', minimum: 0, maximum: 100 })
  @Allow()
  bedrooms?: number | null;

  @ApiPropertyOptional({ description: 'Year built (1900 to currentYear + 1)' })
  @Allow()
  yearBuilt?: number | null;

  @ApiProperty({ description: 'Registered Saudi IBAN for payouts' })
  @Allow()
  payoutIban!: string;

  @ApiProperty({ description: 'Property photos (min 3, max 20)', type: 'array' })
  @Allow()
  photos!: ListingPhotoItem[];

  @ApiProperty({ description: 'Legal and supporting documents (min 1)', type: 'array' })
  @Allow()
  documents!: ListingDocumentItem[];
}
