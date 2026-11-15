import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WorkspaceShell } from '../workspace-shell';
import { AuthContext, AuthContextType } from '../../providers/auth-provider';
import { DirectionProvider } from '../../providers/direction-provider';
import { ThemeProvider } from '../../providers/theme-provider';
import { UserRole, ProfileStatus, VerificationStatus } from '@elmasaif/shared';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/buyer',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

describe('WorkspaceShell Component (AC: 5, 7)', () => {
  const createMockContext = (activeRole: UserRole): AuthContextType => ({
    user: {
      id: 'usr-1',
      fullName: 'أحمد فهد',
      mobileNumber: '+966501234567',
      username: 'ahmed_f',
      role: activeRole,
      activeRole,
      profiles: [
        {
          id: 'p-1',
          role: activeRole,
          status: ProfileStatus.ACTIVE
        }
      ]
    },
    activeRole,
    profiles: [
      {
        id: 'p-1',
        role: activeRole,
        status: ProfileStatus.ACTIVE
      }
    ],
    identityStatus: null,
    isLoading: false,
    switchRole: async () => {},
    attachOwnerRole: async () => {},
    logout: async () => {},
    refreshSession: async () => {},
    refreshIdentityStatus: async () => ({
      isUploaded: false,
      status: VerificationStatus.NOT_UPLOADED,
      documentType: null,
      maskedIdNumber: null,
      uploadedAt: null,
      rejectionReason: null,
      canUploadDealPaymentProof: false
    })
  });

  const renderWithProviders = (contextValue: AuthContextType, children: React.ReactNode) => {
    return renderToString(
      React.createElement(
        DirectionProvider,
        null,
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: contextValue },
            children
          )
        )
      )
    );
  };

  it('renders Buyer workspace sidebar navigation', () => {
    const html = renderWithProviders(
      createMockContext(UserRole.BUYER),
      React.createElement(
        WorkspaceShell,
        null,
        React.createElement('div', null, 'محتوى مساحة المشتري')
      )
    );

    expect(html).toContain('المصايف');
    expect(html).toContain('مساحة المشتري');
    expect(html).toContain('لوحة التحكم');
    expect(html).toContain('تصفح العقارات');
    expect(html).toContain('عروضي النشطة');
    expect(html).toContain('العقارات المفضلة');
    expect(html).toContain('طلبات الشراء');
    expect(html).toContain('توثيق الهوية');
    expect(html).toContain('محتوى مساحة المشتري');
  });

  it('renders Owner workspace sidebar navigation', () => {
    const html = renderWithProviders(
      createMockContext(UserRole.OWNER),
      React.createElement(
        WorkspaceShell,
        null,
        React.createElement('div', null, 'محتوى مساحة المالك')
      )
    );

    expect(html).toContain('مساحة المالك');
    expect(html).toContain('لوحة تحكم المالك');
    expect(html).toContain('طلب عرض عقار مباشر');
    expect(html).toContain('عقود الوساطة الإلكترونية');
    expect(html).toContain('حسابات التحويل (IBAN)');
    expect(html).toContain('محتوى مساحة المالك');
  });

  it('renders Marketer workspace sidebar navigation', () => {
    const html = renderWithProviders(
      createMockContext(UserRole.MARKETER),
      React.createElement(
        WorkspaceShell,
        null,
        React.createElement('div', null, 'محتوى مساحة الوسيط')
      )
    );

    expect(html).toContain('مساحة الوسيط المعتمد');
    expect(html).toContain('لوحة تحكم الوسيط');
    expect(html).toContain('إدارة العقارات');
    expect(html).toContain('إضافة عقار جديد');
    expect(html).toContain('رخصة فال العقارية');
    expect(html).toContain('محتوى مساحة الوسيط');
  });
});
