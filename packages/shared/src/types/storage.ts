import { ScanStatus } from '../enums';

export interface ScanEngineResult {
  isClean: boolean;
  isInfected: boolean;
  threatName?: string;
  engineName: string;
  details?: Record<string, unknown>;
}

export interface MalwareScanOptions {
  timeoutMs?: number;
  skipInfectionCheck?: boolean;
}

export interface FileObjectMetadata {
  id: string;
  bucket: string;
  key: string;
  mimeType: string;
  fileSize: number;
  scanStatus: ScanStatus;
  scannedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface QuarantineUploadResult {
  fileObjectId: string;
  uploadUrl?: string;
  key: string;
  bucket: string;
  scanStatus: ScanStatus;
  mimeType: string;
  fileSize: number;
}

export type ScanOutcome = 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
