import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { SessionAuthGuard } from '../guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { SESSION_COOKIE_NAME } from '@elmasaif/shared';

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
      logout: jest.fn()
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
});

