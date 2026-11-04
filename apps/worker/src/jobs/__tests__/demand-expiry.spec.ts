import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JOB_DEMAND_EXPIRY_CHECKER,
  DemandStatus,
  ProposalStatus,
  DEMAND_EXPIRY_DAYS
} from '@elmasaif/shared';
import {
  demandExpiryCheckerHandler,
  createDemandExpiryCheckerLogic,
  DemandExpiryDbClient
} from '../demand-expiry-checker.job';

describe('demand-expiry-checker Worker Job (Story 3.6 / FR-21) (AC: 5)', () => {
  let mockDb: DemandExpiryDbClient;
  const mockNow = new Date('2026-12-04T12:00:00.000Z');

  const staleDemand = (id: string) => ({
    id,
    status: DemandStatus.ACTIVE,
    expiresAt: new Date(mockNow.getTime() - 60000),
    buyerProfileId: 'profile-1',
  });

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockDb = {
      demand: {
        findMany: vi.fn(),
        update: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      },
      proposal: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };
  });

  it('selects only ACTIVE demands whose expiresAt has elapsed', async () => {
    (mockDb.demand.findMany as any).mockResolvedValueOnce([]);

    const logic = createDemandExpiryCheckerLogic(mockDb);
    const result = await logic([], mockNow);

    expect(mockDb.demand.findMany).toHaveBeenCalledWith({
      where: {
        status: DemandStatus.ACTIVE,
        expiresAt: { lte: mockNow },
      },
    });
    expect(result.processedCount).toBe(0);
  });

  it('flips every stale demand to EXPIRED and writes one AuditLog row per transition', async () => {
    (mockDb.demand.findMany as any).mockResolvedValueOnce([
      staleDemand('d1'),
      staleDemand('d2'),
    ]);
    (mockDb.demand.update as any).mockResolvedValue({});
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createDemandExpiryCheckerLogic(mockDb);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(2);
    expect(result.details?.processedCount).toBe(2);
    expect(mockDb.demand.update).toHaveBeenCalledTimes(2);
    expect(mockDb.demand.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: DemandStatus.EXPIRED },
    });
    expect(mockDb.auditLog!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'DEMAND_EXPIRED',
          entityType: 'Demand',
          entityId: 'd2',
        }),
      }),
    );
  });

  it('is idempotent — an already-EXPIRED demand is never re-selected or re-written', async () => {
    // First sweep expires d1; the ACTIVE-only filter means the second sweep
    // (same hour or a later one) cannot select the row it just flipped to EXPIRED.
    (mockDb.demand.findMany as any).mockResolvedValue([staleDemand('d1')]);
    (mockDb.demand.update as any).mockResolvedValue({});
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createDemandExpiryCheckerLogic(mockDb);
    const first = await logic([], mockNow);
    expect(first.processedCount).toBe(1);

    // Simulate the row now being EXPIRED: the ACTIVE filter excludes it.
    (mockDb.demand.findMany as any).mockResolvedValue([]);
    const second = await logic([], mockNow);

    expect(second.processedCount).toBe(0);
    expect(mockDb.demand.update).toHaveBeenCalledTimes(1);
    for (const call of (mockDb.demand.findMany as any).mock.calls) {
      expect(call[0].where.status).toBe(DemandStatus.ACTIVE);
    }
  });

  it('runs the sweep without a db client (unwired runtime) and processes nothing', async () => {
    const logic = createDemandExpiryCheckerLogic();
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(0);
    expect(result.outcome).toContain('Expired 0 pending demands');
  });

  it('keeps the 30-day window shared with the API expiry math', () => {
    expect(DEMAND_EXPIRY_DAYS).toBe(30);
  });

  it('closes the expired demand\u2019s unaccepted proposals, leaving a selected one for Epic 5 (Story 3.7 / FR-58)', async () => {
    (mockDb.demand.findMany as any).mockResolvedValueOnce([staleDemand('d1')]);
    (mockDb.demand.update as any).mockResolvedValue({});
    (mockDb.auditLog!.create as any).mockResolvedValue({ id: 'audit-1' });

    const logic = createDemandExpiryCheckerLogic(mockDb);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(1);
    expect(mockDb.proposal!.updateMany).toHaveBeenCalledWith({
      where: {
        demandId: 'd1',
        status: { notIn: [ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL] },
      },
      data: { status: ProposalStatus.CLOSED },
    });
  });

  it('skips the proposal sweep when no proposal client is wired (unwired runtime)', async () => {
    const dbWithoutProposal: DemandExpiryDbClient = {
      demand: { findMany: vi.fn().mockResolvedValue([staleDemand('d1')]), update: vi.fn().mockResolvedValue({}) },
    };
    const logic = createDemandExpiryCheckerLogic(dbWithoutProposal);
    const result = await logic([], mockNow);

    expect(result.processedCount).toBe(1);
    expect(dbWithoutProposal.proposal).toBeUndefined();
  });

  it('executes cleanly via jobHandler wrapper conforming to JobExecutionResult', async () => {
    const mockJob: any = { id: 'test-job-id', name: JOB_DEMAND_EXPIRY_CHECKER, data: {} };
    const execResult = await demandExpiryCheckerHandler([mockJob]);

    expect(execResult).toBeDefined();
    expect(execResult.jobName).toBe(JOB_DEMAND_EXPIRY_CHECKER);
    expect(execResult.success).toBe(true);
    expect(typeof execResult.durationMs).toBe('number');
    expect(typeof execResult.processedCount).toBe('number');
  });
});
