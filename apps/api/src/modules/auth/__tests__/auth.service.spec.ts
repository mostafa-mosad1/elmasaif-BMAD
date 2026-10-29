import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  AUTH_PHONE_ALREADY_EXISTS,
  AUTH_NATIONAL_ID_ALREADY_EXISTS,
  AUTH_USERNAME_ALREADY_EXISTS,
  DEFAULT_TERMS_VERSION,
  DEFAULT_PRIVACY_VERSION
} from '@elmasaif/shared';

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed_argon2id_password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2
}));

describe('AuthService (AC: 1, 4, 5)', () => {
  let service: AuthService;
  let mockPrismaService: any;
  let mockOtpService: any;
  let mockClockService: any;

  const fixedNow = new Date('2026-10-29T11:00:00.000Z');

  beforeEach(async () => {
    mockClockService = {
      now: jest.fn().mockReturnValue(new Date(fixedNow))
    };

    mockOtpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      }),
      verifyOtp: jest.fn(),
      cleanupOtp: jest.fn().mockResolvedValue(undefined)
    };

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn()
      },
      otpVerification: {
        findFirst: jest.fn()
      },
      session: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
      },
      $transaction: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: ClockService, useValue: mockClockService }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validDto = {
      fullName: 'خالد عبدالله',
      mobileNumber: '+966501234567',
      nationalId: '1023456789',
      username: 'u_966501234567',
      password: 'Password123',
      termsAccepted: true as const,
      privacyAccepted: true as const
    };

    it('rejects registration if mobile number already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.mobileNumber) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_PHONE_ALREADY_EXISTS }));
      }
    });

    it('rejects registration if national ID already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.nationalId) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_NATIONAL_ID_ALREADY_EXISTS }));
      }
    });

    it('rejects registration if username already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.username) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_USERNAME_ALREADY_EXISTS }));
      }
    });

    it('hashes password and dispatches OTP when inputs are unique', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.register(validDto, '127.0.0.1', 'test-agent');

      expect(argon2.hash).toHaveBeenCalledWith('Password123', { type: argon2.argon2id });
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalledWith(
        '+966501234567',
        'REGISTRATION',
        expect.objectContaining({
          fullName: 'خالد عبدالله',
          mobileNumber: '+966501234567',
          nationalId: '1023456789',
          username: 'u_966501234567',
          passwordHash: 'hashed_argon2id_password',
          termsVersion: DEFAULT_TERMS_VERSION,
          privacyVersion: DEFAULT_PRIVACY_VERSION,
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        })
      );
      expect(result.success).toBe(true);
      expect(result.mobileNumber).toBe('+966501234567');
      expect(result.resendAvailableInSeconds).toBe(60);
    });
  });

  describe('verifyRegistrationOtp', () => {
    it('creates User, UserProfile, ConsentRecord and Session inside transaction', async () => {
      const mockOtpRecord = {
        id: 'otp-id-123',
        mobileNumber: '+966501234567',
        metadata: {
          fullName: 'خالد عبدالله',
          mobileNumber: '+966501234567',
          nationalId: '1023456789',
          username: 'u_966501234567',
          passwordHash: 'hashed_argon2id_password',
          termsVersion: '1.0',
          privacyVersion: '1.0'
        }
      };

      mockOtpService.verifyOtp.mockResolvedValue(mockOtpRecord);

      const mockCreatedUser = {
        id: 'new-user-uuid',
        fullName: 'خالد عبدالله',
        mobileNumber: '+966501234567',
        nationalId: '1023456789',
        username: 'u_966501234567',
        status: 'ACTIVE'
      };

      const mockSession = {
        id: 'session-uuid',
        token: 'session-token-32-bytes',
        expiresAt: new Date(fixedNow.getTime() + 30 * 24 * 60 * 60 * 1000)
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockCreatedUser)
          },
          userProfile: {
            create: jest.fn().mockResolvedValue({ id: 'profile-uuid', role: 'BUYER' })
          },
          consentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'consent-uuid' })
          },
          session: {
            create: jest.fn().mockResolvedValue(mockSession)
          }
        };
        return callback(tx);
      });

      const result = await service.verifyRegistrationOtp(
        { mobileNumber: '+966501234567', code: '123456' },
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(mockOtpService.verifyOtp).toHaveBeenCalledWith('+966501234567', 'REGISTRATION', '123456');
      expect(mockOtpService.cleanupOtp).toHaveBeenCalledWith('otp-id-123');
      expect(result.user).toEqual({
        id: 'new-user-uuid',
        fullName: 'خالد عبدالله',
        mobileNumber: '+966501234567',
        username: 'u_966501234567',
        role: 'BUYER'
      });
      expect(result.sessionToken).toBeDefined();
    });
  });
});

