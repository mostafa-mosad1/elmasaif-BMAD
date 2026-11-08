import { describe, it, expect, vi } from 'vitest';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_CANCEL_REASON_PAYMENT_TIMEOUT,
  DEAL_CANCELLED_BY_TIMEOUT,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  ListingStatus,
  PaymentType,
} from '@elmasaif/shared';
import {
  createPaymentDeadlineExpiryLogic,
  type PaymentDeadlineExpiryDbClient,
} from '../payment-deadline-expiry.job';

describe('Story 5.5: Payment Deadline Expiry Worker Sweep', () => {
  const baseTime = new Date('2026-11-08T12:00:00.000Z');
  const pastDeadline = new Date('2026-11-08T11:00:00.000Z');

  const createMockDb = (deals: any[]): { db: PaymentDeadlineExpiryDbClient; calls: any } => {
    const calls = {
      dealUpdates: [] as any[],
      listingUpdates: [] as any[],
      paymentUpdates: [] as any[],
      auditLogs: [] as any[],
    };

    const db: PaymentDeadlineExpiryDbClient = {
      deal: {
        findMany: vi.fn().mockResolvedValue(deals),
        update: vi.fn().mockImplementation((args) => {
          calls.dealUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      listing: {
        update: vi.fn().mockImplementation((args) => {
          calls.listingUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      payment: {
        update: vi.fn().mockImplementation((args) => {
          calls.paymentUpdates.push(args);
          return Promise.resolve(args);
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation((args) => {
          calls.auditLogs.push(args);
          return Promise.resolve(args);
        }),
      },
    };

    return { db, calls };
  };

  it('completes immediately with processedCount: 0 when no candidate deals exist', async () => {
    const { db } = createMockDb([]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(0);
    expect(result.details?.cancelledDealsCount).toBe(0);
    expect(result.details?.expiredPaymentsCount).toBe(0);
    expect(db.deal.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [...ACTIVE_DEAL_STATUSES] },
        paymentDeadline: { lte: baseTime },
      },
      include: {
        payments: true,
        disputes: true,
        listing: true,
      },
    });
  });

  it('skips deals past deadline that have an OPEN dispute (Gate 1)', async () => {
    const disputedDeal = {
      id: 'deal-disputed',
      dealNumber: 'DL-20261108-001',
      listingId: 'listing-001',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: pastDeadline,
      payments: [
        { id: 'pay-1', paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PENDING },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [{ id: 'disp-1', status: 'OPEN' }],
    };

    const { db, calls } = createMockDb([disputedDeal]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(0);
    expect(calls.dealUpdates).toHaveLength(0);
    expect(calls.listingUpdates).toHaveLength(0);
    expect(calls.paymentUpdates).toHaveLength(0);
  });

  it('skips deals where ANY payment has proof uploaded or is under review (Gate 2)', async () => {
    const dealWithUploadedProof = {
      id: 'deal-proof-uploaded',
      dealNumber: 'DL-20261108-002',
      listingId: 'listing-002',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: pastDeadline,
      payments: [
        { id: 'pay-1', paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    const dealUnderReview = {
      id: 'deal-under-review',
      dealNumber: 'DL-20261108-003',
      listingId: 'listing-003',
      status: DealStatus.UNDER_ADMIN_AUDIT,
      paymentDeadline: pastDeadline,
      payments: [
        { id: 'pay-3', paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.UNDER_REVIEW },
        { id: 'pay-4', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    const { db, calls } = createMockDb([dealWithUploadedProof, dealUnderReview]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(0);
    expect(calls.dealUpdates).toHaveLength(0);
    expect(calls.listingUpdates).toHaveLength(0);
  });

  it('skips deals where rejected payment is still inside 12-hour grace period (Gate 3)', async () => {
    // Rejection happened at 11:30 (past deadline 11:00). 12h grace ends at 23:30.
    const dealInGrace = {
      id: 'deal-in-grace',
      dealNumber: 'DL-20261108-004',
      listingId: 'listing-004',
      status: DealStatus.PAYMENT_REJECTED,
      paymentDeadline: pastDeadline,
      payments: [
        {
          id: 'pay-1',
          paymentType: PaymentType.PLATFORM_COMMISSION,
          status: DEAL_PAYMENT_STATUS.REJECTED,
          verifiedAt: new Date('2026-11-08T11:30:00.000Z'),
        },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    // Current time is 12:00 (only 30 mins into grace)
    const { db, calls } = createMockDb([dealInGrace]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(0);
    expect(calls.dealUpdates).toHaveLength(0);
  });

  it('cancels deal, reverts listing, and expires payments when 12-hour grace period elapsed', async () => {
    // Rejection happened on Nov 7 at 11:30. 12h grace ended at 23:30 Nov 7.
    // Current time is 12:00 Nov 8 (well past 12 hours).
    const dealPastGrace = {
      id: 'deal-past-grace',
      dealNumber: 'DL-20261108-005',
      listingId: 'listing-005',
      status: DealStatus.PAYMENT_REJECTED,
      paymentDeadline: new Date('2026-11-07T11:00:00.000Z'),
      payments: [
        {
          id: 'pay-1',
          paymentType: PaymentType.PLATFORM_COMMISSION,
          status: DEAL_PAYMENT_STATUS.REJECTED,
          verifiedAt: new Date('2026-11-07T11:30:00.000Z'),
        },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    const { db, calls } = createMockDb([dealPastGrace]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(1);
    expect(calls.dealUpdates).toEqual([
      {
        where: { id: 'deal-past-grace' },
        data: {
          status: DealStatus.CANCELLED,
          version: { increment: 1 },
        },
      },
    ]);
    expect(calls.listingUpdates).toEqual([
      {
        where: { id: 'listing-005' },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
        },
      },
    ]);
    expect(calls.paymentUpdates).toHaveLength(2);
    expect(calls.paymentUpdates).toContainEqual({
      where: { id: 'pay-1' },
      data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
    });
    expect(calls.paymentUpdates).toContainEqual({
      where: { id: 'pay-2' },
      data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
    });
    expect(calls.auditLogs).toHaveLength(1);
    expect(calls.auditLogs[0].data.action).toBe(DEAL_CANCELLED_BY_TIMEOUT);
    expect(calls.auditLogs[0].data.payload.reason).toBe(DEAL_CANCEL_REASON_PAYMENT_TIMEOUT);
  });

  it('cancels deal when both payments are PENDING past deadline (Standard Timeout)', async () => {
    const expiredDeal = {
      id: 'deal-both-pending',
      dealNumber: 'DL-20261108-006',
      listingId: 'listing-006',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: pastDeadline,
      payments: [
        { id: 'pay-1', paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.PENDING },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    const { db, calls } = createMockDb([expiredDeal]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(1);
    expect(calls.dealUpdates[0].data.status).toBe(DealStatus.CANCELLED);
    expect(calls.listingUpdates[0].data.status).toBe(ListingStatus.ACTIVE);
    expect(calls.paymentUpdates).toHaveLength(2);
    expect(calls.auditLogs[0].data.action).toBe(DEAL_CANCELLED_BY_TIMEOUT);
  });

  it('Outcome B (OQ-13): cancels deal, reverts listing, and flags for Super Admin commission refund review when commission is CONFIRMED and price is EXPIRED', async () => {
    const commissionConfirmedDeal = {
      id: 'deal-commission-paid',
      dealNumber: 'DL-20261108-007',
      listingId: 'listing-007',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: pastDeadline,
      payments: [
        { id: 'pay-1', paymentType: PaymentType.PLATFORM_COMMISSION, status: DEAL_PAYMENT_STATUS.CONFIRMED },
        { id: 'pay-2', paymentType: PaymentType.SELLER_PURCHASE_PRICE, status: DEAL_PAYMENT_STATUS.PENDING },
      ],
      disputes: [],
    };

    const { db, calls } = createMockDb([commissionConfirmedDeal]);
    const logic = createPaymentDeadlineExpiryLogic(db);
    const result = await logic([], baseTime);

    expect(result.processedCount).toBe(1);
    expect(calls.dealUpdates[0].data.status).toBe(DealStatus.CANCELLED);
    expect(calls.listingUpdates[0].data.status).toBe(ListingStatus.ACTIVE);
    // Only pay-2 (SELLER_PURCHASE_PRICE) should be updated to EXPIRED; pay-1 remains CONFIRMED
    expect(calls.paymentUpdates).toEqual([
      {
        where: { id: 'pay-2' },
        data: { status: DEAL_PAYMENT_STATUS.EXPIRED },
      },
    ]);
    expect(calls.auditLogs).toHaveLength(1);
    expect(calls.auditLogs[0].data.payload.flag).toBe('SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED');
  });
});

