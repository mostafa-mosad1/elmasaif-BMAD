import { describe, expect, it } from 'vitest';
import { IdentityDocumentType, VerificationStatus } from '../../enums';
import {
  adminRejectIdentitySchema,
  adminVerifyIdentitySchema,
  identityStatusResponseSchema,
  uploadIdentityDocumentSchema
} from '../identity.schema';
import {
  IDENTITY_ALREADY_VERIFIED,
  IDENTITY_DOCUMENT_REQUIRED,
  IDENTITY_INVALID_DOCUMENT,
  IDENTITY_FILE_TOO_LARGE,
  IDENTITY_UNSUPPORTED_TYPE,
  IDENTITY_INVALID_ID_NUMBER,
  IDENTITY_NOT_FOUND,
  IDENTITY_REJECTED,
  IDENTITY_MALWARE_DETECTED
} from '../../constants/auth';

describe('identity schemas', () => {
  it('accepts supported document types with matching Saudi ID prefixes', () => {
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '1234567890'
    }).success).toBe(true);
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.IQAMA,
      idNumber: '2345678901'
    }).success).toBe(true);
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.NATIONAL_ID
    }).success).toBe(true);
  });

  it('rejects invalid ID numbers and a number that conflicts with document type', () => {
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '2345678901'
    }).success).toBe(false);
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.IQAMA,
      idNumber: '1234567890'
    }).success).toBe(false);
    expect(uploadIdentityDocumentSchema.safeParse({
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '1234'
    }).success).toBe(false);
  });

  it('validates identity status response fields', () => {
    expect(identityStatusResponseSchema.safeParse({
      isUploaded: true,
      status: VerificationStatus.PENDING_REVIEW,
      documentType: IdentityDocumentType.NATIONAL_ID,
      maskedIdNumber: '123****890',
      uploadedAt: '2026-10-29T12:00:00.000Z',
      rejectionReason: null,
      canUploadDealPaymentProof: true
    }).success).toBe(true);
    expect(identityStatusResponseSchema.safeParse({
      isUploaded: false,
      status: 'UNKNOWN',
      canUploadDealPaymentProof: false
    }).success).toBe(false);
  });

  it('requires a valid UUID and a 5–500 character rejection reason', () => {
    expect(adminVerifyIdentitySchema.safeParse({
      documentId: '4ecaa1d1-e73f-44f3-9453-4f89653c98d4'
    }).success).toBe(true);
    expect(adminRejectIdentitySchema.safeParse({
      documentId: '4ecaa1d1-e73f-44f3-9453-4f89653c98d4',
      reason: 'الصورة غير واضحة'
    }).success).toBe(true);
    expect(adminRejectIdentitySchema.safeParse({
      documentId: '4ecaa1d1-e73f-44f3-9453-4f89653c98d4',
      reason: 'خطأ'
    }).success).toBe(false);
    expect(adminRejectIdentitySchema.safeParse({
      documentId: 'not-a-uuid',
      reason: 'الصورة غير واضحة'
    }).success).toBe(false);
  });

  it('exports identity-specific error codes', () => {
    expect(IDENTITY_ALREADY_VERIFIED).toBe('IDENTITY_ALREADY_VERIFIED');
    expect(IDENTITY_DOCUMENT_REQUIRED).toBe('IDENTITY_DOCUMENT_REQUIRED');
    expect(IDENTITY_INVALID_DOCUMENT).toBe('IDENTITY_INVALID_DOCUMENT');
    expect(IDENTITY_FILE_TOO_LARGE).toBe('IDENTITY_FILE_TOO_LARGE');
    expect(IDENTITY_UNSUPPORTED_TYPE).toBe('IDENTITY_UNSUPPORTED_TYPE');
    expect(IDENTITY_INVALID_ID_NUMBER).toBe('IDENTITY_INVALID_ID_NUMBER');
    expect(IDENTITY_NOT_FOUND).toBe('IDENTITY_NOT_FOUND');
    expect(IDENTITY_REJECTED).toBe('IDENTITY_REJECTED');
    expect(IDENTITY_MALWARE_DETECTED).toBe('IDENTITY_MALWARE_DETECTED');
  });
});
