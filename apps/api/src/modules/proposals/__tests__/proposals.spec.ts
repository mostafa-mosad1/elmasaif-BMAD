import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProposalsService } from '../proposals.service';
import { ProposalMatcherService } from '../proposal-matcher.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  PropertyType,
  DemandStatus,
  ListingStatus,
  ProposalStatus,
  MATCH_AREA_TOLERANCE_PERCENT,
  PROPOSAL_FORBIDDEN,
  PROPOSAL_NOT_FOUND,
  PROPOSAL_DUPLICATE,
  PROPOSAL_NOT_SELECTABLE,
} from '@elmasaif/shared';

describe('ProposalMatcherService + ProposalsService (Story 3.7 / FR-22, FR-23, FR-24)', () => {
  let service: ProposalsService;
  let matcher: ProposalMatcherService;
  let prisma: any;
  let clockService: any;

  const userId = 'user-uuid-1';
  const providerProfileId = 'provider-profile-1';
  const buyerProfileId = 'buyer-profile-1';
  const demandId = '11111111-1111-1111-1111-111111111111';
  const listingId = '22222222-2222-2222-2222-222222222222';
  const cityId = '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11';
  const mockNow = new Date('2026-11-04T12:00:00.000Z');

  const activeDemand = (overrides: Partial<any> = {}) => ({
    id: demandId,
    buyerProfileId,
    propertyType: PropertyType.VILLA,
    cityId,
    minBudget: '800000.00',
    maxBudget: '1500000.00',
    minArea: 250,
    maxArea: 450,
    status: DemandStatus.ACTIVE,
    ...overrides,
  });

  const activeListing = (overrides: Partial<any> = {}) => ({
    id: listingId,
    sellerProfileId: providerProfileId,
    propertyType: PropertyType.VILLA,
    cityId,
    askPrice: '1200000.00',
    areaSquareMeters: 300,
    status: ListingStatus.ACTIVE,
    title: 'فيلا شمال الطائف',
    ...overrides,
  });

  const proposalRow = (overrides: Partial<any> = {}) => ({
    id: 'proposal-1',
    demandId,
    listingId,
    providerProfileId,
    proposedPrice: '1150000.00',
    status: ProposalStatus.PENDING_ADMIN_REVIEW,
    note: null,
    rejectReason: null,
    selectedAt: null,
    createdAt: mockNow,
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      userProfile: { findUnique: jest.fn() },
      listing: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      demand: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      demandMatch: { create: jest.fn(), findMany: jest.fn() },
      proposal: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        ProposalMatcherService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
    matcher = module.get<ProposalMatcherService>(ProposalMatcherService);
  });

  describe('ProposalMatcherService.matchDemand (AC#1)', () => {
    it('persists one DemandMatch per qualifying ACTIVE listing and flips the demand MATCHED + audits', async () => {
      prisma.demand.findUnique.mockResolvedValue(activeDemand());
      prisma.listing.findMany.mockResolvedValue([activeListing()]);
      prisma.demandMatch.create.mockResolvedValue({ id: 'm1' });
      prisma.demand.update.mockResolvedValue(activeDemand({ status: DemandStatus.MATCHED }));

      const { matchCount } = await matcher.matchDemand(demandId);

      const arg = prisma.listing.findMany.mock.calls[0][0];
      expect(arg.where.status).toBe(ListingStatus.ACTIVE);
      expect(arg.where.propertyType).toBe(PropertyType.VILLA);
      expect(arg.where.cityId).toBe(cityId);
      expect(arg.where.askPrice).toEqual({ lte: '1500000.00' });
      expect(arg.where.areaSquareMeters.gte).toBeCloseTo(250 * (1 - MATCH_AREA_TOLERANCE_PERCENT));
      expect(arg.where.areaSquareMeters.lte).toBeCloseTo(450 * (1 + MATCH_AREA_TOLERANCE_PERCENT));

      expect(matchCount).toBe(1);
      expect(prisma.demandMatch.create).toHaveBeenCalledWith({
        data: { demandId, listingId, providerProfileId },
      });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: demandId },
          data: { status: DemandStatus.MATCHED },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorType: 'SYSTEM',
            action: 'DEMAND_MATCHED',
            entityType: 'Demand',
            entityId: demandId,
          }),
        }),
      );
    });

    it('leaves the demand ACTIVE and writes nothing when zero listings qualify (AC#1)', async () => {
      prisma.demand.findUnique.mockResolvedValue(activeDemand());
      prisma.listing.findMany.mockResolvedValue([]);

      const { matchCount } = await matcher.matchDemand(demandId);

      expect(matchCount).toBe(0);
      expect(prisma.demandMatch.create).not.toHaveBeenCalled();
      expect(prisma.demand.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('skips an already-non-ACTIVE demand without querying listings', async () => {
      prisma.demand.findUnique.mockResolvedValue(activeDemand({ status: DemandStatus.MATCHED }));

      const result = await matcher.matchDemand(demandId);

      expect(result.matchCount).toBe(0);
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createProposal (AC#3)', () => {
    const providerProfile = {
      id: providerProfileId,
      role: UserRole.MARKETER,
      status: ProfileStatus.ACTIVE,
    };
    const dto = { demandId, listingId, proposedPrice: 1150000 };

    beforeEach(() => {
      prisma.userProfile.findUnique.mockResolvedValue(providerProfile);
    });

    it('creates a PENDING_ADMIN_REVIEW proposal when everything qualifies', async () => {
      prisma.listing.findFirst.mockResolvedValue(activeListing());
      prisma.demand.findUnique.mockResolvedValue(activeDemand());
      prisma.proposal.create.mockResolvedValue(
        proposalRow({ status: ProposalStatus.PENDING_ADMIN_REVIEW }),
      );

      const item = await service.createProposal(userId, UserRole.MARKETER, dto as any);

      expect(item.status).toBe(ProposalStatus.PENDING_ADMIN_REVIEW);
      expect(item.proposedPrice).toBe(1150000);
      expect(prisma.proposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            demandId,
            listingId,
            providerProfileId,
            status: ProposalStatus.PENDING_ADMIN_REVIEW,
          }),
        }),
      );
    });

    it('rejects a listing the caller does not own with PROPOSAL_FORBIDDEN', async () => {
      prisma.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: PROPOSAL_FORBIDDEN }) });
    });

    it('rejects a non-ACTIVE listing', async () => {
      prisma.listing.findFirst.mockResolvedValue(activeListing({ status: ListingStatus.RESERVED }));

      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a listing that no longer satisfies the match criteria', async () => {
      prisma.listing.findFirst.mockResolvedValue(activeListing({ cityId: 'other-city' }));
      prisma.demand.findUnique.mockResolvedValue(activeDemand());

      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: PROPOSAL_NOT_FOUND }) });
    });

    it('rejects a proposed price above the buyer maxBudget', async () => {
      prisma.listing.findFirst.mockResolvedValue(activeListing());
      prisma.demand.findUnique.mockResolvedValue(activeDemand());

      await expect(
        service.createProposal(userId, UserRole.MARKETER, { ...dto, proposedPrice: 9999999 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps a unique-constraint violation to PROPOSAL_DUPLICATE', async () => {
      prisma.listing.findFirst.mockResolvedValue(activeListing());
      prisma.demand.findUnique.mockResolvedValue(activeDemand());
      prisma.proposal.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createProposal(userId, UserRole.MARKETER, dto as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: PROPOSAL_DUPLICATE }) });
    });
  });

  describe('getMatchingDemands (AC#2)', () => {
    it('scopes DemandMatch to the provider profile and groups by demand', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: providerProfileId,
        role: UserRole.MARKETER,
      });
      prisma.demandMatch.findMany.mockResolvedValue([
        {
          createdAt: mockNow,
          demand: activeDemand({
            city: { nameAr: 'الطائف' },
            district: null,
            districtId: null,
            notes: null,
            createdAt: mockNow,
          }),
          listing: { id: listingId, title: 'فيلا', askPrice: '1200000.00', areaSquareMeters: 300 },
        },
      ]);

      const { items } = await service.getMatchingDemands(userId, UserRole.MARKETER);

      expect(prisma.demandMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { providerProfileId } }),
      );
      expect(items).toHaveLength(1);
      expect(items[0].demandId).toBe(demandId);
      expect(items[0].matchedListings[0].listingId).toBe(listingId);
    });

    it('returns an empty list when the caller has no provider profile', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.getMatchingDemands(userId, UserRole.BUYER)).resolves.toEqual({
        items: [],
      });
      expect(prisma.demandMatch.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getApprovedProposalsForDemand (AC#5)', () => {
    it('returns only APPROVED_FOR_BUYER proposals for the caller’s own demand', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: buyerProfileId, role: UserRole.BUYER });
      prisma.demand.findFirst.mockResolvedValue(activeDemand());
      prisma.proposal.findMany.mockResolvedValue([
        proposalRow({
          status: ProposalStatus.APPROVED_FOR_BUYER,
          listing: {
            id: listingId,
            title: 'فيلا',
            propertyType: PropertyType.VILLA,
            cityId,
            districtId: null,
            city: { nameAr: 'الطائف' },
            district: null,
            askPrice: '1200000.00',
            areaSquareMeters: 300,
            sellerProfile: { user: { fullName: 'هشام' } },
          },
        }),
      ]);

      const { items } = await service.getApprovedProposalsForDemand(userId, demandId);

      expect(prisma.demand.findFirst).toHaveBeenCalledWith({
        where: { id: demandId, buyerProfileId },
      });
      expect(prisma.proposal.findMany.mock.calls[0][0].where).toEqual({
        demandId,
        status: ProposalStatus.APPROVED_FOR_BUYER,
      });
      expect(items).toHaveLength(1);
      expect((items[0] as any).providerName).toBe('هشام');
    });

    it('hides another buyer’s demand behind PROPOSAL_NOT_FOUND', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: buyerProfileId, role: UserRole.BUYER });
      prisma.demand.findFirst.mockResolvedValue(null);

      await expect(service.getApprovedProposalsForDemand(userId, demandId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('selectProposal (AC#5)', () => {
    const buyerProfile = { id: buyerProfileId, role: UserRole.BUYER };

    it('moves an APPROVED proposal to SELECTED, closes siblings, and audits', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.proposal.findFirst.mockResolvedValue(
        proposalRow({ status: ProposalStatus.APPROVED_FOR_BUYER }),
      );
      prisma.demand.findUnique.mockResolvedValue(activeDemand({ status: DemandStatus.MATCHED }));
      prisma.proposal.update.mockResolvedValue(
        proposalRow({ status: ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, selectedAt: mockNow }),
      );
      prisma.proposal.updateMany.mockResolvedValue({ count: 1 });

      const item = await service.selectProposal(userId, 'proposal-1');

      expect(item.status).toBe(ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL);
      expect(prisma.proposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            demandId,
            id: { not: 'proposal-1' },
            status: {
              in: [ProposalStatus.PENDING_ADMIN_REVIEW, ProposalStatus.APPROVED_FOR_BUYER],
            },
          }),
          data: { status: ProposalStatus.CLOSED },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PROPOSAL_SELECTED', entityType: 'Proposal' }),
        }),
      );
    });

    it('refuses to select a non-approved proposal with PROPOSAL_NOT_SELECTABLE', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.proposal.findFirst.mockResolvedValue(
        proposalRow({ status: ProposalStatus.PENDING_ADMIN_REVIEW }),
      );

      await expect(service.selectProposal(userId, 'proposal-1')).rejects.toThrow(ConflictException);
      await expect(service.selectProposal(userId, 'proposal-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: PROPOSAL_NOT_SELECTABLE }),
      });
    });

    it('hides another buyer’s proposal behind PROPOSAL_NOT_FOUND', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.proposal.findFirst.mockResolvedValue(null);

      await expect(service.selectProposal(userId, 'proposal-1')).rejects.toThrow(NotFoundException);
    });
  });
});
