import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DealStatus,
  ListingStatus,
  UserRole,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_TERMINAL,
  DISPUTE_PROOF_REQUIRED,
  DISPUTE_ALREADY_OPEN,
  DISPUTE_NOT_FOUND,
  DISPUTE_LOCK_CONFLICT,
  DISPUTE_LOCK_REQUIRED,
  DISPUTE_LOCK_EXPIRED,
  DISPUTE_STATUS,
  DISPUTE_RESOLUTION_ACTION,
  DEAL_DISPUTED,
  DEAL_DISPUTE_CLAIMED,
  DEAL_DISPUTE_RESOLVED_COMPLETED,
  DEAL_DISPUTE_RESOLVED_CANCELLED,
  DEAL_DISPUTE_RETURNED_TO_REVIEW,
  DEAL_PAYMENT_STATUS,
  DISPUTE_LOCK_DURATION_MS,
} from '@elmasaif/shared';
import { DisputesService } from '../disputes.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { DealCompletionService } from '../deal-completion.service';

describe('DisputesService (Story 5.6)', () => {
  let service: DisputesService;
  let prisma: any;
  let clockService: any;
  let dealCompletionService: any;

  const mockNow = new Date('2026-11-08T14:00:00.000Z');
  const buyerProfile = { id: 'prof-buyer-1', userId: 'user-buyer-1', role: UserRole.BUYER };
  const sellerProfile = { id: 'prof-seller-1', userId: 'user-seller-1', role: UserRole.MARKETER };

  const dealWithProof: any = {
    id: 'deal-1',
    dealNumber: 'DL-20261108-0000000001',
    listingId: 'listing-1',
    buyerProfileId: buyerProfile.id,
    sellerProfileId: sellerProfile.id,
    status: DealStatus.AWAITING_PAYMENT_PROOF,
    version: 1,
    payments: [
      { id: 'pay-1', status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED, type: 'PLATFORM_COMMISSION' },
      { id: 'pay-2', status: DEAL_PAYMENT_STATUS.PENDING, type: 'SELLER_PURCHASE_PRICE' },
    ],
    disputes: [],
  };

  const openDispute: any = {
    id: 'disp-1',
    dealId: 'deal-1',
    initiatorId: 'user-buyer-1',
    reason: 'Payment reference was mismatched by recipient bank',
    status: DISPUTE_STATUS.OPEN,
    lockedByAdminId: 'admin-1',
    lockedAt: mockNow,
    lockExpiresAt: new Date(mockNow.getTime() + DISPUTE_LOCK_DURATION_MS),
    deal: dealWithProof,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
      deal: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        update: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
      dispute: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userProfile: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', fullName: 'Super Admin' }]),
      },
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    dealCompletionService = {
      completeDealInTransaction: jest.fn().mockResolvedValue({ status: DealStatus.COMPLETED }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: DealCompletionService, useValue: dealCompletionService },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  describe('fileDispute', () => {
    it('creates dispute and transitions deal to DISPUTED when proof exists and caller is party', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue(dealWithProof);
      prisma.deal.update.mockResolvedValue({ ...dealWithProof, status: DealStatus.DISPUTED });
      prisma.dispute.create.mockResolvedValue(openDispute);

      const result = await service.fileDispute(
        buyerProfile.userId,
        UserRole.BUYER,
        'deal-1',
        { reason: 'Payment reference was mismatched by recipient bank' },
      );

      expect(result.status).toBe(DealStatus.DISPUTED);
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1' },
          data: expect.objectContaining({
            status: DealStatus.DISPUTED,
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            initiatorId: buyerProfile.userId,
            reason: 'Payment reference was mismatched by recipient bank',
            status: DISPUTE_STATUS.OPEN,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_DISPUTED,
            actorId: buyerProfile.userId,
            entityType: 'Dispute',
          }),
        }),
      );
    });

    it('rejects dispute if caller is neither buyer nor seller', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({ id: 'stranger-prof', userId: 'stranger', role: UserRole.BUYER });
      prisma.deal.findUnique.mockResolvedValue(dealWithProof);

      await expect(
        service.fileDispute('stranger', UserRole.BUYER, 'deal-1', {
          reason: 'Some dispute reason',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects dispute if 0 proofs have been uploaded', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue({
        ...dealWithProof,
        payments: [
          { id: 'pay-1', status: DEAL_PAYMENT_STATUS.PENDING },
          { id: 'pay-2', status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      });

      await expect(
        service.fileDispute(buyerProfile.userId, UserRole.BUYER, 'deal-1', {
          reason: 'Some dispute reason',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects dispute if an active dispute is already open', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue({
        ...dealWithProof,
        disputes: [{ id: 'disp-old', status: DISPUTE_STATUS.OPEN }],
      });

      await expect(
        service.fileDispute(buyerProfile.userId, UserRole.BUYER, 'deal-1', {
          reason: 'Another dispute reason',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('claimDispute & Lock Management', () => {
    it('claims an unlocked dispute with 15-minute lease', async () => {
      const unlockedDispute = { ...openDispute, lockedByAdminId: null, lockExpiresAt: null };
      prisma.dispute.findUnique.mockResolvedValue(unlockedDispute);
      prisma.dispute.update.mockResolvedValue({
        ...unlockedDispute,
        lockedByAdminId: 'admin-1',
        lockedAt: mockNow,
        lockExpiresAt: new Date(mockNow.getTime() + DISPUTE_LOCK_DURATION_MS),
      });

      const result = await service.claimDispute('disp-1', 'admin-1');

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'disp-1' },
          data: expect.objectContaining({
            lockedByAdminId: 'admin-1',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_DISPUTE_CLAIMED,
            actorId: 'admin-1',
          }),
        }),
      );
    });

    it('rejects claim when locked by another admin within active lease', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...openDispute,
        lockedByAdminId: 'admin-2',
        lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
      });

      await expect(service.claimDispute('disp-1', 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('renews lock held by current admin', async () => {
      prisma.dispute.findUnique.mockResolvedValue(openDispute);
      prisma.dispute.update.mockResolvedValue({
        ...openDispute,
        lockExpiresAt: new Date(mockNow.getTime() + DISPUTE_LOCK_DURATION_MS),
      });

      const result = await service.renewDisputeLock('disp-1', 'admin-1');
      expect(prisma.dispute.update).toHaveBeenCalled();
    });

    it('releases lock held by current admin', async () => {
      prisma.dispute.findUnique.mockResolvedValue(openDispute);
      prisma.dispute.update.mockResolvedValue({
        ...openDispute,
        lockedByAdminId: null,
        lockExpiresAt: null,
      });

      const result = await service.releaseDisputeLock('disp-1', 'admin-1');
      expect(result.released).toBe(true);
    });
  });

  describe('adjudicateDispute', () => {
    const adminActor: any = { id: 'admin-1', fullName: 'Super Admin' };

    it('Verdict 1 (COMPLETE): delegates to DealCompletionService and resolves dispute', async () => {
      prisma.dispute.findUnique.mockResolvedValue(openDispute);
      prisma.dispute.update.mockResolvedValue({
        ...openDispute,
        status: DISPUTE_STATUS.RESOLVED,
        resolutionAction: DISPUTE_RESOLUTION_ACTION.COMPLETE,
      });

      const result = await service.adjudicateDispute('disp-1', adminActor, {
        action: DISPUTE_RESOLUTION_ACTION.COMPLETE,
        notes: 'Transfer verified by treasury',
      });

      expect(result.action).toBe('COMPLETE');
      expect(result.status).toBe('RESOLVED');
      expect(dealCompletionService.completeDealInTransaction).toHaveBeenCalledWith(
        'deal-1',
        adminActor,
        expect.anything(),
      );
      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DISPUTE_STATUS.RESOLVED,
            resolutionAction: DISPUTE_RESOLUTION_ACTION.COMPLETE,
            resolutionNotes: 'Transfer verified by treasury',
            resolvedByAdminId: 'admin-1',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_DISPUTE_RESOLVED_COMPLETED,
            actorId: 'admin-1',
          }),
        }),
      );
    });

    it('Verdict 2 (CANCEL): cancels deal, reverts listing, expires payments and resolves dispute', async () => {
      prisma.dispute.findUnique.mockResolvedValue(openDispute);
      prisma.deal.update.mockResolvedValue({ ...dealWithProof, status: DealStatus.CANCELLED });
      prisma.dispute.update.mockResolvedValue({
        ...openDispute,
        status: DISPUTE_STATUS.RESOLVED,
        resolutionAction: DISPUTE_RESOLUTION_ACTION.CANCEL,
      });

      const result = await service.adjudicateDispute('disp-1', adminActor, {
        action: DISPUTE_RESOLUTION_ACTION.CANCEL,
        notes: 'Irreconcilable dispute over boundary survey',
      });

      expect(result.action).toBe('CANCEL');
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1' },
          data: expect.objectContaining({
            status: DealStatus.CANCELLED,
            cancellationReason: 'CANCELLED_BY_ADMIN',
          }),
        }),
      );
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: { status: ListingStatus.ACTIVE, version: { increment: 1 } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_DISPUTE_RESOLVED_CANCELLED,
            actorId: 'admin-1',
          }),
        }),
      );
    });

    it('Verdict 3 (RETURN_TO_REVIEW): resets status to UNDER_ADMIN_AUDIT with extended deadline', async () => {
      prisma.dispute.findUnique.mockResolvedValue(openDispute);
      prisma.deal.update.mockResolvedValue({ ...dealWithProof, status: DealStatus.UNDER_ADMIN_AUDIT });
      prisma.dispute.update.mockResolvedValue({
        ...openDispute,
        status: DISPUTE_STATUS.RESOLVED,
        resolutionAction: DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW,
      });

      const result = await service.adjudicateDispute('disp-1', adminActor, {
        action: DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW,
        notes: 'Requesting original stamp receipt from bank within 48 hours',
        newDeadlineHours: 48,
      });

      expect(result.action).toBe('RETURN_TO_REVIEW');
      const expectedDeadline = new Date(mockNow.getTime() + 48 * 3600 * 1000);
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1' },
          data: expect.objectContaining({
            status: DealStatus.UNDER_ADMIN_AUDIT,
            paymentDeadline: expectedDeadline,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_DISPUTE_RETURNED_TO_REVIEW,
            actorId: 'admin-1',
          }),
        }),
      );
    });
  });
});

