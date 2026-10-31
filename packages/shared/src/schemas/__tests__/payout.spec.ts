import { describe, it, expect } from 'vitest';
import {
  SAUDI_BANK_NAMES,
  getSaudiBankName,
  formatSaudiIban,
  maskSaudiIban,
  createPayoutAccountSchema,
  updatePayoutAccountSchema,
  PAYOUT_INVALID_IBAN,
  PAYOUT_ACTIVE_DEAL_RESTRICTION,
  PAYOUT_ACCOUNT_NOT_FOUND,
  PAYOUT_ROLE_NOT_AUTHORIZED,
  PAYOUT_NAME_MISMATCH_WARNING,
  PAYOUT_ALREADY_EXISTS
} from '../../index';

describe('Payout Schemas, Bank Resolution & Helpers (AC: 1, 6, 7)', () => {
  const validAlRajhiIban = 'SA0380000000608010167519';
  const validSabbIban = 'SA4120000001080010065432';

  describe('SAUDI_BANK_NAMES dictionary', () => {
    it('should contain all major official Saudi bank code mappings', () => {
      expect(SAUDI_BANK_NAMES['80']).toBe('مصرف الراجحي');
      expect(SAUDI_BANK_NAMES['10']).toBe('البنك الأهلي السعودي');
      expect(SAUDI_BANK_NAMES['50']).toBe('بنك الرياض');
      expect(SAUDI_BANK_NAMES['05']).toBe('مصرف الإنماء');
      expect(SAUDI_BANK_NAMES['20']).toBe('بنك الأول SABB');
      expect(SAUDI_BANK_NAMES['15']).toBe('بنك البلاد');
      expect(SAUDI_BANK_NAMES['45']).toBe('البنك السعودي الفرنسي');
      expect(SAUDI_BANK_NAMES['30']).toBe('البنك العربي الوطني');
      expect(SAUDI_BANK_NAMES['65']).toBe('بنك الجزيرة');
      expect(SAUDI_BANK_NAMES['60']).toBe('بنك مسقط');
      expect(SAUDI_BANK_NAMES['76']).toBe('بنك الخليج الدولي');
      expect(SAUDI_BANK_NAMES['85']).toBe('بنك الإمارات دبي الوطني');
      expect(SAUDI_BANK_NAMES['90']).toBe('بنك دي 360');
      expect(SAUDI_BANK_NAMES['95']).toBe('إس تي سي بنك');
    });
  });

  describe('getSaudiBankName helper', () => {
    it('should resolve bank name from a valid 24-character Saudi IBAN', () => {
      expect(getSaudiBankName(validAlRajhiIban)).toBe('مصرف الراجحي');
      expect(getSaudiBankName(validSabbIban)).toBe('بنك الأول SABB');
    });

    it('should resolve bank name even when input has whitespace and lowercase', () => {
      expect(getSaudiBankName('sa03 8000 0000 6080 1016 7519')).toBe('مصرف الراجحي');
    });

    it('should return null or undefined for unknown bank code or invalid length', () => {
      expect(getSaudiBankName('SA0399000000608010167519')).toBeNull();
      expect(getSaudiBankName('SA03')).toBeNull();
    });
  });

  describe('formatSaudiIban helper', () => {
    it('should format raw 24-char IBAN into blocks of 4 separated by spaces', () => {
      expect(formatSaudiIban(validAlRajhiIban)).toBe('SA03 8000 0000 6080 1016 7519');
    });

    it('should normalize spaced or lower-case input before formatting', () => {
      expect(formatSaudiIban('sa03 80000000608010167519')).toBe('SA03 8000 0000 6080 1016 7519');
    });
  });

  describe('maskSaudiIban helper', () => {
    it('should mask IBAN showing prefix check digits and last 4 digits with 4 asterisks blocks', () => {
      expect(maskSaudiIban(validAlRajhiIban)).toBe('SA03 **** **** **** **** 7519');
    });

    it('should handle spaced input properly', () => {
      expect(maskSaudiIban('SA41 2000 0001 0800 1006 5432')).toBe('SA41 **** **** **** **** 5432');
    });
  });

  describe('createPayoutAccountSchema Zod validation', () => {
    it('should parse valid input successfully and default isDefault to true', () => {
      const result = createPayoutAccountSchema.safeParse({
        accountHolderName: 'سعد بن عبد الله القحطاني',
        iban: validAlRajhiIban,
        otpCode: '123456'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountHolderName).toBe('سعد بن عبد الله القحطاني');
        expect(result.data.isDefault).toBe(true);
        expect(result.data.otpCode).toBe('123456');
      }
    });

    it('should reject invalid IBAN checksum', () => {
      const result = createPayoutAccountSchema.safeParse({
        accountHolderName: 'سعد بن عبد الله',
        iban: 'SA0080000000608010167519',
        otpCode: '123456'
      });
      expect(result.success).toBe(false);
    });

    it('should reject short account holder name', () => {
      const result = createPayoutAccountSchema.safeParse({
        accountHolderName: 'أح',
        iban: validAlRajhiIban,
        otpCode: '123456'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid OTP code length', () => {
      const result = createPayoutAccountSchema.safeParse({
        accountHolderName: 'سعد بن عبد الله',
        iban: validAlRajhiIban,
        otpCode: '123'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePayoutAccountSchema Zod validation', () => {
    it('should allow partial updates with mandatory otpCode', () => {
      const result = updatePayoutAccountSchema.safeParse({
        accountHolderName: 'عبد الله بن سعد',
        otpCode: '654321',
        isDefault: false
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountHolderName).toBe('عبد الله بن سعد');
        expect(result.data.isDefault).toBe(false);
      }
    });

    it('should fail update when otpCode is missing', () => {
      const result = updatePayoutAccountSchema.safeParse({
        accountHolderName: 'عبد الله بن سعد'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Error Constants', () => {
    it('should export all payout-related error codes', () => {
      expect(PAYOUT_INVALID_IBAN).toBe('PAYOUT_INVALID_IBAN');
      expect(PAYOUT_ACTIVE_DEAL_RESTRICTION).toBe('PAYOUT_ACTIVE_DEAL_RESTRICTION');
      expect(PAYOUT_ACCOUNT_NOT_FOUND).toBe('PAYOUT_ACCOUNT_NOT_FOUND');
      expect(PAYOUT_ROLE_NOT_AUTHORIZED).toBe('PAYOUT_ROLE_NOT_AUTHORIZED');
      expect(PAYOUT_NAME_MISMATCH_WARNING).toBe('PAYOUT_NAME_MISMATCH_WARNING');
      expect(PAYOUT_ALREADY_EXISTS).toBe('PAYOUT_ALREADY_EXISTS');
    });
  });
});

