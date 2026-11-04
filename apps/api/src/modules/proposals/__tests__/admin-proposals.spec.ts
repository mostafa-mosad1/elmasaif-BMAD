import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminProposalsService } from '../admin-proposals.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  ProposalStatus,
  PROPOSAL_NOT_FOUND,
  PROPOSAL_NOT_APPROVABLE,
} from '@elmasaif/shared';

describe('AdminProposalsService (Story 3.7 / FR-23, Offers.Review)', () => {
  let service: AdminProposalsService;
  let prisma: any;
  let clockService: any;

  const adminId = 'admin-uuid-1';
  const proposalId = '33333333-3333-3333-3333-333333333333';
  const mockNow = new Date('2026-11-04T12:00:00.000Z');

  const proposalRow = (overrides: Partial<any> = {}) => ({
    id: proposalId,
    demandId: 'd-1',
    listingId: 'l-1',
    providerProfileId: 'p-1',
    proposedPrice: '1150000.00',
    status: ProposalStatus.PENDING_ADMIN_REVIEW,
    note: null,
    rejectReason: null,
    selectedAt: null,
    createdAt: mockNow,
    demand: null,
    listing: null,
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      proposal: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminProposalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<AdminProposalsService>(AdminProposalsService);
  });

  describe('getQueue (AC#4)', () => {
    it('defaults to PENDING_ADMIN_REVIEW and returns a paginated envelope', async () => {
      prisma.proposal.findMany.mockResolvedValue([]);
      prisma.proposal.count.mockResolvedValue(0);

      const res = await service.getQueue({} as any);

      expect(prisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ProposalStatus.PENDING_ADMIN_REVIEW } }),
      );
      expect(res.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
      expect(res.items).toEqual([]);
    });

    it('honours an explicit status filter', async () => {
      prisma.proposal.findMany.mockResolvedValue([]);
      prisma.proposal.count.mockResolvedValue(0);

      await service.getQueue({ status: ProposalStatus.APPROVED_FOR_BUYER, page: 1, limit: 50 } as any);

      expect(prisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ProposalStatus.APPROVED_FOR_BUYER } }),
      );
    });
  });

  describe('approve (AC#4)', () => {
    it('moves a PENDING proposal to APPROVED_FOR_BUYER and audits', async () => {
      prisma.proposal.findUnique.mockResolvedValue(proposalRow());
      prisma.proposal.update.mockResolvedValue(
        proposalRow({ status: ProposalStatus.APPROVED_FOR_BUYER }),
      );

      const res = await service.approve(adminId, proposalId);

      expect(res.status).toBe(ProposalStatus.APPROVED_FOR_BUYER);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: adminId,
            actorType: 'ADMIN',
            action: 'PROPOSAL_APPROVED',
            entityType: 'Proposal',
            entityId: proposalId,
          }),
        }),
      );
    });

    it('refuses a non-pending proposal with PROPOSAL_NOT_APPROVABLE', async () => {
      prisma.proposal.findUnique.mockResolvedValue(
        proposalRow({ status: ProposalStatus.REJECTED }),
      );

      await expect(service.approve(adminId, proposalId)).rejects.toThrow(ConflictException);
      await expect(service.approve(adminId, proposalId)).rejects.toMatchObject({
        response: expect.objectContaining({ code: PROPOSAL_NOT_APPROVABLE }),
      });
      expect(prisma.proposal.update).not.toHaveBeenCalled();
    });

    it('404s an unknown proposal', async () => {
      prisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.approve(adminId, proposalId)).rejects.toThrow(NotFoundException);
      await expect(service.approve(adminId, proposalId)).rejects.toMatchObject({
        response: expect.objectContaining({ code: PROPOSAL_NOT_FOUND }),
      });
    });
  });

  describe('reject (AC#4)', () => {
    it('moves a PENDING proposal to REJECTED with the reason and audits', async () => {
      prisma.proposal.findUnique.mockResolvedValue(proposalRow());
      prisma.proposal.update.mockResolvedValue(proposalRow({ status: ProposalStatus.REJECTED }));

      const res = await service.reject(adminId, proposalId, 'العقار خارج النطاق المطلوب');

      expect(res.status).toBe(ProposalStatus.REJECTED);
      expect(prisma.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ProposalStatus.REJECTED,
            rejectReason: 'العقار خارج النطاق المطلوب',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PROPOSAL_REJECTED' }),
        }),
      );
    });

    it('refuses a non-pending proposal with PROPOSAL_NOT_APPROVABLE', async () => {
      prisma.proposal.findUnique.mockResolvedValue(
        proposalRow({ status: ProposalStatus.APPROVED_FOR_BUYER }),
      );

      await expect(service.reject(adminId, proposalId, 'سبب الرفض')).rejects.toMatchObject({
        response: expect.objectContaining({ code: PROPOSAL_NOT_APPROVABLE }),
      });
    });
  });
});
