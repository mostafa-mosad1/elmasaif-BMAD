import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ForbiddenException, ConflictException } from '@nestjs/common';
import { PayoutService } from '../payout.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { OtpService } from '../../auth/otp/otp.service';
import {
  UserRole,
  DealStatus,
  AUTH_OTP_INVALID
} from '@elmasaif/shared';

describe('PayoutService (Seller Payout Account Management & Security Guards) (AC: 1, 2, 4, 5, 6, 7)', () => {
  let service: PayoutService;
  let prisma: any;
  let clockService: any;
  let cryptoService: any;
  let otpService: any;

  const validRajhiIban = 'SA0380000000608010167519';
  const mockDate = new Date('2026-10-31T12:00:00Z');

  const mockUser = {
    id: 'user-1',
    fullName: 'سعد القحطاني',
    mobileNumber: '0512345678',
    profiles: [
      {
        id: 'profile-marketer-1',
        role: UserRole.MARKETER,
        userId: 'user-1',
        payoutIban: null,
        falLicense: {
          licenseNumber: '1234567890',
          commercialName: 'مؤسسة سعد العقارية'
        }
      },
      {
        id: 'profile-owner-1',
        role: UserRole.OWNER,
        userId: 'user-1',
        payoutIban: null,
        falLicense: null
      },
      {
        id: 'profile-buyer-1',
        role: UserRole.BUYER,
        userId: 'user-1',
        payoutIban: null,
        falLicense: null
      }
    ]
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn()
      },
      userProfile: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      payoutAccount: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      deal: {
        findFirst: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      })
    };

    clockService = {
      now: jest.fn(() => mockDate)
    };

    cryptoService = {
      encrypt: jest.fn((text: string) => `iv:tag:${text}`),
      decrypt: jest.fn((cipher: string) => cipher.replace('iv:tag:', ''))
    };

    otpService = {
      generateAndSendOtp: jest.fn(),
      verifyOtp: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: CryptoService, useValue: cryptoService },
        { provide: OtpService, useValue: otpService }
      ]
    }).compile();

    service = module.get<PayoutService>(PayoutService);
  });

  describe('Role Guard (AC: 7)', () => {
    it('should reject BUYER role with ForbiddenException and PAYOUT_ROLE_NOT_AUTHORIZED', async () => {
      await expect(
        service.getPayoutAccounts('user-1', UserRole.BUYER)
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createPayoutAccount('user-1', UserRole.BUYER, {
          accountHolderName: 'سعد القحطاني',
          iban: validRajhiIban,
          otpCode: '123456',
          isDefault: true
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should permit MARKETER and OWNER roles', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userProfile.findUnique.mockResolvedValue(mockUser.profiles[0]);
      prisma.payoutAccount.findMany.mockResolvedValue([]);
      prisma.deal.findFirst.mockResolvedValue(null);

      const marketerAccounts = await service.getPayoutAccounts('user-1', UserRole.MARKETER);
      expect(marketerAccounts).toEqual([]);

      prisma.userProfile.findUnique.mockResolvedValue(mockUser.profiles[1]);
      const ownerAccounts = await service.getPayoutAccounts('user-1', UserRole.OWNER);
      expect(ownerAccounts).toEqual([]);
    });
  });

  describe('Step-Up OTP Verification (AC: 4)', () => {
    it('should dispatch OTP with purpose PAYOUT_ACCOUNT_UPDATE for registered mobile', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.generateAndSendOtp.mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      });

      const res = await service.requestPayoutOtp('user-1');
      expect(res.success).toBe(true);
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        '0512345678',
        'PAYOUT_ACCOUNT_UPDATE'
      );
    });

    it('should reject account creation if OTP verification fails', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.verifyOtp.mockRejectedValue(
        new HttpException({ code: AUTH_OTP_INVALID, message: 'رمز غير صالح' }, HttpStatus.BAD_REQUEST)
      );

      await expect(
        service.createPayoutAccount('user-1', UserRole.MARKETER, {
          accountHolderName: 'سعد القحطاني',
          iban: validRajhiIban,
          otpCode: '000000',
          isDefault: true
        })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Mod-97 Checksum & Bank Code Resolution (AC: 1)', () => {
    it('should reject invalid Saudi IBAN with PAYOUT_INVALID_IBAN', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.verifyOtp.mockResolvedValue({ success: true });

      await expect(
        service.createPayoutAccount('user-1', UserRole.MARKETER, {
          accountHolderName: 'سعد القحطاني',
          iban: 'SA0080000000608010167519', // invalid checksum
          otpCode: '123456',
          isDefault: true
        })
      ).rejects.toThrow(HttpException);
    });

    it('should identify bank name Al Rajhi Bank (code 80)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.verifyOtp.mockResolvedValue({ success: true });
      prisma.payoutAccount.count.mockResolvedValue(0);
      prisma.payoutAccount.create.mockResolvedValue({
        id: 'acc-1',
        profileId: 'profile-marketer-1',
        accountHolderName: 'سعد القحطاني',
        bankName: 'مصرف الراجحي',
        ibanEncrypted: `iv:tag:${validRajhiIban}`,
        ibanMasked: 'SA03 **** **** **** **** 7519',
        ibanLast4: '7519',
        isDefault: true,
        hasCommercialNameMismatch: false,
        createdAt: mockDate,
        updatedAt: mockDate
      });

      const res = await service.createPayoutAccount('user-1', UserRole.MARKETER, {
        accountHolderName: 'سعد القحطاني',
        iban: validRajhiIban,
        otpCode: '123456',
        isDefault: true
      });

      expect(res.account.bankName).toBe('مصرف الراجحي');
      expect(cryptoService.encrypt).toHaveBeenCalledWith(validRajhiIban);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYOUT_ACCOUNT_CREATED',
            actorId: 'user-1'
          })
        })
      );
    });
  });

  describe('Commercial Name Mismatch Warning (AC: 6)', () => {
    it('should set hasCommercialNameMismatch: true and return warning when name differs', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.verifyOtp.mockResolvedValue({ success: true });
      prisma.payoutAccount.count.mockResolvedValue(0);
      prisma.payoutAccount.create.mockImplementation(({ data }) => ({
        id: 'acc-2',
        ...data,
        createdAt: mockDate,
        updatedAt: mockDate
      }));

      const res = await service.createPayoutAccount('user-1', UserRole.MARKETER, {
        accountHolderName: 'خالد عبد الله الشمري', // Mismatch against 'سعد القحطاني' and 'مؤسسة سعد العقارية'
        iban: validRajhiIban,
        otpCode: '123456',
        isDefault: true
      });

      expect(res.account.hasCommercialNameMismatch).toBe(true);
      expect(res.warning).toBe('ACCOUNT_HOLDER_NAME_MISMATCH');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYOUT_NAME_MISMATCH_WARNING'
          })
        })
      );
    });

    it('should NOT flag mismatch when accountHolderName matches commercialName', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      otpService.verifyOtp.mockResolvedValue({ success: true });
      prisma.payoutAccount.count.mockResolvedValue(0);
      prisma.payoutAccount.create.mockImplementation(({ data }) => ({
        id: 'acc-3',
        ...data,
        createdAt: mockDate,
        updatedAt: mockDate
      }));

      const res = await service.createPayoutAccount('user-1', UserRole.MARKETER, {
        accountHolderName: 'مؤسسة سعد العقارية',
        iban: validRajhiIban,
        otpCode: '123456',
        isDefault: true
      });

      expect(res.account.hasCommercialNameMismatch).toBe(false);
      expect(res.warning).toBeUndefined();
    });
  });

  describe('Active Non-Terminal Deal Restriction (AC: 5)', () => {
    const existingAccount = {
      id: 'acc-1',
      profileId: 'profile-marketer-1',
      accountHolderName: 'سعد القحطاني',
      bankName: 'مصرف الراجحي',
      ibanEncrypted: `iv:tag:${validRajhiIban}`,
      ibanMasked: 'SA03 **** **** **** **** 7519',
      ibanLast4: '7519',
      isDefault: true,
      hasCommercialNameMismatch: false,
      profile: {
        id: 'profile-marketer-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        user: mockUser,
        falLicense: mockUser.profiles[0].falLicense
      }
    };

    it('should BLOCK update with 409 Conflict when seller has active non-terminal deal', async () => {
      prisma.payoutAccount.findUnique.mockResolvedValue(existingAccount);
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-active-1',
        status: DealStatus.AWAITING_PAYMENT_PROOF
      });

      await expect(
        service.updatePayoutAccount('user-1', UserRole.MARKETER, 'acc-1', {
          accountHolderName: 'اسم جديد',
          otpCode: '123456'
        })
      ).rejects.toThrow(ConflictException);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYOUT_MODIFICATION_BLOCKED_ACTIVE_DEAL'
          })
        })
      );
    });

    it('should BLOCK delete with 409 Conflict when seller has deal under admin audit', async () => {
      prisma.payoutAccount.findUnique.mockResolvedValue(existingAccount);
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-active-2',
        status: DealStatus.UNDER_ADMIN_AUDIT
      });

      await expect(
        service.deletePayoutAccount('user-1', UserRole.MARKETER, 'acc-1', '123456')
      ).rejects.toThrow(ConflictException);
    });

    it('should ALLOW update when seller has no active deals or only terminal deals (COMPLETED)', async () => {
      prisma.payoutAccount.findUnique.mockResolvedValue(existingAccount);
      prisma.deal.findFirst.mockResolvedValue(null);
      otpService.verifyOtp.mockResolvedValue({ success: true });
      prisma.payoutAccount.update.mockResolvedValue({
        ...existingAccount,
        accountHolderName: 'سعد بن عبد الله القحطاني'
      });

      const res = await service.updatePayoutAccount('user-1', UserRole.MARKETER, 'acc-1', {
        accountHolderName: 'سعد بن عبد الله القحطاني',
        otpCode: '123456'
      });

      expect(res.accountHolderName).toBe('سعد بن عبد الله القحطاني');
    });
  });
});
