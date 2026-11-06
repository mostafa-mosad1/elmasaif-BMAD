import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_OFFER_EXPIRY_CHECKER,
  EXPIRABLE_OFFER_STATUSES,
  ACTIVE_OFFER_STATUSES,
  OFFER_HISTORY_ACTIONS,
  OfferStatus,
} from '@elmasaif/shared';
import {
  offerExpiryCheckerHandler,
  createOfferExpiryCheckerLogic,
  OfferExpiryDbClient,
} from '../offer-expiry-checker.job';

describe('offer-expiry-checker Worker Job (Story 4.2 / FR-26, AD-7 job #2) (AC: 7)', () => {
  let mockDb: OfferExpiryDbClient;
  const mockNow = new Date('2026-11-06T12:00:00.000Z');

  const staleOffer = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    status: OfferStatus.RELAYED_TO_SELLER,
    offerPrice: '1150000.00',
    negotiationRound: 1,
    expiresAt: new Date(mockNow.getTime() - 60_000),
    ...overrides,
  });

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockDb = {
      offer: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      offerHistory: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };
  });

  it('targets EXPIRABLE_OFFER_STATUSES (never ACTIVE_OFFER_STATUSES) with an elapsed expiry', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([]);

    const logic = createOfferExpiryCheckerLogic(mockDb);
    const result = await logic([], mockNow);

    expect(mockDb.offer.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [...EXPIRABLE_OFFER_STATUSES] },
        expiresAt: { lte: mockNow },
      },
    });
    expect(result.processedCount).toBe(0);
  });

  it('never selects a mutually-agreed offer, so Story 5.1 can still bind it into a Deal', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([]);

    const logic = createOfferExpiryCheckerLogic(mockDb);
    await logic([], mockNow);

    const where = (mockDb.offer.findMany as any).mock.calls[0][0].where;
    expect(where.status.in).not.toContain(
      OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    );
    // The agreed hand-off status stays "active" for the listings guards.
    expect(ACTIVE_OFFER_STATUSES).toContain(
      OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    );
  });

  it('flips every stale offer to EXPIRED with a history and SYSTEM audit row', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([
      staleOffer('o1'),
      staleOffer('o2', { status: OfferStatus.RELAYED_TO_BUYER }),
    ]);
    (mockDb.offer.update as any).mockResolvedValue({});
    (mockDb.offerHistory!.create as any).mockResolvedValue({ id: 'history-1' });
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createOfferExpiryCheckerLogic(mockDb);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(2);
    expect(result.details?.processedCount).toBe(2);
    expect(mockDb.offer.update).toHaveBeenCalledTimes(2);
    expect(mockDb.offer.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: OfferStatus.EXPIRED, version: { increment: 1 } },
    });

    expect(mockDb.offerHistory!.create).toHaveBeenCalledWith({
      data: {
        offerId: 'o1',
        action: OFFER_HISTORY_ACTIONS.EXPIRED,
        priceSnapshot: 1150000,
        notes: null,
        roundNumber: 1,
      },
    });

    expect(mockDb.auditLog!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: OFFER_HISTORY_ACTIONS.EXPIRED,
          entityType: 'Offer',
          entityId: 'o2',
          payload: expect.objectContaining({
            previousStatus: OfferStatus.RELAYED_TO_BUYER,
            expiredAt: mockNow.toISOString(),
          }),
        }),
      }),
    );
  });

  it('is idempotent — an already-EXPIRED offer is never re-selected or re-written', async () => {
    (mockDb.offer.findMany as any).mockResolvedValue([staleOffer('o1')]);
    (mockDb.offer.update as any).mockResolvedValue({});
    (mockDb.offerHistory!.create as any).mockResolvedValue({ id: 'history-1' });
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createOfferExpiryCheckerLogic(mockDb);
    const first = await logic([], mockNow);
    expect(first.processedCount).toBe(1);

    // Simulate the row now being EXPIRED: the EXPIRABLE filter excludes it.
    (mockDb.offer.findMany as any).mockResolvedValue([]);
    const second = await logic([], mockNow);

    expect(second.processedCount).toBe(0);
    expect(mockDb.offer.update).toHaveBeenCalledTimes(1);
    for (const call of (mockDb.offer.findMany as any).mock.calls) {
      expect(call[0].where.status.in).toEqual([...EXPIRABLE_OFFER_STATUSES]);
    }
  });

  it('runs the sweep without a db client (unwired runtime) and processes nothing', async () => {
    const logic = createOfferExpiryCheckerLogic();
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('Expired 0 pending offers');
  });

  it('skips the history/audit writes when those clients are not wired', async () => {
    const dbWithoutSideEffects: OfferExpiryDbClient = {
      offer: {
        findMany: vi.fn().mockResolvedValue([staleOffer('o1')]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const logic = createOfferExpiryCheckerLogic(dbWithoutSideEffects);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(1);
    expect(dbWithoutSideEffects.offerHistory).toBeUndefined();
    expect(dbWithoutSideEffects.auditLog).toBeUndefined();
  });

  it('executes cleanly via the jobHandler wrapper (registered under JOB_OFFER_EXPIRY_CHECKER)', async () => {
    const mockJob: any = { id: 'test-job-id', name: JOB_OFFER_EXPIRY_CHECKER, data: {} };
    const execResult = await offerExpiryCheckerHandler([mockJob]);

    expect(execResult).toBeDefined();
    expect(execResult.jobName).toBe(JOB_OFFER_EXPIRY_CHECKER);
    expect(execResult.success).toBe(true);
    expect(typeof execResult.durationMs).toBe('number');
    expect(typeof execResult.processedCount).toBe('number');
  });
});
