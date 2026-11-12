import { describe, it, expect } from 'vitest';
import {
  ALL_ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  ADMIN_ROLE_PERMISSIONS,
  resolveAdminPermissions,
  ADMIN_USERNAME_ALREADY_EXISTS,
  ADMIN_EMAIL_ALREADY_EXISTS,
  ADMIN_SELF_MODIFICATION_FORBIDDEN,
  ADMIN_LAST_SUPER_ADMIN_BLOCK,
  ADMIN_HARD_DELETE_HISTORY_EXISTS,
  USER_HARD_DELETE_HISTORY_EXISTS,
} from '../../constants/auth';
import {
  adminCreateStaffRequestSchema,
  adminUpdateStaffPermissionsRequestSchema,
  adminUpdateStaffStatusRequestSchema,
  adminHardDeleteStaffRequestSchema,
  adminUpdateUserStatusRequestSchema,
  adminHardDeleteUserRequestSchema,
} from '../auth.schema';
import { AdminRole } from '../../enums';

describe('Story 8.2 Shared RBAC Constants & Schemas (auth.schema.spec)', () => {
  it('defines all Story 8.2 error codes and permission groups', () => {
    expect(ADMIN_USERNAME_ALREADY_EXISTS).toBe('ADMIN_USERNAME_ALREADY_EXISTS');
    expect(ADMIN_EMAIL_ALREADY_EXISTS).toBe('ADMIN_EMAIL_ALREADY_EXISTS');
    expect(ADMIN_SELF_MODIFICATION_FORBIDDEN).toBe('ADMIN_SELF_MODIFICATION_FORBIDDEN');
    expect(ADMIN_LAST_SUPER_ADMIN_BLOCK).toBe('ADMIN_LAST_SUPER_ADMIN_BLOCK');
    expect(ADMIN_HARD_DELETE_HISTORY_EXISTS).toBe('ADMIN_HARD_DELETE_HISTORY_EXISTS');
    expect(USER_HARD_DELETE_HISTORY_EXISTS).toBe('USER_HARD_DELETE_HISTORY_EXISTS');
    expect(ADMIN_PERMISSION_GROUPS.length).toBeGreaterThanOrEqual(14);
    expect(ALL_ADMIN_PERMISSIONS.length).toBeGreaterThanOrEqual(42);
  });

  it('resolves effective admin permissions with backward-compatible role fallback', () => {
    expect(resolveAdminPermissions(AdminRole.SUPER_ADMIN, null)).toEqual(ALL_ADMIN_PERMISSIONS);
    expect(resolveAdminPermissions(AdminRole.MODERATOR, ['Users.PhoneChange', 'Geo.Manage'])).toEqual([
      'Users.PhoneChange',
      'Geo.Manage',
    ]);
    expect(resolveAdminPermissions(AdminRole.COMPLIANCE_OFFICER, [])).toEqual(
      ADMIN_ROLE_PERMISSIONS[AdminRole.COMPLIANCE_OFFICER]
    );
  });

  it('validates staff and user lifecycle schemas', () => {
    expect(
      adminCreateStaffRequestSchema.safeParse({
        username: 'auditor_1',
        email: 'auditor1@elmasaif.sa',
        fullName: 'عبدالله الشهري',
        role: AdminRole.FINANCIAL_AUDITOR,
        initialPassword: 'AuditorPassword2026',
        permissions: ['Finance.View', 'Finance.Audit'],
      }).success
    ).toBe(true);

    expect(
      adminUpdateStaffPermissionsRequestSchema.safeParse({
        permissions: ['Finance.View', 'Finance.Export', 'Finance.Audit'],
        reason: 'منح صلاحية التدقيق المالي الشامل',
      }).success
    ).toBe(true);

    expect(
      adminUpdateStaffStatusRequestSchema.safeParse({
        action: 'DISABLE',
        reason: 'إجازة رسمية للموظف',
      }).success
    ).toBe(true);

    expect(
      adminHardDeleteStaffRequestSchema.safeParse({
        reason: 'حساب مكرر أنشئ بالخطأ بدون عمليات',
      }).success
    ).toBe(true);

    expect(
      adminUpdateUserStatusRequestSchema.safeParse({
        action: 'SOFT_DELETE',
        reason: 'حذف ناعم للحساب مع حفظ سجلات المعاملات',
      }).success
    ).toBe(true);

    expect(
      adminHardDeleteUserRequestSchema.safeParse({
        reason: 'حذف حساب غير مستخدم بدون أي معاملات',
      }).success
    ).toBe(true);
  });
});

