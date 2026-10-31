import { Test, TestingModule } from '@nestjs/testing';
import { PayoutController } from '../payout.controller';
import { PayoutService } from '../payout.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { UserRole } from '@elmasaif/shared';

describe('PayoutController (AC: 1, 4, 5, 7)', () => {
  let controller: PayoutController;
  let service: any;
  let mockPrisma: any;
  let mockClock: any;

  const mockUser = {
    id: 'user-1',
    activeRole: UserRole.MARKETER,
    mobileNumber: '0512345678'
  };

  const mockReq = {
    user: mockUser,
    headers: { 'x-request-id': 'req-123' }
  };

  beforeEach(async () => {
    service = {
      getPayoutAccounts: jest.fn(),
      requestPayoutOtp: jest.fn(),
      createPayoutAccount: jest.fn(),
      updatePayoutAccount: jest.fn(),
      deletePayoutAccount: jest.fn()
    };

    mockPrisma = {
      session: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-10-31T12:00:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayoutController],
      providers: [
        { provide: PayoutService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<PayoutController>(PayoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/payout-accounts', () => {
    it('should return list of payout accounts for user and activeRole', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          accountHolderName: 'سعد القحطاني',
          bankName: 'مصرف الراجحي',
          ibanMasked: 'SA03 **** **** **** **** 7519',
          ibanFormatted: 'SA03 8000 0000 6080 1016 7519',
          isDefault: true
        }
      ];
      service.getPayoutAccounts.mockResolvedValue(mockAccounts);

      const res = await controller.getPayoutAccounts(mockReq);
      expect(res.code).toBe('SUCCESS');
      expect(res.data).toEqual(mockAccounts);
      expect(service.getPayoutAccounts).toHaveBeenCalledWith('user-1', UserRole.MARKETER);
    });
  });

  describe('POST /users/payout-accounts/request-otp', () => {
    it('should request step-up OTP for the authenticated seller', async () => {
      service.requestPayoutOtp.mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      });

      const res = await controller.requestPayoutOtp(mockReq);
      expect(res.code).toBe('SUCCESS');
      expect(res.data.resendAvailableInSeconds).toBe(60);
      expect(service.requestPayoutOtp).toHaveBeenCalledWith('user-1');
    });
  });

  describe('POST /users/payout-accounts', () => {
    it('should create payout account and return formatted response', async () => {
      const input = {
        accountHolderName: 'سعد القحطاني',
        iban: 'SA0380000000608010167519',
        otpCode: '123456',
        isDefault: true
      };

      const created = {
        id: 'acc-1',
        ...input,
        bankName: 'مصرف الراجحي',
        ibanMasked: 'SA03 **** **** **** **** 7519'
      };

      service.createPayoutAccount.mockResolvedValue({
        account: created,
        warning: undefined,
        warningMessage: undefined
      });

      const res = await controller.createPayoutAccount(input, mockReq);
      expect(res.code).toBe('SUCCESS');
      expect(res.data).toEqual(created);
      expect(service.createPayoutAccount).toHaveBeenCalledWith(
        'user-1',
        UserRole.MARKETER,
        input
      );
    });
  });

  describe('PUT /users/payout-accounts/:id', () => {
    it('should update payout account with OTP', async () => {
      const input = {
        accountHolderName: 'سعد بن عبد الله القحطاني',
        otpCode: '123456'
      };

      const updated = {
        id: 'acc-1',
        accountHolderName: 'سعد بن عبد الله القحطاني'
      };

      service.updatePayoutAccount.mockResolvedValue(updated);

      const res = await controller.updatePayoutAccount('acc-1', input, mockReq);
      expect(res.code).toBe('SUCCESS');
      expect(res.data).toEqual(updated);
      expect(service.updatePayoutAccount).toHaveBeenCalledWith(
        'user-1',
        UserRole.MARKETER,
        'acc-1',
        input
      );
    });
  });

  describe('DELETE /users/payout-accounts/:id', () => {
    it('should delete payout account with OTP', async () => {
      service.deletePayoutAccount.mockResolvedValue({
        success: true,
        message: 'تم حذف الحساب البنكي بنجاح'
      });

      const res = await controller.deletePayoutAccount('acc-1', { otpCode: '123456' }, {}, mockReq);
      expect(res.code).toBe('SUCCESS');
      expect(service.deletePayoutAccount).toHaveBeenCalledWith(
        'user-1',
        UserRole.MARKETER,
        'acc-1',
        '123456'
      );
    });
  });
});
