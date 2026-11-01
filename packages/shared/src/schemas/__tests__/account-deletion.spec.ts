import { describe, it, expect } from 'vitest';
import {
  initiateAccountDeletionSchema,
  confirmAccountDeletionSchema,
  cancelAccountDeletionSchema
} from '../auth.schema';
import {
  AUTH_DELETION_INITIATED,
  AUTH_DELETION_ACTIVE_DEAL_BLOCK,
  AUTH_DELETION_OPEN_DISPUTE_BLOCK,
  AUTH_DELETION_ACTIVE_CONTRACT_BLOCK,
  AUTH_DELETION_COOLING_OFF,
  AUTH_ACCOUNT_DEACTIVATED_STATUTORY,
  AUTH_DELETION_CANCELLED,
  AUTH_DELETION_TOKEN_INVALID,
  AUTH_DELETION_TOKEN_EXPIRED,
  AUTH_ACCOUNT_PERMANENTLY_ERASED,
  DELETION_COOLING_OFF_DAYS,
  DELETION_TOKEN_EXPIRY_SECONDS
} from '../../constants/auth';
import { JOB_ACCOUNT_DELETION_EXPIRY } from '../../constants/jobs';

describe('Account Deletion Constants and Schemas (Story 1.9)', () => {
  describe('Constants', () => {
    it('should export all required deletion status and error codes', () => {
      expect(AUTH_DELETION_INITIATED).toBe('AUTH_DELETION_INITIATED');
      expect(AUTH_DELETION_ACTIVE_DEAL_BLOCK).toBe('AUTH_DELETION_ACTIVE_DEAL_BLOCK');
      expect(AUTH_DELETION_OPEN_DISPUTE_BLOCK).toBe('AUTH_DELETION_OPEN_DISPUTE_BLOCK');
      expect(AUTH_DELETION_ACTIVE_CONTRACT_BLOCK).toBe('AUTH_DELETION_ACTIVE_CONTRACT_BLOCK');
      expect(AUTH_DELETION_COOLING_OFF).toBe('AUTH_DELETION_COOLING_OFF');
      expect(AUTH_ACCOUNT_DEACTIVATED_STATUTORY).toBe('AUTH_ACCOUNT_DEACTIVATED_STATUTORY');
      expect(AUTH_DELETION_CANCELLED).toBe('AUTH_DELETION_CANCELLED');
      expect(AUTH_DELETION_TOKEN_INVALID).toBe('AUTH_DELETION_TOKEN_INVALID');
      expect(AUTH_DELETION_TOKEN_EXPIRED).toBe('AUTH_DELETION_TOKEN_EXPIRED');
      expect(AUTH_ACCOUNT_PERMANENTLY_ERASED).toBe('AUTH_ACCOUNT_PERMANENTLY_ERASED');
      expect(DELETION_COOLING_OFF_DAYS).toBe(14);
      expect(DELETION_TOKEN_EXPIRY_SECONDS).toBe(900);
      expect(JOB_ACCOUNT_DELETION_EXPIRY).toBe('account-deletion-expiry');
    });
  });

  describe('initiateAccountDeletionSchema', () => {
    it('should validate a valid current password', () => {
      const result = initiateAccountDeletionSchema.safeParse({
        currentPassword: 'Password123'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentPassword).toBe('Password123');
      }
    });

    it('should reject missing or empty current password', () => {
      const emptyResult = initiateAccountDeletionSchema.safeParse({
        currentPassword: ''
      });
      expect(emptyResult.success).toBe(false);

      const missingResult = initiateAccountDeletionSchema.safeParse({});
      expect(missingResult.success).toBe(false);
    });
  });

  describe('confirmAccountDeletionSchema', () => {
    it('should validate a valid deletion token and 6-digit OTP code', () => {
      const result = confirmAccountDeletionSchema.safeParse({
        deletionToken: 'valid-hmac-token',
        code: '123456'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deletionToken).toBe('valid-hmac-token');
        expect(result.data.code).toBe('123456');
      }
    });

    it('should reject missing token or non-6-digit code', () => {
      expect(confirmAccountDeletionSchema.safeParse({ deletionToken: '', code: '123456' }).success).toBe(false);
      expect(confirmAccountDeletionSchema.safeParse({ deletionToken: 'valid', code: '12345' }).success).toBe(false);
      expect(confirmAccountDeletionSchema.safeParse({ deletionToken: 'valid', code: '1234567' }).success).toBe(false);
      expect(confirmAccountDeletionSchema.safeParse({ deletionToken: 'valid' }).success).toBe(false);
      expect(confirmAccountDeletionSchema.safeParse({ code: '123456' }).success).toBe(false);
    });
  });

  describe('cancelAccountDeletionSchema', () => {
    it('should accept empty or optional payload', () => {
      expect(cancelAccountDeletionSchema.safeParse({}).success).toBe(true);
      expect(cancelAccountDeletionSchema.safeParse(undefined).success).toBe(true);
    });
  });
});

