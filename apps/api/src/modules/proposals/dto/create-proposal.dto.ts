import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { CreateProposalInput, RejectProposalInput } from '@elmasaif/shared';

export class CreateProposalDto implements CreateProposalInput {
  @ApiProperty({ description: 'Buyer demand UUID being proposed against', format: 'uuid' })
  @Allow()
  demandId!: string;

  @ApiProperty({ description: 'The provider-owned ACTIVE listing UUID', format: 'uuid' })
  @Allow()
  listingId!: string;

  @ApiProperty({ description: 'Binding proposed price in SAR' })
  @Allow()
  proposedPrice!: number;

  @ApiPropertyOptional({ description: 'Optional provider note (max 1000 chars)', maxLength: 1000 })
  @Allow()
  note?: string | null;
}

export class RejectProposalDto implements RejectProposalInput {
  @ApiProperty({ description: 'Mandatory rejection reason (min 5, max 500 chars)', minLength: 5, maxLength: 500 })
  @Allow()
  reason!: string;
}
