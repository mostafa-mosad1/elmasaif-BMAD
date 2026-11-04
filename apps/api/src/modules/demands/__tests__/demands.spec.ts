import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DemandsService } from '../demands.service';
import { ProposalMatcherService } from '../../proposals/proposal-matcher.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  PropertyType,
  DemandStatus,
  ProposalStatus,
  DEMAND_EXPIRY_DAYS,
  DEMAND_NOT_FOUND,
  DEMAND_NOT_CANCELLABLE,
  DEMAND_FORBIDDEN,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
} from '@elmasaif/shared';

describe('DemandsService — Buyer Demand Lifecycle (Story 3.6 / FR-21, FR-58)', () => {
  let service: DemandsService;
  let prisma: any;
  let clockService: any;

  const mockUserId = 'user-uuid-1';
  const mockProfileId = 'profile-uuid-1';
  const mockDemandId = '11111111-1111-1111-1111-111111111111';
  const mockCityId = '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11';
  const mockDistrictId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const mockNow = new Date('2026-11-04T12:00:00.000Z');

  const buyerProfile = {
    id: mockProfileId,
    userId: mockUserId,
    role: UserRole.BUYER,
    status: ProfileStatus.ACTIVE,
  };

  const demandRow = (overrides: Partial<any> = {}) => ({
    id: mockDemandId,
    buyerProfileId: mockProfileId,
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    minBudget: '800000.00',
    maxBudget: '1500000.00',
    minArea: 250,
    maxArea: 450,
    notes: 'فيلا شمال الطائف',
    status: DemandStatus.ACTIVE,
    expiresAt: new Date(mockNow.getTime() + DEMAND_EXPIRY_DAYS * 86400000),
    cancelledAt: null,
    cancelReason: null,
    createdAt: mockNow,
    city: { nameAr: 'الطائف' },
    district: { nameAr: 'الشهراء' },
    ...overrides,
  });

  const validDto = {
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    minBudget: 800000,
    maxBudget: 1500000,
    minArea: 250,
    maxArea: 450,
    notes: 'فيلا شمال الطائف',
  };

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };

    prisma = {
      userProfile: { findUnique: jest.fn() },
      city: { findUnique: jest.fn() },
      district: { findUnique: jest.fn() },
      demand: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      // Story 3.7: createDemand now fires the matcher inline, and cancelDemand closes proposals.
      // These mock prisma surfaces keep the 3.6 assertions valid (listing.findMany -> [] means
      // zero matches, so the created demand stays ACTIVE and the matcher never flips it).
      listing: { findMany: jest.fn().mockResolvedValue([]) },
      demandMatch: { create: jest.fn() },
      proposal: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemandsService,
        ProposalMatcherService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<DemandsService>(DemandsService);
  });

  describe('createDemand', () => {
    it('AC#1: persists an ACTIVE demand with expiresAt = ClockService.now() + 30 days', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.district.findUnique.mockResolvedValue({
        id: mockDistrictId,
        cityId: mockCityId,
        isActive: true,
      });
      prisma.demand.create.mockResolvedValue(demandRow());

      const item = await service.createDemand(mockUserId, UserRole.BUYER, validDto as any);

      expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId_role: { userId: mockUserId, role: UserRole.BUYER } },
      });
      expect(prisma.demand.create).toHaveBeenCalledTimes(1);
      const arg = prisma.demand.create.mock.calls[0][0];
      expect(arg.data.buyerProfileId).toBe(mockProfileId);
      expect(arg.data.status).toBe(DemandStatus.ACTIVE);
      expect(arg.data.cityId).toBe(mockCityId);
      expect(arg.data.districtId).toBe(mockDistrictId);
      expect(arg.data.expiresAt).toEqual(
        new Date(mockNow.getTime() + DEMAND_EXPIRY_DAYS * 86400000),
      );
      expect(item.status).toBe(DemandStatus.ACTIVE);
      expect(item.cityName).toBe('الطائف');
    });

    it('AC#1: never writes the retired free-text city/districts columns', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.demand.create.mockResolvedValue(demandRow({ districtId: null, district: null }));

      await service.createDemand(
        mockUserId,
        UserRole.BUYER,
        { ...validDto, districtId: null } as any,
      );

      const arg = prisma.demand.create.mock.calls[0][0];
      expect(arg.data).not.toHaveProperty('city');
      expect(arg.data).not.toHaveProperty('districts');
      expect(arg.data.notes).toBe('فيلا شمال الطائف');
    });

    it('AC#2: skips the district query entirely when districtId is absent', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.demand.create.mockResolvedValue(demandRow({ districtId: null, district: null }));

      await service.createDemand(
        mockUserId,
        UserRole.BUYER,
        { ...validDto, districtId: null } as any,
      );

      expect(prisma.district.findUnique).not.toHaveBeenCalled();
    });

    it('AC#2: rejects an inactive/unknown city with GEO_CITY_INACTIVE', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: false });

      await expect(
        service.createDemand(mockUserId, UserRole.BUYER, validDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDemand(mockUserId, UserRole.BUYER, validDto as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: GEO_CITY_INACTIVE }),
      });
      expect(prisma.demand.create).not.toHaveBeenCalled();
    });

    it('AC#2: rejects a district that does not belong to the city with GEO_DISTRICT_INACTIVE', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.district.findUnique.mockResolvedValue(null);

      await expect(
        service.createDemand(mockUserId, UserRole.BUYER, validDto as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: GEO_DISTRICT_INACTIVE }),
      });
      expect(prisma.district.findUnique).toHaveBeenCalledWith({
        where: { id_cityId: { id: mockDistrictId, cityId: mockCityId } },
      });
      expect(prisma.demand.create).not.toHaveBeenCalled();
    });

    it('AC#1: forbids a non-active buyer profile with DEMAND_FORBIDDEN', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile,
        status: ProfileStatus.SUSPENDED,
      });

      await expect(
        service.createDemand(mockUserId, UserRole.BUYER, validDto as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createDemand(mockUserId, UserRole.BUYER, validDto as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: DEMAND_FORBIDDEN }),
      });
      expect(prisma.demand.create).not.toHaveBeenCalled();
    });

    it('AC#1: emits budget Decimals as numbers on the response item', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.district.findUnique.mockResolvedValue({
        id: mockDistrictId,
        cityId: mockCityId,
        isActive: true,
      });
      prisma.demand.create.mockResolvedValue(demandRow());

      const item = await service.createDemand(mockUserId, UserRole.BUYER, validDto as any);

      expect(item.minBudget).toBe(800000);
      expect(item.maxBudget).toBe(1500000);
      expect(typeof item.minBudget).toBe('number');
      expect(item.expiresAt).toBe(
        new Date(mockNow.getTime() + DEMAND_EXPIRY_DAYS * 86400000).toISOString(),
      );
    });
  });

  describe('getBuyerDemands', () => {
    it('AC#3: queries the buyer profile scope newest-first with city+district joined and NO status filter', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findMany.mockResolvedValue([demandRow()]);

      const { items } = await service.getBuyerDemands(mockUserId);

      const arg = prisma.demand.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ buyerProfileId: mockProfileId });
      expect(arg.where).not.toHaveProperty('status');
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
      expect(arg.include).toEqual({ city: true, district: true });
      expect(items).toHaveLength(1);
      expect(items[0].districtName).toBe('الشهراء');
      expect(items[0].minBudget).toBe(800000);
    });

    it('AC#3: returns { items: [] } when the buyer has no demands', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findMany.mockResolvedValue([]);

      await expect(service.getBuyerDemands(mockUserId)).resolves.toEqual({ items: [] });
    });

    it('AC#3: returns an empty list when the buyer has no BUYER profile', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.getBuyerDemands(mockUserId)).resolves.toEqual({ items: [] });
      expect(prisma.demand.findMany).not.toHaveBeenCalled();
    });

    it('AC#3: surfaces historical CANCELLED rows with their reason and timestamp', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findMany.mockResolvedValue([
        demandRow({
          status: DemandStatus.CANCELLED,
          cancelReason: 'تم الشراء من مصدر آخر',
          cancelledAt: mockNow,
        }),
      ]);

      const { items } = await service.getBuyerDemands(mockUserId);

      expect(items[0].status).toBe(DemandStatus.CANCELLED);
      expect(items[0].cancelReason).toBe('تم الشراء من مصدر آخر');
      expect(items[0].cancelledAt).toBe(mockNow.toISOString());
    });
  });

  describe('cancelDemand', () => {
    it('AC#4: cancels an ACTIVE demand, recording reason + cancelledAt and writing the AuditLog in one tx', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findFirst.mockResolvedValue(demandRow());
      prisma.demand.update.mockResolvedValue(
        demandRow({
          status: DemandStatus.CANCELLED,
          cancelReason: 'تم الشراء خارج المنصة',
          cancelledAt: mockNow,
        }),
      );
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const item = await service.cancelDemand(
        mockUserId,
        mockDemandId,
        'تم الشراء خارج المنصة',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.demand.findFirst).toHaveBeenCalledWith({
        where: { id: mockDemandId, buyerProfileId: mockProfileId },
      });
      expect(prisma.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDemandId },
          data: expect.objectContaining({
            status: DemandStatus.CANCELLED,
            cancelReason: 'تم الشراء خارج المنصة',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: mockUserId,
            actorType: 'USER',
            action: 'DEMAND_CANCELLED',
            entityType: 'Demand',
            entityId: mockDemandId,
          }),
        }),
      );
      // Story 3.7 / AC#6: cancel closes the demand's open (not-selected) proposals.
      expect(prisma.proposal.updateMany).toHaveBeenCalledWith({
        where: {
          demandId: mockDemandId,
          status: {
            in: [ProposalStatus.PENDING_ADMIN_REVIEW, ProposalStatus.APPROVED_FOR_BUYER],
          },
        },
        data: { status: ProposalStatus.CLOSED },
      });
      expect(item.status).toBe(DemandStatus.CANCELLED);
      expect(item.cancelReason).toBe('تم الشراء خارج المنصة');
    });

    it('AC#4: allows cancelling a MATCHED demand (3.7 sets MATCHED, 3.6 only reads it)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findFirst.mockResolvedValue(demandRow({ status: DemandStatus.MATCHED }));
      prisma.demand.update.mockResolvedValue(demandRow({ status: DemandStatus.CANCELLED }));
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      const item = await service.cancelDemand(mockUserId, mockDemandId, 'لم تناسبني العروض');

      expect(item.status).toBe(DemandStatus.CANCELLED);
      expect(prisma.demand.update).toHaveBeenCalledTimes(1);
    });

    it.each([[DemandStatus.EXPIRED], [DemandStatus.CLOSED], [DemandStatus.CANCELLED]])(
      'AC#4: refuses to cancel a %s demand with DEMAND_NOT_CANCELLABLE and writes nothing',
      async (status) => {
        prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
        prisma.demand.findFirst.mockResolvedValue(demandRow({ status }));

        await expect(
          service.cancelDemand(mockUserId, mockDemandId, 'سبب الإلغاء'),
        ).rejects.toThrow(ConflictException);
        await expect(
          service.cancelDemand(mockUserId, mockDemandId, 'سبب الإلغاء'),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: DEMAND_NOT_CANCELLABLE }),
        });

        expect(prisma.demand.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
      },
    );

    it('AC#4: hides another buyer\'s demand behind DEMAND_NOT_FOUND', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);
      prisma.demand.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelDemand(mockUserId, mockDemandId, 'سبب الإلغاء'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.cancelDemand(mockUserId, mockDemandId, 'سبب الإلغاء'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: DEMAND_NOT_FOUND }),
      });
      expect(prisma.demand.update).not.toHaveBeenCalled();
    });
  });
});
