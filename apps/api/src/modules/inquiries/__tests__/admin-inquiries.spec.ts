import { Test, TestingModule } from '@nestjs/testing';
import { AdminInquiriesService } from '../admin-inquiries.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_CLOSED,
  INQUIRY_CLOSE_REASON_REQUIRED,
  INQUIRY_FORCE_UNLOCK_REASON_REQUIRED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_DURATION_MS,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_LOCK_REQUIRED,
  INQUIRY_NOT_FOUND,
  InquiryAuthorRole,
  InquiryStatus,
  ListingStatus,
  PropertyType,
} from '@elmasaif/shared';

describe('AdminInquiriesService — conversation queue (Story 4.4 / AC-3, AC-5, AD-10)', () => {
  let service: AdminInquiriesService;
  let prisma: any;
  let clockService: any;

  const admin = {
    id: 'admin-1',
    username: 'moderator.one',
    email: 'moderator.one@elmasaif.sa',
    fullName: 'مشرف الوساطة الأول',
    role: 'MODERATOR',
    isActive: true,
    permissions: ['Conversations.Handle'],
  };
  const otherAdmin = { id: 'admin-2', fullName: 'مشرف الوساطة الثاني', username: 'moderator.two' };

  const listingId = '33333333-3333-3333-3333-333333333333';
  const inquiryId = 'inquiry-1';
  const buyerProfileId = 'buyer-profile-1';
  const sellerProfileId = 'seller-profile-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const liveLockExpiry = new Date(mockNow.getTime() + 10 * 60 * 1000);
  const expiredLockExpiry = new Date(mockNow.getTime() - 60 * 1000);

  const messageRow = (overrides: Partial<any> = {}) => ({
    id: 'message-1',
    inquiryId,
    authorRole: InquiryAuthorRole.BUYER,
    authorProfileId: buyerProfileId,
    authorAdminId: null,
    body: 'هل السعر قابل للتفاوض؟',
    maskingApplied: false,
    maskedTypes: null,
    relayedAt: null,
    createdAt: mockNow,
    attachments: [],
    ...overrides,
  });

  const inquiryRow = (overrides: Partial<any> = {}) => ({
    id: inquiryId,
    listingId,
    buyerProfileId,
    sellerProfileId,
    status: InquiryStatus.PENDING_ADMIN_REVIEW,
    subject: null,
    version: 1,
    lockedByAdminId: admin.id,
    lockedAt: mockNow,
    lockExpiresAt: liveLockExpiry,
    lastMessageAt: mockNow,
    closedAt: null,
    closedByAdminId: null,
    closeReason: null,
    createdAt: mockNow,
    updatedAt: mockNow,
    listing: {
      id: listingId,
      title: 'فيلا شمال الطائف',
      propertyType: PropertyType.VILLA,
      status: ListingStatus.ACTIVE,
      askPrice: '1200000',
      areaSquareMeters: 300,
      city: { nameAr: 'الطائف' },
      district: { nameAr: 'الشهداء الشمالية' },
    },
    buyerProfile: { id: buyerProfileId, user: { fullName: 'مشتري العقار' } },
    sellerProfile: { id: sellerProfileId, user: { fullName: 'بائع العقار' } },
    _count: { messages: 1 },
    messages: [messageRow()],
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    prisma = {
      listingInquiry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(inquiryRow()),
        update: jest.fn().mockResolvedValue(inquiryRow()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inquiryMessage: {
        create: jest.fn().mockResolvedValue({ id: 'message-new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inquiryAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(otherAdmin),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: inquiryId }]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminInquiriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<AdminInquiriesService>(AdminInquiriesService);
  });

  describe('getQueue (AC-3)', () => {
    it('filters on the relay-owing statuses, oldest first, paginated', async () => {
      await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      const arg = prisma.listingInquiry.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        status: { in: [InquiryStatus.PENDING_ADMIN_REVIEW, InquiryStatus.SELLER_RESPONDED] },
      });
      expect(arg.orderBy).toEqual({ createdAt: 'asc' });
      expect(arg.skip).toBe(0);
      expect(arg.take).toBe(20);
    });

    it('projects an unlocked record when nobody holds a lease', async () => {
      prisma.listingInquiry.findMany.mockResolvedValue([
        inquiryRow({ lockedByAdminId: null, lockedAt: null, lockExpiresAt: null }),
      ]);
      prisma.listingInquiry.count.mockResolvedValue(1);

      const result = await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(result.items[0].lockInfo).toMatchObject({ isLocked: false, remainingSeconds: 0 });
    });

    it('names the live holder in one query rather than per row', async () => {
      prisma.listingInquiry.findMany.mockResolvedValue([
        inquiryRow({ lockedByAdminId: otherAdmin.id }),
      ]);
      prisma.adminUser.findMany.mockResolvedValue([otherAdmin]);

      const result = await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(prisma.adminUser.findMany).toHaveBeenCalledTimes(1);
      expect(result.items[0].lockInfo).toMatchObject({
        isLocked: true,
        isLockedByCurrentAdmin: false,
        lockedByAdminName: otherAdmin.fullName,
      });
    });

    it('reads an expired lease as unlocked (lazy expiry)', async () => {
      prisma.listingInquiry.findMany.mockResolvedValue([
        inquiryRow({ lockedByAdminId: otherAdmin.id, lockExpiresAt: expiredLockExpiry }),
      ]);

      const result = await service.getQueue({ page: 1, limit: 20 } as any, admin.id);

      expect(result.items[0].lockInfo).toMatchObject({ isLocked: false });
      expect(prisma.adminUser.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getInquiry (AC-4 — admins see everything)', () => {
    it('returns every message regardless of relay stamps', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({
          messages: [
            messageRow(),
            messageRow({ id: 'message-2', authorRole: InquiryAuthorRole.SELLER, relayedAt: null }),
          ],
        }),
      );

      const thread = await service.getInquiry(inquiryId, admin.id);

      expect(thread.messages).toHaveLength(2);
      expect(thread.lockInfo).toMatchObject({ isLocked: true, isLockedByCurrentAdmin: true });
    });

    it('returns INQUIRY_NOT_FOUND for an unknown thread', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(null);

      await expect(service.getInquiry(inquiryId, admin.id)).rejects.toMatchObject({
        response: { code: INQUIRY_NOT_FOUND },
      });
    });
  });

  describe('claimInquiry (AC-3)', () => {
    it('claims with a conditional updateMany and a 15-minute lease', async () => {
      const result = await service.claimInquiry(inquiryId, admin);

      const arg = prisma.listingInquiry.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        id: inquiryId,
        OR: [
          { lockedByAdminId: null },
          { lockExpiresAt: { lt: mockNow } },
          { lockedByAdminId: admin.id },
        ],
      });
      expect(arg.data).toEqual({
        lockedByAdminId: admin.id,
        lockedAt: mockNow,
        lockExpiresAt: new Date(mockNow.getTime() + INQUIRY_LOCK_DURATION_MS),
      });
      expect(result.lockInfo).toMatchObject({
        isLocked: true,
        isLockedByCurrentAdmin: true,
        remainingSeconds: 900,
      });
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
        INQUIRY_AUDIT_ACTIONS.MODERATION_CLAIMED,
      );
    });

    it('returns INQUIRY_LOCK_CONFLICT naming the holder when the update matches nothing', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ lockedByAdminId: otherAdmin.id }),
      );
      prisma.listingInquiry.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.claimInquiry(inquiryId, admin)).rejects.toMatchObject({
        response: {
          code: INQUIRY_LOCK_CONFLICT,
          details: { lockInfo: { lockedByAdminName: otherAdmin.fullName } },
        },
      });
    });

    it('refuses to claim a closed thread', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.CLOSED }),
      );

      await expect(service.claimInquiry(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_INVALID_STATE_TRANSITION },
      });
      expect(prisma.listingInquiry.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat / release (AC-3)', () => {
    it('extends the caller’s lease', async () => {
      await service.heartbeatInquiry(inquiryId, admin);

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toEqual({
        lockExpiresAt: new Date(mockNow.getTime() + INQUIRY_LOCK_DURATION_MS),
      });
    });

    it('refuses a heartbeat when nobody holds the lease', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(inquiryRow({ lockedByAdminId: null }));

      await expect(service.heartbeatInquiry(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_LOCK_REQUIRED },
      });
    });

    it('refuses a heartbeat on an expired lease', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ lockExpiresAt: expiredLockExpiry }),
      );

      await expect(service.heartbeatInquiry(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_LOCK_EXPIRED },
      });
    });

    it('refuses a heartbeat when another administrator holds the lease', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ lockedByAdminId: otherAdmin.id }),
      );

      await expect(service.heartbeatInquiry(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_LOCK_CONFLICT },
      });
    });

    it('clears the lease and audits the release', async () => {
      await service.releaseInquiry(inquiryId, admin);

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toEqual({
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      });
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
        INQUIRY_AUDIT_ACTIONS.MODERATION_RELEASED,
      );
    });

    it('requires a documented reason of at least 5 characters to force-unlock', async () => {
      await expect(service.forceUnlockInquiry(inquiryId, admin, 'abc')).rejects.toMatchObject({
        response: { code: INQUIRY_FORCE_UNLOCK_REASON_REQUIRED },
      });
      expect(prisma.listingInquiry.update).not.toHaveBeenCalled();
    });

    it('forces the lease open and records the previous holder and reason', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ lockedByAdminId: otherAdmin.id }),
      );

      await service.forceUnlockInquiry(inquiryId, admin, 'انقطاع اتصال المشرف المناوب');

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.action).toBe(INQUIRY_AUDIT_ACTIONS.MODERATION_FORCE_UNLOCKED);
      expect(audit.payload).toMatchObject({
        previousLockHolderId: otherAdmin.id,
        reason: 'انقطاع اتصال المشرف المناوب',
        unlockedByAdminId: admin.id,
      });
    });
  });

  describe('relayToSeller (AC-4, AC-5)', () => {
    it('moves PENDING_ADMIN_REVIEW → RELAYED_TO_SELLER and stamps the buyer messages', async () => {
      // First read happens inside the transaction (lease held), the second one after commit
      // (lease released) — exactly the projection the admin workspace renders afterwards.
      prisma.listingInquiry.findUnique
        .mockResolvedValueOnce(inquiryRow())
        .mockResolvedValueOnce(
          inquiryRow({ lockedByAdminId: null, lockedAt: null, lockExpiresAt: null }),
        );

      const thread = await service.relayToSeller(inquiryId, admin);

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toMatchObject({
        status: InquiryStatus.RELAYED_TO_SELLER,
        version: { increment: 1 },
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      });

      const stamp = prisma.inquiryMessage.updateMany.mock.calls[0][0];
      expect(stamp.where).toEqual({
        inquiryId,
        authorRole: InquiryAuthorRole.BUYER,
        relayedAt: null,
      });
      expect(stamp.data).toEqual({ relayedAt: mockNow, relayedByAdminId: admin.id });

      const actions = prisma.auditLog.create.mock.calls.map((call: any) => call[0].data.action);
      expect(actions).toContain(INQUIRY_AUDIT_ACTIONS.RELAYED_TO_SELLER);
      expect(thread.lockInfo).toMatchObject({ isLocked: false });
    });

    it('masks an administrator’s relay note and stores it as an ADMIN message', async () => {
      await service.relayToSeller(inquiryId, admin, 'يمكنك التواصل على 0551234567');

      const created = prisma.inquiryMessage.create.mock.calls[0][0].data;
      expect(created.authorRole).toBe(InquiryAuthorRole.ADMIN);
      expect(created.authorProfileId).toBeNull();
      expect(created.authorAdminId).toBe(admin.id);
      expect(created.body).not.toContain('0551234567');
      expect(String(created.maskedTypes)).toContain('PHONE');

      const maskingAudit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(maskingAudit.action).toBe(INQUIRY_AUDIT_ACTIONS.CONTACT_MASKED);
      expect(maskingAudit.actorType).toBe('ADMIN');
      expect(JSON.stringify(maskingAudit.payload)).not.toContain('0551234567');
    });

    it('refuses the relay without a lease', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(inquiryRow({ lockedByAdminId: null }));

      await expect(service.relayToSeller(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_LOCK_REQUIRED },
      });
      expect(prisma.listingInquiry.update).not.toHaveBeenCalled();
    });

    it('refuses the relay from an illegal status', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.RELAYED_TO_BUYER }),
      );

      await expect(service.relayToSeller(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_INVALID_STATE_TRANSITION },
      });
    });

    it('refuses any relay on a closed thread', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.CLOSED }),
      );

      await expect(service.relayToSeller(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_CLOSED },
      });
    });

    it('locks the inquiry row with a ::text cast inside the transaction', async () => {
      await service.relayToSeller(inquiryId, admin);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('relayToBuyer (AC-5)', () => {
    it('moves SELLER_RESPONDED → RELAYED_TO_BUYER and stamps the seller messages', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.SELLER_RESPONDED }),
      );

      await service.relayToBuyer(inquiryId, admin);

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toMatchObject({
        status: InquiryStatus.RELAYED_TO_BUYER,
      });
      expect(prisma.inquiryMessage.updateMany.mock.calls[0][0].where).toEqual({
        inquiryId,
        authorRole: InquiryAuthorRole.SELLER,
        relayedAt: null,
      });
    });

    it('refuses to relay a reply the seller has not written yet', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.RELAYED_TO_SELLER }),
      );

      await expect(service.relayToBuyer(inquiryId, admin)).rejects.toMatchObject({
        response: { code: INQUIRY_INVALID_STATE_TRANSITION },
      });
    });
  });

  describe('closeInquiry (AC-5)', () => {
    it('closes the thread with a documented reason and releases the lease', async () => {
      await service.closeInquiry(inquiryId, admin, ' تم حل استفسار المشتري نهائياً ');

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toMatchObject({
        status: InquiryStatus.CLOSED,
        closedAt: mockNow,
        closedByAdminId: admin.id,
        closeReason: 'تم حل استفسار المشتري نهائياً',
        lockedByAdminId: null,
        version: { increment: 1 },
      });
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
        INQUIRY_AUDIT_ACTIONS.CLOSED,
      );
    });

    it('requires a documented reason', async () => {
      await expect(service.closeInquiry(inquiryId, admin, 'تم')).rejects.toMatchObject({
        response: { code: INQUIRY_CLOSE_REASON_REQUIRED },
      });
    });

    it('cannot close an already closed thread', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.CLOSED }),
      );

      await expect(
        service.closeInquiry(inquiryId, admin, 'إغلاق مكرر للمحادثة'),
      ).rejects.toMatchObject({ response: { code: INQUIRY_CLOSED } });
    });
  });
});
