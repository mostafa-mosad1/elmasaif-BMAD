import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { OfferListQuery, SubmitOfferInput } from '@elmasaif/shared';

/**
 * Swagger-facing mirror of `submitOfferSchema` (Story 4.1 / FR-25). `ZodValidationPipe`
 * remains the runtime validator; this class only documents the body.
 */
export class CreateOfferDto implements SubmitOfferInput {
  @ApiProperty({ description: 'Target ACTIVE/RESERVED listing UUID', format: 'uuid' })
  @Allow()
  listingId!: string;

  @ApiProperty({ description: 'Binding offer price in SAR (1 – 50,000,000)' })
  @Allow()
  offerPrice!: number;

  @ApiPropertyOptional({ description: 'Optional buyer note (max 500 chars)', maxLength: 500 })
  @Allow()
  note?: string | null;

  @ApiPropertyOptional({
    description: 'Explicit acknowledgement of an offer below 50% of the ask price (BR-11)',
  })
  @Allow()
  lowPriceConfirmation!: boolean;
}

export class OfferListQueryDto implements OfferListQuery {
  @ApiPropertyOptional({ description: 'Narrow to a single listing UUID', format: 'uuid' })
  @Allow()
  listingId?: string;
}
