import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DEAL_PAYMENT_STATUS,
  DealStatus,
  ERROR_FILE_QUARANTINED,
  PAYMENT_CLAIMABLE_STATUSES,
  PAYMENT_FORCE_UNLOCK_REASON_REQUIRED,
  PAYMENT_LOCK_CONFLICT,
  PAYMENT_LOCK_DURATION_MS,
  PAYMENT_LOCK_EXPIRED,
  PAYMENT_LOCK_FORCE_UNLOCKED,
  PAYMENT_LOCK_REQUIRED,
  PAYMENT_MODERATION_RELEASED,
  PAYMENT_NOT_CLAIMABLE,
  PAYMENT_PROOF_CLAIMED,
  PAYMENT_PROOF_CONFIRMED,
  PAYMENT_PROOF_NOT_FOUND,
  PAYMENT_PROOF_REJECTED,
  PAYMENT_REJECTION_NOTE_REQUIRED,
  PAYMENT_SELF_APPROVAL_FORBIDDEN,
  PaymentType,
} from '@elmasaif/shared';
import { AdminPaymentsService } from '../admin-payments.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';

describe('AdminPaymentsService (Story 5.3) (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)', () => {
  let service: AdminPaymentsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;

  const mockNow = new Date('2026-11-07T12:00:00.000Z');
  const admin = {
    id: 'admin-auditor-1',
    username: 'auditor.one',
    email: 'auditor@elmasaif.sa',
    fullName: 'مدقق الإثباتات الأول',
    role: 'FINANCIAL_AUDITOR',
  };
  const otherAdmin = {
    id: 'admin-auditor-2',
    fullName: 'مدقق الإثباتات الثاني',
    username: 'auditor.two',
  };
  const approvingAdminId = 'super-admin-deal-approver';

  const paymentId = '11111111-1111-1111-1111-111111111111';
  const dealId = '22222222-2222-2222-2222-222222222222';

  const makeDeal = (overrides: Record<string, any> = {}) => ({
    id: dealId,
    dealNumber: 'D-202611-0001',
    dealReferenceCode: 'MSF-DEAL-0001',
    status: DealStatus.UNDER_ADMIN_AUDIT,
    approvedByAdminId: approvingAdminId,
    paymentDeadline: new Date('2026-11-08T12:00:00.000Z'),
    listing: {
      title: 'فيلا فاخرة في الطائف',
    },
    ...overrides,
  });

  const makePayment = (overrides: Record<string, any> = {}) => ({
    id: paymentId,
    dealId,
    paymentType: PaymentType.PLATFORM_COMMISSION,
    amount: '30000.00',
    status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
    proofFileUrl: 'file-obj-clean-uuid',
    bankReferenceCode: 'REF-123456',
    senderBankName: 'مصرف الراجحي',
    uploadedAt: new Date('2026-11-07T10:00:00.000Z'),
    verifiedByAdminId: null,
    verifiedAt: null,
    rejectionReason: null,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    createdAt: new Date('2026-11-07T09:00:00.000Z'),
    updatedAt: new Date('2026-11-07T10:00:00.000Z'),
    deal: makeDeal(),
    ...overrides,
  });

  const expectCode = (error: any, code: string) => {
    expect(error.getResponse().code).toBe(code);
  };

  beforeEach(async () => {
    const currentPayment = makePayment();
    clockService = { now: jest.fn(() => mockNow) };
    storageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://signed-s3.example.com/receipt.pdf'),
    };

    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: paymentId }]),
      payment: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...currentPayment })),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([{ ...currentPayment }])),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockImplementation(({ data }: any) => {
          Object.assign(currentPayment, data);
          return Promise.resolve({ count: 1 });
        }),
        update: jest.fn().mockImplementation(({ data }: any) => {
          Object.assign(currentPayment, data);
          return Promise.resolve({ ...currentPayment });
        }),
      },
      deal: {
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve(makeDeal(data)),
        ),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([
          { id: admin.id, fullName: admin.fullName },
          { id: otherAdmin.id, fullName: otherAdmin.fullName },
        ]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<AdminPaymentsService>(AdminPaymentsService);
  });

  describe('getQueue (AC-1: read never claims)', () => {
    it('returns paginated items with lock projection and deal summary, oldest-first', async () => {
      const result = await service.getQueue({ page: 1, limit: 10 }, admin.id);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(paymentId);
      expect(result.items[0].dealNumber).toBe('D-202611-0001');
      expect(result.items[0].propertyTitle).toBe('فيلا فاخرة في الطائف');
      expect(result.items[0].amount).toBe('30000.00');
      expect(result.items[0].lockInfo.isLocked).toBe(false);
      expect(result.meta.total).toBe(1);

      // Reads never take the lease (AC-1)
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('filters by status when provided in query', async () => {
      await service.getQueue({ status: DEAL_PAYMENT_STATUS.UNDER_REVIEW }, admin.id);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('getPayment (AC-1)', () => {
    it('returns payment slot detail with live lock info', async () => {
      const result = await service.getPayment(paymentId, admin.id);

      expect(result.id).toBe(paymentId);
      expect(result.dealStatus).toBe(DealStatus.UNDER_ADMIN_AUDIT);
      expect(result.lockInfo.isLocked).toBe(false);
      expect(result.serverNow).toBe(mockNow.toISOString());
    });

    it('throws 404 PAYMENT_NOT_FOUND when payment does not exist', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.getPayment('non-existent', admin.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('claimPayment (AC-2)', () => {
    it('atomically claims row for 15 minutes and advances PROOF_UPLOADED → UNDER_REVIEW', async () => {
      const result = await service.claimPayment(paymentId, admin as any);

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: paymentId,
          status: { in: [...PAYMENT_CLAIMABLE_STATUSES] },
          OR: [
            { lockedByAdminId: null },
            { lockExpiresAt: { lt: mockNow } },
            { lockedByAdminId: admin.id },
          ],
        },
        data: expect.objectContaining({
          lockedByAdminId: admin.id,
          lockedAt: mockNow,
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PAYMENT_PROOF_CLAIMED,
          entityType: 'Payment',
          entityId: paymentId,
        }),
      });

      expect(result.lockInfo.isLocked).toBe(true);
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
    });

    it('throws 409 PAYMENT_LOCK_CONFLICT when actively held by another admin', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      try {
        await service.claimPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_LOCK_CONFLICT);
      }
    });

    it('throws 409 PAYMENT_NOT_CLAIMABLE for terminal/undecidable payment (e.g. PENDING or CONFIRMED)', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({ status: DEAL_PAYMENT_STATUS.CONFIRMED }),
      );

      try {
        await service.claimPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_NOT_CLAIMABLE);
      }
    });
  });

  describe('heartbeatPayment (AC-7)', () => {
    it('extends the lease by 15 minutes when caller holds lease', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
        }),
      );

      const result = await service.heartbeatPayment(paymentId, admin as any);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: {
            lockExpiresAt: new Date(mockNow.getTime() + PAYMENT_LOCK_DURATION_MS),
          },
        }),
      );
      expect(result.id).toBe(paymentId);
    });

    it('throws 409 PAYMENT_LOCK_EXPIRED if lease expired before heartbeat', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() - 1000),
        }),
      );

      try {
        await service.heartbeatPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_LOCK_EXPIRED);
      }
    });

    it('throws 409 PAYMENT_LOCK_CONFLICT if lease held by another admin', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
        }),
      );

      try {
        await service.heartbeatPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_LOCK_CONFLICT);
      }
    });

    it('throws 409 PAYMENT_LOCK_REQUIRED if payment is not claimed at all', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: null,
          lockExpiresAt: null,
        }),
      );

      try {
        await service.heartbeatPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_LOCK_REQUIRED);
      }
    });
  });

  describe('releasePayment (AC-7)', () => {
    it('clears the lease without modifying payment status, writes audit log', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      await service.releasePayment(paymentId, admin as any);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          action: PAYMENT_MODERATION_RELEASED,
          entityType: 'Payment',
          entityId: paymentId,
        }),
      });
    });
  });

  describe('forceUnlockPayment (AC-7)', () => {
    it('breaks lease with mandatory reason (≥ 5 chars) and writes audit log', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      await service.forceUnlockPayment(
        paymentId,
        admin as any,
        'المشرف السابق غير متصل ويجب التدقيق العاجل',
      );

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: PAYMENT_LOCK_FORCE_UNLOCKED,
          entityType: 'Payment',
          entityId: paymentId,
        }),
      });
    });

    it('throws 400 PAYMENT_FORCE_UNLOCK_REASON_REQUIRED when reason is < 5 chars', async () => {
      try {
        await service.forceUnlockPayment(paymentId, admin as any, 'قفل');
        fail('Expected BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expectCode(err, PAYMENT_FORCE_UNLOCK_REASON_REQUIRED);
      }
    });
  });

  describe('confirmPayment (AC-3, AC-4, AC-6)', () => {
    it('confirms payment, releases lease, writes audit log, locks row with ::text', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      const result = await service.confirmPayment(paymentId, admin as any);

      // Row lock cast ::text (T-1)
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const rawCall = prisma.$queryRaw.mock.calls[0][0].join('?');
      expect(rawCall).toContain('::text');
      expect(rawCall).not.toContain('::uuid');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({
            status: DEAL_PAYMENT_STATUS.CONFIRMED,
            verifiedByAdminId: admin.id,
            verifiedAt: mockNow,
            lockedByAdminId: null,
          }),
        }),
      );

      // AC-4: Deal is NOT set to COMPLETED (Story 5.4 completes the deal)
      expect(prisma.deal.update).not.toHaveBeenCalled();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: PAYMENT_PROOF_CONFIRMED,
          entityType: 'Payment',
          entityId: paymentId,
        }),
      });
      expect(result.status).toBe(DEAL_PAYMENT_STATUS.CONFIRMED);
    });

    it('throws 403 PAYMENT_SELF_APPROVAL_FORBIDDEN when verifying admin approved the deal (FR-51)', async () => {
      const approvingAdmin = { ...admin, id: approvingAdminId };
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: approvingAdminId,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          deal: makeDeal({ approvedByAdminId: approvingAdminId }),
        }),
      );

      try {
        await service.confirmPayment(paymentId, approvingAdmin as any);
        fail('Expected ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expectCode(err, PAYMENT_SELF_APPROVAL_FORBIDDEN);
      }
    });

    it('throws 409 PAYMENT_NOT_CLAIMABLE if payment status is not UNDER_REVIEW', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      try {
        await service.confirmPayment(paymentId, admin as any);
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expectCode(err, PAYMENT_NOT_CLAIMABLE);
      }
    });
  });

  describe('rejectPayment (AC-3, AC-4, AC-6)', () => {
    it('rejects payment with note, moves deal to PAYMENT_REJECTED, releases lease', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          deal: makeDeal({ status: DealStatus.UNDER_ADMIN_AUDIT }),
        }),
      );

      const note = 'رقم الحساب المحول إليه لا يتطابق مع الحساب المعتمد';
      const result = await service.rejectPayment(paymentId, admin as any, note);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({
            status: DEAL_PAYMENT_STATUS.REJECTED,
            verifiedByAdminId: admin.id,
            verifiedAt: mockNow,
            rejectionReason: note,
            lockedByAdminId: null,
          }),
        }),
      );

      // Parent deal moves to PAYMENT_REJECTED (AC-4)
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: { status: DealStatus.PAYMENT_REJECTED },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: PAYMENT_PROOF_REJECTED,
          entityType: 'Payment',
          entityId: paymentId,
        }),
      });
      expect(result.status).toBe(DEAL_PAYMENT_STATUS.REJECTED);
    });

    it('throws 400 PAYMENT_REJECTION_NOTE_REQUIRED for empty or whitespace < 5 char reason', async () => {
      try {
        await service.rejectPayment(paymentId, admin as any, '  لا  ');
        fail('Expected BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expectCode(err, PAYMENT_REJECTION_NOTE_REQUIRED);
      }
    });

    it('throws 403 PAYMENT_SELF_APPROVAL_FORBIDDEN on reject when admin approved deal', async () => {
      const approvingAdmin = { ...admin, id: approvingAdminId };
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          lockedByAdminId: approvingAdminId,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          deal: makeDeal({ approvedByAdminId: approvingAdminId }),
        }),
      );

      try {
        await service.rejectPayment(paymentId, approvingAdmin as any, 'إيصال غير صالح ومرفوض');
        fail('Expected ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expectCode(err, PAYMENT_SELF_APPROVAL_FORBIDDEN);
      }
    });
  });

  describe('getProofDownloadUrl (AC-9)', () => {
    it('returns presigned download URL with 300 s expiration', async () => {
      const result = await service.getProofDownloadUrl(paymentId);

      expect(storageService.getVerifiedDownloadUrl).toHaveBeenCalledWith(
        'file-obj-clean-uuid',
        300,
      );
      expect(result.downloadUrl).toBe('https://signed-s3.example.com/receipt.pdf');
      expect(result.expiresInSeconds).toBe(300);
    });

    it('throws 404 PAYMENT_PROOF_NOT_FOUND when payment has no receipt uploaded', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        makePayment({ proofFileUrl: null }),
      );

      try {
        await service.getProofDownloadUrl(paymentId);
        fail('Expected NotFoundException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        expectCode(err, PAYMENT_PROOF_NOT_FOUND);
      }
    });

    it('throws 403 ERROR_FILE_QUARANTINED when storage indicates quarantined file', async () => {
      storageService.getVerifiedDownloadUrl.mockRejectedValue(
        new ForbiddenException('File is quarantined or has not passed malware scan verification'),
      );

      try {
        await service.getProofDownloadUrl(paymentId);
        fail('Expected ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expectCode(err, ERROR_FILE_QUARANTINED);
      }
    });
  });
});
