import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_BACKUP_OFFER_RECONCILIATION,
  ListingStatus,
  OFFER_HISTORY_ACTIONS,
  OfferStatus,
} from '@elmasaif/shared';
import {
  backupOfferReconciliationHandler,
  createBackupOfferReconciliationLogic,
  BackupOfferReconciliationDbClient,
} from '../backup-offer-reconciliation.job';
import { jobHandlersMap } from '../index';

describe('backup-offer-reconciliation Worker Job (Story 4.3 / FR-27, AD-7) (AC: 8)', () => {
  let mockDb: BackupOfferReconciliationDbClient;
  const mockNow = new Date('2026-11-06T12:00:00.000Z');

  const staleBackup = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    listingId: 'listing-1',
    status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    activatedAt: null,
    isBackup: true,
    offerPrice: '1150000.00',
    negotiationRound: 2,
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

  it('selects only approved, never-activated backups on a SOLD listing', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([]);

    const logic = createBackupOfferReconciliationLogic(mockDb);
    const result = await logic([], mockNow);

    expect(mockDb.offer.findMany).toHaveBeenCalledWith({
      where: {
        isBackup: true,
        status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
        activatedAt: null,
        listing: { status: ListingStatus.SOLD },
      },
    });
    expect(result.processedCount).toBe(0);
  });

  it('never selects an activated backup — Story 5.1 owns the winner transition', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([]);

    const logic = createBackupOfferReconciliationLogic(mockDb);
    await logic([], mockNow);

    const where = (mockDb.offer.findMany as any).mock.calls[0][0].where;
    expect(where.activatedAt).toBeNull();
    expect(where.isBackup).toBe(true);
    // A backup held on a RESERVED listing is still the primary deal's fallback, not garbage.
    expect(where.listing.status).toBe(ListingStatus.SOLD);
  });

  it('closes every stale backup with CLOSED_BACKUP, a history row and a SYSTEM audit row', async () => {
    (mockDb.offer.findMany as any).mockResolvedValueOnce([
      staleBackup('o1'),
      staleBackup('o2', { listingId: 'listing-2', negotiationRound: null }),
    ]);
    (mockDb.offer.update as any).mockResolvedValue({});
    (mockDb.offerHistory!.create as any).mockResolvedValue({ id: 'history-1' });
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createBackupOfferReconciliationLogic(mockDb);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(2);
    expect(result.details?.processedCount).toBe(2);
    expect(result.details?.evaluationTime).toBe(mockNow.toISOString());
    expect(mockDb.offer.update).toHaveBeenCalledTimes(2);
    expect(mockDb.offer.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: OfferStatus.CLOSED_BACKUP, version: { increment: 1 } },
    });

    expect(mockDb.offerHistory!.create).toHaveBeenCalledWith({
      data: {
        offerId: 'o1',
        action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED,
        priceSnapshot: 1150000,
        notes: 'PRIMARY_DEAL_COMPLETED',
        roundNumber: 2,
      },
    });

    expect(mockDb.auditLog!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'OFFER_BACKUP_CLOSED',
          entityType: 'Offer',
          entityId: 'o2',
          payload: expect.objectContaining({
            listingId: 'listing-2',
            reason: 'PRIMARY_DEAL_COMPLETED',
            previousStatus: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
            closedAt: mockNow.toISOString(),
          }),
        }),
      }),
    );
  });

  it('is idempotent — a second run re-selects nothing and writes nothing', async () => {
    (mockDb.offer.findMany as any).mockResolvedValue([staleBackup('o1')]);
    (mockDb.offer.update as any).mockResolvedValue({});
    (mockDb.offerHistory!.create as any).mockResolvedValue({ id: 'history-1' });
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createBackupOfferReconciliationLogic(mockDb);
    const first = await logic([], mockNow);
    expect(first.processedCount).toBe(1);

    // Simulate the row now being CLOSED_BACKUP: the status predicate excludes it.
    (mockDb.offer.findMany as any).mockResolvedValue([]);
    const second = await logic([], mockNow);

    expect(second.processedCount).toBe(0);
    expect(mockDb.offer.update).toHaveBeenCalledTimes(1);
    for (const call of (mockDb.offer.findMany as any).mock.calls) {
      expect(call[0].where.status).toBe(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL);
    }
  });

  it('runs the sweep without a db client (unwired runtime) and processes nothing', async () => {
    const logic = createBackupOfferReconciliationLogic();
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('Closed 0 backup offers');
  });

  it('skips the history/audit writes when those clients are not wired', async () => {
    const dbWithoutSideEffects: BackupOfferReconciliationDbClient = {
      offer: {
        findMany: vi.fn().mockResolvedValue([staleBackup('o1')]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const logic = createBackupOfferReconciliationLogic(dbWithoutSideEffects);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(1);
    expect(dbWithoutSideEffects.offerHistory).toBeUndefined();
    expect(dbWithoutSideEffects.auditLog).toBeUndefined();
  });

  it('executes cleanly via the jobHandler wrapper (registered under JOB_BACKUP_OFFER_RECONCILIATION)', async () => {
    const mockJob: any = { id: 'test-job-id', name: JOB_BACKUP_OFFER_RECONCILIATION, data: {} };
    const execResult = await backupOfferReconciliationHandler([mockJob]);

    expect(execResult).toBeDefined();
    expect(execResult.jobName).toBe(JOB_BACKUP_OFFER_RECONCILIATION);
    expect(execResult.success).toBe(true);
    expect(typeof execResult.durationMs).toBe('number');
    expect(typeof execResult.processedCount).toBe('number');
  });

  it('is registered in jobHandlersMap alongside the seven sibling sweeps', () => {
    expect(jobHandlersMap[JOB_BACKUP_OFFER_RECONCILIATION]).toBe(
      backupOfferReconciliationHandler,
    );
  });
});
