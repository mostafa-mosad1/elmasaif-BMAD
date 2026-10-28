import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanStatus } from '@elmasaif/shared';

export class StorageUploadResponseDto {
  @ApiProperty({ description: 'Unique ID of the staged FileObject record' })
  fileObjectId!: string;

  @ApiPropertyOptional({ description: 'Short-lived presigned S3 PUT URL for direct client upload' })
  uploadUrl?: string;

  @ApiProperty({ description: 'Object storage key (e.g. quarantine/...)' })
  key!: string;

  @ApiProperty({ description: 'Storage bucket name' })
  bucket!: string;

  @ApiProperty({ description: 'Current malware scan status', enum: ScanStatus })
  scanStatus!: ScanStatus;

  @ApiProperty({ description: 'File MIME type' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize!: number;
}

export class ScanResultResponseDto {
  @ApiProperty({ description: 'Unique ID of the FileObject record' })
  fileObjectId!: string;

  @ApiProperty({ description: 'Whether file passed malware inspection cleanly' })
  isClean!: boolean;

  @ApiProperty({ description: 'Scan status transition value', enum: ScanStatus })
  scanStatus!: ScanStatus;

  @ApiProperty({ description: 'Operational storage key if promoted, or quarantine key if infected/failed' })
  key!: string;

  @ApiPropertyOptional({ description: 'Threat name if malware was detected' })
  threatName?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp of scan execution' })
  scannedAt?: string | null;
}

export class FileStatusResponseDto {
  @ApiProperty({ description: 'Unique ID of the FileObject record' })
  fileObjectId!: string;

  @ApiProperty({ description: 'Current scan status', enum: ScanStatus })
  scanStatus!: ScanStatus;

  @ApiProperty({ description: 'File MIME type' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize!: number;

  @ApiProperty({ description: 'Object storage key' })
  key!: string;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp of scan execution' })
  scannedAt?: string | null;

  @ApiProperty({ description: 'Record creation timestamp' })
  createdAt!: string;
}

export class DownloadUrlResponseDto {
  @ApiProperty({ description: 'Short-lived presigned GET download URL clamped to <= 300 seconds' })
  downloadUrl!: string;

  @ApiProperty({ description: 'Expiry duration in seconds (<= 300)' })
  expiresInSeconds!: number;
}
