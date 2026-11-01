import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PhoneChangeService } from '../phone-change.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { OtpService } from '../../auth/otp/otp.service';
import {
  AdminRole,
  DealStatus,
  AUTH_PHONE_IN_USE,
  AUTH_PHONE_SAME_AS_CURRENT,
  AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
  AUTH_PHONE_CHANGE_EXPIRED,
  AUTH_PHONE_CHANGE_ALREADY_VERIFIED,
  AUTH_NOT_AUTHORIZED
} from '@elmasaif/shared';

describe('PhoneChangeService (Story 1.7 Dual-OTP Mobile Update) (AC: 1, 2, 3, 4, 5)', () => {
  let service: PhoneChangeService;
  let prisma: any;
  let clockService: any;
  let otpService: any;

  const mockDate = new Date('2026-11-01T12:00:00Z');
  const mockUser = {
    id: 'user-uuid-1',
    mobileNumber: '+966512345678',
    fullName: 'أحمد التميمي',
    status: 'ACTIVE'
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      userProfile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'prof-1' }])
      },
      deal: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      phoneChangeRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      identityDocument: {
        findFirst: jest.fn().mockResolvedValue({ id: 'id-doc-1', status: 'VERIFIED' })
      },
      otpVerification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' })
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      })
    };

    clockService = {
      now: jest.fn(() => new Date(mockDate))
    };

    otpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({ success: true, resendAvailableInSeconds: 60 }),
      verifyOtp: jest.fn().mockResolvedValue({ id: 'otp-rec-1' }),
      cleanupOtp: jest.fn().mockResolvedValue(undefined)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneChangeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: OtpService, useValue: otpService }
      ]
    }).compile();

    service = module.get<PhoneChangeService>(PhoneChangeService);
  });

  describe('1. initiatePhoneChange (AC: 1, 3)', () => {
    it('successfully initiates dual OTP dispatch and creates PENDING request', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // lookup user
        .mockResolvedValueOnce(null); // lookup new phone uniqueness

      prisma.phoneChangeRequest.create.mockResolvedValueOnce({
        id: 'request-uuid-1',
        userId: mockUser.id,
        oldPhoneNumber: mockUser.mobileNumber,
        newPhoneNumber: '+966598765432',
        status: 'PENDING',
        expiresAt: new Date(mockDate.getTime() + 900 * 1000)
      });

      const res = await service.initiatePhoneChange(
        mockUser.id,
        { newMobileNumber: '+966598765432' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(res.code).toBe('AUTH_PHONE_CHANGE_INITIATED');
      expect(res.data.requestId).toBe('request-uuid-1');
      expect(res.data.oldPhoneNumberMasked).toBe('+966 5X XXX 5678');
      expect(res.data.newPhoneNumberMasked).toBe('+966 5X XXX 5432');
      expect(res.data.expiresInSeconds).toBe(900);
      expect(res.data.resendAvailableInSeconds).toBe(60);

      // Verify OTP sent to both old and new numbers
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        mockUser.mobileNumber,
        'PHONE_CHANGE_OLD',
        { requestId: 'request-uuid-1' }
      );
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        '+966598765432',
        'PHONE_CHANGE_NEW',
        { requestId: 'request-uuid-1' }
      );

      // Verify prior pending requests cancelled
      expect(prisma.phoneChangeRequest.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, status: 'PENDING' },
        data: { status: 'CANCELLED' }
      });
    });

    it('rejects when new mobile number is identical to current registered number', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.initiatePhoneChange(
          mockUser.id,
          { newMobileNumber: mockUser.mobileNumber },
          '192.168.1.1',
          'agent'
        )
      ).rejects.toThrow(BadRequestException);

      try {
        await service.initiatePhoneChange(
          mockUser.id,
          { newMobileNumber: mockUser.mobileNumber },
          '192.168.1.1',
          'agent'
        );
      } catch (err: any) {
        expect(err.response.code).toBe(AUTH_PHONE_SAME_AS_CURRENT);
      }
    });

    it('rejects when new mobile number is already in use by another user (HTTP 409)', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'other-user', mobileNumber: '+966598765432' });

      await expect(
        service.initiatePhoneChange(
          mockUser.id,
          { newMobileNumber: '+966598765432' },
          '192.168.1.1',
          'agent'
        )
      ).rejects.toThrow(ConflictException);

      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'other-user', mobileNumber: '+966598765432' });

      try {
        await service.initiatePhoneChange(
          mockUser.id,
          { newMobileNumber: '+966598765432' },
          '192.168.1.1',
          'agent'
        );
      } catch (err: any) {
        expect(err.response.code).toBe(AUTH_PHONE_IN_USE);
      }
    });

    it('rejects when user is party to active deal in non-terminal state (AC: 3)', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      // Deal active
      prisma.deal.findFirst.mockResolvedValueOnce({
        id: 'deal-1',
        status: DealStatus.AWAITING_PAYMENT_PROOF
      });

      await expect(
        service.initiatePhoneChange(
          mockUser.id,
          { newMobileNumber: '+966598765432' },
          '192.168.1.1',
          'agent'
        )
      ).rejects.toThrow(ConflictException);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PHONE_CHANGE_BLOCKED_ACTIVE_DEAL',
            entityId: mockUser.id
          })
        })
      );
    });
  });

  describe('2. verifyOldPhoneOtp & verifyNewPhoneOtp (AC: 2)', () => {
    const pendingRequest = {
      id: 'req-1',
      userId: mockUser.id,
      oldPhoneNumber: '+966512345678',
      newPhoneNumber: '+966598765432',
      oldVerified: false,
      newVerified: false,
      status: 'PENDING',
      expiresAt: new Date(mockDate.getTime() + 600 * 1000)
    };

    it('marks oldVerified = true when valid OTP is provided', async () => {
      prisma.phoneChangeRequest.findUnique.mockResolvedValueOnce({ ...pendingRequest });
      prisma.phoneChangeRequest.update.mockResolvedValueOnce({
        ...pendingRequest,
        oldVerified: true
      });

      const res = await service.verifyOldPhoneOtp(mockUser.id, {
        requestId: 'req-1',
        code: '123456'
      });

      expect(res.code).toBe('AUTH_PHONE_OLD_VERIFIED');
      expect((res.data as any).oldVerified).toBe(true);
      expect((res.data as any).isCompleted).toBe(false);
      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        pendingRequest.oldPhoneNumber,
        'PHONE_CHANGE_OLD',
        '123456'
      );
    });

    it('rejects verification if request expired (15 minutes passed)', async () => {
      const expiredRequest = {
        ...pendingRequest,
        expiresAt: new Date(mockDate.getTime() - 1000) // expired
      };
      prisma.phoneChangeRequest.findUnique.mockResolvedValueOnce(expiredRequest);

      await expect(
        service.verifyOldPhoneOtp(mockUser.id, {
          requestId: 'req-1',
          code: '123456'
        })
      ).rejects.toThrow(BadRequestException);

      expect(prisma.phoneChangeRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'EXPIRED' }
      });
    });

    it('triggers atomic completion when both old and new numbers are verified', async () => {
      const almostDoneRequest = {
        ...pendingRequest,
        oldVerified: true,
        newVerified: false
      };
      prisma.phoneChangeRequest.findUnique
        .mockResolvedValueOnce(almostDoneRequest)
        .mockResolvedValueOnce(almostDoneRequest);

      prisma.user.findUnique.mockResolvedValueOnce(null); // uniqueness check in tx
      prisma.deal.findFirst.mockResolvedValueOnce(null); // deal guard in tx

      const res = await service.verifyNewPhoneOtp(
        mockUser.id,
        {
          requestId: 'req-1',
          code: '123456'
        },
        '10.0.0.1'
      );

      expect(res.code).toBe('AUTH_PHONE_CHANGE_SUCCESS');
      expect((res.data as any).isCompleted).toBe(true);
      expect((res.data as any).mobileNumber).toBe('+966598765432');

      // Verify User record updated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { mobileNumber: '+966598765432' }
      });

      // Verify AuditLog written
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: mockUser.id,
          actorType: 'USER',
          action: 'USER_PHONE_CHANGED',
          entityId: mockUser.id,
          payload: {
            oldPhoneNumber: '+966512345678',
            newPhoneNumber: '+966598765432',
            method: 'DUAL_OTP'
          }
        })
      });

      // Verify OTP records cleaned up
      expect(prisma.otpVerification.deleteMany).toHaveBeenCalled();
    });
  });

  describe('3. resendPhoneChangeOtp (AC: 4)', () => {
    it('dispatches fresh OTP when target is not yet verified', async () => {
      prisma.phoneChangeRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: mockUser.id,
        oldPhoneNumber: '+966512345678',
        newPhoneNumber: '+966598765432',
        oldVerified: false,
        newVerified: false,
        status: 'PENDING',
        expiresAt: new Date(mockDate.getTime() + 600 * 1000)
      });

      const res = await service.resendPhoneChangeOtp(mockUser.id, {
        requestId: 'req-1',
        target: 'OLD'
      });

      expect(res.code).toBe('SUCCESS');
      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        '+966512345678',
        'PHONE_CHANGE_OLD',
        { requestId: 'req-1' }
      );
    });

    it('rejects resend if target number is already verified', async () => {
      prisma.phoneChangeRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: mockUser.id,
        oldPhoneNumber: '+966512345678',
        newPhoneNumber: '+966598765432',
        oldVerified: true,
        newVerified: false,
        status: 'PENDING',
        expiresAt: new Date(mockDate.getTime() + 600 * 1000)
      });

      await expect(
        service.resendPhoneChangeOtp(mockUser.id, {
          requestId: 'req-1',
          target: 'OLD'
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. adminPhoneChange (Support-Assisted) (AC: 5)', () => {
    it('rejects if administrator is not SUPER_ADMIN (Risk R-09)', async () => {
      await expect(
        service.adminPhoneChange(
          'admin-mod',
          AdminRole.MODERATOR,
          mockUser.id,
          {
            newMobileNumber: '+966598765432',
            officialIdVerified: true,
            reason: 'تم التحقق من الهوية الوطنية والمستندات الرسمية بالفرع'
          },
          '1.1.1.1'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully executes support-assisted phone update for SUPER_ADMIN with audit log', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // lookup target user
        .mockResolvedValueOnce(null); // lookup new phone uniqueness

      prisma.deal.findFirst.mockResolvedValueOnce(null); // active deal check

      const res = await service.adminPhoneChange(
        'admin-super-1',
        AdminRole.SUPER_ADMIN,
        mockUser.id,
        {
          newMobileNumber: '+966598765432',
          officialIdVerified: true,
          reason: 'تم التحقق من بطاقة الهوية الوطنية والمستندات الرسمية بالفرع'
        },
        '1.1.1.1'
      );

      expect(res.code).toBe('ADMIN_PHONE_CHANGE_SUCCESS');
      expect(res.data.isCompleted).toBe(true);
      expect(res.data.mobileNumber).toBe('+966598765432');

      // Verify User record updated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { mobileNumber: '+966598765432' }
      });

      // Verify PhoneChangeRequest record created with isSupportAssisted: true
      expect(prisma.phoneChangeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          oldPhoneNumber: mockUser.mobileNumber,
          newPhoneNumber: '+966598765432',
          isSupportAssisted: true,
          adminId: 'admin-super-1',
          status: 'COMPLETED'
        })
      });

      // Verify AuditLog record created
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-super-1',
          actorType: 'ADMIN',
          action: 'ADMIN_PHONE_CHANGED',
          entityId: mockUser.id
        })
      });
    });
  });
});
