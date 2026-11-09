import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DealStatus,
  ListingStatus,
  UserRole,
  DEAL_NOT_FOUND,
  DEAL_CANCEL_NOT_PARTY,
  DEAL_CANCEL_INVALID_STATE,
  DEAL_CANCEL_PROOF_EXISTS,
  SELLER_CANCEL_REQUEST_PENDING,
  SELLER_CANCEL_REQUEST_NOT_FOUND,
  DEAL_CANCELLED_BY_BUYER,
  SELLER_CANCELLATION_REQUESTED,
  DEAL_CANCELLED_BY_SELLER,
  SELLER_CANCELLATION_REJECTED,
  DEAL_CANCEL_REASON_BUYER,
  DEAL_CANCEL_REASON_SELLER,
  DEAL_PAYMENT_STATUS,
} from '@elmasaif/shared';
import { DealsCancellationService } from '../deals-cancellation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

describe('DealsCancellationService (Story 5.6)', () => {
  let service: DealsCancellationService;
  let prisma: any;
  let clockService: any;

  const mockNow = new Date('2026-11-08T12:00:00.000Z');

  const buyerProfile = { id: 'prof-buyer-1', userId: 'user-buyer-1', role: UserRole.BUYER };
  const sellerProfile = { id: 'prof-seller-1', userId: 'user-seller-1', role: UserRole.MARKETER };

  const activeDealWithPendingPayments: any = {
    id: 'deal-123',
    dealNumber: 'DL-20261108-0000000001',
    listingId: 'listing-456',
    buyerProfileId: buyerProfile.id,
    sellerProfileId: sellerProfile.id,
    status: DealStatus.AWAITING_PAYMENT_PROOF,
    sellerCancellationRequestedAt: null,
    sellerCancellationReason: null,
    version: 1,
    payments: [
      { id: 'pay-comm', status: DEAL_PAYMENT_STATUS.PENDING },
      { id: 'pay-price', status: DEAL_PAYMENT_STATUS.PENDING },
    ],
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
      userProfile: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsCancellationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<DealsCancellationService>(DealsCancellationService);
  });

  describe('cancelByBuyer', () => {
    it('cancels deal atomically when status is AWAITING_PAYMENT_PROOF and 0 proofs uploaded', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue(activeDealWithPendingPayments);
      prisma.deal.update.mockResolvedValue({
        ...activeDealWithPendingPayments,
        status: DealStatus.CANCELLED,
      });

      const result = await service.cancelByBuyer(
        buyerProfile.userId,
        UserRole.BUYER,
        'deal-123',
        { reason: 'Buyer decision' },
      );

      expect(result.status).toBe(DealStatus.CANCELLED);
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-123' },
          data: expect.objectContaining({
            status: DealStatus.CANCELLED,
            cancellationReason: DEAL_CANCEL_REASON_BUYER,
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-456' },
        data: { status: ListingStatus.ACTIVE, version: { increment: 1 } },
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { dealId: 'deal-123' },
        data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_CANCELLED_BY_BUYER,
            actorId: buyerProfile.userId,
            actorType: 'USER',
            entityType: 'Deal',
            entityId: 'deal-123',
          }),
        }),
      );
    });

    it('rejects if caller is not the buyer', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({ id: 'other-prof', userId: 'other-user', role: UserRole.BUYER });
      prisma.deal.findUnique.mockResolvedValue(activeDealWithPendingPayments);

      await expect(
        service.cancelByBuyer('other-user', UserRole.BUYER, 'deal-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if deal not found', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelByBuyer(buyerProfile.userId, UserRole.BUYER, 'deal-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if deal is not in AWAITING_PAYMENT_PROOF', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue({
        ...activeDealWithPendingPayments,
        status: DealStatus.UNDER_ADMIN_AUDIT,
      });

      await expect(
        service.cancelByBuyer(buyerProfile.userId, UserRole.BUYER, 'deal-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects if any payment proof has been uploaded', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(buyerProfile);
      prisma.deal.findUnique.mockResolvedValue({
        ...activeDealWithPendingPayments,
        payments: [
          { id: 'pay-comm', status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED },
          { id: 'pay-price', status: DEAL_PAYMENT_STATUS.PENDING },
        ],
      });

      await expect(
        service.cancelByBuyer(buyerProfile.userId, UserRole.BUYER, 'deal-123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('requestSellerCancellation', () => {
    it('sets seller cancellation requested timestamp and reason', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(sellerProfile);
      prisma.deal.findUnique.mockResolvedValue(activeDealWithPendingPayments);
      prisma.deal.update.mockResolvedValue({
        ...activeDealWithPendingPayments,
        sellerCancellationRequestedAt: mockNow,
        sellerCancellationReason: 'Title defect found',
      });

      const result = await service.requestSellerCancellation(
        sellerProfile.userId,
        UserRole.MARKETER,
        'deal-123',
        { reason: 'Title defect found' },
      );

      expect(result.sellerCancellationReason).toBe('Title defect found');
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-123' },
          data: expect.objectContaining({
            sellerCancellationRequestedAt: mockNow,
            sellerCancellationReason: 'Title defect found',
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SELLER_CANCELLATION_REQUESTED,
            actorId: sellerProfile.userId,
          }),
        }),
      );
    });

    it('rejects if caller is not the seller', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({ id: 'wrong-prof', userId: 'wrong-user', role: UserRole.MARKETER });
      prisma.deal.findUnique.mockResolvedValue(activeDealWithPendingPayments);

      await expect(
        service.requestSellerCancellation('wrong-user', UserRole.MARKETER, 'deal-123', {
          reason: 'Reason 12345',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if a request is already pending', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(sellerProfile);
      prisma.deal.findUnique.mockResolvedValue({
        ...activeDealWithPendingPayments,
        sellerCancellationRequestedAt: new Date(),
        sellerCancellationReason: 'Earlier reason',
      });

      await expect(
        service.requestSellerCancellation(sellerProfile.userId, UserRole.MARKETER, 'deal-123', {
          reason: 'New reason 12345',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approveSellerCancellation', () => {
    it('cancels deal, reverts listing, expires payments, and writes audit log', async () => {
      const dealWithPendingRequest = {
        ...activeDealWithPendingPayments,
        sellerCancellationRequestedAt: new Date('2026-11-08T10:00:00.000Z'),
        sellerCancellationReason: 'Need to cancel',
      };
      prisma.deal.findUnique.mockResolvedValue(dealWithPendingRequest);
      prisma.deal.update.mockResolvedValue({
        ...dealWithPendingRequest,
        status: DealStatus.CANCELLED,
      });

      const result = await service.approveSellerCancellation('admin-1', 'deal-123');

      expect(result.status).toBe(DealStatus.CANCELLED);
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-123' },
          data: expect.objectContaining({
            status: DealStatus.CANCELLED,
            cancellationReason: DEAL_CANCEL_REASON_SELLER,
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-456' },
        data: { status: ListingStatus.ACTIVE, version: { increment: 1 } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: DEAL_CANCELLED_BY_SELLER,
            actorId: 'admin-1',
            actorType: 'ADMIN',
          }),
        }),
      );
    });

    it('rejects if deal has no pending cancellation request', async () => {
      prisma.deal.findUnique.mockResolvedValue(activeDealWithPendingPayments);

      await expect(
        service.approveSellerCancellation('admin-1', 'deal-123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectSellerCancellation', () => {
    it('clears cancellation request and writes rejection audit log with note', async () => {
      const dealWithPendingRequest = {
        ...activeDealWithPendingPayments,
        sellerCancellationRequestedAt: new Date('2026-11-08T10:00:00.000Z'),
        sellerCancellationReason: 'Need to cancel',
      };
      prisma.deal.findUnique.mockResolvedValue(dealWithPendingRequest);
      prisma.deal.update.mockResolvedValue({
        ...dealWithPendingRequest,
        sellerCancellationRequestedAt: null,
        sellerCancellationReason: null,
      });

      const result = await service.rejectSellerCancellation('admin-1', 'deal-123', {
        note: 'Insufficient reason provided',
      });

      expect(result.dealId).toBe('deal-123');
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-123' },
          data: expect.objectContaining({
            sellerCancellationRequestedAt: null,
            sellerCancellationReason: null,
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SELLER_CANCELLATION_REJECTED,
            actorId: 'admin-1',
            actorType: 'ADMIN',
            payload: expect.objectContaining({
              note: 'Insufficient reason provided',
            }),
          }),
        }),
      );
    });
  });
});

