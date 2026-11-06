import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import {
  BackupOffersService,
  resolveBackupQueueState,
} from '../backup-offers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  ListingStatus,
  OFFER_BACKUP_ALREADY_ACTIVATED,
  OFFER_BACKUP_LISTING_UNAVAILABLE,
  OFFER_BACKUP_NOT_QUEUED,
  OFFER_BACKUP_PRIMARY_DEAL_ACTIVE,
  OFFER_EXPIRY_HOURS,
  OFFER_HISTORY_ACTIONS,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
  OfferStatus,
  PropertyType,
} from '@elmasaif/shared';

describe('BackupOffersService — backup offer pipeline (Story 4.3 / FR-27, OQ-04, AD-10)', () => {
  let service: BackupOffersService;
  let prisma: any;
  let clockService: any;

  const admin = {
    id: 'admin-1',
    username: 'moderator.one',
    email: 'moderator.one@elmasaif.sa',
    fullName: 'مشرف الوساطة الأول',
    role: 'MODERATOR',
    isActive: true,
    permissions: ['Offers.Review'],
  };
  const otherAdmin = {
    id: 'admin-2',
    fullName: 'مشرف الوساطة الثاني',
    username: 'moderator.two',
  };

  const listingId = 'listing-1';
  const secondListingId = 'listing-2';
  const offerId = 'offer-1';
  const secondOfferId = 'offer-2';
  const buyerProfileId = 'buyer-profile-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const liveLockExpiry = new Date(mockNow.getTime() + 10 * 60 * 1000);
  const futureExpiry = new Date(mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000);

  const listingRow = (overrides: Partial<any> = {}) => ({
    id: listingId,
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    askPrice: '1200000.00',
    areaSquareMeters: 300,
    city: { id: 'city-1', nameAr: 'الطائف' },
    district: { id: 'district-1', nameAr: 'الشهداء الشمالية' },
    ...overrides,
  });

  const offerRow = (overrides: Partial<any> = {}) => ({
    id: offerId,
    listingId,
    buyerProfileId,
    offerPrice: '1150000.00',
    status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    isBackup: true,
    isLowPrice: false,
    note: null,
    negotiationRound: 1,
    rejectionReason: null,
    rejectionNote: null,
    activatedAt: null,
    lockedByAdminId: admin.id,
    lockedAt: mockNow,
    lockExpiresAt: liveLockExpiry,
    expiresAt: futureExpiry,
    createdAt: mockNow,
    listing: listingRow(),
    buyerProfile: { id: buyerProfileId, user: { fullName: 'مشتري العقار' } },
    history: [],
    ...overrides,
  });

  /** `$queryRaw` is a tagged template — the first argument is the literal chunk array. */
  const rawSqlAt = (index: number): string =>
    (prisma.$queryRaw.mock.calls[index][0] as string[]).join('?');

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      offer: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      offerHistory: { create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: offerId }]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupOffersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<BackupOffersService>(BackupOffersService);
  });

  describe('resolveBackupQueueState (AC#2)', () => {
    it('derives the queue state from Listing.status only', () => {
      expect(resolveBackupQueueState(ListingStatus.ACTIVE)).toBe('SURFACED');
      expect(resolveBackupQueueState(ListingStatus.RESERVED)).toBe('QUEUED');
      expect(resolveBackupQueueState(ListingStatus.SOLD)).toBe('CLOSABLE');
    });

    it('freezes the queue on every other listing status', () => {
      const frozen = Object.values(ListingStatus).filter(
        (status) =>
          status !== ListingStatus.ACTIVE &&
          status !== ListingStatus.RESERVED &&
          status !== ListingStatus.SOLD,
      );

      expect(frozen.length).toBeGreaterThan(0);
      for (const status of frozen) {
        expect(resolveBackupQueueState(status)).toBe('FROZEN');
      }
    });
  });

  describe('getBackupQueue (AC#1, AC#2, AC#3)', () => {
    it('reads the queue through the FR-27 predicate and returns nothing for an empty queue', async () => {
      const result = await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      const rootArg = prisma.offer.findMany.mock.calls[0][0];
      expect(rootArg.where).toEqual({
        isBackup: true,
        status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
        activatedAt: null,
      });
      expect(rootArg.distinct).toEqual(['listingId']);
      expect(rootArg.orderBy).toEqual({ createdAt: 'asc' });

      // No listing is loaded when no listing holds a queue.
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    });

    it('excludes activated, non-backup and non-selected offers from the queue', async () => {
      await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      const where = prisma.offer.findMany.mock.calls[0][0].where;
      // An activated candidate is the winning offer — Story 5.1 owns its terminal transition.
      expect(where.activatedAt).toBeNull();
      expect(where.isBackup).toBe(true);
      expect(where.status).toBe(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL);
    });

    it('groups per listing, orders SURFACED first, and numbers positions oldest-first', async () => {
      prisma.offer.findMany
        .mockResolvedValueOnce([
          // Reserved listing queued earlier than the surfaced one.
          { listingId: secondListingId, createdAt: new Date(mockNow.getTime() - 90_000) },
          { listingId, createdAt: new Date(mockNow.getTime() - 30_000) },
        ])
        .mockResolvedValueOnce([
          offerRow({
            id: secondOfferId,
            listingId: secondListingId,
            createdAt: new Date(mockNow.getTime() - 90_000),
            listing: listingRow({ id: secondListingId, status: ListingStatus.RESERVED }),
          }),
          offerRow({ id: 'offer-3', createdAt: new Date(mockNow.getTime() - 40_000) }),
          offerRow({ id: offerId, createdAt: new Date(mockNow.getTime() - 30_000) }),
        ]);
      prisma.listing.findMany.mockResolvedValue([
        listingRow({ status: ListingStatus.ACTIVE }),
        listingRow({ id: secondListingId, status: ListingStatus.RESERVED }),
      ]);

      const result = await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      // AC#2: the surfaced group reads first even though it queued later.
      expect(result.items.map((group) => group.listing.id)).toEqual([listingId, secondListingId]);
      expect(result.items.map((group) => group.queueState)).toEqual(['SURFACED', 'QUEUED']);

      // AC#3: 1-based positions, oldest queued first, scoped per listing.
      expect(result.items[0].items.map((item) => item.id)).toEqual(['offer-3', offerId]);
      expect(result.items[0].items.map((item) => item.queuePosition)).toEqual([1, 2]);
      expect(result.items[1].items.map((item) => item.queuePosition)).toEqual([1]);
    });

    it('counts listings — not offers — in meta.total', async () => {
      prisma.offer.findMany
        .mockResolvedValueOnce([
          { listingId, createdAt: mockNow },
          { listingId, createdAt: mockNow },
          { listingId, createdAt: mockNow },
        ])
        .mockResolvedValueOnce([offerRow({ id: 'offer-3' }), offerRow({ id: offerId })]);
      prisma.listing.findMany.mockResolvedValue([listingRow()]);

      const result = await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.items[0].items).toHaveLength(2);
    });

    it('paginates over groups and keeps the page deterministic', async () => {
      prisma.offer.findMany
        .mockResolvedValueOnce([
          { listingId, createdAt: mockNow },
          { listingId: secondListingId, createdAt: mockNow },
        ])
        .mockResolvedValueOnce([offerRow()]);
      prisma.listing.findMany.mockResolvedValue([
        listingRow(),
        listingRow({ id: secondListingId }),
      ]);

      const result = await service.getBackupQueue({ page: 2, limit: 1 } as any, admin.id);

      expect(result.meta).toEqual({ total: 2, page: 2, limit: 1, totalPages: 2 });
      expect(result.items).toHaveLength(1);
      // Both listings are ACTIVE, so the id tiebreak decides the page order.
      expect(result.items[0].listing.id).toBe(secondListingId);
    });

    it('projects the live lease with the holder name resolved in one lookup', async () => {
      prisma.offer.findMany
        .mockResolvedValueOnce([{ listingId, createdAt: mockNow }])
        .mockResolvedValueOnce([
          offerRow({ lockedByAdminId: otherAdmin.id, lockExpiresAt: liveLockExpiry }),
        ]);
      prisma.listing.findMany.mockResolvedValue([listingRow()]);
      prisma.adminUser.findMany.mockResolvedValue([
        { id: otherAdmin.id, fullName: otherAdmin.fullName, username: otherAdmin.username },
      ]);

      const result = await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(prisma.adminUser.findMany).toHaveBeenCalledTimes(1);
      expect(result.items[0].items[0].lockInfo).toEqual(
        expect.objectContaining({
          isLocked: true,
          isLockedByCurrentAdmin: false,
          lockedByAdminId: otherAdmin.id,
          lockedByAdminName: otherAdmin.fullName,
        }),
      );
    });

    it('reads an expired lease as unlocked (lazy expiry)', async () => {
      prisma.offer.findMany
        .mockResolvedValueOnce([{ listingId, createdAt: mockNow }])
        .mockResolvedValueOnce([
          offerRow({
            lockedByAdminId: otherAdmin.id,
            lockExpiresAt: new Date(mockNow.getTime() - 60_000),
          }),
        ]);
      prisma.listing.findMany.mockResolvedValue([listingRow()]);

      const result = await service.getBackupQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(prisma.adminUser.findMany).not.toHaveBeenCalled();
      expect(result.items[0].items[0].lockInfo).toEqual(
        expect.objectContaining({ isLocked: false, lockedByAdminId: null, remainingSeconds: 0 }),
      );
    });
  });

  describe('activateBackupOffer (AC#3, AC#4)', () => {
    it('stamps activatedAt in one transaction without touching status, expiry or a Deal', async () => {
      prisma.offer.findUnique
        .mockResolvedValueOnce(offerRow())
        .mockResolvedValueOnce(offerRow({ activatedAt: mockNow }));
      prisma.listing.findUnique.mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE });
      prisma.offer.count.mockResolvedValue(1);

      const result = await service.activateBackupOffer(offerId, admin as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      const data = prisma.offer.update.mock.calls[0][0].data;
      expect(data).toEqual({
        activatedAt: mockNow,
        version: { increment: 1 },
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      });
      // AD-2 / AD-8: activation is not a status change and never shortens the offer's window.
      expect(data.status).toBeUndefined();
      expect(data.expiresAt).toBeUndefined();
      expect(data.offerPrice).toBeUndefined();

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          offerId,
          actorAdminId: admin.id,
          action: OFFER_HISTORY_ACTIONS.BACKUP_ACTIVATED,
          priceSnapshot: 1150000,
          notes: null,
          roundNumber: 1,
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_BACKUP_ACTIVATED',
          entityType: 'Offer',
          entityId: offerId,
          payload: expect.objectContaining({
            listingId,
            queuePosition: 2,
            price: 1150000,
            previousListingStatus: ListingStatus.ACTIVE,
            adminName: admin.fullName,
            at: mockNow.toISOString(),
          }),
        }),
      });

      // Story 5.1 owns deal creation — this story must not create one.
      expect(prisma.deal).toBeUndefined();
      expect((prisma as any).listing.update).toBeUndefined();

      expect(result.queuePosition).toBe(2);
      expect(result.queueState).toBe('SURFACED');
      expect(result.activatedAt).toBe(mockNow.toISOString());
      // AD-10: the lease is released on decision commit.
      expect(result.lockInfo?.isLocked).toBe(false);
    });

    it('locks the offer then the listing, always casting text ids to ::text', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());
      prisma.listing.findUnique.mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE });

      await service.activateBackupOffer(offerId, admin as any);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);

      const offerSql = rawSqlAt(0);
      expect(offerSql).toContain('FROM "offers"');
      expect(offerSql).toContain('FOR UPDATE');
      expect(offerSql).toContain('::text');
      expect(offerSql).not.toContain('::uuid');

      const listingSql = rawSqlAt(1);
      expect(listingSql).toContain('FROM "listings"');
      expect(listingSql).toContain('FOR UPDATE');
      expect(listingSql).toContain('::text');
      expect(listingSql).not.toContain('::uuid');
    });

    it('404s for an unknown offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.activateBackupOffer('missing', admin as any)).rejects.toMatchObject({
        response: { code: OFFER_NOT_FOUND },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses an offer that is not a queued backup', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ isBackup: false }));

      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_NOT_QUEUED },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.PENDING_ADMIN_REVIEW }),
      );
      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_NOT_QUEUED },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses an offer that was already activated', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ activatedAt: mockNow }));

      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_ALREADY_ACTIVATED },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses while the primary deal still reserves the listing', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());
      prisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        status: ListingStatus.RESERVED,
      });

      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_PRIMARY_DEAL_ACTIVE },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses when the listing is unavailable (FROZEN or CLOSABLE)', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      for (const status of [ListingStatus.DRAFT, ListingStatus.SOLD]) {
        prisma.listing.findUnique.mockResolvedValue({ id: listingId, status });

        await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
          response: { code: OFFER_BACKUP_LISTING_UNAVAILABLE },
        });
      }
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses a second activation on the same listing', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());
      prisma.listing.findUnique.mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE });
      prisma.offer.findFirst.mockResolvedValue({ id: secondOfferId, activatedAt: mockNow });

      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_ALREADY_ACTIVATED },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('reports the state refusal before the lease refusal (most actionable error first)', async () => {
      // No lease held *and* the primary deal still active → the deal state wins.
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: null, lockExpiresAt: null }),
      );
      prisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        status: ListingStatus.RESERVED,
      });

      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_BACKUP_PRIMARY_DEAL_ACTIVE },
      });
    });

    it('refuses to activate without a live lease (required / conflict / expired)', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: null, lockedAt: null, lockExpiresAt: null }),
      );
      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_REQUIRED },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdmin.id }),
      );
      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_CONFLICT },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockExpiresAt: new Date(mockNow.getTime() - 1) }),
      );
      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.activateBackupOffer(offerId, admin as any)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_EXPIRED },
      });

      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(prisma.offerHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('closeRemainingBackupOffersForListing (AC#7)', () => {
    it('closes only approved, never-activated backups and writes history + audit per offer', async () => {
      prisma.offer.findMany.mockResolvedValue([
        offerRow({ id: offerId }),
        offerRow({ id: secondOfferId, negotiationRound: 3 }),
      ]);

      const result = await service.closeRemainingBackupOffersForListing(listingId, {
        reason: 'PRIMARY_DEAL_COMPLETED',
        actorAdminId: admin.id,
      });

      expect(prisma.offer.findMany).toHaveBeenCalledWith({
        where: {
          isBackup: true,
          status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
          activatedAt: null,
          listingId,
        },
      });

      expect(result).toEqual({ closedCount: 2, offerIds: [offerId, secondOfferId] });
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: offerId },
        data: { status: OfferStatus.CLOSED_BACKUP, version: { increment: 1 } },
      });
      expect(prisma.offerHistory.create).toHaveBeenCalledTimes(2);
      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          offerId: secondOfferId,
          actorAdminId: admin.id,
          action: OFFER_HISTORY_ACTIONS.BACKUP_CLOSED,
          priceSnapshot: 1150000,
          notes: 'PRIMARY_DEAL_COMPLETED',
          roundNumber: 3,
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_BACKUP_CLOSED',
          entityType: 'Offer',
          entityId: offerId,
          payload: expect.objectContaining({
            listingId,
            reason: 'PRIMARY_DEAL_COMPLETED',
            price: 1150000,
            closedAt: mockNow.toISOString(),
          }),
        }),
      });
    });

    it('attributes an unattended closure to SYSTEM', async () => {
      prisma.offer.findMany.mockResolvedValue([offerRow()]);

      await service.closeRemainingBackupOffersForListing(listingId, {
        reason: 'PRIMARY_DEAL_COMPLETED',
      });

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorAdminId: null }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorId: 'SYSTEM', actorType: 'SYSTEM' }),
      });
    });

    it('uses the caller transaction and never opens its own (Story 5.1 deadlock guard)', async () => {
      const tx = {
        offer: {
          findMany: jest.fn().mockResolvedValue([offerRow()]),
          update: jest.fn().mockResolvedValue({}),
        },
        offerHistory: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };

      const result = await service.closeRemainingBackupOffersForListing(
        listingId,
        { reason: 'PRIMARY_DEAL_COMPLETED' },
        tx,
      );

      expect(result.closedCount).toBe(1);
      expect(tx.offer.update).toHaveBeenCalledTimes(1);
      expect(tx.offerHistory.create).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);

      // A nested client-level transaction would run on another connection and deadlock.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.offer.findMany).not.toHaveBeenCalled();
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('is a no-op on a second run (idempotent)', async () => {
      prisma.offer.findMany.mockResolvedValueOnce([offerRow()]).mockResolvedValueOnce([]);

      const first = await service.closeRemainingBackupOffersForListing(listingId, {
        reason: 'PRIMARY_DEAL_COMPLETED',
      });
      const second = await service.closeRemainingBackupOffersForListing(listingId, {
        reason: 'PRIMARY_DEAL_COMPLETED',
      });

      expect(first.closedCount).toBe(1);
      expect(second).toEqual({ closedCount: 0, offerIds: [] });
      expect(prisma.offer.update).toHaveBeenCalledTimes(1);
    });
  });
});
