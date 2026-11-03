import { Request, Response } from 'express';
import {
  AdminRole,
  ADMIN_LOGIN_SUCCESS,
  ADMIN_LOGOUT_SUCCESS,
  ADMIN_PASSWORD_RESET_SUCCESS,
  ADMIN_RESET_DISPATCHED,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_INACTIVITY_MS,
  ADMIN_SESSION_PROFILE,
} from '@elmasaif/shared';
import { AdminAuthController } from '../admin-auth.controller';
import { AdminAuthService } from '../admin-auth.service';
import { AdminSessionAuthGuard } from '../guards/admin-session-auth.guard';

describe('AdminAuthController (Story 8.1)', () => {
  let controller: AdminAuthController;
  let adminAuthService: {
    login: jest.Mock;
    logout: jest.Mock;
    getMe: jest.Mock;
    listAdminsForSuperAdmin: jest.Mock;
    initiatePasswordReset: jest.Mock;
    completePasswordReset: jest.Mock;
  };

  beforeEach(() => {
    adminAuthService = {
      login: jest.fn(),
      logout: jest.fn(),
      getMe: jest.fn(),
      listAdminsForSuperAdmin: jest.fn(),
      initiatePasswordReset: jest.fn(),
      completePasswordReset: jest.fn(),
    };

    controller = new AdminAuthController(
      adminAuthService as unknown as AdminAuthService,
      {} as unknown as AdminSessionAuthGuard
    );
  });

  it('sets isolated elmasaif_admin_session cookie with 8-hour maxAge on login', async () => {
    const expiresAt = new Date('2026-11-03T18:00:00.000Z');
    adminAuthService.login.mockResolvedValue({
      sessionToken: 'admin-token-hex-64',
      expiresAt,
      admin: {
        id: 'admin-1',
        username: 'superadmin',
        email: 'admin@elmasaif.sa',
        fullName: 'المشرف العام - المصايف',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        permissions: ['Rbac.Manage'],
      },
    });

    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest', 'x-request-id': 'req-1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const response = await controller.login(
      { identifier: 'superadmin', password: 'Admin@Elmasaif2026' },
      req,
      res
    );

    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      'admin-token-hex-64',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_INACTIVITY_MS,
      })
    );
    expect(response.code).toBe(ADMIN_LOGIN_SUCCESS);
    expect(response.data.admin.username).toBe('superadmin');
  });

  it('clears elmasaif_admin_session cookie on logout', async () => {
    adminAuthService.logout.mockResolvedValue({ success: true });

    const req = {
      ip: '127.0.0.1',
      cookies: { [ADMIN_SESSION_COOKIE_NAME]: 'admin-token-hex-64' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    const response = await controller.logout(req, res);

    expect(adminAuthService.logout).toHaveBeenCalledWith('admin-token-hex-64', '127.0.0.1');
    expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE_NAME, { path: '/' });
    expect(response.code).toBe(ADMIN_LOGOUT_SUCCESS);
  });

  it('returns current admin profile and refreshes sliding cookie on GET /admin/auth/me', async () => {
    adminAuthService.getMe.mockResolvedValue({
      id: 'admin-1',
      username: 'superadmin',
      email: 'admin@elmasaif.sa',
      fullName: 'المشرف العام - المصايف',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      permissions: ['Rbac.Manage'],
    });

    const req = {
      admin: { id: 'admin-1', role: AdminRole.SUPER_ADMIN },
      adminSessionToken: 'token-123',
      headers: {},
    } as unknown as Request & { admin: { id: string; role: AdminRole }; adminSessionToken?: string };
    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const response = await controller.getMe(req, res);

    expect(response.code).toBe(ADMIN_SESSION_PROFILE);
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      'token-123',
      expect.objectContaining({
        maxAge: ADMIN_SESSION_INACTIVITY_MS,
      })
    );
  });

  it('initiates password reset for target admin when requested by SUPER_ADMIN', async () => {
    adminAuthService.initiatePasswordReset.mockResolvedValue({
      adminId: 'target-mod-1',
      email: 'moderator@elmasaif.sa',
      expiresInSeconds: 900,
      activeSessionsRevoked: true,
    });

    const req = {
      ip: '127.0.0.1',
      admin: { id: 'super-1', role: AdminRole.SUPER_ADMIN },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request & { admin: { id: string; role: AdminRole } };

    const response = await controller.initiatePasswordReset(
      'target-mod-1',
      { reason: 'إعادة تعيين كلمة المرور بناءً على طلب المشرف' },
      req
    );

    expect(response.code).toBe(ADMIN_RESET_DISPATCHED);
    expect(response.data.activeSessionsRevoked).toBe(true);
  });

  it('completes password reset and clears any existing admin cookie', async () => {
    adminAuthService.completePasswordReset.mockResolvedValue({ success: true });

    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    const response = await controller.confirmPasswordReset(
      { token: 'valid-token', newPassword: 'NewAdminPassword2026' },
      req,
      res
    );

    expect(response.code).toBe(ADMIN_PASSWORD_RESET_SUCCESS);
    expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE_NAME, { path: '/' });
  });
});

