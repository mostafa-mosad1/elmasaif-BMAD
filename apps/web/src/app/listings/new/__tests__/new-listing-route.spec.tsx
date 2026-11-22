import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import NewListingRouteHandler from '../page';
import { UserRole } from '@elmasaif/shared';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../../components/layout/layout-shell', () => ({
  LayoutShell: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-shell">{children}</div>,
}));

let mockAuthContext: any = {
  user: null,
  activeRole: UserRole.BUYER,
  profiles: [],
  isLoading: false,
  attachOwnerRole: vi.fn(),
};

vi.mock('../../../../components/providers/auth-provider', () => ({
  useAuth: () => mockAuthContext,
}));

describe('NewListingRouteHandler (/listings/new)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = {
      user: null,
      activeRole: UserRole.BUYER,
      profiles: [],
      isLoading: false,
      attachOwnerRole: vi.fn(),
    };
  });

  it('renders login required state when user is not authenticated', () => {
    const html = renderToString(<NewListingRouteHandler />);
    expect(html).toContain('تسجيل الدخول مطلوب لإضافة العقار');
    expect(html).toContain('تسجيل الدخول والمتابعة');
  });

  it('renders loading state when auth state is loading', () => {
    mockAuthContext.isLoading = true;
    const html = renderToString(<NewListingRouteHandler />);
    expect(html).toContain('جارٍ التحقق من حسابك وصلاحيات إضافة العقار');
  });

  it('renders role selection options when user is authenticated as buyer only', () => {
    mockAuthContext.user = { id: 'u1', fullName: 'سعد التميمي', username: 'saad' };
    mockAuthContext.activeRole = UserRole.BUYER;
    mockAuthContext.profiles = [{ role: UserRole.BUYER }];

    const html = renderToString(<NewListingRouteHandler />);
    expect(html).toContain('بأي صفة ترغب في إضافة هذا العقار؟');
    expect(html).toContain('أنا مالك العقار');
    expect(html).toContain('أنا وسيط عقاري مرخص (فال)');
  });
});
