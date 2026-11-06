import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  AppendInquiryMessageInput,
  CreateInquiryInput,
  RelayInquiryInput,
  CloseInquiryInput,
} from '@elmasaif/shared';

/**
 * Swagger-facing mirrors of the inquiry Zod schemas (Story 4.4). `ZodValidationPipe` remains the
 * runtime validator — these classes only document the bodies, per house style.
 */
export class CreateInquiryDto implements CreateInquiryInput {
  @ApiProperty({ description: 'Target ACTIVE/RESERVED listing UUID', format: 'uuid' })
  @Allow()
  listingId!: string;

  @ApiPropertyOptional({ description: 'Optional subject line (max 200 chars)', maxLength: 200 })
  @Allow()
  subject?: string | null;

  @ApiProperty({ description: 'Inquiry body (1 – 2000 chars), masked server-side' })
  @Allow()
  body!: string;

  @ApiPropertyOptional({
    description: 'Draft attachment ids from POST /inquiries/attachments (max 5)',
    type: [String],
  })
  @Allow()
  attachmentIds!: string[];
}

export class AppendInquiryMessageDto implements AppendInquiryMessageInput {
  @ApiProperty({ description: 'Message body (1 – 2000 chars), masked server-side' })
  @Allow()
  body!: string;

  @ApiPropertyOptional({
    description: 'Draft attachment ids from POST /inquiries/attachments (max 5)',
    type: [String],
  })
  @Allow()
  attachmentIds!: string[];
}

export class RelayInquiryDto implements RelayInquiryInput {
  @ApiPropertyOptional({ description: 'Optional admin relay note (masked, max 2000 chars)' })
  @Allow()
  note?: string | null;
}

export class CloseInquiryDto implements CloseInquiryInput {
  @ApiProperty({ description: 'Documented closure reason (5 – 500 chars)' })
  @Allow()
  reason!: string;
}

/** Swagger mirror of the force-unlock body; the >= 5 character rule is enforced in the service. */
export class ForceUnlockInquiryDto {
  @ApiProperty({ description: 'Documented reason for breaking the conversation lease (≥ 5 chars)' })
  @Allow()
  reason!: string;
}
