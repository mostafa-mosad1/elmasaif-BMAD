import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OffersService } from '../offers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  ListingStatus,
  OfferStatus,
  ProfileStatus,
  PropertyType,
  UserRole,
  OFFER_ACTIVE_EXISTS,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_EXPIRY_HOURS,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_SELF_SUBMISSION_FORBIDDEN,
} from '@elmasaif/shared';

describe('OffersService (Story 4.1 / FR-25, A-07, BR-11)', () => {
  let service: OffersService;
  let prisma: any;
  let clockService: any;

  const userId = 'user-uuid-1';
  const buyerProfileId = 'buyer-profile-1';
  const sellerUserId = 'seller-user-2';
  const listingId = '22222222-2222-2222-2222-222222222222';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const askPrice = 1200000;

  const buyerProfile = () => ({
    id: buyerProfileId,
    userId,
    role: UserRole.BUYER,
    status: ProfileStatus.ACTIVE,
  });

  const listingRow = (overrides: Partial<any> = {}) => ({
    id: listingId,
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    askPrice: String(askPrice),
    areaSquareMeters: 300,
    sellerProfileId: 'seller-profile-1',
    sellerProfile: { id: 'seller-profile-1', userId: sellerUserId },
    city: { id: 'city-1', nameAr: 'الطائف' },
    district: { id: 'district-1', nameAr: 'الشهداء الشمالية' },
    ...overrides,
  });

  const offerRow = (overrides: Partial<any> = {}) => ({
    id: 'offer-1',
    listingId,
    buyerProfileId,
    offerPrice: '1150000.00',
    status: OfferStatus.PENDING_ADMIN_REVIEW,
    isBackup: false,
    isLowPrice: false,
    note: null,
    expiresAt: new Date(mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000),
    createdAt: mockNow,
    ...overrides,
  });

  const dto = (overrides: Partial<any> = {}) => ({
    listingId,
    offerPrice: 1150000,
    note: null,
    lowPriceConfirmation: false,
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      userProfile: { findUnique: jest.fn().mockResolvedValue(buyerProfile()) },
      listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
      offer: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(offerRow()),
        findMany: jest.fn().mockResolvedValue([]),
      },
      offerHistory: { create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: listingId }]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  describe('submitOffer — happy path (AC#1, AC#8)', () => {
    it('records a PENDING_ADMIN_REVIEW offer with a 7-day expiry, history and audit in one transaction', async () => {
      const result = await service.submitOffer(userId, UserRole.BUYER, dto());

      // AD-4: the listing row is locked before any check runs.
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();

      const createArg = prisma.offer.create.mock.calls[0][0];
      expect(createArg.data).toEqual(
        expect.objectContaining({
          listingId,
          buyerProfileId,
          offerPrice: 1150000,
          status: OfferStatus.PENDING_ADMIN_REVIEW,
          isBackup: false,
          isLowPrice: false,
          note: null,
        }),
      );
      const expectedExpiry = mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000;
      expect(new Date(createArg.data.expiresAt).getTime()).toBe(expectedExpiry);

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: {
          offerId: 'offer-1',
          actorProfileId: buyerProfileId,
          action: 'OFFER_SUBMITTED',
          priceSnapshot: 1150000,
          notes: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: userId,
          actorType: 'USER',
          action: 'OFFER_SUBMITTED',
          entityType: 'Offer',
          entityId: 'offer-1',
          payload: expect.objectContaining({
            listingId,
            offerPrice: 1150000,
            askPrice,
            isBackup: false,
            isLowPrice: false,
          }),
        }),
      });

      expect(result.status).toBe(OfferStatus.PENDING_ADMIN_REVIEW);
      expect(result.offerPrice).toBe(1150000);
      expect(result.askPrice).toBe(askPrice);
      expect(result.isBackup).toBe(false);
      expect(result.listing.cityName).toBe('الطائف');
      expect(result.listing.districtName).toBe('الشهداء الشمالية');
    });

    it('locks the listing row through the text id column (no ::uuid cast)', async () => {
      await service.submitOffer(userId, UserRole.BUYER, dto());

      // `listings.id` is `text` in the Prisma schema (`String @id @default(uuid())` has no
      // `@db.Uuid`), so casting the parameter to `uuid` fails at runtime with
      // `operator does not exist: text = uuid` (P2010 / 42883) and surfaces as a 500.
      const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
      expect(sql).toContain('FROM "listings"');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('::text');
      expect(sql).not.toContain('::uuid');
    });

    it('stores the note when provided', async () => {
      prisma.offer.create.mockResolvedValue(offerRow({ note: 'جاهز للتسجيل' }));

      await service.submitOffer(userId, UserRole.BUYER, dto({ note: 'جاهز للتسجيل' }));

      expect(prisma.offer.create.mock.calls[0][0].data.note).toBe('جاهز للتسجيل');
      expect(prisma.offerHistory.create.mock.calls[0][0].data.notes).toBe('جاهز للتسجيل');
    });
  });

  describe('submitOffer — RESERVED listing (AC#4)', () => {
    it('flags the offer as a backup offer', async () => {
      prisma.listing.findUnique.mockResolvedValue(listingRow({ status: ListingStatus.RESERVED }));
      prisma.offer.create.mockResolvedValue(offerRow({ isBackup: true }));

      const result = await service.submitOffer(userId, UserRole.BUYER, dto());

      expect(prisma.offer.create.mock.calls[0][0].data.isBackup).toBe(true);
      expect(result.isBackup).toBe(true);
    });
  });

  describe('submitOffer — listing state guardrail (AC#6)', () => {
    const blockedStatuses = [
      ListingStatus.DRAFT,
      ListingStatus.PENDING_REVIEW,
      ListingStatus.PENDING_FEE,
      ListingStatus.SOLD,
      ListingStatus.REJECTED,
      ListingStatus.UNDER_COMPLIANCE_REVIEW,
      ListingStatus.ARCHIVED,
      ListingStatus.SUSPENDED,
      ListingStatus.BLOCKED,
    ];

    it.each(blockedStatuses)('rejects offers on a %s listing', async (status) => {
      prisma.listing.findUnique.mockResolvedValue(listingRow({ status }));

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_LISTING_NOT_OFFERABLE },
      });
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_LISTING_NOT_FOUND },
      });
    });

    it('forbids an offer on the caller’s own listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        listingRow({ sellerProfile: { id: 'seller-profile-1', userId } }),
      );

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_SELF_SUBMISSION_FORBIDDEN },
      });
    });
  });

  describe('submitOffer — price envelope (AC#2)', () => {
    it.each([0, -5, 50000001, Number.NaN])('rejects the out-of-envelope price %s', async (price) => {
      await expect(
        service.submitOffer(userId, UserRole.BUYER, dto({ offerPrice: price })),
      ).rejects.toMatchObject({ response: { code: OFFER_PRICE_OUT_OF_RANGE } });
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('accepts the envelope boundaries', async () => {
      await expect(
        service.submitOffer(
          userId,
          UserRole.BUYER,
          dto({ offerPrice: 1, lowPriceConfirmation: true }),
        ),
      ).resolves.toBeDefined();
      await expect(
        service.submitOffer(userId, UserRole.BUYER, dto({ offerPrice: 50_000_000 })),
      ).resolves.toBeDefined();
    });
  });

  describe('submitOffer — low-price confirmation (AC#3, BR-11)', () => {
    it('rejects a sub-50% bid without the explicit acknowledgement', async () => {
      await expect(
        service.submitOffer(userId, UserRole.BUYER, dto({ offerPrice: askPrice * 0.49 })),
      ).rejects.toMatchObject({
        response: { code: OFFER_LOW_PRICE_CONFIRMATION_REQUIRED },
      });
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('persists isLowPrice when the buyer acknowledged it', async () => {
      const lowPrice = askPrice * 0.49;
      prisma.offer.create.mockResolvedValue(offerRow({ isLowPrice: true, offerPrice: String(lowPrice) }));

      const result = await service.submitOffer(
        userId,
        UserRole.BUYER,
        dto({ offerPrice: lowPrice, lowPriceConfirmation: true }),
      );

      expect(prisma.offer.create.mock.calls[0][0].data.isLowPrice).toBe(true);
      expect(prisma.auditLog.create.mock.calls[0][0].data.payload.isLowPrice).toBe(true);
      expect(result.isLowPrice).toBe(true);
    });

    it('does not require the acknowledgement at exactly 50% of the ask price', async () => {
      await expect(
        service.submitOffer(userId, UserRole.BUYER, dto({ offerPrice: askPrice * 0.5 })),
      ).resolves.toBeDefined();
    });
  });

  describe('submitOffer — one active offer per buyer per listing (AC#5, A-07)', () => {
    it('rejects the submission when an unexpired non-terminal offer already exists', async () => {
      prisma.offer.count.mockResolvedValue(1);

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_ACTIVE_EXISTS },
      });
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('scopes the active count to the buyer, the listing, active statuses and a future expiry', async () => {
      await service.submitOffer(userId, UserRole.BUYER, dto());

      const where = prisma.offer.count.mock.calls[0][0].where;
      expect(where.buyerProfileId).toBe(buyerProfileId);
      expect(where.listingId).toBe(listingId);
      expect(where.status.in).toContain(OfferStatus.PENDING_ADMIN_REVIEW);
      expect(where.expiresAt.gt).toBe(mockNow);
    });

    it('allows a new offer when the previous one has lapsed', async () => {
      // A lapsed offer is excluded by `expiresAt > now`, so the count stays 0.
      prisma.offer.count.mockResolvedValue(0);

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).resolves.toBeDefined();
    });
  });

  describe('submitOffer — buyer profile guardrail', () => {
    it('rejects a caller with no ACTIVE buyer profile', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_BUYER_PROFILE_REQUIRED },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a suspended buyer profile', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile(),
        status: ProfileStatus.SUSPENDED,
      });

      await expect(service.submitOffer(userId, UserRole.BUYER, dto())).rejects.toMatchObject({
        response: { code: OFFER_BUYER_PROFILE_REQUIRED },
      });
    });

    it('rejects a caller whose active workspace is not BUYER (FR-3)', async () => {
      await expect(
        service.submitOffer(userId, UserRole.MARKETER, dto()),
      ).rejects.toMatchObject({ response: { code: OFFER_BUYER_PROFILE_REQUIRED } });
    });
  });

  describe('listMyOffers (AC#7)', () => {
    it('returns the caller’s offers newest first with the listing summary', async () => {
      prisma.offer.findMany.mockResolvedValue([
        offerRow({ listing: listingRow() }),
        offerRow({ id: 'offer-2', status: OfferStatus.EXPIRED }),
      ]);

      const result = await service.listMyOffers(userId, UserRole.BUYER, {});

      const arg = prisma.offer.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ buyerProfileId });
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
      expect(arg.include).toEqual({ listing: { include: { city: true, district: true } } });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].listing.title).toBe('فيلا شمال الطائف');
      expect(result.items[0].listing.status).toBe(ListingStatus.ACTIVE);
      expect(result.items[0].listing.areaSquareMeters).toBe(300);
      expect(result.items[1].status).toBe(OfferStatus.EXPIRED);
    });

    it('narrows to one listing when listingId is supplied', async () => {
      await service.listMyOffers(userId, UserRole.BUYER, { listingId });

      expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual({
        buyerProfileId,
        listingId,
      });
    });

    it('is scoped to the caller’s own buyer profile only', async () => {
      await service.listMyOffers(userId, UserRole.BUYER, {});

      expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId_role: { userId, role: UserRole.BUYER } },
      });
    });

    it('rejects a caller with no buyer profile', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.listMyOffers(userId, UserRole.BUYER, {})).rejects.toMatchObject({
        response: { code: OFFER_BUYER_PROFILE_REQUIRED },
      });
    });
  });
});
