import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  PropertyType,
  CreateDemandInput,
  CancelDemandInput,
} from '@elmasaif/shared';

export class CreateDemandDto implements CreateDemandInput {
  @ApiProperty({ enum: PropertyType, description: 'Property category/type sought' })
  @Allow()
  propertyType!: PropertyType;

  @ApiProperty({ description: 'City UUID (structured master data)', format: 'uuid' })
  @Allow()
  cityId!: string;

  @ApiPropertyOptional({ description: 'Optional district UUID within the city', format: 'uuid' })
  @Allow()
  districtId?: string | null;

  @ApiProperty({ description: 'Minimum budget in SAR' })
  @Allow()
  minBudget!: number;

  @ApiProperty({ description: 'Maximum budget in SAR' })
  @Allow()
  maxBudget!: number;

  @ApiProperty({ description: 'Minimum area in m²' })
  @Allow()
  minArea!: number;

  @ApiProperty({ description: 'Maximum area in m²' })
  @Allow()
  maxArea!: number;

  @ApiPropertyOptional({ description: 'Free-text specifications (max 1000 chars)', maxLength: 1000 })
  @Allow()
  notes?: string | null;
}

export class CancelDemandDto implements CancelDemandInput {
  @ApiProperty({ description: 'Structured cancellation reason (min 5, max 500 chars)', minLength: 5, maxLength: 500 })
  @Allow()
  reason!: string;
}
