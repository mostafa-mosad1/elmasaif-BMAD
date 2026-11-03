import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import {
  ListingStatus,
  PriceSuggestionStatus,
  PropertyType,
  UserRole,
  LISTING_ROLE_UNAUTHORIZED,
  PRICE_SUGGESTION_ALREADY_RESPONDED,
  PRICE_SUGGESTION_NOT_FOUND,
} from '@elmasaif/shared';

describe('ListingsService — Seller Price Suggestion Response & Confidentiality (Story 2.5)', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const baseNow = new Date('2026-11-03T12:00:00.000Z');
  const sellerUserId = 'seller-user-1';
  const otherUserId = 'buyer-user-2';
  const listingId = 'listing-100';
  const suggestionId = 'suggestion-200';

  const makeMockListing = (overrides: Record<string, any> = {}) => ({
    id: listingId,
    title: 'فيلا مودرن في حي الملقا',
    description: 'فيلا فاخرة مطابقة للكود السعودي',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'district-1',
    askPrice: 4200000,
    areaSquareMeters: 420,
    status: ListingStatus.ACTIVE,
    sellerProfileId: 'profile-1',
    payoutIban: 'SA0380000000608010167519',
    version: 2,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    city: { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh' },
    district: { id: 'district-1', nameAr: 'الملقا', nameEn: 'Al Malqa' },
    documents: [],
    sellerProfile: {
      id: 'profile-1',
      userId: sellerUserId,
      role: UserRole.MARKETER,
      user: {
        id: sellerUserId,
        fullName: 'عبدالله العقاري',
        username: 'abdullah_broker',
        mobileNumber: '+966551112222',
        email: 'abdullah@broker.sa',
        nationalId: '1012345678',
      },
    },
    priceSuggestions: [
      {
        id: suggestionId,
        listingId,
        currentAskPrice: 4200000,
        suggestedPrice: 3850000,
        reason: 'متوسط الصفقات المماثلة في الحي خلال الربع الأخير هو 3,850,000 ريال',
        status: PriceSuggestionStatus.PENDING,
        suggestedByAdminId: 'admin-1',
        suggestedByAdminName: 'أحمد المراجع',
        sellerResponseNote: null,
        respondedAt: null,
        createdAt: new Date('2026-11-03T10:00:00.000Z'),
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      priceSuggestion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    clockService = {
      now: jest.fn(() => new Date(baseNow.getTime())),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (url: string) => url),
    };

    quarantineService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: quarantineService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  describe('Confidentiality of Price Suggestions (AC #2)', () => {
    it('conceals activePriceSuggestion and priceSuggestions from public buyers on getListingById', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());

      const publicResult = await service.getListingById(listingId, otherUserId, false);
      expect(publicResult.activePriceSuggestion).toBeUndefined();
      expect(publicResult.priceSuggestions).toBeUndefined();
    });

    it('includes activePriceSuggestion and priceSuggestions for the owning seller and admins on getListingById', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());

      const sellerResult = await service.getListingById(listingId, sellerUserId, false);
      expect(sellerResult.activePriceSuggestion).toBeDefined();
      expect(sellerResult.activePriceSuggestion.suggestedPrice).toBe(3850000);
      expect(sellerResult.priceSuggestions).toHaveLength(1);

      const adminResult = await service.getListingById(listingId, undefined, true);
      expect(adminResult.activePriceSuggestion).toBeDefined();
      expect(adminResult.priceSuggestions).toHaveLength(1);
    });

    it('includes activePriceSuggestion and priceSuggestions in getMyListings for the seller', async () => {
      prisma.listing.findMany.mockResolvedValue([makeMockListing()]);

      const myListings = await service.getMyListings(sellerUserId);
      expect(myListings.items).toHaveLength(1);
      expect(myListings.items[0].activePriceSuggestion).toBeDefined();
      expect(myListings.items[0].activePriceSuggestion.suggestedPrice).toBe(3850000);
    });
  });

  describe('acceptPriceSuggestion (AC #3)', () => {
    it('updates suggestion to ACCEPTED, updates Listing askPrice, transitions ACTIVE listing to PENDING_REVIEW (BR-13), increments version, and logs AuditLog', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.ACTIVE,
        askPrice: 4200000,
        version: 2,
      });
      const mockSuggestion = mockListing.priceSuggestions[0];

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.priceSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      prisma.priceSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: PriceSuggestionStatus.ACCEPTED,
        sellerResponseNote: 'موافق على السعر الاسترشادي لتسريع البيع',
        respondedAt: baseNow,
      });
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        askPrice: 3850000,
        status: ListingStatus.PENDING_REVIEW,
        version: 3,
      });

      const res = await service.acceptPriceSuggestion(
        listingId,
        suggestionId,
        sellerUserId,
        { sellerResponseNote: 'موافق على السعر الاسترشادي لتسريع البيع' },
      );

      expect(prisma.priceSuggestion.update).toHaveBeenCalledWith({
        where: { id: suggestionId },
        data: {
          status: PriceSuggestionStatus.ACCEPTED,
          sellerResponseNote: 'موافق على السعر الاسترشادي لتسريع البيع',
          respondedAt: baseNow,
        },
      });

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: expect.objectContaining({
          status: ListingStatus.PENDING_REVIEW,
          version: { increment: 1 },
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: sellerUserId,
          actorType: 'USER',
          action: 'LISTING_PRICE_SUGGESTION_ACCEPTED',
          entityType: 'Listing',
          entityId: listingId,
          payload: expect.objectContaining({
            suggestionId,
            previousAskPrice: 4200000,
            newAskPrice: 3850000,
            previousStatus: ListingStatus.ACTIVE,
            newStatus: ListingStatus.PENDING_REVIEW,
          }),
        }),
      });

      expect(res.suggestion.status).toBe(PriceSuggestionStatus.ACCEPTED);
      expect(res.listing.askPrice).toBe(3850000);
      expect(res.listing.status).toBe(ListingStatus.PENDING_REVIEW);
    });

    it('rejects with 403 LISTING_ROLE_UNAUTHORIZED when called by a user who is not the listing seller', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());

      await expect(
        service.acceptPriceSuggestion(listingId, suggestionId, otherUserId, {}),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.acceptPriceSuggestion(listingId, suggestionId, otherUserId, {}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_ROLE_UNAUTHORIZED }),
      });
    });

    it('rejects with 409 PRICE_SUGGESTION_ALREADY_RESPONDED if suggestion is not PENDING', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());
      prisma.priceSuggestion.findUnique.mockResolvedValue({
        ...makeMockListing().priceSuggestions[0],
        status: PriceSuggestionStatus.DECLINED,
      });

      await expect(
        service.acceptPriceSuggestion(listingId, suggestionId, sellerUserId, {}),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.acceptPriceSuggestion(listingId, suggestionId, sellerUserId, {}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: PRICE_SUGGESTION_ALREADY_RESPONDED }),
      });
    });
  });

  describe('declinePriceSuggestion (AC #4)', () => {
    it('updates suggestion to DECLINED, preserves Listing askPrice and status without penalty, and logs LISTING_PRICE_SUGGESTION_DECLINED', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.ACTIVE,
        askPrice: 4200000,
      });
      const mockSuggestion = mockListing.priceSuggestions[0];

      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.priceSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      prisma.priceSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: PriceSuggestionStatus.DECLINED,
        sellerResponseNote: 'أفضل الاحتفاظ بالسعر الحالي نظراً لتشطيبات العقار الخاصة',
        respondedAt: baseNow,
      });

      const res = await service.declinePriceSuggestion(
        listingId,
        suggestionId,
        sellerUserId,
        { sellerResponseNote: 'أفضل الاحتفاظ بالسعر الحالي نظراً لتشطيبات العقار الخاصة' },
      );

      expect(prisma.priceSuggestion.update).toHaveBeenCalledWith({
        where: { id: suggestionId },
        data: {
          status: PriceSuggestionStatus.DECLINED,
          sellerResponseNote: 'أفضل الاحتفاظ بالسعر الحالي نظراً لتشطيبات العقار الخاصة',
          respondedAt: baseNow,
        },
      });

      // Verify listing askPrice and status are NEVER altered on decline
      expect(prisma.listing.update).not.toHaveBeenCalled();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: sellerUserId,
          actorType: 'USER',
          action: 'LISTING_PRICE_SUGGESTION_DECLINED',
          entityType: 'Listing',
          entityId: listingId,
          payload: expect.objectContaining({
            suggestionId,
            preservedAskPrice: 4200000,
            suggestedPrice: 3850000,
          }),
        }),
      });

      expect(res.suggestion.status).toBe(PriceSuggestionStatus.DECLINED);
      expect(res.listing.askPrice).toBe(4200000);
      expect(res.listing.status).toBe(ListingStatus.ACTIVE);
    });

    it('throws 404 PRICE_SUGGESTION_NOT_FOUND when suggestion does not belong to listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());
      prisma.priceSuggestion.findUnique.mockResolvedValue({
        ...makeMockListing().priceSuggestions[0],
        listingId: 'other-listing-id',
      });

      await expect(
        service.declinePriceSuggestion(listingId, suggestionId, sellerUserId, {}),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.declinePriceSuggestion(listingId, suggestionId, sellerUserId, {}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: PRICE_SUGGESTION_NOT_FOUND }),
      });
    });
  });
});

