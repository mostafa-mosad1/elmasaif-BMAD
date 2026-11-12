import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  AdminRole,
  AdminStaffSummaryDto,
  AdminPlatformUserSummaryDto,
  UserRole,
} from '@elmasaif/shared';
import {
  AdminStaffManagement,
  AdminCreateStaffModal,
  AdminPermissionsModal,
} from '../admin-staff-management';

const mockStaff: AdminStaffSummaryDto[] = [
  {
    id: 'admin-super-1',
    username: 'superadmin',
    email: 'super@elmasaif.sa',
    fullName: 'عبدالله السديري',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    deletedAt: null,
    permissions: ['Rbac.Manage', 'Listings.Review', 'Reviews.Approve'],
    hasOperationalHistory: true,
  },
  {
    id: 'admin-mod-2',
    username: 'moderator_ops',
    email: 'mod@elmasaif.sa',
    fullName: 'فهد القحطاني',
    role: AdminRole.MODERATOR,
    isActive: false,
    deletedAt: null,
    permissions: ['Listings.Review', 'Reviews.Approve'],
    hasOperationalHistory: false,
  },
];

const mockUsers: AdminPlatformUserSummaryDto[] = [
  {
    id: 'user-buyer-1',
    fullName: 'سلطان العتيبي',
    phone: '+966500000001',
    email: 'sultan@example.com',
    role: UserRole.BUYER,
    roles: [UserRole.BUYER],
    status: 'ACTIVE',
    isActive: true,
    verificationStatus: 'VERIFIED',
    deletedAt: null,
    transactionHistoryCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-new-2',
    fullName: 'نواف الدوسري',
    phone: '+966500000002',
    email: null,
    role: UserRole.OWNER,
    roles: [UserRole.OWNER],
    status: 'SUSPENDED',
    isActive: false,
    verificationStatus: 'UNVERIFIED',
    deletedAt: null,
    transactionHistoryCount: 0,
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

describe('AdminStaffManagement & Dynamic RBAC Modals (Story 8.2) (AC: 3, 4, 5, 6, 7)', () => {
  it('renders Staff Management table with role badges, Area.Action permission chips, operational history indicators, and lifecycle actions', () => {
    const html = renderToString(
      <AdminStaffManagement initialStaff={mockStaff} initialUsers={mockUsers} initialTab="STAFF" />
    );

    expect(html).toContain('إدارة الموظفين والصلاحيات (RBAC) وحوكمة حسابات المستخدمين');
    expect(html).toContain('عبدالله السديري');
    expect(html).toContain('فهد القحطاني');
    expect(html).toContain('Rbac.Manage');
    expect(html).toContain('Listings.Review');
    expect(html).toContain('سجل عمليات مرتبط');
    expect(html).toContain('بدون سجل');
    expect(html).toContain('تعديل الصلاحيات');
    expect(html).toContain('تعطيل');
    expect(html).toContain('تفعيل');
    expect(html).toContain('حذف ناعم');
    expect(html).toContain('حذف نهائي');
    expect(html).toContain('رابط استعادة كلمة المرور');
  });

  it('renders Platform User Governance tab with transaction history count and enable/disable/soft-delete/hard-delete actions', () => {
    const html = renderToString(
      <AdminStaffManagement initialStaff={mockStaff} initialUsers={mockUsers} initialTab="USERS" />
    );

    expect(html).toContain('حوكمة حسابات مستخدمي المنصة');
    expect(html).toContain('سلطان العتيبي');
    expect(html).toContain('نواف الدوسري');
    expect(html).toContain('سجل معاملات مرتبط (4)');
    expect(html).toContain('بدون سجل معاملات');
    expect(html).toContain('تعطيل');
    expect(html).toContain('تفعيل');
    expect(html).toContain('حذف ناعم');
    expect(html).toContain('حذف نهائي');
  });

  it('renders AdminCreateStaffModal with role presets and grouped Area.Action permission matrix', () => {
    const html = renderToString(
      <AdminCreateStaffModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('إنشاء حساب موظف إداري جديد وتخصيص الصلاحيات (RBAC)');
    expect(html).toContain('الاسم الكامل للموظف');
    expect(html).toContain('اسم المستخدم الإداري (Username)');
    expect(html).toContain('مصفوفة الصلاحيات الدقيقة حسب النطاق التشغيلي (Area.Action)');
    expect(html).toContain('Listings.Review');
    expect(html).toContain('Reviews.Moderate');
    expect(html).toContain('Tasks.ForceUnlock');
    expect(html).toContain('Rbac.Manage');
  });

  it('renders AdminPermissionsModal with target staff permissions, mandatory AuditLog reason, and session revocation notice', () => {
    const html = renderToString(
      <AdminPermissionsModal
        isOpen={true}
        targetStaff={mockStaff[1]}
        onClose={() => {}}
      />
    );

    expect(html).toContain('تعديل مصفوفة الصلاحيات الدقيقة (Dynamic RBAC)');
    expect(html).toContain('فهد القحطاني');
    expect(html).toContain('سبب تعديل الصلاحيات (إلزامي لسجل التدقيق الرقابي AuditLog)');
    expect(html).toContain('حفظ مصفوفة الصلاحيات وإلغاء الجلسات');
  });
});

