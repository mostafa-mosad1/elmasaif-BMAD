import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { DealPaymentType } from '@elmasaif/shared';

/**
 * The shape multer/Nest hands `@UploadedFile()` — identical to `IdentityUploadFile`, declared here
 * so the deals module does not depend on the users module's internals.
 */
export interface DealProofUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Swagger-facing mirror of `uploadDealProofSchema` (Story 5.2 / AC-8). The multipart body arrives
 * as strings, so `ZodValidationPipe` stays the runtime validator and this class only documents it.
 * `paymentType` itself comes from the route parameter, not the body.
 */
export class UploadPaymentProofDto {
  @ApiPropertyOptional({
    description: 'Bank transfer reference the buyer wrote on the wire (max 64 chars)',
    maxLength: 64,
  })
  @Allow()
  bankReferenceCode?: string;

  @ApiPropertyOptional({
    description: 'Name of the bank the buyer transferred from (max 100 chars)',
    maxLength: 100,
  })
  @Allow()
  senderBankName?: string;
}

/** Route parameter of both `:paymentType` endpoints. */
export class DealPaymentTypeParamDto {
  @ApiProperty({
    description: 'Which leg of the dual wire transfer',
    enum: ['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE'],
  })
  @Allow()
  paymentType!: DealPaymentType;
}
