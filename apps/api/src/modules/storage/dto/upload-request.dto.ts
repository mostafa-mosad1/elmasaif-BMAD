import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ALLOWED_UPLOAD_MIME_TYPES, AllowedUploadMimeType } from '@elmasaif/shared';
import { StoragePartition } from '../storage.service';

export class UploadRequestDto {
  @ApiProperty({
    description: 'Name of the file including extension (e.g. national_id.pdf)',
    example: 'national_id.pdf',
  })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({
    description: 'MIME type of the file (application/pdf, image/jpeg, image/png, image/webp)',
    example: 'application/pdf',
    enum: ALLOWED_UPLOAD_MIME_TYPES,
  })
  @IsString()
  @IsIn(ALLOWED_UPLOAD_MIME_TYPES, {
    message: `mimeType must be one of: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}`,
  })
  mimeType!: AllowedUploadMimeType;

  @ApiProperty({
    description: 'File size in bytes (max 10MB = 10,485,760 bytes)',
    example: 1048576,
    maximum: 10485760,
  })
  @IsNumber()
  @Min(1, { message: 'fileSize must be at least 1 byte' })
  @Max(10485760, { message: 'fileSize cannot exceed 10MB (10,485,760 bytes)' })
  fileSize!: number;

  @ApiPropertyOptional({
    description: 'Target operational partition for promotion after scan passes',
    enum: ['identity', 'payments', 'contracts', 'licenses'],
    default: 'identity',
  })
  @IsOptional()
  @IsIn(['identity', 'payments', 'contracts', 'licenses'])
  targetPartition?: StoragePartition;

  @ApiPropertyOptional({ description: 'User ID context for identity/licenses partition' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Deal ID context for payments partition' })
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional({ description: 'Payment ID context for payments partition' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Contract ID context for contracts partition' })
  @IsOptional()
  @IsString()
  contractId?: string;
}
