import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WorkspaceRoleSwitcher } from '../workspace-role-switcher';
import { AuthContext, AuthContextType } from '../../providers/auth-provider';
import { UserRole, ProfileStatus } from '@elmasaif/shared';

describe('WorkspaceRoleSwitcher Component (AC: 5, 6)', () => {
  const mockAuthContext: AuthContextType = {
    user: {
      id: 'usr-1',
      fullName: 'أحمد فهد',
      mobileNumber: '+966501234567',
      username: 'ahmed_f',
      role: UserRole.BUYER,
      activeRole: UserRole.BUYER,
      profiles: [
        {
          id: 'p-1',
          role: UserRole.BUYER,
          status: ProfileStatus.ACTIVE
        }
      ]
    },
    activeRole: UserRole.BUYER,
    profiles: [
      {
        id: 'p-1',
        role: UserRole.BUYER,
        status: ProfileStatus.ACTIVE
      }
    ],
    isLoading: false,
    switchRole: async () => {},
    attachOwnerRole: async () => {},
    logout: async () => {},
    refreshSession: async () => {}
  };

  it('renders current active role badge and trigger button', () => {
    const html = renderToString(
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContext },
        React.createElement(WorkspaceRoleSwitcher, null)
      )
    );

    expect(html).toContain('مشتري');
    expect(html).toContain('تبديل مساحة العمل');
  });

  it('renders owner activation option when owner role is unattached', () => {
    const html = renderToString(
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContext },
        React.createElement(WorkspaceRoleSwitcher, { defaultOpen: true })
      )
    );

    expect(html).toContain('تفعيل حساب المالك');
    expect(html).toContain('ترقية لحساب مسوق معتمد');
  });
});
