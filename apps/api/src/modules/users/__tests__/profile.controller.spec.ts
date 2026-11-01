import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from '../profile.controller';
import { ProfileService } from '../profile.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  AUTH_EMAIL_VERIFICATION_INITIATED,
  AUTH_EMAIL_VERIFIED_SUCCESS,
  AUTH_EMAIL_VERIFICATION_RESENT,
  AUTH_EMAIL_PENDING_CANCELLED
} from '@elmasaif/shared';

describe('ProfileController (Story 1.8 Endpoints) (AC: 1, 2, 3, 4)', () => {
  let controller: ProfileController;
  let service: any;
  let mockPrisma: any;
  let mockClock: any;

  const mockUser = {
    id: 'usr-controller-1',
    mobileNumber: '+966501234567'
  };

  const mockReq = {
    user: mockUser,
    ip: '192.168.1.100',
    headers: {
      'x-request-id': 'req-profile-123',
      'user-agent': 'JestControllerRunner'
    }
  };

  beforeEach(async () => {
    service = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
      cancelPendingEmail: jest.fn()
    };

    mockPrisma = {
      session: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-11-01T12:00:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: ProfileService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/profile', () => {
    it('fetches profile and attaches requestId', async () => {
      service.getProfile.mockResolvedValue({
        code: 'PROFILE_FETCH_SUCCESS',
        message: 'تم استرجاع بيانات الملف الشخصي بنجاح',
        data: { id: 'usr-controller-1', fullName: 'أحمد التميمي' }
      });

      const response = await controller.getProfile(mockReq);

      expect(service.getProfile).toHaveBeenCalledWith('usr-controller-1');
      expect(response.requestId).toBe('req-profile-123');
      expect(response.data.id).toBe('usr-controller-1');
    });
  });

  describe('PATCH /users/profile', () => {
    it('invokes service.updateProfile with user id, payload, and client metadata', async () => {
      service.updateProfile.mockResolvedValue({
        code: AUTH_EMAIL_VERIFICATION_INITIATED,
        message: 'تم إرسال رابط تأكيد',
        data: {
          id: 'usr-controller-1',
          fullName: 'أحمد التميمي',
          pendingEmail: 'new.test@domain.sa',
          isEmailPending: true
        }
      });

      const dto = {
        fullName: 'أحمد بن فهد التميمي',
        email: 'new.test@domain.sa'
      };

      const response = await controller.updateProfile(dto, mockReq);

      expect(service.updateProfile).toHaveBeenCalledWith(
        'usr-controller-1',
        dto,
        '192.168.1.100',
        'JestControllerRunner'
      );
      expect(response.code).toBe(AUTH_EMAIL_VERIFICATION_INITIATED);
      expect(response.requestId).toBe('req-profile-123');
    });
  });

  describe('POST /users/email/verify (Public Endpoint)', () => {
    it('invokes service.verifyEmail with verification token', async () => {
      service.verifyEmail.mockResolvedValue({
        code: AUTH_EMAIL_VERIFIED_SUCCESS,
        message: 'تم تأكيد البريد الإلكتروني بنجاح',
        data: {
          email: 'verified@domain.sa',
          emailVerifiedAt: new Date('2026-11-01T12:00:00Z')
        }
      });

      const dto = { token: 'valid.signed.token' };
      const response = await controller.verifyEmail(dto, mockReq);

      expect(service.verifyEmail).toHaveBeenCalledWith(dto, '192.168.1.100');
      expect(response.code).toBe(AUTH_EMAIL_VERIFIED_SUCCESS);
      expect(response.requestId).toBe('req-profile-123');
    });
  });

  describe('POST /users/email/resend', () => {
    it('invokes service.resendVerificationEmail for current user', async () => {
      service.resendVerificationEmail.mockResolvedValue({
        code: AUTH_EMAIL_VERIFICATION_RESENT,
        message: 'تم إعادة إرسال رابط التحقق',
        data: { resendAvailableInSeconds: 60 }
      });

      const response = await controller.resendVerificationEmail(mockReq);

      expect(service.resendVerificationEmail).toHaveBeenCalledWith(
        'usr-controller-1',
        '192.168.1.100'
      );
      expect(response.code).toBe(AUTH_EMAIL_VERIFICATION_RESENT);
      expect(response.data.resendAvailableInSeconds).toBe(60);
    });
  });

  describe('DELETE /users/email/pending', () => {
    it('invokes service.cancelPendingEmail for current user', async () => {
      service.cancelPendingEmail.mockResolvedValue({
        code: AUTH_EMAIL_PENDING_CANCELLED,
        message: 'تم إلغاء طلب تحديث البريد الإلكتروني المعلق بنجاح'
      });

      const response = await controller.cancelPendingEmail(mockReq);

      expect(service.cancelPendingEmail).toHaveBeenCalledWith(
        'usr-controller-1',
        '192.168.1.100'
      );
      expect(response.code).toBe(AUTH_EMAIL_PENDING_CANCELLED);
    });
  });
});

