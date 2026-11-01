import { describe, it, expect } from 'vitest';
import {
  initiatePhoneChangeSchema,
  verifyPhoneChangeOtpSchema,
  resendPhoneChangeOtpSchema,
  adminPhoneChangeSchema
} from '../auth.schema';
import {
  AUTH_PHONE_IN_USE,
  AUTH_PHONE_SAME_AS_CURRENT,
  AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
  AUTH_PHONE_CHANGE_EXPIRED,
  AUTH_PHONE_CHANGE_NOT_FOUND,
  AUTH_PHONE_CHANGE_ALREADY_VERIFIED,
  AUTH_PHONE_CHANGE_INITIATED,
  AUTH_PHONE_OLD_VERIFIED,
  AUTH_PHONE_NEW_VERIFIED,
  AUTH_PHONE_CHANGE_SUCCESS,
  ADMIN_PHONE_CHANGE_SUCCESS,
  PHONE_CHANGE_OTP_EXPIRY_SECONDS
} from '../../constants/auth';

describe('Story 1.7: Shared Phone Change Constants & Schemas (AC: 1, 2, 4, 5)', () => {
  describe('Constants and Error Codes', () => {
    it('defines expected error and success codes', () => {
      expect(AUTH_PHONE_IN_USE).toBe('AUTH_PHONE_IN_USE');
      expect(AUTH_PHONE_SAME_AS_CURRENT).toBe('AUTH_PHONE_SAME_AS_CURRENT');
      expect(AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK).toBe('AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK');
      expect(AUTH_PHONE_CHANGE_EXPIRED).toBe('AUTH_PHONE_CHANGE_EXPIRED');
      expect(AUTH_PHONE_CHANGE_NOT_FOUND).toBe('AUTH_PHONE_CHANGE_NOT_FOUND');
      expect(AUTH_PHONE_CHANGE_ALREADY_VERIFIED).toBe('AUTH_PHONE_CHANGE_ALREADY_VERIFIED');
      expect(AUTH_PHONE_CHANGE_INITIATED).toBe('AUTH_PHONE_CHANGE_INITIATED');
      expect(AUTH_PHONE_OLD_VERIFIED).toBe('AUTH_PHONE_OLD_VERIFIED');
      expect(AUTH_PHONE_NEW_VERIFIED).toBe('AUTH_PHONE_NEW_VERIFIED');
      expect(AUTH_PHONE_CHANGE_SUCCESS).toBe('AUTH_PHONE_CHANGE_SUCCESS');
      expect(ADMIN_PHONE_CHANGE_SUCCESS).toBe('ADMIN_PHONE_CHANGE_SUCCESS');
    });

    it('defines 15-minute OTP expiry constant', () => {
      expect(PHONE_CHANGE_OTP_EXPIRY_SECONDS).toBe(900);
    });
  });

  describe('initiatePhoneChangeSchema (AC: 1)', () => {
    it('normalizes local 05 mobile numbers to +9665', () => {
      const parsed = initiatePhoneChangeSchema.parse({
        newMobileNumber: '0512345678'
      });
      expect(parsed.newMobileNumber).toBe('+966512345678');
    });

    it('accepts valid +9665 mobile numbers with spaces or hyphens', () => {
      const parsed = initiatePhoneChangeSchema.parse({
        newMobileNumber: '+966 51-234-5678'
      });
      expect(parsed.newMobileNumber).toBe('+966512345678');
    });

    it('rejects invalid mobile numbers', () => {
      expect(() =>
        initiatePhoneChangeSchema.parse({ newMobileNumber: '0123456789' })
      ).toThrow();
      expect(() =>
        initiatePhoneChangeSchema.parse({ newMobileNumber: '05123456' })
      ).toThrow();
    });
  });

  describe('verifyPhoneChangeOtpSchema (AC: 2)', () => {
    it('accepts valid UUID requestId and 6-digit OTP code', () => {
      const valid = {
        requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        code: '123456'
      };
      const parsed = verifyPhoneChangeOtpSchema.parse(valid);
      expect(parsed).toEqual(valid);
    });

    it('rejects invalid UUID for requestId', () => {
      expect(() =>
        verifyPhoneChangeOtpSchema.parse({
          requestId: 'not-a-uuid',
          code: '123456'
        })
      ).toThrow('معرف الطلب غير صالح');
    });

    it('rejects non-6-digit OTP code', () => {
      expect(() =>
        verifyPhoneChangeOtpSchema.parse({
          requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
          code: '12345'
        })
      ).toThrow('رمز التحقق يجب أن يتكون من 6 أرقام');

      expect(() =>
        verifyPhoneChangeOtpSchema.parse({
          requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
          code: '1234567'
        })
      ).toThrow('رمز التحقق يجب أن يتكون من 6 أرقام');
    });
  });

  describe('resendPhoneChangeOtpSchema (AC: 4)', () => {
    it('accepts OLD or NEW target with valid requestId', () => {
      const parsedOld = resendPhoneChangeOtpSchema.parse({
        requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        target: 'OLD'
      });
      expect(parsedOld.target).toBe('OLD');

      const parsedNew = resendPhoneChangeOtpSchema.parse({
        requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        target: 'NEW'
      });
      expect(parsedNew.target).toBe('NEW');
    });

    it('rejects invalid target', () => {
      expect(() =>
        resendPhoneChangeOtpSchema.parse({
          requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
          target: 'OTHER'
        })
      ).toThrow();
    });
  });

  describe('adminPhoneChangeSchema (AC: 5)', () => {
    it('accepts valid admin phone change payload with official verification and minimum 10 char reason', () => {
      const valid = {
        newMobileNumber: '0598765432',
        officialIdVerified: true,
        reason: 'تم التحقق من بطاقة الهوية الوطنية شخصياً عبر الفرع'
      };
      const parsed = adminPhoneChangeSchema.parse(valid);
      expect(parsed.newMobileNumber).toBe('+966598765432');
      expect(parsed.officialIdVerified).toBe(true);
      expect(parsed.reason).toBe('تم التحقق من بطاقة الهوية الوطنية شخصياً عبر الفرع');
    });

    it('rejects when officialIdVerified is false or omitted', () => {
      expect(() =>
        adminPhoneChangeSchema.parse({
          newMobileNumber: '0598765432',
          officialIdVerified: false,
          reason: 'تم التحقق من بطاقة الهوية الوطنية شخصياً عبر الفرع'
        })
      ).toThrow();

      expect(() =>
        adminPhoneChangeSchema.parse({
          newMobileNumber: '0598765432',
          reason: 'تم التحقق من بطاقة الهوية الوطنية شخصياً عبر الفرع'
        })
      ).toThrow();
    });

    it('rejects when reason is less than 10 characters', () => {
      expect(() =>
        adminPhoneChangeSchema.parse({
          newMobileNumber: '0598765432',
          officialIdVerified: true,
          reason: 'قصير جدا'
        })
      ).toThrow('سبب التحديث الإداري مطلوب (10 أحرف على الأقل)');
    });
  });
});

