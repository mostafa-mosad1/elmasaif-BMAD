import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdminOffersService } from '../admin-offers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  ListingStatus,
  OfferStatus,
  PropertyType,
  OFFER_ALREADY_EXPIRED,
  OFFER_EXPIRY_HOURS,
  OFFER_FORCE_UNLOCK_REASON_REQUIRED,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
} from '@elmasaif/shared';

describe('AdminOffersService — mediation queue (Story 4.2 / FR-26, AD-10)', () => {
  let service: AdminOffersService;
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
  const otherAdmin = { id: 'admin-2', fullName: 'مشرف الوساطة الثاني', username: 'moderator.two' };

  const listingId = '33333333-3333-3333-3333-333333333333';
  const offerId = 'offer-1';
  const buyerProfileId = 'buyer-profile-1';
  const sellerProfileId = 'seller-profile-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const askPrice = 1200000;
  const futureExpiry = new Date(mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000);
  const liveLockExpiry = new Date(mockNow.getTime() + 10 * 60 * 1000);

  const listingRow = () => ({
    id: listingId,
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    askPrice: String(askPrice),
    areaSquareMeters: 300,
    sellerProfileId,
    sellerProfile: { id: sellerProfileId, user: { fullName: 'بائع العقار' } },
    city: { id: 'city-1', nameAr: 'الطائف' },
    district: { id: 'district-1', nameAr: 'الشهداء الشمالية' },
  });

  const offerRow = (overrides: Partial<any> = {}) => ({
    id: offerId,
    listingId,
    buyerProfileId,
    offerPrice: '1150000.00',
    status: OfferStatus.PENDING_ADMIN_REVIEW,
    isBackup: false,
    isLowPrice: false,
    note: null,
    negotiationRound: 0,
    rejectionReason: null,
    rejectionNote: null,
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

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      offer: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(offerRow()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        AdminOffersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<AdminOffersService>(AdminOffersService);
  });

  describe('getQueue (AC#9)', () => {
    it('defaults to the two mediable statuses, oldest first, paginated', async () => {
      await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      const arg = prisma.offer.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        status: { in: [OfferStatus.PENDING_ADMIN_REVIEW, OfferStatus.COUNTER_OFFERED] },
      });
      expect(arg.orderBy).toEqual({ createdAt: 'asc' });
      expect(arg.skip).toBe(0);
      expect(arg.take).toBe(20);
      expect(prisma.offer.count).toHaveBeenCalledWith({ where: arg.where });
    });

    it('honours an explicit status filter', async () => {
      await service.getQueue(
        { status: OfferStatus.COUNTER_OFFERED, page: 1, limit: 20 } as any,
        admin.id,
      );

      expect(prisma.offer.findMany.mock.calls[0][0].where).toEqual({
        status: OfferStatus.COUNTER_OFFERED,
      });
    });

    it('never leaks a backup offer into the mediation queue (Story 4.3 / AC#5)', async () => {
      await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      // Widening this filter to the claimable set would surface reserve bids as mediations.
      const where = prisma.offer.findMany.mock.calls[0][0].where;
      expect(where.status.in).toEqual([
        OfferStatus.PENDING_ADMIN_REVIEW,
        OfferStatus.COUNTER_OFFERED,
      ]);
      expect(where.status.in).not.toContain(
        OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
      );
    });

    it('projects the live lock with the holder name resolved in one lookup', async () => {
      prisma.offer.findMany.mockResolvedValue([
        offerRow({ lockedByAdminId: otherAdmin.id, lockExpiresAt: liveLockExpiry }),
      ]);
      prisma.offer.count.mockResolvedValue(1);
      prisma.adminUser.findMany.mockResolvedValue([
        { id: otherAdmin.id, fullName: otherAdmin.fullName, username: otherAdmin.username },
      ]);

      const result = await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(prisma.adminUser.findMany).toHaveBeenCalledTimes(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(result.items[0].lockInfo).toEqual(
        expect.objectContaining({
          isLocked: true,
          isLockedByCurrentAdmin: false,
          lockedByAdminId: otherAdmin.id,
          lockedByAdminName: otherAdmin.fullName,
        }),
      );
      expect(result.items[0].lockInfo!.remainingSeconds).toBeGreaterThan(0);
    });

    it('reads an expired lease as unlocked (lazy expiry) and skips the holder lookup', async () => {
      prisma.offer.findMany.mockResolvedValue([
        offerRow({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() - 60_000),
        }),
      ]);

      const result = await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(prisma.adminUser.findMany).not.toHaveBeenCalled();
      expect(result.items[0].lockInfo).toEqual(
        expect.objectContaining({
          isLocked: false,
          lockedByAdminId: null,
          lockedByAdminName: null,
          remainingSeconds: 0,
        }),
      );
    });
  });

  describe('getOffer (AC#9)', () => {
    it('returns the thread with its lock state', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      const result = await service.getOffer(offerId, admin.id);

      expect(result.id).toBe(offerId);
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
      expect(result.history).toEqual([]);
    });

    it('returns 404 for an unknown offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.getOffer('missing', admin.id)).rejects.toMatchObject({
        response: { code: OFFER_NOT_FOUND },
      });
    });
  });

  describe('claim / heartbeat / release (AC#9, AD-10)', () => {
    it('claims with an atomic conditional update and audits the lease', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      const result = await service.claimOffer(offerId, admin);

      const arg = prisma.offer.updateMany.mock.calls[0][0];
      expect(arg.where.id).toBe(offerId);
      expect(arg.where.OR).toEqual([
        { lockedByAdminId: null },
        { lockExpiresAt: { lt: mockNow } },
        { lockedByAdminId: admin.id },
      ]);
      expect(new Date(arg.data.lockExpiresAt).getTime()).toBe(
        mockNow.getTime() + 15 * 60 * 1000,
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_MODERATION_CLAIMED',
          entityType: 'Offer',
          entityId: offerId,
        }),
      });
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
    });

    it('409s on a lost race (count === 0) and names the holder', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdmin.id, lockExpiresAt: liveLockExpiry }),
      );
      prisma.offer.updateMany.mockResolvedValue({ count: 0 });
      prisma.adminUser.findUnique.mockResolvedValue({
        id: otherAdmin.id,
        fullName: otherAdmin.fullName,
        username: otherAdmin.username,
      });

      await expect(service.claimOffer(offerId, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.claimOffer(offerId, admin)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: OFFER_LOCK_CONFLICT,
          lockInfo: expect.objectContaining({ lockedByAdminName: otherAdmin.fullName }),
        }),
      });
    });

    it('refuses to claim an offer that is not awaiting mediation', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.RELAYED_TO_SELLER }),
      );

      await expect(service.claimOffer(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_INVALID_STATE_TRANSITION },
      });
      expect(prisma.offer.updateMany).not.toHaveBeenCalled();
    });

    it('claims an approved backup offer — the second claim-locked queue (Story 4.3 / AC#5)', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({
          status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
          isBackup: true,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        }),
      );

      const result = await service.claimOffer(offerId, admin);

      expect(prisma.offer.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.offer.updateMany.mock.calls[0][0].where.id).toBe(offerId);
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
    });

    it('still refuses a terminal or intra-party status on the backup queue', async () => {
      for (const status of [
        OfferStatus.CLOSED_BACKUP,
        OfferStatus.EXPIRED,
        OfferStatus.RELAYED_TO_BUYER,
      ]) {
        prisma.offer.findUnique.mockResolvedValue(offerRow({ status, isBackup: true }));

        await expect(service.claimOffer(offerId, admin)).rejects.toMatchObject({
          response: { code: OFFER_INVALID_STATE_TRANSITION },
        });
      }
      expect(prisma.offer.updateMany).not.toHaveBeenCalled();
    });

    it('extends only the caller’s own unexpired lease', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      const result = await service.heartbeatOffer(offerId, admin);

      expect(prisma.offer.update.mock.calls[0][0].data).toEqual({
        lockExpiresAt: new Date(mockNow.getTime() + 15 * 60 * 1000),
      });
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
    });

    it('rejects a heartbeat when nothing is held, someone else holds it, or the lease lapsed', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ lockedByAdminId: null }));
      await expect(service.heartbeatOffer(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_REQUIRED },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdmin.id }),
      );
      await expect(service.heartbeatOffer(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_CONFLICT },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockExpiresAt: new Date(mockNow.getTime() - 1) }),
      );
      await expect(service.heartbeatOffer(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_EXPIRED },
      });
    });

    it('releases the lease and audits it', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      await service.releaseOffer(offerId, admin);

      expect(prisma.offer.update.mock.calls[0][0].data).toEqual({
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'OFFER_MODERATION_RELEASED' }),
      });
    });
  });

  describe('force-unlock (AC#9, Tasks.ForceUnlock)', () => {
    it('requires a documented reason of at least 5 characters', async () => {
      await expect(
        service.forceUnlockOffer(offerId, admin, 'abc'),
      ).rejects.toMatchObject({ response: { code: OFFER_FORCE_UNLOCK_REASON_REQUIRED } });
      await expect(
        service.forceUnlockOffer(offerId, admin, '   '),
      ).rejects.toMatchObject({ response: { code: OFFER_FORCE_UNLOCK_REASON_REQUIRED } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('breaks the lease and audits the previous holder', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdmin.id }),
      );

      await service.forceUnlockOffer(offerId, admin, 'انتهاء دوام المشرف السابق');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorType: 'ADMIN',
          action: 'OFFER_MODERATION_FORCE_UNLOCKED',
          payload: expect.objectContaining({
            previousLockHolderId: otherAdmin.id,
            reason: 'انتهاء دوام المشرف السابق',
          }),
        }),
      });
    });
  });

  describe('mediation decisions (AC#1, AC#4, AC#6)', () => {
    it('relays a PENDING_ADMIN_REVIEW offer to the seller with a fresh 7-day expiry', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      await service.relayToSeller(offerId, admin);

      const data = prisma.offer.update.mock.calls[0][0].data;
      expect(data).toEqual(
        expect.objectContaining({
          status: OfferStatus.RELAYED_TO_SELLER,
          version: { increment: 1 },
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        }),
      );
      expect(new Date(data.expiresAt).getTime()).toBe(
        mockNow.getTime() + OFFER_EXPIRY_HOURS * 3_600_000,
      );

      expect(prisma.offerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          offerId,
          actorAdminId: admin.id,
          action: 'OFFER_RELAYED_TO_SELLER',
          priceSnapshot: 1150000,
          roundNumber: 0,
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OFFER_RELAYED_TO_SELLER',
          entityType: 'Offer',
          entityId: offerId,
        }),
      });
    });

    it('locks the offer row through the text id column (no ::uuid cast)', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow());

      await service.relayToSeller(offerId, admin);

      const sql = (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');
      expect(sql).toContain('FROM "offers"');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('::text');
      expect(sql).not.toContain('::uuid');
    });

    it('refuses to relay an offer that is not awaiting the seller', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.COUNTER_OFFERED }),
      );

      await expect(service.relayToSeller(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_INVALID_STATE_TRANSITION },
      });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('refuses to relay an already-expired offer', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ expiresAt: new Date(mockNow.getTime() - 1000) }),
      );

      await expect(service.relayToSeller(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_ALREADY_EXPIRED },
      });
    });

    it('relays a seller counter to the buyer', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.COUNTER_OFFERED, negotiationRound: 1 }),
      );

      await service.relayToBuyer(offerId, admin);

      expect(prisma.offer.update.mock.calls[0][0].data.status).toBe(
        OfferStatus.RELAYED_TO_BUYER,
      );
      expect(prisma.offerHistory.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ action: 'OFFER_RELAYED_TO_BUYER', roundNumber: 1 }),
      );
    });

    it('rejects the mediated terms with the mandatory reason and keeps the expiry untouched', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ status: OfferStatus.COUNTER_OFFERED }),
      );

      await service.rejectOffer(offerId, admin, 'غير مطابق لسياسة التسعير');

      const data = prisma.offer.update.mock.calls[0][0].data;
      expect(data).toEqual(
        expect.objectContaining({
          status: OfferStatus.REJECTED_BY_ADMIN,
          rejectionReason: 'غير مطابق لسياسة التسعير',
        }),
      );
      expect(data.expiresAt).toBeUndefined();
      expect(prisma.offerHistory.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ action: 'OFFER_REJECTED_BY_ADMIN' }),
      );
    });

    it('refuses every decision without holding a live lease', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ lockedByAdminId: null }));
      await expect(service.relayToSeller(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_REQUIRED },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdmin.id }),
      );
      await expect(service.relayToSeller(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_CONFLICT },
      });

      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockExpiresAt: new Date(mockNow.getTime() - 1) }),
      );
      await expect(service.relayToSeller(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_EXPIRED },
      });

      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(prisma.offerHistory.create).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown offer id', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.relayToSeller('missing', admin)).rejects.toMatchObject({
        response: { code: OFFER_NOT_FOUND },
      });
    });
  });
});
