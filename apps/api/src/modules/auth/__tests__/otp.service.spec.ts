import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { OtpService, HTTP_STATUS_LOCKED } from '../otp/otp.service';
import { OTP_PROVIDER_TOKEN } from '../otp/otp-provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  AUTH_OTP_EXPIRED,
  AUTH_OTP_INVALID,
  AUTH_OTP_LOCKED,
  AUTH_OTP_MAX_EXCEEDED,
  AUTH_OTP_THROTTLED
} from '@elmasaif/shared';

describe('OtpService (AC: 2, 3)', () => {
  let service: OtpService;
  let mockPrismaService: any;
  let mockClockService: any;
  let mockConfigService: any;
  let mockOtpProvider: any;

  const fixedNow = new Date('2026-10-29T11:00:00.000Z');

  beforeEach(async () => {
    mockClockService = {
      now: jest.fn().mockReturnValue(new Date(fixedNow))
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'ENABLE_STATIC_OTP') return 'true';
        if (key === 'NODE_ENV') return 'test';
        return defaultVal;
      })
    };

    mockOtpProvider = {
      sendOtp: jest.fn().mockResolvedValue(true)
    };

    mockPrismaService = {
      otpVerification: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClockService, useValue: mockClockService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OTP_PROVIDER_TOKEN, useValue: mockOtpProvider }
      ]
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndSendOtp', () => {
    const mobileNumber = '+966501234567';
    const purpose = 'REGISTRATION';

    it('generates and sends OTP when no existing record exists', async () => {
      mockPrismaService.otpVerification.findFirst.mockResolvedValue(null);
      mockPrismaService.otpVerification.upsert.mockResolvedValue({
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        otpCode: '123456',
        resendAvailableAt: new Date(fixedNow.getTime() + 60 * 1000)
      });

      const result = await service.generateAndSendOtp(mobileNumber, purpose, { test: true });

      expect(result.success).toBe(true);
      expect(mockOtpProvider.sendOtp).toHaveBeenCalledWith(mobileNumber, '123456');
      expect(mockPrismaService.otpVerification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            mobileNumber,
            purpose,
            otpCode: '123456',
            attempts: 0,
            hourlyCount: 1
          })
        })
      );
    });

    it('throws AUTH_OTP_LOCKED if phone is currently locked', async () => {
      mockPrismaService.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        lockedUntil: new Date(fixedNow.getTime() + 10 * 60 * 1000) // locked for 10 more mins
      });

      try {
        await service.generateAndSendOtp(mobileNumber, purpose);
        throw new Error('Expected generateAndSendOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HTTP_STATUS_LOCKED);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_OTP_LOCKED }));
      }
      expect(mockOtpProvider.sendOtp).not.toHaveBeenCalled();
    });

    it('throws AUTH_OTP_THROTTLED if resend requested within 60 seconds', async () => {
      mockPrismaService.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        resendAvailableAt: new Date(fixedNow.getTime() + 30 * 1000), // 30s remaining
        hourlyCount: 1,
        lastSentAt: fixedNow
      });

      try {
        await service.generateAndSendOtp(mobileNumber, purpose);
        throw new Error('Expected generateAndSendOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_OTP_THROTTLED }));
      }
      expect(mockOtpProvider.sendOtp).not.toHaveBeenCalled();
    });

    it('throws AUTH_OTP_MAX_EXCEEDED if more than 3 requests occur within an hour', async () => {
      mockPrismaService.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        resendAvailableAt: new Date(fixedNow.getTime() - 1000), // resend is available
        hourlyCount: 3,
        lastSentAt: new Date(fixedNow.getTime() - 15 * 60 * 1000) // 15 mins ago
      });

      try {
        await service.generateAndSendOtp(mobileNumber, purpose);
        throw new Error('Expected generateAndSendOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_OTP_MAX_EXCEEDED }));
      }
      expect(mockOtpProvider.sendOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    const mobileNumber = '+966501234567';
    const purpose = 'REGISTRATION';

    it('verifies code successfully when matching and not expired', async () => {
      const mockRecord = {
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        otpCode: '123456',
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(fixedNow.getTime() + 200 * 1000),
        lockedUntil: null,
        metadata: { fullName: 'سارة خالد' }
      };
      mockPrismaService.otpVerification.findFirst.mockResolvedValue(mockRecord);

      const result = await service.verifyOtp(mobileNumber, purpose, '123456');

      expect(result).toBeDefined();
      expect(result.id).toBe('otp-uuid-1');
      expect(result.metadata).toEqual({ fullName: 'سارة خالد' });
    });

    it('throws AUTH_OTP_EXPIRED if expired', async () => {
      const mockRecord = {
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        otpCode: '123456',
        attempts: 0,
        expiresAt: new Date(fixedNow.getTime() - 1000), // 1s ago
        lockedUntil: null
      };
      mockPrismaService.otpVerification.findFirst.mockResolvedValue(mockRecord);

      try {
        await service.verifyOtp(mobileNumber, purpose, '123456');
        throw new Error('Expected verifyOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_OTP_EXPIRED }));
      }
    });

    it('throws AUTH_OTP_INVALID and increments attempts on incorrect code', async () => {
      const mockRecord = {
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        otpCode: '123456',
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(fixedNow.getTime() + 200 * 1000),
        lockedUntil: null
      };
      mockPrismaService.otpVerification.findFirst.mockResolvedValue(mockRecord);

      try {
        await service.verifyOtp(mobileNumber, purpose, '999999');
        throw new Error('Expected verifyOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: AUTH_OTP_INVALID,
            details: { remainingAttempts: 2 }
          })
        );
      }

      expect(mockPrismaService.otpVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'otp-uuid-1' },
          data: { attempts: 1 }
        })
      );
    });

    it('locks verification for 15 minutes upon 3rd failed attempt', async () => {
      const mockRecord = {
        id: 'otp-uuid-1',
        mobileNumber,
        purpose,
        otpCode: '123456',
        attempts: 2,
        maxAttempts: 3,
        expiresAt: new Date(fixedNow.getTime() + 200 * 1000),
        lockedUntil: null
      };
      mockPrismaService.otpVerification.findFirst.mockResolvedValue(mockRecord);

      try {
        await service.verifyOtp(mobileNumber, purpose, '999999');
        throw new Error('Expected verifyOtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HTTP_STATUS_LOCKED);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: AUTH_OTP_LOCKED,
            details: expect.any(Object)
          })
        );
      }

      expect(mockPrismaService.otpVerification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'otp-uuid-1' },
          data: expect.objectContaining({
            attempts: 3,
            lockedUntil: new Date(fixedNow.getTime() + 15 * 60 * 1000)
          })
        })
      );
    });
  });
});
