import { Test, TestingModule } from '@nestjs/testing';
import { PhoneChangeController } from '../phone-change.controller';
import { PhoneChangeService } from '../phone-change.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

describe('PhoneChangeController (Story 1.7) (AC: 1, 2, 4)', () => {
  let controller: PhoneChangeController;
  let service: any;
  let mockPrisma: any;
  let mockClock: any;

  const mockUser = {
    id: 'user-uuid-1',
    mobileNumber: '+966512345678'
  };

  const mockReq = {
    user: mockUser,
    ip: '192.168.1.100',
    headers: {
      'x-request-id': 'req-test-123',
      'user-agent': 'JestTestRunner'
    }
  };

  beforeEach(async () => {
    service = {
      initiatePhoneChange: jest.fn(),
      verifyOldPhoneOtp: jest.fn(),
      verifyNewPhoneOtp: jest.fn(),
      resendPhoneChangeOtp: jest.fn()
    };

    mockPrisma = {
      session: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-11-01T12:00:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhoneChangeController],
      providers: [
        { provide: PhoneChangeService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<PhoneChangeController>(PhoneChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /users/phone-change/initiate (AC: 1)', () => {
    it('delegates to phoneChangeService.initiatePhoneChange and adds x-request-id', async () => {
      service.initiatePhoneChange.mockResolvedValueOnce({
        code: 'AUTH_PHONE_CHANGE_INITIATED',
        message: 'تم إرسال رموز التحقق إلى رقم جوالك الحالي والرقم الجديد بنجاح',
        data: {
          requestId: 'req-1',
          oldPhoneNumberMasked: '+966 5X XXX 5678',
          newPhoneNumberMasked: '+966 5X XXX 5432',
          expiresInSeconds: 900,
          resendAvailableInSeconds: 60
        }
      });

      const body = { newMobileNumber: '+966598765432' };
      const res = await controller.initiatePhoneChange(body, mockReq);

      expect(service.initiatePhoneChange).toHaveBeenCalledWith(
        mockUser.id,
        body,
        mockReq.ip,
        mockReq.headers['user-agent']
      );
      expect(res.code).toBe('AUTH_PHONE_CHANGE_INITIATED');
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/phone-change/verify-old (AC: 2)', () => {
    it('delegates to phoneChangeService.verifyOldPhoneOtp and adds x-request-id', async () => {
      service.verifyOldPhoneOtp.mockResolvedValueOnce({
        code: 'AUTH_PHONE_OLD_VERIFIED',
        message: 'تم التحقق من رقم الجوال الحالي بنجاح',
        data: {
          requestId: 'req-1',
          oldVerified: true,
          newVerified: false,
          isCompleted: false
        }
      });

      const body = { requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538', code: '123456' };
      const res = await controller.verifyOldPhoneOtp(body, mockReq);

      expect(service.verifyOldPhoneOtp).toHaveBeenCalledWith(
        mockUser.id,
        body,
        mockReq.ip
      );
      expect(res.code).toBe('AUTH_PHONE_OLD_VERIFIED');
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/phone-change/verify-new (AC: 2)', () => {
    it('delegates to phoneChangeService.verifyNewPhoneOtp and adds x-request-id', async () => {
      service.verifyNewPhoneOtp.mockResolvedValueOnce({
        code: 'AUTH_PHONE_NEW_VERIFIED',
        message: 'تم التحقق من رقم الجوال الجديد بنجاح',
        data: {
          requestId: 'req-1',
          oldVerified: true,
          newVerified: true,
          isCompleted: false
        }
      });

      const body = { requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538', code: '123456' };
      const res = await controller.verifyNewPhoneOtp(body, mockReq);

      expect(service.verifyNewPhoneOtp).toHaveBeenCalledWith(
        mockUser.id,
        body,
        mockReq.ip
      );
      expect(res.code).toBe('AUTH_PHONE_NEW_VERIFIED');
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/phone-change/resend (AC: 4)', () => {
    it('delegates to phoneChangeService.resendPhoneChangeOtp and adds x-request-id', async () => {
      service.resendPhoneChangeOtp.mockResolvedValueOnce({
        code: 'SUCCESS',
        message: 'تم إرسال رمز التحقق بنجاح',
        data: {
          resendAvailableInSeconds: 60
        }
      });

      const body = { requestId: 'c56a4180-65aa-42ec-a945-5fd21dec0538', target: 'NEW' as const };
      const res = await controller.resendPhoneChangeOtp(body, mockReq);

      expect(service.resendPhoneChangeOtp).toHaveBeenCalledWith(
        mockUser.id,
        body
      );
      expect(res.code).toBe('SUCCESS');
      expect(res.requestId).toBe('req-test-123');
    });
  });
});

