import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { AccountDeletionService } from '../account-deletion.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { OtpService } from '../../auth/otp/otp.service';
import * as argon2 from 'argon2';
import {
  ProfileStatus,
  DealStatus,
  OwnerContractStatus,
  AUTH_DELETION_ACTIVE_DEAL_BLOCK,
  AUTH_DELETION_OPEN_DISPUTE_BLOCK,
  AUTH_DELETION_ACTIVE_CONTRACT_BLOCK,
  AUTH_INVALID_CREDENTIALS,
  AUTH_DELETION_INITIATED,
  AUTH_DELETION_COOLING_OFF,
  AUTH_ACCOUNT_DEACTIVATED_STATUTORY,
  AUTH_DELETION_CANCELLED,
  AUTH_DELETION_TOKEN_INVALID,
  AUTH_DELETION_TOKEN_EXPIRED
} from '@elmasaif/shared';

// Mock argon2
jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('new_hash'),
  argon2id: 2
}));

describe('AccountDeletionService (Story 1.9 PDPL Compliance) (AC: 1, 2, 3, 4, 5)', () => {
  let service: AccountDeletionService;
  let prisma: any;
  let clockService: any;
  let otpService: any;

  const mockDate = new Date('2026-11-01T12:00:00Z');
  const mockUser = {
    id: 'user-uuid-1',
    mobileNumber: '+966512345678',
    fullName: 'سعد القحطاني',
    passwordHash: 'hashed_current_password',
    status: ProfileStatus.ACTIVE,
    deletionRequestedAt: null,
    deletionDueAt: null,
    failedLoginAttempts: 0
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser)
      },
      userProfile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'prof-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      deal: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0)
      },
      dispute: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0)
      },
      ownerListingRequest: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      ownerContract: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0)
      },
      listing: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      offer: {
        count: jest.fn().mockResolvedValue(0)
      },
      payment: {
        count: jest.fn().mockResolvedValue(0)
      },
      conversation: {
        count: jest.fn().mockResolvedValue(0)
      },
      rating: {
        count: jest.fn().mockResolvedValue(0)
      },
      demand: {
        count: jest.fn().mockResolvedValue(0)
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' })
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return await cb(prisma);
        }
        return cb;
      })
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date(mockDate))
    };

    otpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({ success: true, resendAvailableInSeconds: 60 }),
      verifyOtp: jest.fn().mockResolvedValue({ id: 'otp-record-1', verified: true }),
      cleanupOtp: jest.fn().mockResolvedValue(undefined)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: OtpService, useValue: otpService }
      ]
    }).compile();

    service = module.get<AccountDeletionService>(AccountDeletionService);
    jest.clearAllMocks();
  });

  describe('1. Pre-Flight Eligibility & Active Commitment Blocking (AC: 1)', () => {
    it('blocks deletion when user is party to active non-terminal deal', async () => {
      prisma.deal.findFirst.mockResolvedValueOnce({
        id: 'deal-1',
        status: DealStatus.AWAITING_PAYMENT_PROOF
      });

      await expect(service.getEligibility(mockUser.id)).rejects.toThrow(ConflictException);

      try {
        await service.getEligibility(mockUser.id);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_DELETION_ACTIVE_DEAL_BLOCK);
      }
    });

    it('blocks deletion when user has an open dispute', async () => {
      prisma.dispute.findFirst.mockResolvedValueOnce({
        id: 'dispute-1',
        status: 'OPEN'
      });

      await expect(service.getEligibility(mockUser.id)).rejects.toThrow(ConflictException);

      try {
        await service.getEligibility(mockUser.id);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_DELETION_OPEN_DISPUTE_BLOCK);
      }
    });

    it('blocks deletion when user has pending owner listing request or contract fee', async () => {
      prisma.ownerListingRequest.findFirst.mockResolvedValueOnce({
        id: 'req-1',
        status: 'PENDING'
      });

      await expect(service.getEligibility(mockUser.id)).rejects.toThrow(ConflictException);

      try {
        await service.getEligibility(mockUser.id);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_DELETION_ACTIVE_CONTRACT_BLOCK);
      }
    });

    it('returns eligible status with COOLING_OFF mode when clean account has no transactions', async () => {
      const res = await service.getEligibility(mockUser.id);
      expect(res.data.eligible).toBe(true);
      expect(res.data.mode).toBe('COOLING_OFF');
      expect(res.data.coolingOffDays).toBe(14);
      expect(res.data.hasTransactionHistory).toBe(false);
    });

    it('returns eligible status with STATUTORY_RETENTION mode when account has historical transactions', async () => {
      prisma.listing.count.mockResolvedValueOnce(3);

      const res = await service.getEligibility(mockUser.id);
      expect(res.data.eligible).toBe(true);
      expect(res.data.mode).toBe('STATUTORY_RETENTION');
      expect(res.data.hasTransactionHistory).toBe(true);
    });
  });

  describe('2. Deletion Initiation & Step-Up OTP Dispatch (AC: 2)', () => {
    it('fails when current password verification fails', async () => {
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.initiateDeletion(mockUser.id, { currentPassword: 'WrongPassword' }, '127.0.0.1')
      ).rejects.toThrow(HttpException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: { failedLoginAttempts: { increment: 1 } }
        })
      );
    });

    it('successfully verifies password and dispatches OTP with challenge token', async () => {
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);

      const res = await service.initiateDeletion(
        mockUser.id,
        { currentPassword: 'CorrectPassword123' },
        '192.168.1.1'
      );

      expect(res.code).toBe(AUTH_DELETION_INITIATED);
      expect(res.data.deletionToken).toBeDefined();
      expect(res.data.maskedMobileNumber).toContain('+966 5X XXX');
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        mockUser.mobileNumber,
        'ACCOUNT_DELETION'
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ACCOUNT_DELETION_INITIATED',
            actorId: mockUser.id
          })
        })
      );
    });
  });

  describe('3. Deletion Confirmation & Zero-History Branch (AC: 3)', () => {
    it('schedules 14-day cooling-off period when user has zero transaction history', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const initiateRes = await service.initiateDeletion(
        mockUser.id,
        { currentPassword: 'CorrectPassword123' },
        '127.0.0.1'
      );
      const token = initiateRes.data.deletionToken;

      const confirmRes = await service.confirmDeletion(
        mockUser.id,
        { deletionToken: token, code: '123456' },
        '127.0.0.1'
      );

      expect(confirmRes.code).toBe(AUTH_DELETION_COOLING_OFF);
      expect(confirmRes.data.status).toBe(ProfileStatus.DELETION_PENDING);
      expect(confirmRes.data.coolingOffDays).toBe(14);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUser.id } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ACCOUNT_DELETION_REQUESTED',
            actorId: mockUser.id
          })
        })
      );
    });
  });

  describe('4. Deletion Confirmation & Historical Records Branch (AC: 4)', () => {
    it('deactivates account with statutory retention when user has transaction history', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const initiateRes = await service.initiateDeletion(
        mockUser.id,
        { currentPassword: 'CorrectPassword123' },
        '127.0.0.1'
      );
      const token = initiateRes.data.deletionToken;

      // Mock user having 1 listing
      prisma.listing.count.mockResolvedValue(1);

      const confirmRes = await service.confirmDeletion(
        mockUser.id,
        { deletionToken: token, code: '123456' },
        '127.0.0.1'
      );

      expect(confirmRes.code).toBe(AUTH_ACCOUNT_DEACTIVATED_STATUTORY);
      expect(confirmRes.data.status).toBe(ProfileStatus.DEACTIVATED);
      expect(confirmRes.data.retainedRecords).toBe(true);
      expect(prisma.userProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { status: ProfileStatus.DEACTIVATED }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ACCOUNT_DEACTIVATED_STATUTORY_RETENTION',
            actorId: mockUser.id
          })
        })
      );
    });
  });

  describe('5. Cooling-Off Cancellation & Explicit Revocation (AC: 5)', () => {
    it('explicitly cancels deletion and restores status to ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        status: ProfileStatus.DELETION_PENDING,
        deletionDueAt: new Date(mockDate.getTime() + 14 * 86400000)
      });

      const res = await service.cancelDeletion(mockUser.id, '127.0.0.1');

      expect(res.code).toBe(AUTH_DELETION_CANCELLED);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: {
            status: ProfileStatus.ACTIVE,
            deletionRequestedAt: null,
            deletionDueAt: null
          }
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ACCOUNT_DELETION_CANCELLED',
            actorId: mockUser.id
          })
        })
      );
    });
  });
});

