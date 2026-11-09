import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
  DEAL_CANCELLED_BY_TIMEOUT,
  DEAL_NOT_FOUND,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  ListingStatus,
  PaymentType,
} from '@elmasaif/shared';
import { DealTimeoutService } from '../deal-timeout.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

describe('DealTimeoutService (Story 5.5) (AC: 2, 3, 4, 5, 6, 7)', () => {
  let service: DealTimeoutService;
  let prisma: any;
  let clockService: any;

  const mockNow = new Date('2026-11-08T12:00:00.000Z');
  const pastDeadline = new Date('2026-11-08T11:00:00.000Z');
  const dealId = 'deal-uuid-1';
  const listingId = 'listing-uuid-1';

  const makeMockDeal = (overrides: Record<string, any> = {}) => ({
    id: dealId,
    dealNumber: 'DL-20261108-0001',
    listingId,
    status: DealStatus.AWAITING_PAYMENT_PROOF,
    paymentDeadline: pastDeadline,
    version: 1,
    payments: [
      {
        id: 'pay-1',
        paymentType: PaymentType.PLATFORM_COMMISSION,
        status: DEAL_PAYMENT_STATUS.PENDING,
        amount: '50000.00',
      },
      {
        id: 'pay-2',
        paymentType: PaymentType.SELLER_PURCHASE_PRICE,
        status: DEAL_PAYMENT_STATUS.PENDING,
        amount: '2000000.00',
      },
    ],
    disputes: [],
    listing: {
      id: listingId,
      status: ListingStatus.RESERVED,
      version: 1,
    },
    ...overrides,
  });

  let mockTx: any;

  beforeEach(async () => {
    clockService = {
      now: jest.fn(() => mockNow),
    };

    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      deal: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...makeMockDeal(),
          ...data,
        })),
      },
      listing: {
        update: jest.fn().mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE }),
      },
      payment: {
        update: jest.fn().mockImplementation(({ where, data }) => ({
          id: where.id,
          ...data,
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    prisma = {
      $transaction: jest.fn((callback) => callback(mockTx)),
      deal: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealTimeoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<DealTimeoutService>(DealTimeoutService);
  });

  describe('cancelDealByTimeout', () => {
    it('throws NotFoundException when deal does not exist', async () => {
      mockTx.deal.findUnique.mockResolvedValue(null);

      await expect(service.cancelDealByTimeout('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns without modifications if deal is already CANCELLED (idempotent)', async () => {
      mockTx.deal.findUnique.mockResolvedValue(
        makeMockDeal({ status: DealStatus.CANCELLED }),
      );

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('ALREADY_CANCELLED');
      expect(mockTx.deal.update).not.toHaveBeenCalled();
      expect(mockTx.listing.update).not.toHaveBeenCalled();
    });

    it('returns without modifications if deal is in another terminal status (COMPLETED)', async () => {
      mockTx.deal.findUnique.mockResolvedValue(
        makeMockDeal({ status: DealStatus.COMPLETED }),
      );

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('DEAL_TERMINAL');
      expect(mockTx.deal.update).not.toHaveBeenCalled();
    });

    it('Gate 1: skips cancellation when deal has an OPEN dispute', async () => {
      mockTx.deal.findUnique.mockResolvedValue(
        makeMockDeal({ disputes: [{ id: 'disp-1', status: 'OPEN' }] }),
      );

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('ACTIVE_DISPUTE');
      expect(mockTx.deal.update).not.toHaveBeenCalled();
    });

    it('Gate 2: skips cancellation when any payment has PROOF_UPLOADED or UNDER_REVIEW', async () => {
      mockTx.deal.findUnique.mockResolvedValue(
        makeMockDeal({
          payments: [
            {
              id: 'pay-1',
              paymentType: PaymentType.PLATFORM_COMMISSION,
              status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
            },
            {
              id: 'pay-2',
              paymentType: PaymentType.SELLER_PURCHASE_PRICE,
              status: DEAL_PAYMENT_STATUS.PENDING,
            },
          ],
        }),
      );

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('PAYMENT_UNDER_REVIEW');
      expect(mockTx.deal.update).not.toHaveBeenCalled();
    });

    it('Gate 3: skips cancellation when rejected payment is within 12-hour grace period', async () => {
      // Rejection at 11:30 (after 11:00 deadline). Grace ends at 23:30.
      // Current mockNow is 12:00 (within grace window).
      mockTx.deal.findUnique.mockResolvedValue(
        makeMockDeal({
          status: DealStatus.PAYMENT_REJECTED,
          payments: [
            {
              id: 'pay-1',
              paymentType: PaymentType.PLATFORM_COMMISSION,
              status: DEAL_PAYMENT_STATUS.REJECTED,
              verifiedAt: new Date('2026-11-08T11:30:00.000Z'),
            },
            {
              id: 'pay-2',
              paymentType: PaymentType.SELLER_PURCHASE_PRICE,
              status: DEAL_PAYMENT_STATUS.PENDING,
            },
          ],
        }),
      );

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.reason).toBe('PAYMENT_IN_GRACE_PERIOD');
      expect(mockTx.deal.update).not.toHaveBeenCalled();
    });

    it('cancels deal, reverts listing to ACTIVE, expires payments, and writes audit log on standard timeout', async () => {
      const deal = makeMockDeal();
      mockTx.deal.findUnique.mockResolvedValue(deal);

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(true);
      expect(result.outcome).toBe('BOTH_EXPIRED');

      // Verify row locks executed in order (deal -> listing -> payments)
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);

      // Verify deal updated to CANCELLED with incremented version
      expect(mockTx.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: {
          status: DealStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      // Verify listing reverted to ACTIVE with incremented version
      expect(mockTx.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
        },
      });

      // Verify payments expired
      expect(mockTx.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
      });
      expect(mockTx.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-2' },
        data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
      });

      // Verify audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: DEAL_CANCELLED_BY_TIMEOUT,
          entityType: 'Deal',
          entityId: dealId,
          payload: {
            dealId,
            dealNumber: deal.dealNumber,
            listingId,
            reason: DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
            cancelledAt: mockNow.toISOString(),
          },
        },
      });
    });

    it('Outcome B (OQ-13): cancels deal, reverts listing, and flags for Super Admin commission refund review when commission is CONFIRMED and price is EXPIRED', async () => {
      const deal = makeMockDeal({
        payments: [
          {
            id: 'pay-1',
            paymentType: PaymentType.PLATFORM_COMMISSION,
            status: DEAL_PAYMENT_STATUS.CONFIRMED,
          },
          {
            id: 'pay-2',
            paymentType: PaymentType.SELLER_PURCHASE_PRICE,
            status: DEAL_PAYMENT_STATUS.PENDING,
          },
        ],
      });
      mockTx.deal.findUnique.mockResolvedValue(deal);

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(true);
      expect(result.outcome).toBe('COMMISSION_CONFIRMED_PRICE_EXPIRED');

      expect(mockTx.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: {
          status: DealStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      expect(mockTx.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
        },
      });

      // Only pay-2 (price) is updated to EXPIRED
      expect(mockTx.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-2' },
        data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
      });

      // Audit log has refund flag
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: DEAL_CANCELLED_BY_TIMEOUT,
          entityType: 'Deal',
          entityId: dealId,
          payload: {
            dealId,
            dealNumber: deal.dealNumber,
            listingId,
            reason: DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
            cancelledAt: mockNow.toISOString(),
            flag: 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED',
          },
        },
      });
    });

    it('Outcome C (AC-6): auto-escalates to Dispute with status DISPUTED when price is CONFIRMED and commission is EXPIRED', async () => {
      const deal = makeMockDeal({
        payments: [
          {
            id: 'pay-1',
            paymentType: PaymentType.PLATFORM_COMMISSION,
            status: DEAL_PAYMENT_STATUS.PENDING,
          },
          {
            id: 'pay-2',
            paymentType: PaymentType.SELLER_PURCHASE_PRICE,
            status: DEAL_PAYMENT_STATUS.CONFIRMED,
          },
        ],
      });
      mockTx.deal.findUnique.mockResolvedValue(deal);
      mockTx.dispute = { create: jest.fn().mockResolvedValue({ id: 'disp-auto-1' }) };

      const result = await service.cancelDealByTimeout(dealId);

      expect(result.cancelled).toBe(false);
      expect(result.outcome).toBe('PRICE_CONFIRMED_COMMISSION_EXPIRED');
      expect(result.reason).toBe('ANOMALY_ESCALATED_TO_DISPUTE');

      expect(mockTx.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: {
          status: DealStatus.DISPUTED,
          version: { increment: 1 },
        },
      });

      expect(mockTx.dispute.create).toHaveBeenCalledWith({
        data: {
          dealId,
          initiatorId: 'SYSTEM',
          reason: 'PRICE_CONFIRMED_COMMISSION_EXPIRED',
          status: 'OPEN',
        },
      });
    });

    it('rolls back completely if any sub-operation fails inside transaction', async () => {
      mockTx.deal.findUnique.mockResolvedValue(makeMockDeal());
      mockTx.deal.update.mockRejectedValue(new Error('DB connection failure'));

      await expect(service.cancelDealByTimeout(dealId)).rejects.toThrow(
        'DB connection failure',
      );
    });
  });

  describe('sweepExpiredDeals', () => {
    it('queries candidate deals and executes cancellation per eligible deal', async () => {
      prisma.deal.findMany.mockResolvedValue([
        { id: 'deal-1' },
        { id: 'deal-2' },
      ]);

      mockTx.deal.findUnique
        .mockResolvedValueOnce(makeMockDeal({ id: 'deal-1' }))
        .mockResolvedValueOnce(
          makeMockDeal({
            id: 'deal-2',
            payments: [
              {
                id: 'pay-1',
                paymentType: PaymentType.PLATFORM_COMMISSION,
                status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
              },
            ],
          }),
        );

      const result = await service.sweepExpiredDeals();

      expect(prisma.deal.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: [...ACTIVE_DEAL_STATUSES] },
          paymentDeadline: { lte: mockNow },
        },
        select: { id: true },
      });

      expect(result.processedCount).toBe(2);
      expect(result.cancelledDealsCount).toBe(1);
      expect(result.skippedDealsCount).toBe(1);
      expect(result.results).toHaveLength(2);
    });
  });
});
