import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdminPhoneChangeDialog } from '../admin-phone-change-dialog';

describe('AdminPhoneChangeDialog Component (AC: 7)', () => {
  const targetUser = {
    id: 'user-test-1',
    fullName: 'خالد بن ناصر الدوسري',
    nationalId: '1088776655',
    mobileNumber: '+966512345678'
  };

  it('renders modal with target user info, R-09 warning, checkbox, and reason textarea when isOpen is true', () => {
    const html = renderToString(
      React.createElement(AdminPhoneChangeDialog, {
        isOpen: true,
        onClose: vi.fn(),
        targetUser
      })
    );

    expect(html).toContain('تحديث رقم الجوال عبر الدعم (إشراف عام)');
    expect(html).toContain('خالد بن ناصر الدوسري');
    expect(html).toContain('1088776655');
    expect(html).toContain('+966512345678');
    expect(html).toContain('تحذير أمني عالي المخاطر (R-09)');
    expect(html).toContain('أؤكد التحقق من وثيقة الهوية الرسمية للمستخدم عبر القنوات المعتمدة');
    expect(html).toContain('سبب التحديث الإداري وتفاصيل التحقق (مطلوب للرقابة)');
    expect(html).toContain('تأكيد التحديث الإداري');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      React.createElement(AdminPhoneChangeDialog, {
        isOpen: false,
        onClose: vi.fn(),
        targetUser
      })
    );

    expect(html).toBe('');
  });
});

