import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { StoragePartition } from '../storage.service';

export class ScanRequestDto {
  @ApiPropertyOptional({
    description: 'Target operational partition for promotion upon clean scan result',
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
