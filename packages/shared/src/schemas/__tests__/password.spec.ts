import { describe, it, expect } from 'vitest';
import {
  AUTH_RESET_INITIATED,
  AUTH_RESET_OTP_VERIFIED,
  AUTH_PASSWORD_SAME_AS_CURRENT,
  AUTH_RESET_TOKEN_INVALID,
  AUTH_RESET_TOKEN_EXPIRED,
  AUTH_PASSWORD_RESET_SUCCESS,
  AUTH_PASSWORD_CHANGE_SUCCESS,
  PASSWORD_RESET_TOKEN_EXPIRY_SECONDS,
  passwordComplexitySchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../index';

describe('Password Recovery & Change Shared Schemas and Constants', () => {
  describe('Constants', () => {
    it('should export all required error/status codes and expiry constants', () => {
      expect(AUTH_RESET_INITIATED).toBe('AUTH_RESET_INITIATED');
      expect(AUTH_RESET_OTP_VERIFIED).toBe('AUTH_RESET_OTP_VERIFIED');
      expect(AUTH_PASSWORD_SAME_AS_CURRENT).toBe('AUTH_PASSWORD_SAME_AS_CURRENT');
      expect(AUTH_RESET_TOKEN_INVALID).toBe('AUTH_RESET_TOKEN_INVALID');
      expect(AUTH_RESET_TOKEN_EXPIRED).toBe('AUTH_RESET_TOKEN_EXPIRED');
      expect(AUTH_PASSWORD_RESET_SUCCESS).toBe('AUTH_PASSWORD_RESET_SUCCESS');
      expect(AUTH_PASSWORD_CHANGE_SUCCESS).toBe('AUTH_PASSWORD_CHANGE_SUCCESS');
      expect(PASSWORD_RESET_TOKEN_EXPIRY_SECONDS).toBe(900);
    });
  });

  describe('passwordComplexitySchema', () => {
    it('should accept valid passwords meeting length, letter and number rules', () => {
      expect(passwordComplexitySchema.safeParse('Password123').success).toBe(true);
      expect(passwordComplexitySchema.safeParse('elmasaif2026').success).toBe(true);
      expect(passwordComplexitySchema.safeParse('Pass#12345').success).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const res = passwordComplexitySchema.safeParse('Pass1');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].message).toContain('8');
      }
    });

    it('should reject passwords with letters only', () => {
      const res = passwordComplexitySchema.safeParse('PasswordOnly');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].message).toContain('حرفاً ورقماً');
      }
    });

    it('should reject passwords with numbers only', () => {
      const res = passwordComplexitySchema.safeParse('1234567890');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].message).toContain('حرفاً ورقماً');
      }
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should accept and normalize Saudi mobile numbers', () => {
      const res1 = forgotPasswordSchema.safeParse({ mobileNumber: '0512345678' });
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.data.mobileNumber).toBe('+966512345678');
      }

      const res2 = forgotPasswordSchema.safeParse({ mobileNumber: '+966 51 234 5678' });
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.data.mobileNumber).toBe('+966512345678');
      }
    });

    it('should reject invalid mobile numbers', () => {
      const res = forgotPasswordSchema.safeParse({ mobileNumber: '0112345678' });
      expect(res.success).toBe(false);
    });
  });

  describe('verifyResetOtpSchema', () => {
    it('should validate normalized phone and 6-digit code', () => {
      const res = verifyResetOtpSchema.safeParse({
        mobileNumber: '0555555555',
        code: '123456'
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.mobileNumber).toBe('+966555555555');
        expect(res.data.code).toBe('123456');
      }
    });

    it('should reject code of invalid length', () => {
      const res = verifyResetOtpSchema.safeParse({
        mobileNumber: '0555555555',
        code: '123'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept valid resetToken and newPassword', () => {
      const res = resetPasswordSchema.safeParse({
        resetToken: 'valid-signed-token',
        newPassword: 'StrongPass123'
      });
      expect(res.success).toBe(true);
    });

    it('should reject empty resetToken', () => {
      const res = resetPasswordSchema.safeParse({
        resetToken: '',
        newPassword: 'StrongPass123'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid current and new passwords', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword2'
      });
      expect(res.success).toBe(true);
    });

    it('should reject weak newPassword', () => {
      const res = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword1',
        newPassword: 'weak'
      });
      expect(res.success).toBe(false);
    });
  });
});

