import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_ROLE_NOT_AUTHORIZED,
  ACTIVE_DEAL_STATUSES,
  DealStatus,
  ProfileStatus,
  UserRole,
} from '@elmasaif/shared';
import { BuyerDealsController } from '../buyer-deals.controller';
import { BuyerDealsService } from '../buyer-deals.service';
import { DealsCancellationService } from '../deals-cancellation.service';
import { DisputesService } from '../disputes.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../../users/guards/active-role.guard';
import { ROLES_KEY } from '../../users/decorators/require-role.decorator';

describe('Seller Deals & Dashboard Summary (Story 6.4 / AC-3)', () => {
  describe('BuyerDealsController - Seller Endpoints', () => {
    let controller: BuyerDealsController;
    let service: any;
    let reflector: Reflector;

    const marketer = {
      id: 'user-marketer-1',
      role: UserRole.MARKETER,
      activeRole: UserRole.MARKETER,
      fullName: 'وسيط عقاري',
    };

    beforeEach(async () => {
      service = {
        getSellerDealsSummary: jest.fn().mockResolvedValue({
          metrics: {
            totalDealsCount: 2,
            activeDealsCount: 1,
            completedDealsCount: 1,
            disputedDealsCount: 0,
            cancelledDealsCount: 0,
            totalCompletedVolume: '2000000.00',
            projectedActiveVolume: '1000000.00',
            earnedCommissionTotal: '50000.00',
            pendingCommissionForecast: '25000.00',
          },
          stageBreakdown: {
            AWAITING_PAYMENT_PROOF: 1,
            UNDER_ADMIN_AUDIT: 0,
            PAYMENT_REJECTED: 0,
            DISPUTED: 0,
            COMPLETED: 1,
            CANCELLED: 0,
            TERMINATED: 0,
          },
          activeDeals: [],
        }),
        listSellerDeals: jest.fn().mockResolvedValue([]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [BuyerDealsController],
        providers: [
          Reflector,
          { provide: BuyerDealsService, useValue: service },
          { provide: DealsCancellationService, useValue: {} },
          { provide: DisputesService, useValue: {} },
        ],
      })
        .overrideGuard(SessionAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(ActiveRoleGuard)
        .useValue({ canActivate: () => true })
        .compile();

      controller = module.get<BuyerDealsController>(BuyerDealsController);
      reflector = module.get<Reflector>(Reflector);
    });

    it('requires MARKETER or OWNER role on getSellerDealsSummary', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        controller.getSellerDealsSummary,
      );
      expect(roles).toEqual([UserRole.MARKETER, UserRole.OWNER]);
    });

    it('requires MARKETER or OWNER role on listSellerDeals', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        controller.listSellerDeals,
      );
      expect(roles).toEqual([UserRole.MARKETER, UserRole.OWNER]);
    });

    it('returns envelope with statusCode 200 for getSellerDealsSummary', async () => {
      const res = await controller.getSellerDealsSummary({ user: marketer });
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data.metrics.totalDealsCount).toBe(2);
      expect(service.getSellerDealsSummary).toHaveBeenCalledWith(
        marketer.id,
        UserRole.MARKETER,
      );
    });

    it('returns envelope with statusCode 200 for listSellerDeals', async () => {
      const res = await controller.listSellerDeals({ user: marketer });
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data).toEqual([]);
      expect(service.listSellerDeals).toHaveBeenCalledWith(
        marketer.id,
        UserRole.MARKETER,
      );
    });
  });

  describe('BuyerDealsService - Seller Logic & Privacy Masking', () => {
    let service: BuyerDealsService;
    let prisma: any;
    let clockService: any;

    const sellerUserId = 'seller-user-uuid';
    const sellerProfileId = 'seller-profile-uuid';

    beforeEach(() => {
      clockService = { now: () => new Date('2026-11-10T12:00:00.000Z') };
      prisma = {
        userProfile: {
          findUnique: jest.fn(),
        },
        deal: {
          findMany: jest.fn(),
        },
      };

      service = new BuyerDealsService(
        prisma,
        clockService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('rejects caller without active MARKETER or OWNER role with AUTH_ROLE_NOT_AUTHORIZED', async () => {
      await expect(
        service.getSellerDealsSummary(sellerUserId, UserRole.BUYER),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.getSellerDealsSummary(sellerUserId, UserRole.BUYER);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_ROLE_NOT_AUTHORIZED);
      }
    });

    it('rejects caller if seller profile is missing or inactive with AUTH_ROLE_NOT_AUTHORIZED', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getSellerDealsSummary(sellerUserId, UserRole.MARKETER),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.getSellerDealsSummary(sellerUserId, UserRole.MARKETER);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_ROLE_NOT_AUTHORIZED);
      }
    });

    it('computes metrics, stage breakdown, and masks buyer info for non-completed deals (AC-3, FR-32)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: sellerProfileId,
        userId: sellerUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
      });

      const mockDeals = [
        {
          id: 'deal-1',
          dealNumber: 'DL-2026-0001',
          dealReferenceCode: 'ELM-001',
          listingId: 'listing-1',
          dealPrice: '1000000.00',
          platformCommission: '25000.00',
          status: DealStatus.AWAITING_PAYMENT_PROOF,
          paymentDeadline: new Date('2026-11-12T12:00:00.000Z'),
          paymentWindowHoursSnapshot: 48,
          sellerCancellationRequestedAt: null,
          completedAt: null,
          createdAt: new Date('2026-11-10T12:00:00.000Z'),
          listing: {
            id: 'listing-1',
            title: 'فيلا فاخرة في النرجس',
            propertyType: 'VILLA',
            city: { nameAr: 'الرياض' },
            district: { nameAr: 'النرجس' },
          },
          buyerProfile: {
            user: {
              fullName: 'طارق الشمري',
              mobileNumber: '0551234567',
              email: 'tariq@example.com',
            },
          },
        },
        {
          id: 'deal-2',
          dealNumber: 'DL-2026-0002',
          dealReferenceCode: 'ELM-002',
          listingId: 'listing-2',
          dealPrice: '2000000.00',
          platformCommission: '50000.00',
          status: DealStatus.COMPLETED,
          paymentDeadline: new Date('2026-11-09T12:00:00.000Z'),
          paymentWindowHoursSnapshot: 48,
          sellerCancellationRequestedAt: null,
          completedAt: new Date('2026-11-09T10:00:00.000Z'),
          createdAt: new Date('2026-11-07T12:00:00.000Z'),
          listing: {
            id: 'listing-2',
            title: 'شقة مودرن في حطين',
            propertyType: 'APARTMENT',
            city: { nameAr: 'الرياض' },
            district: { nameAr: 'حطين' },
          },
          buyerProfile: {
            user: {
              fullName: 'فهد الدوسري',
              mobileNumber: '0559876543',
              email: 'fahad@example.com',
            },
          },
        },
        {
          id: 'deal-3',
          dealNumber: 'DL-2026-0003',
          dealReferenceCode: 'ELM-003',
          listingId: 'listing-3',
          dealPrice: '500000.00',
          platformCommission: '12500.00',
          status: DealStatus.CANCELLED,
          paymentDeadline: new Date('2026-11-05T12:00:00.000Z'),
          paymentWindowHoursSnapshot: 48,
          sellerCancellationRequestedAt: null,
          completedAt: null,
          createdAt: new Date('2026-11-03T12:00:00.000Z'),
          listing: {
            id: 'listing-3',
            title: 'أرض سكنية في الخير',
            propertyType: 'LAND',
            city: { nameAr: 'الرياض' },
            district: { nameAr: 'الخير' },
          },
          buyerProfile: {
            user: {
              fullName: 'سعد العتيبي',
              mobileNumber: '0550001122',
              email: 'saad@example.com',
            },
          },
        },
      ];

      prisma.deal.findMany.mockResolvedValue(mockDeals);

      const summary = await service.getSellerDealsSummary(sellerUserId, UserRole.MARKETER);

      // Verify metrics
      expect(summary.metrics.totalDealsCount).toBe(3);
      expect(summary.metrics.activeDealsCount).toBe(1);
      expect(summary.metrics.completedDealsCount).toBe(1);
      expect(summary.metrics.cancelledDealsCount).toBe(1);
      expect(summary.metrics.disputedDealsCount).toBe(0);
      expect(summary.metrics.totalCompletedVolume).toBe('2000000.00');
      expect(summary.metrics.projectedActiveVolume).toBe('1000000.00');
      expect(summary.metrics.earnedCommissionTotal).toBe('50000.00');
      expect(summary.metrics.pendingCommissionForecast).toBe('25000.00');

      // Verify stage breakdown
      expect(summary.stageBreakdown.AWAITING_PAYMENT_PROOF).toBe(1);
      expect(summary.stageBreakdown.COMPLETED).toBe(1);
      expect(summary.stageBreakdown.CANCELLED).toBe(1);
      expect(summary.stageBreakdown.UNDER_ADMIN_AUDIT).toBe(0);

      // Verify active deals list
      expect(summary.activeDeals).toHaveLength(1);
      const activeDeal = summary.activeDeals[0];
      expect(activeDeal.id).toBe('deal-1');
      expect(activeDeal.dealNumber).toBe('DL-2026-0001');
      expect(activeDeal.listingTitle).toBe('فيلا فاخرة في النرجس');
      expect(activeDeal.cityName).toBe('الرياض');
      expect(activeDeal.districtName).toBe('النرجس');

      // Buyer privacy masking check: non-completed deal has masked name and NO phone/email
      expect(activeDeal.buyer.fullName).toMatch(/^[^\s]+\*\*\*/); // starts with initial + ***
      expect(activeDeal.buyer.phone).toBeUndefined();
      expect(activeDeal.buyer.email).toBeUndefined();
    });

    it('unmasks buyer contact info for completed deals in listSellerDeals (FR-32)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: sellerProfileId,
        userId: sellerUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
      });

      const mockDeals = [
        {
          id: 'deal-completed',
          dealNumber: 'DL-2026-0042',
          dealReferenceCode: 'ELM-042',
          listingId: 'listing-42',
          dealPrice: '3000000.00',
          platformCommission: '75000.00',
          status: DealStatus.COMPLETED,
          paymentDeadline: new Date('2026-11-09T12:00:00.000Z'),
          paymentWindowHoursSnapshot: 48,
          sellerCancellationRequestedAt: null,
          completedAt: new Date('2026-11-09T10:00:00.000Z'),
          createdAt: new Date('2026-11-07T12:00:00.000Z'),
          listing: {
            id: 'listing-42',
            title: 'قصر في حطين',
            propertyType: 'VILLA',
            city: { nameAr: 'الرياض' },
            district: { nameAr: 'حطين' },
          },
          buyerProfile: {
            user: {
              fullName: 'عبدالله بن فهد',
              mobileNumber: '0555555555',
              email: 'abdullah@example.com',
            },
          },
        },
      ];

      prisma.deal.findMany.mockResolvedValue(mockDeals);

      const deals = await service.listSellerDeals(sellerUserId, UserRole.MARKETER);
      expect(deals).toHaveLength(1);
      expect(deals[0].buyer.fullName).toBe('عبدالله بن فهد');
      expect(deals[0].buyer.phone).toBe('0555555555');
      expect(deals[0].buyer.email).toBe('abdullah@example.com');
    });
  });
});
