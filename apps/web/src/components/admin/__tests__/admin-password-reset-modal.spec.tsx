import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdminRole } from '@elmasaif/shared';
import { AdminPasswordResetModal } from '../admin-password-reset-modal';

describe('AdminPasswordResetModal Component (Story 8.1) (AC: 4, 6, 7)', () => {
  const targetAdmin = {
    id: 'admin-mod-1',
    username: 'moderator',
    email: 'moderator@elmasaif.sa',
    fullName: 'مشرف العمليات',
    role: AdminRole.MODERATOR,
    isActive: true,
    permissions: ['Listings.Review'],
  };

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <AdminPasswordResetModal
        isOpen={false}
        targetAdmin={targetAdmin}
        onClose={() => {}}
      />
    );

    expect(html).toBe('');
  });

  it('renders Level 3 Super Admin password reset dispatch modal with mandatory reason and immediate session revocation warning', () => {
    const html = renderToString(
      <AdminPasswordResetModal
        isOpen={true}
        targetAdmin={targetAdmin}
        onClose={() => {}}
      />
    );

    expect(html).toContain('إصدار رابط إعادة تعيين كلمة مرور إدارية');
    expect(html).toContain('مشرف العمليات');
    expect(html).toContain('moderator@elmasaif.sa');
    expect(html).toContain('15 دقيقة');
    expect(html).toContain('للاستخدام مرة واحدة فقط');
    expect(html).toContain('إلغاء جميع الجلسات النشطة');
    expect(html).toContain('سبب إعادة تعيين كلمة المرور (إلزامي لسجل التدقيق)');
  });
});

