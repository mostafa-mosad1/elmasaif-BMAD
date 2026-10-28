import { describe, it, expect } from 'vitest';
import {
  ScanStatus,
  SCAN_STATUS,
  ERROR_FILE_QUARANTINED,
  ERROR_FILE_INFECTED,
  ERROR_SCAN_FAILED,
  ACTION_SECURITY_MALWARE_DETECTED,
  ALLOWED_UPLOAD_MIME_TYPES,
} from '../../index';

describe('Shared Storage Contracts & Enums (AC: 7)', () => {
  it('should export the canonical ScanStatus enum values', () => {
    expect(ScanStatus.PENDING).toBe('PENDING');
    expect(ScanStatus.CLEAN).toBe('CLEAN');
    expect(ScanStatus.INFECTED).toBe('INFECTED');
    expect(ScanStatus.SCAN_FAILED).toBe('SCAN_FAILED');
  });

  it('should export SCAN_STATUS dictionary matching the enum', () => {
    expect(SCAN_STATUS).toEqual({
      PENDING: 'PENDING',
      CLEAN: 'CLEAN',
      INFECTED: 'INFECTED',
      SCAN_FAILED: 'SCAN_FAILED',
    });
  });

  it('should export canonical error codes and audit actions', () => {
    expect(ERROR_FILE_QUARANTINED).toBe('FILE_QUARANTINED');
    expect(ERROR_FILE_INFECTED).toBe('FILE_INFECTED');
    expect(ERROR_SCAN_FAILED).toBe('SCAN_FAILED');
    expect(ACTION_SECURITY_MALWARE_DETECTED).toBe('SECURITY_MALWARE_DETECTED');
  });

  it('should export ALLOWED_UPLOAD_MIME_TYPES per NFR2/NFR13', () => {
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('image/webp');
  });
});
