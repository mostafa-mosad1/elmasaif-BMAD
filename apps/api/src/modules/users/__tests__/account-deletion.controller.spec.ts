import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionController } from '../account-deletion.controller';
import { AccountDeletionService } from '../account-deletion.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  ProfileStatus,
  AUTH_DELETION_INITIATED,
  AUTH_DELETION_COOLING_OFF,
  AUTH_ACCOUNT_DEACTIVATED_STATUTORY,
  AUTH_DELETION_CANCELLED,
  SESSION_COOKIE_NAME
} from '@elmasaif/shared';

describe('AccountDeletionController (Story 1.9) (AC: 1, 2, 3, 4, 5)', () => {
  let controller: AccountDeletionController;
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
      'x-request-id': 'req-test-123'
    }
  };

  const mockRes = {
    clearCookie: jest.fn()
  };

  beforeEach(async () => {
    service = {
      getEligibility: jest.fn(),
      initiateDeletion: jest.fn(),
      confirmDeletion: jest.fn(),
      cancelDeletion: jest.fn()
    };

    mockPrisma = {
      session: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-11-01T12:00:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountDeletionController],
      providers: [
        { provide: AccountDeletionService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<AccountDeletionController>(
      AccountDeletionController
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/delete-account/eligibility', () => {
    it('returns eligibility evaluation and attaches requestId', async () => {
      service.getEligibility.mockResolvedValueOnce({
        code: 'AUTH_DELETION_ELIGIBLE',
        message: 'حسابك مؤهل لطلب الحذف',
        data: {
          eligible: true,
          hasTransactionHistory: false,
          mode: 'COOLING_OFF',
          coolingOffDays: 14
        }
      });

      const res = await controller.getEligibility(mockReq as any);

      expect(service.getEligibility).toHaveBeenCalledWith(
        mockUser.id,
        '192.168.1.100'
      );
      expect(res.data.eligible).toBe(true);
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/delete-account/initiate', () => {
    it('initiates deletion and returns challenge token with requestId', async () => {
      service.initiateDeletion.mockResolvedValueOnce({
        code: AUTH_DELETION_INITIATED,
        message: 'تم إرسال رمز التحقق',
        data: {
          deletionToken: 'challenge-token-123',
          resendAvailableInSeconds: 60,
          maskedMobileNumber: '+966 5X XXX 5678'
        }
      });

      const res = await controller.initiateDeletion(
        { currentPassword: 'Password123' },
        mockReq as any
      );

      expect(service.initiateDeletion).toHaveBeenCalledWith(
        mockUser.id,
        { currentPassword: 'Password123' },
        '192.168.1.100'
      );
      expect(res.code).toBe(AUTH_DELETION_INITIATED);
      expect(res.data.deletionToken).toBe('challenge-token-123');
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/delete-account/confirm', () => {
    it('confirms deletion, clears session cookie, and returns cooling-off details', async () => {
      service.confirmDeletion.mockResolvedValueOnce({
        code: AUTH_DELETION_COOLING_OFF,
        message: 'تمت جدولة حذف الحساب بنجاح',
        data: {
          status: ProfileStatus.DELETION_PENDING,
          deletionRequestedAt: '2026-11-01T12:00:00Z',
          deletionDueAt: '2026-11-15T12:00:00Z',
          coolingOffDays: 14
        }
      });

      const res = await controller.confirmDeletion(
        { deletionToken: 'token-123', code: '123456' },
        mockReq as any,
        mockRes as any
      );

      expect(service.confirmDeletion).toHaveBeenCalledWith(
        mockUser.id,
        { deletionToken: 'token-123', code: '123456' },
        '192.168.1.100'
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
        path: '/'
      });
      expect(res.code).toBe(AUTH_DELETION_COOLING_OFF);
      expect(res.requestId).toBe('req-test-123');
    });
  });

  describe('POST /users/delete-account/cancel', () => {
    it('cancels deletion and returns confirmation', async () => {
      service.cancelDeletion.mockResolvedValueOnce({
        code: AUTH_DELETION_CANCELLED,
        message: 'تم إلغاء طلب حذف الحساب بنجاح'
      });

      const res = await controller.cancelDeletion(mockReq as any);

      expect(service.cancelDeletion).toHaveBeenCalledWith(
        mockUser.id,
        '192.168.1.100'
      );
      expect(res.code).toBe(AUTH_DELETION_CANCELLED);
      expect(res.requestId).toBe('req-test-123');
    });
  });
});

