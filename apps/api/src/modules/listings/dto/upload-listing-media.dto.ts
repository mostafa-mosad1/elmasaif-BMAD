import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UploadListingMediaDto {
  @ApiPropertyOptional({
    description: 'Purpose of the upload: photo or legal document',
    enum: ['photo', 'document'],
    default: 'photo',
  })
  @IsOptional()
  @IsIn(['photo', 'document'])
  purpose?: 'photo' | 'document' = 'photo';
}

export interface UploadListingMediaResponse {
  fileUrl: string;
  key: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  scanStatus: string;
}

