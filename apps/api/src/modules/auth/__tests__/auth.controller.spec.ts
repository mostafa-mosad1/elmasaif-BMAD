import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { SessionAuthGuard } from '../guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { SESSION_COOKIE_NAME, DEVICE_COOKIE_NAME } from '@elmasaif/shared';

describe('AuthController (AC: 1, 4, 5)', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockPrismaService: any;
  let mockClockService: any;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      verifyRegistrationOtp: jest.fn(),
      resendOtp: jest.fn(),
      logout: jest.fn(),
      login: jest.fn(),
      verifyStepUpOtp: jest.fn(),
      forgotPassword: jest.fn(),
      verifyResetOtp: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn()
    };

    mockPrismaService = {
      session: {
        findUnique: jest.fn()
      }
    };

    mockClockService = {
      now: jest.fn().mockReturnValue(new Date('2026-10-29T11:00:00.000Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClockService, useValue: mockClockService },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('dispatches registration and returns envelope', async () => {
      mockAuthService.register.mockResolvedValue({
        success: true,
        message: 'OTP_SENT',
        mobileNumber: '+966501234567',
        resendAvailableInSeconds: 60
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest-Test' }
      } as any;

      const body = {
        fullName: 'عبدالله محمد',
        mobileNumber: '+966501234567',
        nationalId: '1023456789',
        username: 'u_966501234567',
        password: 'Password123',
        termsAccepted: true,
        privacyAccepted: true
      };

      const result = await controller.register(body as any, mockReq);

      expect(mockAuthService.register).toHaveBeenCalledWith(body, '127.0.0.1', 'Jest-Test');
      expect(result.code).toBe('AUTH_OTP_SENT');
      expect(result.data.mobileNumber).toBe('+966501234567');
    });
  });

  describe('verifyOtp', () => {
    it('verifies OTP, sets HttpOnly cookie and returns HTTP 201 envelope', async () => {
      const mockResult = {
        user: {
          id: 'user-uuid',
          fullName: 'عبدالله محمد',
          mobileNumber: '+966501234567',
          username: 'u_966501234567',
          role: 'BUYER'
        },
        sessionToken: 'test-session-token',
        sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      mockAuthService.verifyRegistrationOtp.mockResolvedValue(mockResult);

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest-Test' }
      } as any;

      const mockRes = {
        cookie: jest.fn()
      } as any;

      const body = {
        mobileNumber: '+966501234567',
        code: '123456'
      };

      const response = await controller.verifyOtp(body, mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'test-session-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(response.code).toBe('AUTH_REGISTRATION_SUCCESS');
      expect(response.data.user.role).toBe('BUYER');
    });
  });

  describe('resendOtp', () => {
    it('calls resend and returns envelope', async () => {
      mockAuthService.resendOtp.mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      });

      const body = { mobileNumber: '+966501234567' };
      const response = await controller.resendOtp(body);

      expect(mockAuthService.resendOtp).toHaveBeenCalledWith(body);
      expect(response.code).toBe('AUTH_OTP_RESENT');
    });
  });

  describe('me', () => {
    it('returns current user from session decorator', async () => {
      const mockUser = {
        id: 'user-uuid',
        fullName: 'عبدالله محمد',
        mobileNumber: '+966501234567',
        username: 'u_966501234567',
        role: 'BUYER'
      };

      const response = await controller.me(mockUser as any);
      expect(response.code).toBe('AUTH_USER_PROFILE');
      expect(response.data.user).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('clears session cookie and revokes session', async () => {
      const mockReq = {
        cookies: { [SESSION_COOKIE_NAME]: 'active-token' },
        headers: {}
      } as any;

      const mockRes = {
        clearCookie: jest.fn()
      } as any;

      const response = await controller.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: '/' });
      expect(mockAuthService.logout).toHaveBeenCalledWith('active-token');
      expect(response.code).toBe('AUTH_LOGOUT_SUCCESS');
    });
  });

  describe('login (AC: 1, 4, 5)', () => {
    it('returns step-up challenge and does NOT set session cookie when step-up is required', async () => {
      mockAuthService.login.mockResolvedValue({
        stepUpRequired: true,
        mobileNumber: '+966 5X XXX 1234',
        stepUpToken: 'step-up-token',
        resendAvailableInSeconds: 60,
        deviceId: 'device-123'
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Chrome-Agent' },
        cookies: {}
      } as any;

      const mockRes = {
        cookie: jest.fn()
      } as any;

      const body = {
        identifier: '0501234567',
        password: 'Password123'
      };

      const result = await controller.login(body, mockReq, mockRes);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        body,
        '127.0.0.1',
        'Chrome-Agent',
        expect.any(String)
      );
      expect(result.code).toBe('AUTH_STEP_UP_REQUIRED');
      expect(result.data.stepUpRequired).toBe(true);
      expect(result.data.mobileNumber).toBe('+966 5X XXX 1234');
      expect(mockRes.cookie).not.toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.anything(),
        expect.anything()
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        DEVICE_COOKIE_NAME,
        expect.any(String),
        expect.anything()
      );
    });

    it('sets session and device cookies and returns success when device is recognized', async () => {
      mockAuthService.login.mockResolvedValue({
        stepUpRequired: false,
        user: {
          id: 'user-1',
          fullName: 'عبدالله محمد',
          mobileNumber: '+966501234567',
          username: 'abdullah',
          role: 'BUYER'
        },
        sessionToken: 'sess-token-xyz',
        sessionExpiresAt: new Date(),
        deviceId: 'device-123',
        deletionCancelled: true
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Chrome-Agent' },
        cookies: { [DEVICE_COOKIE_NAME]: 'device-123' }
      } as any;

      const mockRes = {
        cookie: jest.fn()
      } as any;

      const body = {
        identifier: '0501234567',
        password: 'Password123'
      };

      const result = await controller.login(body, mockReq, mockRes);

      expect(result.code).toBe('AUTH_LOGIN_SUCCESS');
      expect(result.data.user.id).toBe('user-1');
      expect(result.data.deletionCancelled).toBe(true);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'sess-token-xyz',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        DEVICE_COOKIE_NAME,
        'device-123',
        expect.objectContaining({
          path: '/'
        })
      );
    });
  });

  describe('loginStepUp (AC: 4, 5)', () => {
    it('verifies step-up OTP, sets session cookie and returns success envelope', async () => {
      mockAuthService.verifyStepUpOtp.mockResolvedValue({
        user: {
          id: 'user-1',
          fullName: 'عبدالله محمد',
          mobileNumber: '+966501234567',
          username: 'abdullah',
          role: 'BUYER'
        },
        sessionToken: 'stepup-session-token',
        sessionExpiresAt: new Date(),
        deviceId: 'device-123'
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Chrome-Agent' },
        cookies: { [DEVICE_COOKIE_NAME]: 'device-123' }
      } as any;

      const mockRes = {
        cookie: jest.fn()
      } as any;

      const body = {
        mobileNumber: '+966501234567',
        code: '123456',
        stepUpToken: 'valid-token'
      };

      const result = await controller.loginStepUp(body, mockReq, mockRes);

      expect(mockAuthService.verifyStepUpOtp).toHaveBeenCalledWith(
        body,
        '127.0.0.1',
        'Chrome-Agent',
        'device-123'
      );
      expect(result.code).toBe('AUTH_LOGIN_SUCCESS');
      expect(result.data.user.id).toBe('user-1');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'stepup-session-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/'
        })
      );
    });
  });

  describe('forgotPassword (AC: 1)', () => {
    it('dispatches forgot password and returns envelope', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        code: 'AUTH_RESET_INITIATED',
        message: 'إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور',
        data: { resendAvailableInSeconds: 60 }
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest-Agent', 'x-request-id': 'req-123' }
      } as any;

      const body = { mobileNumber: '+966501234567' };
      const result = await controller.forgotPassword(body, mockReq);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(body, '127.0.0.1', 'Jest-Agent');
      expect(result.code).toBe('AUTH_RESET_INITIATED');
      expect(result.requestId).toBe('req-123');
    });
  });

  describe('verifyResetOtp (AC: 2)', () => {
    it('verifies OTP and returns challenge token', async () => {
      mockAuthService.verifyResetOtp.mockResolvedValue({
        code: 'AUTH_RESET_OTP_VERIFIED',
        message: 'تم تأكيد رمز التحقق بنجاح',
        data: { resetToken: 'mock-reset-token', expiresInSeconds: 900 }
      });

      const mockReq = {
        headers: { 'x-request-id': 'req-456' }
      } as any;

      const body = { mobileNumber: '+966501234567', code: '123456' };
      const result = await controller.verifyResetOtp(body, mockReq);

      expect(mockAuthService.verifyResetOtp).toHaveBeenCalledWith(body);
      expect(result.code).toBe('AUTH_RESET_OTP_VERIFIED');
      expect(result.data.resetToken).toBe('mock-reset-token');
    });
  });

  describe('resetPassword (AC: 3)', () => {
    it('resets password and returns success envelope', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        code: 'AUTH_PASSWORD_RESET_SUCCESS',
        message: 'تم إعادة تعيين كلمة المرور بنجاح وإلغاء كافة الجلسات النشطة'
      });

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest-Agent' }
      } as any;

      const body = { resetToken: 'mock-token', newPassword: 'NewPassword123' };
      const result = await controller.resetPassword(body, mockReq);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(body, '127.0.0.1', 'Jest-Agent');
      expect(result.code).toBe('AUTH_PASSWORD_RESET_SUCCESS');
    });
  });

  describe('changePassword (AC: 4)', () => {
    it('changes authenticated password using current session cookie', async () => {
      mockAuthService.changePassword.mockResolvedValue({
        code: 'AUTH_PASSWORD_CHANGE_SUCCESS',
        message: 'تم تغيير كلمة المرور بنجاح وتم إلغاء الجلسات الأخرى النشطة'
      });

      const mockUser = {
        id: 'u-1',
        fullName: 'أحمد',
        mobileNumber: '+966501234567',
        username: 'ahmed',
        role: 'BUYER',
        activeRole: 'BUYER',
        profiles: []
      } as any;

      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Jest-Agent' },
        cookies: { [SESSION_COOKIE_NAME]: 'active-session-token' }
      } as any;

      const body = { currentPassword: 'OldPassword1', newPassword: 'NewPassword2' };
      const result = await controller.changePassword(mockUser, body, mockReq);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'u-1',
        'active-session-token',
        body,
        '127.0.0.1',
        'Jest-Agent'
      );
      expect(result.code).toBe('AUTH_PASSWORD_CHANGE_SUCCESS');
    });
  });

});
