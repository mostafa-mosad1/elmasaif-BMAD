import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProfileEditor } from '../profile-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('ProfileEditor Component (Story 1.8 Profile Settings) (AC: 6)', () => {
  const mockProfile = {
    id: 'usr-1',
    fullName: 'عبدالله بن فهد المطيري',
    username: 'u_966501234567',
    mobileNumber: '+966 5X XXX 4567',
    nationalId: '10********',
    email: 'abdullah@example.com',
    pendingEmail: null,
    isEmailPending: false,
    emailVerifiedAt: '2026-10-01T12:00:00Z',
    hasCommercialNameMismatch: false
  };

  it('renders editable fields (fullName, email) and read-only fields (username, mobileNumber, nationalId)', () => {
    const html = renderToString(
      React.createElement(ProfileEditor, { initialProfile: mockProfile })
    );

    expect(html).toContain('الاسم الكامل');
    expect(html).toContain('عبدالله بن فهد المطيري');
    expect(html).toContain('البريد الإلكتروني');
    expect(html).toContain('abdullah@example.com');
    expect(html).toContain('تم التحقق');
    expect(html).toContain('اسم المستخدم');
    expect(html).toContain('u_966501234567');
    expect(html).toContain('رقم الجوال المعتمد');
    expect(html).toContain('+966 5X XXX 4567');
    expect(html).toContain('/app/settings/mobile');
    expect(html).toContain('رقم الهوية الوطنية');
    expect(html).toContain('/app/settings/identity');
    expect(html).toContain('حفظ التغييرات');
  });

  it('renders prominent pending email verification banner when pendingEmail exists', () => {
    const pendingProfile = {
      ...mockProfile,
      pendingEmail: 'abdullah.new@example.com',
      isEmailPending: true
    };

    const html = renderToString(
      React.createElement(ProfileEditor, { initialProfile: pendingProfile })
    );

    expect(html).toContain('البريد الإلكتروني الجديد قيد التحقق');
    expect(html).toContain('abdullah.new@example.com');
    expect(html).toContain('إعادة إرسال الرابط');
    expect(html).toContain('إلغاء التحديث');
  });

  it('renders Marketer commercial name mismatch warning banner when mismatch detected', () => {
    const mismatchProfile = {
      ...mockProfile,
      hasCommercialNameMismatch: true,
      commercialNameMismatchNotice:
        'تنبيه نظامي: اسمك المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال'
    };

    const html = renderToString(
      React.createElement(ProfileEditor, { initialProfile: mismatchProfile })
    );

    expect(html).toContain('تنبيه نظامي: اسمك المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال');
  });
});

