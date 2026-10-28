import { ScanStatus } from '../enums';

export const SCAN_STATUS = {
  PENDING: ScanStatus.PENDING,
  CLEAN: ScanStatus.CLEAN,
  INFECTED: ScanStatus.INFECTED,
  SCAN_FAILED: ScanStatus.SCAN_FAILED,
} as const;

export const ERROR_FILE_QUARANTINED = 'FILE_QUARANTINED';
export const ERROR_FILE_INFECTED = 'FILE_INFECTED';
export const ERROR_SCAN_FAILED = 'SCAN_FAILED';
export const ACTION_SECURITY_MALWARE_DETECTED = 'SECURITY_MALWARE_DETECTED';

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedUploadMimeType = typeof ALLOWED_UPLOAD_MIME_TYPES[number];
