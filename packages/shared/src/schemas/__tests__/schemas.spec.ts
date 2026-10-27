import { describe, it, expect } from 'vitest';
import {
  validateSaudiIban,
  saudiIbanSchema,
  saudiMobileSchema,
  saudiNationalIdSchema,
} from '../index';

describe('Shared Schemas & Validation Contracts', () => {
  describe('validateSaudiIban (ISO 7064 Mod-97)', () => {
    it('should validate standard valid Saudi IBANs', () => {
      // Real valid test Saudi IBANs with valid Mod-97 checksums
      expect(validateSaudiIban('SA0380000000608010167519')).toBe(true);
      expect(validateSaudiIban('SA4120000001080010065432')).toBe(true);
      // Spaced valid IBAN
      expect(validateSaudiIban('SA03 8000 0000 6080 1016 7519')).toBe(true);
    });

    it('should reject Saudi IBAN with invalid checksum', () => {
      expect(validateSaudiIban('SA0080000000608010167519')).toBe(false);
      expect(validateSaudiIban('SA9980000000608010167519')).toBe(false);
    });

    it('should reject IBAN with invalid length (< 24 or > 24 characters)', () => {
      expect(validateSaudiIban('SA038000000060801016751')).toBe(false); // 23 chars
      expect(validateSaudiIban('SA03800000006080101675199')).toBe(false); // 25 chars
      expect(validateSaudiIban('')).toBe(false);
    });

    it('should reject non-Saudi (foreign) IBANs', () => {
      expect(validateSaudiIban('GB82WEST12345698765432')).toBe(false);
      expect(validateSaudiIban('AE070331234567890123456')).toBe(false);
      expect(validateSaudiIban('FR1420041010050500013M02606')).toBe(false);
    });

    it('should reject IBAN with invalid non-digit characters in account part', () => {
      expect(validateSaudiIban('SA038000000060801016751A')).toBe(false);
      expect(validateSaudiIban('SA03800000006080101675-9')).toBe(false);
    });

    it('should validate via saudiIbanSchema Zod schema', () => {
      const validResult = saudiIbanSchema.safeParse('SA0380000000608010167519');
      expect(validResult.success).toBe(true);

      const invalidChecksumResult = saudiIbanSchema.safeParse('SA0080000000608010167519');
      expect(invalidChecksumResult.success).toBe(false);

      const foreignResult = saudiIbanSchema.safeParse('GB82WEST12345698765432');
      expect(foreignResult.success).toBe(false);
    });
  });

  describe('saudiMobileSchema', () => {
    it('should accept valid Saudi mobile formats (05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX)', () => {
      expect(saudiMobileSchema.safeParse('0501234567').success).toBe(true);
      expect(saudiMobileSchema.safeParse('501234567').success).toBe(true);
      expect(saudiMobileSchema.safeParse('+966501234567').success).toBe(true);
      expect(saudiMobileSchema.safeParse('0598765432').success).toBe(true);
    });

    it('should reject invalid mobile numbers', () => {
      expect(saudiMobileSchema.safeParse('0601234567').success).toBe(false); // invalid prefix
      expect(saudiMobileSchema.safeParse('050123456').success).toBe(false);  // too short (9 digits)
      expect(saudiMobileSchema.safeParse('05012345678').success).toBe(false); // too long (11 digits)
      expect(saudiMobileSchema.safeParse('+971501234567').success).toBe(false); // UAE prefix
      expect(saudiMobileSchema.safeParse('050123456a').success).toBe(false);  // non-digit
      expect(saudiMobileSchema.safeParse('').success).toBe(false);
    });
  });

  describe('saudiNationalIdSchema', () => {
    it('should accept 10-digit IDs starting with 1 (Saudi Citizen)', () => {
      expect(saudiNationalIdSchema.safeParse('1000000001').success).toBe(true);
      expect(saudiNationalIdSchema.safeParse('1098765432').success).toBe(true);
      expect(saudiNationalIdSchema.safeParse('1234567890').success).toBe(true);
    });

    it('should accept 10-digit IDs starting with 2 (Resident / Iqama)', () => {
      expect(saudiNationalIdSchema.safeParse('2000000001').success).toBe(true);
      expect(saudiNationalIdSchema.safeParse('2456789012').success).toBe(true);
    });

    it('should reject IDs not starting with 1 or 2', () => {
      expect(saudiNationalIdSchema.safeParse('3000000001').success).toBe(false);
      expect(saudiNationalIdSchema.safeParse('0100000001').success).toBe(false);
      expect(saudiNationalIdSchema.safeParse('5000000001').success).toBe(false);
    });

    it('should reject IDs with invalid length or non-digits', () => {
      expect(saudiNationalIdSchema.safeParse('100000000').success).toBe(false);   // 9 digits
      expect(saudiNationalIdSchema.safeParse('10000000001').success).toBe(false); // 11 digits
      expect(saudiNationalIdSchema.safeParse('100000000A').success).toBe(false); // letter
      expect(saudiNationalIdSchema.safeParse('').success).toBe(false);
    });
  });
});
