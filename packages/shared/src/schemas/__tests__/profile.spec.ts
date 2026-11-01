import { describe, it, expect } from 'vitest';
import {
  updateUserProfileSchema,
  verifyEmailSchema,
  sessionUserSchema
} from '../auth.schema';
import {
  AUTH_EMAIL_IN_USE,
  AUTH_EMAIL_SAME_AS_CURRENT,
  AUTH_EMAIL_VERIFICATION_INITIATED,
  AUTH_EMAIL_VERIFICATION_EXPIRED,
  AUTH_EMAIL_VERIFICATION_INVALID,
  AUTH_EMAIL_VERIFICATION_STALE,
  AUTH_EMAIL_VERIFIED_SUCCESS,
  AUTH_EMAIL_VERIFICATION_RESENT,
  AUTH_EMAIL_PENDING_CANCELLED,
  AUTH_NO_PENDING_EMAIL,
  COMMERCIAL_NAME_MISMATCH,
  EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
} from '../../constants/auth';

describe('Profile & Email Verification Schemas & Constants (Story 1.8) (AC: 1, 2, 3, 4, 5)', () => {
  describe('Constants Verification', () => {
    it('defines expected error/status codes and expiry values', () => {
      expect(AUTH_EMAIL_IN_USE).toBe('AUTH_EMAIL_IN_USE');
      expect(AUTH_EMAIL_SAME_AS_CURRENT).toBe('AUTH_EMAIL_SAME_AS_CURRENT');
      expect(AUTH_EMAIL_VERIFICATION_INITIATED).toBe('AUTH_EMAIL_VERIFICATION_INITIATED');
      expect(AUTH_EMAIL_VERIFICATION_EXPIRED).toBe('AUTH_EMAIL_VERIFICATION_EXPIRED');
      expect(AUTH_EMAIL_VERIFICATION_INVALID).toBe('AUTH_EMAIL_VERIFICATION_INVALID');
      expect(AUTH_EMAIL_VERIFICATION_STALE).toBe('AUTH_EMAIL_VERIFICATION_STALE');
      expect(AUTH_EMAIL_VERIFIED_SUCCESS).toBe('AUTH_EMAIL_VERIFIED_SUCCESS');
      expect(AUTH_EMAIL_VERIFICATION_RESENT).toBe('AUTH_EMAIL_VERIFICATION_RESENT');
      expect(AUTH_EMAIL_PENDING_CANCELLED).toBe('AUTH_EMAIL_PENDING_CANCELLED');
      expect(AUTH_NO_PENDING_EMAIL).toBe('AUTH_NO_PENDING_EMAIL');
      expect(COMMERCIAL_NAME_MISMATCH).toBe('COMMERCIAL_NAME_MISMATCH');

      expect(EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS).toBe(86400);
      expect(EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS).toBe(60);
    });
  });

  describe('updateUserProfileSchema', () => {
    it('accepts valid fullName and email updates', () => {
      const parsed = updateUserProfileSchema.safeParse({
        fullName: 'أحمد بن محمد السالم',
        email: 'Ahmad.Salim@example.com'
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.fullName).toBe('أحمد بن محمد السالم');
        expect(parsed.data.email).toBe('ahmad.salim@example.com');
      }
    });

    it('accepts fullName only', () => {
      const parsed = updateUserProfileSchema.safeParse({
        fullName: 'خالد عبدالله'
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.fullName).toBe('خالد عبدالله');
        expect(parsed.data.email).toBeUndefined();
      }
    });

    it('accepts email only and normalizes casing', () => {
      const parsed = updateUserProfileSchema.safeParse({
        email: '  USER@DOMAIN.SA  '
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.email).toBe('user@domain.sa');
      }
    });

    it('rejects if neither fullName nor email is provided', () => {
      const parsed = updateUserProfileSchema.safeParse({});
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('يجب تقديم حقل واحد على الأقل للتحديث');
      }
    });

    it('rejects fullName shorter than 3 characters', () => {
      const parsed = updateUserProfileSchema.safeParse({
        fullName: 'أح'
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('3 أحرف');
      }
    });

    it('rejects fullName longer than 100 characters', () => {
      const parsed = updateUserProfileSchema.safeParse({
        fullName: 'أ'.repeat(101)
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('100');
      }
    });

    it('rejects invalid email formats', () => {
      const parsed = updateUserProfileSchema.safeParse({
        email: 'not-an-email'
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('صيغة البريد الإلكتروني غير صالحة');
      }
    });
  });

  describe('verifyEmailSchema', () => {
    it('accepts valid verification token', () => {
      const parsed = verifyEmailSchema.safeParse({
        token: 'eyJhbGciOiJIUzI1NiJ9.test-token-payload'
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects empty verification token', () => {
      const parsed = verifyEmailSchema.safeParse({
        token: '   '
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('sessionUserSchema with email fields', () => {
    it('accepts email, pendingEmail, and emailVerifiedAt fields', () => {
      const parsed = sessionUserSchema.safeParse({
        id: 'usr_123',
        fullName: 'عبدالله الشهري',
        mobileNumber: '+966501234567',
        username: 'u_966501234567',
        email: 'verified@domain.sa',
        pendingEmail: 'pending@domain.sa',
        emailVerifiedAt: new Date('2026-11-01T12:00:00Z'),
        profiles: []
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.email).toBe('verified@domain.sa');
        expect(parsed.data.pendingEmail).toBe('pending@domain.sa');
        expect(parsed.data.emailVerifiedAt).toBeDefined();
      }
    });
  });
});

