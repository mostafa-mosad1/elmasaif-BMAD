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
  ACTIVE_OFFER_STATUSES,
  MAX_COUNTER_ROUNDS,
  OFFER_ACTIVE_EXISTS,
  OFFER_ALREADY_EXPIRED,
  OFFER_BUYER_PROFILE_REQUIRED,
  OFFER_EXPIRY_HOURS,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_LISTING_NOT_FOUND,
  OFFER_LISTING_NOT_OFFERABLE,
  OFFER_LOW_PRICE_CONFIRMATION_REQUIRED,
  OFFER_MAX_ROUNDS_REACHED,
  OFFER_NOT_FOUND,
  OFFER_NOT_PARTY,
  OFFER_PRICE_OUT_OF_RANGE,
  OFFER_REJECTION_NOTE_REQUIRED,
  OFFER_SELLER_PROFILE_REQUIRED,
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
          roundNumber: 0,
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

describe('OffersService — mediated negotiation (Story 4.2 / FR-26, FR-55)', () => {
  let service: OffersService;
  let prisma: any;
  let clockService: any;

  const userId = 'user-uuid-1';
  const buyerProfileId = 'buyer-profile-1';
  const sellerProfileId = 'seller-profile-1';
  const sellerUserId = 'seller-user-2';
  const otherUserId = 'other-user-3';
  const listingId = '22222222-2222-2222-2222-222222222222';
  const offerId = 'offer-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const askPrice = 1200000;

  const buyerProfile = () => ({
    id: buyerProfileId,
    userId,
    role: UserRole.BUYER,
    status: ProfileStatus.ACTIVE,
  });

  const sellerProfile = () => ({
    id: sellerProfileId,
    userId: sellerUserId,
    role: UserRole.MARKETER,
    status: ProfileStatus.ACTIVE,
  });

  const listingRow = (overrides: Partial<any> = {}) => ({
    id: listingId,
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    askPrice: String(askPrice),
    areaSquareMeters: 300,
    sellerProfileId,
    sellerProfile: {
      id: sellerProfileId,
      userId: sellerUserId,
      user: { fullName: 'بائع العقار' },
    },
    city: { id: 'city-1', nameAr: 'الطائف' },
    district: { id: 'district-1', nameAr: 'الشهداء الشمالية' },
    ...overrides,
  });

  const offerRow = (overrides: Partial<any> = {}) => ({
    id: offerId,
    listingId,
    buyerProfileId,
    offerPrice: '1150000.00',
    status: OfferStatus.RELAYED_TO_SELLER,
    isBackup: false,
    isLowPrice: false,
    note: null,
    negotiationRound: 0,
    rejectionReason: null,
    rejectionNote: null,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    expiresAt: new Date(mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000),
    createdAt: mockNow,
    listing: listingRow(),
    buyerProfile: { id: buyerProfileId, user: { fullName: 'مشتري العقار' } },
    history: [],
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      userProfile: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(
            where.userId_role.role === UserRole.BUYER ? buyerProfile() : sellerProfile(),
          ),
        ),
      },
      offer: {
        findUnique: jest.fn().mockResolvedValue(offerRow()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(offerRow()),
      },
      offerHistory: { create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: offerId }]),
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

  describe('accept-by-seller (AC#2, AC#5)', () => {
    it('moves RELAYED_TO_SELLER to the mutual-agreement hand-off and clears the admin lock', async () => {
      const result = await service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId);

      expect(prisma.$transaction).toHaveBeenCalled();
      const update = prisma.offer.update.mock.calls[0][0];
      expect(update.data).toEqual(
        expect.objectContaining({
          status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
          version: { increment: 1 },
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        }),
      );

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: {
          offerId,
          actorProfileId: sellerProfileId,
          action: 'OFFER_ACCEPTED_BY_SELLER',
          priceSnapshot: 1150000,
          notes: null,
          roundNumber: 0,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: sellerUserId,
          actorType: 'USER',
          action: 'OFFER_ACCEPTED_BY_SELLER',
          entityType: 'Offer',
          entityId: offerId,
          payload: expect.objectContaining({
            fromStatus: OfferStatus.RELAYED_TO_SELLER,
            toStatus: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
            price: 1150000,
            round: 0,
          }),
        }),
      });

      expect(result.status).toBe(OfferStatus.RELAYED_TO_SELLER);
      expect(result.maxCounterRounds).toBe(MAX_COUNTER_ROUNDS);
    });

    it('locks the offer row through the text id column (no ::uuid cast)', async () => {
      await service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId);

      const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
      expect(sql).toContain('FROM "offers"');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('::text');
      expect(sql).not.toContain('::uuid');
    });

    it('refuses the acceptance from any other source status', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.PENDING_ADMIN_REVIEW }),
      );

      await expect(
        service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_INVALID_STATE_TRANSITION } });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses a response on an offer whose expiry has passed', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ expiresAt: new Date(mockNow.getTime() - 1000) }),
      );

      await expect(
        service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_ALREADY_EXPIRED } });
    });

    it('returns 404 for an unknown offer id', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_NOT_FOUND } });
    });

    it('forbids a caller who is not the listing’s seller', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: 'other-profile',
        userId: otherUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
      });

      await expect(
        service.acceptBySeller(otherUserId, UserRole.MARKETER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_NOT_PARTY } });
    });

    it('refuses a caller with no active MARKETER/OWNER profile (FR-3)', async () => {
      await expect(
        service.acceptBySeller(sellerUserId, UserRole.BUYER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_SELLER_PROFILE_REQUIRED } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('counter-by-seller (AC#2, AC#3)', () => {
    it('replaces the offer price, increments the round and resets the 7-day expiry', async () => {
      const result = await service.counterBySeller(sellerUserId, UserRole.MARKETER, offerId, {
        counterPrice: 1250000,
        note: 'السعر النهائي',
      });

      const update = prisma.offer.update.mock.calls[0][0];
      expect(update.data).toEqual(
        expect.objectContaining({
          status: OfferStatus.COUNTER_OFFERED,
          offerPrice: 1250000,
          negotiationRound: { increment: 1 },
          version: { increment: 1 },
        }),
      );
      expect(new Date(update.data.expiresAt).getTime()).toBe(
        mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000,
      );

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: {
          offerId,
          actorProfileId: sellerProfileId,
          action: 'OFFER_COUNTER_BY_SELLER',
          priceSnapshot: 1250000,
          notes: 'السعر النهائي',
          roundNumber: 1,
        },
      });
      expect(result.maxCounterRounds).toBe(MAX_COUNTER_ROUNDS);
    });

    it('allows the counter at round 4 and refuses it at the cap (AC#3)', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ negotiationRound: MAX_COUNTER_ROUNDS - 1 }),
      );
      await expect(
        service.counterBySeller(sellerUserId, UserRole.MARKETER, offerId, { counterPrice: 1200000 }),
      ).resolves.toBeDefined();

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ negotiationRound: MAX_COUNTER_ROUNDS }),
      );
      prisma.offer.update.mockClear();
      await expect(
        service.counterBySeller(sellerUserId, UserRole.MARKETER, offerId, { counterPrice: 1200000 }),
      ).rejects.toMatchObject({ response: { code: OFFER_MAX_ROUNDS_REACHED } });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('still allows acceptance at the round cap', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ negotiationRound: MAX_COUNTER_ROUNDS }),
      );

      await expect(
        service.acceptBySeller(sellerUserId, UserRole.MARKETER, offerId),
      ).resolves.toBeDefined();
    });

    it('refuses a counter price outside the shared SAR envelope', async () => {
      await expect(
        service.counterBySeller(sellerUserId, UserRole.MARKETER, offerId, { counterPrice: 0 }),
      ).rejects.toMatchObject({
        response: { code: 'OFFER_COUNTER_PRICE_OUT_OF_RANGE' },
      });
    });
  });

  describe('reject-by-seller (AC#2)', () => {
    it('records the structured reason and moves the offer to REJECTED_BY_SELLER', async () => {
      await service.rejectBySeller(sellerUserId, UserRole.MARKETER, offerId, {
        reason: 'PRICE_TOO_LOW',
        note: null,
      });

      const update = prisma.offer.update.mock.calls[0][0];
      expect(update.data).toEqual(
        expect.objectContaining({
          status: OfferStatus.REJECTED_BY_SELLER,
          rejectionReason: 'PRICE_TOO_LOW',
          rejectionNote: null,
        }),
      );
      // A terminal target keeps the existing expiry instead of reviving the offer.
      expect(update.data.expiresAt).toBeUndefined();
    });

    it('requires a detailed note when the reason is OTHER', async () => {
      await expect(
        service.rejectBySeller(sellerUserId, UserRole.MARKETER, offerId, {
          reason: 'OTHER',
          note: null,
        }),
      ).rejects.toMatchObject({ response: { code: OFFER_REJECTION_NOTE_REQUIRED } });
      await expect(
        service.rejectBySeller(sellerUserId, UserRole.MARKETER, offerId, {
          reason: 'OTHER',
          note: 'قصير',
        }),
      ).rejects.toMatchObject({ response: { code: OFFER_REJECTION_NOTE_REQUIRED } });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });

  describe('buyer counter round-trip (AC#4)', () => {
    it('accepts the relayed counter as mutual agreement', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.RELAYED_TO_BUYER, offerPrice: '1250000.00' }),
      );

      await service.acceptByBuyer(userId, UserRole.BUYER, offerId);

      expect(prisma.offer.update.mock.calls[0][0].data.status).toBe(
        OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
      );
      expect(prisma.offerHistory.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          actorProfileId: buyerProfileId,
          action: 'OFFER_ACCEPTED_BY_BUYER',
          priceSnapshot: 1250000,
        }),
      );
    });

    it('bumps the round when the buyer counters again', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.RELAYED_TO_BUYER, negotiationRound: 2 }),
      );

      await service.counterByBuyer(userId, UserRole.BUYER, offerId, { counterPrice: 1180000 });

      expect(prisma.offerHistory.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          actorProfileId: buyerProfileId,
          action: 'OFFER_COUNTER_BY_BUYER',
          priceSnapshot: 1180000,
          roundNumber: 3,
        }),
      );
    });

    it('forbids a buyer who does not own the offer', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile(),
        id: 'another-buyer-profile',
      });

      await expect(
        service.acceptByBuyer(userId, UserRole.BUYER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_NOT_PARTY } });
    });
  });

  describe('listReceivedOffers (AC#10)', () => {
    it('scopes the query to the caller’s own seller profile', async () => {
      prisma.offer.findMany.mockResolvedValue([offerRow()]);

      const result = await service.listReceivedOffers(sellerUserId, UserRole.MARKETER);

      const arg = prisma.offer.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ listing: { sellerProfileId } });
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sellerName).toBe('بائع العقار');
      expect(result.items[0].buyerName).toBe('مشتري العقار');
      expect(result.items[0].awaitingParty).toBe('SELLER');
    });

    it('rejects a caller browsing in the BUYER workspace (FR-3)', async () => {
      await expect(
        service.listReceivedOffers(userId, UserRole.BUYER),
      ).rejects.toMatchObject({ response: { code: OFFER_SELLER_PROFILE_REQUIRED } });
    });
  });

  describe('getOfferThread (AC#10)', () => {
    it.each([
      [OfferStatus.PENDING_ADMIN_REVIEW, 'ADMIN'],
      [OfferStatus.COUNTER_OFFERED, 'ADMIN'],
      [OfferStatus.RELAYED_TO_SELLER, 'SELLER'],
      [OfferStatus.RELAYED_TO_BUYER, 'BUYER'],
      [OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, null],
    ])('derives awaitingParty %s → %s', async (status, expected) => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ status }));

      const thread = await service.getOfferThread(userId, UserRole.BUYER, offerId);

      expect(thread.status).toBe(status);
      expect(thread.awaitingParty).toBe(expected);
    });

    it('maps every history row to its actor role, with admin steps never mislabelled', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({
          history: [
            {
              id: 'h1',
              action: 'OFFER_SUBMITTED',
              actorProfileId: buyerProfileId,
              actorAdminId: null,
              priceSnapshot: '1150000.00',
              notes: null,
              roundNumber: 0,
              createdAt: mockNow,
            },
            {
              id: 'h2',
              action: 'OFFER_RELAYED_TO_SELLER',
              actorProfileId: null,
              actorAdminId: 'admin-1',
              priceSnapshot: '1150000.00',
              notes: null,
              roundNumber: 0,
              createdAt: mockNow,
            },
            {
              id: 'h3',
              action: 'OFFER_COUNTER_BY_SELLER',
              actorProfileId: sellerProfileId,
              actorAdminId: null,
              priceSnapshot: '1250000.00',
              notes: 'السعر النهائي',
              roundNumber: 1,
              createdAt: mockNow,
            },
          ],
        }),
      );

      const thread = await service.getOfferThread(userId, UserRole.BUYER, offerId);

      expect(thread.history).toHaveLength(3);
      expect(thread.history[0].actorRole).toBe('BUYER');
      expect(thread.history[0].actorName).toBe('مشتري العقار');
      expect(thread.history[1].actorRole).toBe('ADMIN');
      expect(thread.history[2].actorRole).toBe('SELLER');
      expect(thread.history[2].actorName).toBe('بائع العقار');
      expect(thread.history[2].priceSnapshot).toBe(1250000);
      expect(thread.history[2].roundNumber).toBe(1);
      expect(thread.history[2].createdAt).toBe(mockNow.toISOString());
    });

    it('forbids a third party', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile(),
        id: 'third-party-profile',
      });

      await expect(
        service.getOfferThread(userId, UserRole.BUYER, offerId),
      ).rejects.toMatchObject({ response: { code: OFFER_NOT_PARTY } });
    });

    it('returns 404 for an unknown offer id', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(
        service.getOfferThread(userId, UserRole.BUYER, 'nope'),
      ).rejects.toMatchObject({ response: { code: OFFER_NOT_FOUND } });
    });
  });

  describe('active offer set (AC#12 regression guard)', () => {
    it('keeps the mediation statuses inside ACTIVE_OFFER_STATUSES', () => {
      expect(ACTIVE_OFFER_STATUSES).toContain(OfferStatus.RELAYED_TO_BUYER);
      expect(ACTIVE_OFFER_STATUSES).toContain(OfferStatus.COUNTER_OFFERED);
      expect(ACTIVE_OFFER_STATUSES).toContain(
        OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
      );
    });
  });
});
