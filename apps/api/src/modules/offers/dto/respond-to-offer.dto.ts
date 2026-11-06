import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  AdminRejectOfferInput,
  CounterOfferInput,
  OfferQueueQuery,
  OfferStatus,
  RejectOfferInput,
} from '@elmasaif/shared';

/**
 * Swagger-facing mirror of `counterOfferSchema` (Story 4.2 / FR-26, FR-55). `ZodValidationPipe`
 * remains the runtime validator; this class only documents the body.
 */
export class CounterOfferDto implements CounterOfferInput {
  @ApiProperty({ description: 'Counter-offer price in SAR (1 – 50,000,000)' })
  @Allow()
  counterPrice!: number;

  @ApiPropertyOptional({ description: 'Optional round note (max 500 chars)', maxLength: 500 })
  @Allow()
  note?: string | null;
}

/** Swagger-facing mirror of `rejectOfferSchema` (Story 4.2 / FR-55). */
export class RejectOfferDto implements RejectOfferInput {
  @ApiProperty({
    description: 'Structured rejection reason',
    enum: ['PRICE_TOO_LOW', 'FINANCING_UNAVAILABLE', 'PROPERTY_UNAVAILABLE', 'TERMS_MISMATCH', 'OTHER'],
  })
  @Allow()
  reason!: RejectOfferInput['reason'];

  @ApiPropertyOptional({
    description: 'Free-text note; mandatory (≥ 10 chars) when reason is OTHER',
    maxLength: 500,
  })
  @Allow()
  note?: string | null;
}

/** Swagger-facing mirror of `adminRejectOfferSchema` (Story 4.2 / AC#6). */
export class AdminRejectOfferDto implements AdminRejectOfferInput {
  @ApiProperty({ description: 'Mandatory administrative rejection reason (5 – 500 chars)' })
  @Allow()
  reason!: string;
}

/**
 * Swagger-facing mirror of the `force-unlock` body (Story 4.2 / AC#9, AD-10). The 5-character
 * minimum is enforced in `AdminOffersService.forceUnlockOffer` so the failure carries the
 * dedicated `OFFER_FORCE_UNLOCK_REASON_REQUIRED` code rather than a generic validation error.
 */
export class ForceUnlockOfferDto {
  @ApiProperty({ description: 'Documented reason for breaking the mediation lease (≥ 5 chars)' })
  @Allow()
  reason!: string;
}

/** Swagger-facing mirror of `offerQueueQuerySchema` (Story 4.2 / AC#9). */
export class OfferQueueQueryDto implements OfferQueueQuery {
  @ApiPropertyOptional({ description: 'Narrow the queue to one OfferStatus', enum: OfferStatus })
  @Allow()
  status?: OfferStatus;

  @ApiPropertyOptional({ description: 'Page number (1-based)' })
  @Allow()
  page!: number;

  @ApiPropertyOptional({ description: 'Page size (1 – 100)' })
  @Allow()
  limit!: number;
}

