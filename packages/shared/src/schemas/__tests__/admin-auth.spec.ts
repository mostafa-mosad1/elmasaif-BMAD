import { describe, it, expect } from 'vitest';
import {
  adminLoginSchema,
  adminInitiatePasswordResetSchema,
  adminCompletePasswordResetSchema,
  adminSessionUserSchema,
} from '../auth.schema';
import {
  ADMIN_SESSION_INACTIVITY_HOURS,
  ADMIN_SESSION_INACTIVITY_MS,
  ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOGIN_LOCKOUT_MINUTES,
  ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
  ADMIN_ROLE_PERMISSIONS,
} from '../../constants/auth';
import { AdminRole } from '../../enums';

describe('Admin Auth Constants & Schemas (Story 8.1)', () => {
  describe('Admin Auth Constants', () => {
    it('defines 8-hour inactivity session timeout and 5-attempt / 15-minute lockout constants', () => {
      expect(ADMIN_SESSION_INACTIVITY_HOURS).toBe(8);
      expect(ADMIN_SESSION_INACTIVITY_MS).toBe(8 * 60 * 60 * 1000);
      expect(ADMIN_LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
      expect(ADMIN_LOGIN_LOCKOUT_MINUTES).toBe(15);
      expect(ADMIN_PASSWORD_RESET_EXPIRY_SECONDS).toBe(900);
    });

    it('maps AdminRole permissions accurately with Rbac.Manage restricted to SUPER_ADMIN', () => {
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.SUPER_ADMIN]).toContain('Rbac.Manage');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.SUPER_ADMIN]).toContain('Geo.Manage');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.SUPER_ADMIN]).toContain('Tasks.ForceUnlock');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.MODERATOR]).not.toContain('Rbac.Manage');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.MODERATOR]).toContain('Listings.Review');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.FINANCIAL_AUDITOR]).not.toContain('Rbac.Manage');
      expect(ADMIN_ROLE_PERMISSIONS[AdminRole.COMPLIANCE_OFFICER]).not.toContain('Rbac.Manage');
    });
  });

  describe('adminLoginSchema', () => {
    it('normalizes identifier to trimmed lowercase and validates password length', () => {
      const parsed = adminLoginSchema.parse({
        identifier: '  SuperAdmin@Elmasaif.SA  ',
        password: 'Password123',
      });
      expect(parsed.identifier).toBe('superadmin@elmasaif.sa');
      expect(parsed.password).toBe('Password123');
    });

    it('rejects short identifier or short password', () => {
      expect(adminLoginSchema.safeParse({ identifier: 'ab', password: 'Password123' }).success).toBe(false);
      expect(adminLoginSchema.safeParse({ identifier: 'superadmin', password: 'short' }).success).toBe(false);
    });
  });

  describe('adminInitiatePasswordResetSchema', () => {
    it('accepts valid reason between 10 and 500 characters', () => {
      const parsed = adminInitiatePasswordResetSchema.parse({
        reason: '  إعادة تعيين كلمة المرور بناءً على طلب المشرف الموثق  ',
      });
      expect(parsed.reason).toBe('إعادة تعيين كلمة المرور بناءً على طلب المشرف الموثق');
    });

    it('rejects reason shorter than 10 characters or longer than 500 characters', () => {
      expect(adminInitiatePasswordResetSchema.safeParse({ reason: 'قصير' }).success).toBe(false);
      expect(adminInitiatePasswordResetSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
    });
  });

  describe('adminCompletePasswordResetSchema', () => {
    it('accepts valid token and complex password', () => {
      const parsed = adminCompletePasswordResetSchema.parse({
        token: 'valid-hmac-reset-token',
        newPassword: 'NewAdminPassword2026',
      });
      expect(parsed.token).toBe('valid-hmac-reset-token');
      expect(parsed.newPassword).toBe('NewAdminPassword2026');
    });

    it('rejects empty token or weak password', () => {
      expect(
        adminCompletePasswordResetSchema.safeParse({
          token: '   ',
          newPassword: 'NewAdminPassword2026',
        }).success
      ).toBe(false);
      expect(
        adminCompletePasswordResetSchema.safeParse({
          token: 'valid-token',
          newPassword: 'alllettersnopassword',
        }).success
      ).toBe(false);
    });
  });

  describe('adminSessionUserSchema', () => {
    it('validates AdminSessionUser with default permissions array', () => {
      const parsed = adminSessionUserSchema.parse({
        id: 'admin-uuid-1',
        username: 'superadmin',
        email: 'admin@elmasaif.sa',
        fullName: 'المشرف العام - المصايف',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        lastLoginAt: null,
      });
      expect(parsed.role).toBe(AdminRole.SUPER_ADMIN);
      expect(parsed.permissions).toEqual([]);
    });
  });
});

