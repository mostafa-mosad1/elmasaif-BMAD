import { describe, it, expect } from 'vitest';
import { updateUserPreferencesSchema } from '../preferences.schema';
import {
  USER_PREFERENCES_RETRIEVED,
  USER_PREFERENCES_UPDATED,
  PREFERENCES_CRITICAL_ALERTS_IMMUTABLE
} from '../../constants/auth';

describe('User Preferences Schemas & Constants (Story 1.10) (AC: 1, 2, 3, 4, 5)', () => {
  describe('Constants Verification', () => {
    it('defines expected preferences action and invariant error codes', () => {
      expect(USER_PREFERENCES_RETRIEVED).toBe('USER_PREFERENCES_RETRIEVED');
      expect(USER_PREFERENCES_UPDATED).toBe('USER_PREFERENCES_UPDATED');
      expect(PREFERENCES_CRITICAL_ALERTS_IMMUTABLE).toBe('PREFERENCES_CRITICAL_ALERTS_IMMUTABLE');
    });
  });

  describe('updateUserPreferencesSchema', () => {
    it('accepts an empty update object', () => {
      const result = updateUserPreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts valid partial preferences payload', () => {
      const result = updateUserPreferencesSchema.safeParse({
        preferredLanguage: 'en',
        themeMode: 'dark'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preferredLanguage).toBe('en');
        expect(result.data.themeMode).toBe('dark');
      }
    });

    it('accepts full valid preferences payload with all fields', () => {
      const payload = {
        preferredLanguage: 'ar',
        themeMode: 'system',
        emailNotifications: true,
        smsNotifications: false,
        marketingAlerts: true,
        inquiryAlerts: true
      };
      const result = updateUserPreferencesSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    it('rejects invalid language value', () => {
      const result = updateUserPreferencesSchema.safeParse({
        preferredLanguage: 'fr'
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid theme mode value', () => {
      const result = updateUserPreferencesSchema.safeParse({
        themeMode: 'neon'
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-boolean values for notification toggles', () => {
      const result1 = updateUserPreferencesSchema.safeParse({
        emailNotifications: 'yes'
      });
      expect(result1.success).toBe(false);

      const result2 = updateUserPreferencesSchema.safeParse({
        smsNotifications: 1
      });
      expect(result2.success).toBe(false);
    });

    it('rejects attempting to set criticalAlertsMandatory to false', () => {
      const result = updateUserPreferencesSchema.safeParse({
        criticalAlertsMandatory: false
      });
      expect(result.success).toBe(false);
    });
  });
});

