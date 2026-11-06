import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { FinalApproveDealInput } from '@elmasaif/shared';

/**
 * Swagger-facing mirror of `finalApproveDealSchema` (Story 5.1 / AC-1, AD-2). `ZodValidationPipe`
 * stays the runtime validator; this class only documents the body.
 */
export class FinalApproveDealDto implements FinalApproveDealInput {
  @ApiProperty({ description: 'The approved offer to bind into a Deal (UUID)' })
  @Allow()
  offerId!: string;
}
