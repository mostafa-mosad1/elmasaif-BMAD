import { describe, it, expect } from 'vitest';
import {
  adminLoginSchema,
  adminInitiatePasswordResetSchema,
  adminCompletePasswordResetSchema,
  adminSessionUserSchema,
  adminCreateStaffRequestSchema,
  adminUpdateStaffPermissionsRequestSchema,
  adminUpdateStaffStatusRequestSchema,
  adminHardDeleteStaffRequestSchema,
  adminUpdateUserStatusRequestSchema,
  adminHardDeleteUserRequestSchema,
} from '../auth.schema';
import {
  ADMIN_SESSION_INACTIVITY_HOURS,
  ADMIN_SESSION_INACTIVITY_MS,
  ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOGIN_LOCKOUT_MINUTES,
  ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
  ADMIN_ROLE_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  resolveAdminPermissions,
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

  describe('Granular Dynamic RBAC Catalog & Schemas (Story 8.2)', () => {
    it('exports ALL_ADMIN_PERMISSIONS and ADMIN_PERMISSION_GROUPS covering all canonical Area.Action keys', () => {
      const requiredCanonicalKeys = [
        'Users.View',
        'Users.Verify',
        'Users.Status',
        'Users.HardDelete',
        'Users.PhoneChange',
        'Listings.View',
        'Listings.Review',
        'Listings.Edit',
        'Listings.Lifecycle',
        'Listings.PriceSuggest',
        'Listings.Feature',
        'Licenses.View',
        'Licenses.Verify',
        'Licenses.Compliance',
        'Contracts.View',
        'Contracts.Manage',
        'Contracts.Assign',
        'Offers.View',
        'Offers.Manage',
        'Deals.View',
        'Deals.FinalApprove',
        'Deals.ExtendTimer',
        'Deals.DisputeResolve',
        'Payments.View',
        'Payments.Verify',
        'Payments.Refund',
        'Conversations.View',
        'Conversations.Relay',
        'Conversations.Redact',
        'Reviews.View',
        'Reviews.Moderate',
        'Geo.Manage',
        'Tasks.View',
        'Tasks.Claim',
        'Tasks.ForceUnlock',
        'Finance.View',
        'Finance.Export',
        'Finance.Audit',
        'Compliance.View',
        'Compliance.Manage',
        'Security.Manage',
        'Settings.Manage',
        'CMS.Manage',
        'Audit.View',
        'Rbac.Manage',
      ];

      for (const key of requiredCanonicalKeys) {
        expect(ALL_ADMIN_PERMISSIONS).toContain(key);
      }
      expect(ADMIN_PERMISSION_GROUPS.length).toBeGreaterThanOrEqual(14);
    });

    it('resolveAdminPermissions returns ALL_ADMIN_PERMISSIONS for SUPER_ADMIN, customPermissions when non-empty, and role defaults when empty', () => {
      expect(resolveAdminPermissions(AdminRole.SUPER_ADMIN, ['Users.View'])).toEqual(
        ALL_ADMIN_PERMISSIONS
      );
      expect(
        resolveAdminPermissions(AdminRole.MODERATOR, ['Geo.Manage', 'Reviews.Moderate'])
      ).toEqual(['Geo.Manage', 'Reviews.Moderate']);
      expect(resolveAdminPermissions(AdminRole.MODERATOR, [])).toEqual(
        ADMIN_ROLE_PERMISSIONS[AdminRole.MODERATOR]
      );
      expect(resolveAdminPermissions(AdminRole.FINANCIAL_AUDITOR, undefined)).toEqual(
        ADMIN_ROLE_PERMISSIONS[AdminRole.FINANCIAL_AUDITOR]
      );
    });

    it('validates adminCreateStaffRequestSchema and normalizes username/email', () => {
      const parsed = adminCreateStaffRequestSchema.parse({
        username: '  Mod_Ops_01  ',
        email: '  Ops01@Elmasaif.SA ',
        fullName: 'فهد القحطاني',
        role: AdminRole.MODERATOR,
        initialPassword: 'SecureStaff2026',
        permissions: ['Listings.Review', 'Reviews.Moderate', 'Geo.Manage'],
      });

      expect(parsed.username).toBe('mod_ops_01');
      expect(parsed.email).toBe('ops01@elmasaif.sa');
      expect(parsed.permissions).toEqual([
        'Listings.Review',
        'Reviews.Moderate',
        'Geo.Manage',
      ]);

      expect(
        adminCreateStaffRequestSchema.safeParse({
          username: 'mod_ops_01',
          email: 'ops01@elmasaif.sa',
          fullName: 'فهد القحطاني',
          role: AdminRole.MODERATOR,
          initialPassword: 'SecureStaff2026',
          permissions: ['Invalid.PermissionKey'],
        }).success
      ).toBe(false);
    });

    it('validates adminUpdateStaffPermissionsRequestSchema and status/deletion schemas', () => {
      expect(
        adminUpdateStaffPermissionsRequestSchema.safeParse({
          role: AdminRole.MODERATOR,
          permissions: ['Reviews.Moderate', 'Tasks.ForceUnlock'],
          reason: 'تفويض المشرف بإدارة التقييمات وفك أقفال المهام',
        }).success
      ).toBe(true);

      expect(
        adminUpdateStaffPermissionsRequestSchema.safeParse({
          permissions: [],
          reason: 'سبب',
        }).success
      ).toBe(false);

      expect(
        adminUpdateStaffStatusRequestSchema.safeParse({
          action: 'SOFT_DELETE',
          reason: 'انتهاء تكليف الموظف مع الاحتفاظ بسجل التدقيق',
        }).success
      ).toBe(true);

      expect(
        adminHardDeleteStaffRequestSchema.safeParse({
          reason: 'حساب تجريبي بدون أي سجل عمليات',
        }).success
      ).toBe(true);

      expect(
        adminUpdateUserStatusRequestSchema.safeParse({
          action: 'DISABLE',
          reason: 'إيقاف الحساب مؤقتاً للتحقق من المستندات',
        }).success
      ).toBe(true);

      expect(
        adminHardDeleteUserRequestSchema.safeParse({
          reason: 'حساب مكرر بدون أي معاملات',
        }).success
      ).toBe(true);
    });
  });
});

