import { Test, TestingModule } from '@nestjs/testing';
import { InquiriesService } from '../inquiries.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import {
  INQUIRY_ATTACHMENT_NOT_CLEAN,
  INQUIRY_ATTACHMENT_NOT_FOUND,
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_BUYER_PROFILE_REQUIRED,
  INQUIRY_CLOSED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_LISTING_NOT_FOUND,
  INQUIRY_LISTING_NOT_INQUIRABLE,
  INQUIRY_NOT_PARTY,
  INQUIRY_SELF_SUBMISSION_FORBIDDEN,
  InquiryAuthorRole,
  InquiryStatus,
  ListingStatus,
  ProfileStatus,
  PropertyType,
  UserRole,
} from '@elmasaif/shared';

describe('InquiriesService — mediated party surface (Story 4.4 / AC-1, AC-2, AC-4, AC-5)', () => {
  let service: InquiriesService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const userId = 'user-buyer-1';
  const sellerUserId = 'user-seller-1';
  const buyerProfileId = 'buyer-profile-1';
  const sellerProfileId = 'seller-profile-1';
  const listingId = '33333333-3333-3333-3333-333333333333';
  const inquiryId = 'inquiry-1';
  const attachmentId = 'attachment-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');

  const buyerProfile = {
    id: buyerProfileId,
    userId,
    role: UserRole.BUYER,
    status: ProfileStatus.ACTIVE,
  };
  const sellerProfile = {
    id: sellerProfileId,
    userId: sellerUserId,
    role: UserRole.MARKETER,
    status: ProfileStatus.ACTIVE,
  };

  const listingRow = (overrides: Partial<any> = {}) => ({
    id: listingId,
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    askPrice: '1200000',
    areaSquareMeters: 300,
    sellerProfileId,
    sellerProfile: { id: sellerProfileId, userId: sellerUserId },
    ...overrides,
  });

  const messageRow = (overrides: Partial<any> = {}) => ({
    id: 'message-1',
    inquiryId,
    authorRole: InquiryAuthorRole.BUYER,
    authorProfileId: buyerProfileId,
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
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
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
    storageService = { getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/x') };
    quarantineService = {
      stageFileForQuarantine: jest.fn().mockResolvedValue({ fileObjectId: 'file-1' }),
      scanAndProcess: jest.fn().mockResolvedValue({ isClean: true }),
    };

    prisma = {
      userProfile: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.userId_role.role === UserRole.BUYER ? buyerProfile : sellerProfile,
        ),
      },
      listing: { findUnique: jest.fn().mockResolvedValue(listingRow()) },
      listingInquiry: {
        findUnique: jest.fn().mockResolvedValue(inquiryRow()),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: inquiryId }),
        update: jest.fn().mockResolvedValue(inquiryRow()),
      },
      inquiryMessage: {
        create: jest.fn().mockResolvedValue({ id: 'message-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inquiryAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: attachmentId,
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          createdAt: mockNow,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: inquiryId }]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InquiriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: quarantineService },
      ],
    }).compile();

    service = module.get<InquiriesService>(InquiriesService);
  });

  describe('createInquiry (AC-1)', () => {
    it('re-masks the body server-side and persists detection types only', async () => {
      await service.createInquiry(userId, UserRole.BUYER, {
        listingId,
        body: 'اتصل بي 0551234567 أو buyer@example.com أو @my_snap',
        attachmentIds: [],
      } as any);

      const created = prisma.inquiryMessage.create.mock.calls[0][0].data;
      expect(created.body).toContain('*');
      expect(created.body).not.toContain('0551234567');
      expect(created.body).not.toContain('buyer@example.com');
      expect(created.body).not.toContain('@my_snap');
      expect(created.maskingApplied).toBe(true);

      const types = String(created.maskedTypes).split(',');
      expect(types).toEqual(expect.arrayContaining(['PHONE', 'EMAIL', 'HANDLE']));
      // The audit row records types and a count — never the detected values.
      expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain('0551234567');
    });

    it('opens the thread in PENDING_ADMIN_REVIEW and audits submission + masking', async () => {
      await service.createInquiry(userId, UserRole.BUYER, {
        listingId,
        body: 'اتصل بي 0551234567',
        attachmentIds: [],
      } as any);

      expect(prisma.listingInquiry.create.mock.calls[0][0].data).toMatchObject({
        listingId,
        buyerProfileId,
        sellerProfileId,
        status: InquiryStatus.PENDING_ADMIN_REVIEW,
        lastMessageAt: mockNow,
      });

      const actions = prisma.auditLog.create.mock.calls.map((call: any) => call[0].data.action);
      expect(actions).toContain(INQUIRY_AUDIT_ACTIONS.CONTACT_MASKED);
      expect(actions).toContain(INQUIRY_AUDIT_ACTIONS.SUBMITTED);
    });

    it('locks the listing row with a ::text cast before reading it', async () => {
      await service.createInquiry(userId, UserRole.BUYER, {
        listingId,
        body: 'استفسار',
        attachmentIds: [],
      } as any);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('rejects a listing that is not ACTIVE or RESERVED', async () => {
      prisma.listing.findUnique.mockResolvedValue(listingRow({ status: ListingStatus.SOLD }));

      await expect(
        service.createInquiry(userId, UserRole.BUYER, {
          listingId,
          body: 'استفسار',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_LISTING_NOT_INQUIRABLE } });
    });

    it('rejects an inquiry on the caller’s own listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        listingRow({ sellerProfile: { id: sellerProfileId, userId } }),
      );

      await expect(
        service.createInquiry(userId, UserRole.BUYER, {
          listingId,
          body: 'استفسار',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_SELF_SUBMISSION_FORBIDDEN } });
    });

    it('returns INQUIRY_LISTING_NOT_FOUND when the listing disappeared', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.createInquiry(userId, UserRole.BUYER, {
          listingId,
          body: 'استفسار',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_LISTING_NOT_FOUND } });
    });

    it('refuses to act without an ACTIVE buyer profile in the active workspace', async () => {
      await expect(
        service.createInquiry(userId, UserRole.MARKETER, {
          listingId,
          body: 'استفسار',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_BUYER_PROFILE_REQUIRED } });
    });
  });

  describe('appendMessage (AC-4, AC-5)', () => {
    it('moves a buyer follow-up from RELAYED_TO_BUYER back to PENDING_ADMIN_REVIEW', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.RELAYED_TO_BUYER }),
      );

      await service.appendMessage(userId, UserRole.BUYER, inquiryId, {
        body: 'هل ما زال العرض سارياً؟',
        attachmentIds: [],
      } as any);

      expect(prisma.listingInquiry.update.mock.calls[0][0].data).toMatchObject({
        status: InquiryStatus.PENDING_ADMIN_REVIEW,
        lastMessageAt: mockNow,
        version: { increment: 1 },
      });
    });

    it('stamps a seller reply with relayedAt = null while moving to SELLER_RESPONDED', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.RELAYED_TO_SELLER }),
      );

      await service.appendMessage(sellerUserId, UserRole.MARKETER, inquiryId, {
        body: 'السعر قابل للتفاوض قليلاً',
        attachmentIds: [],
      } as any);

      const created = prisma.inquiryMessage.create.mock.calls[0][0].data;
      expect(created.authorRole).toBe(InquiryAuthorRole.SELLER);
      expect(created.relayedAt).toBeUndefined();
      expect(prisma.listingInquiry.update.mock.calls[0][0].data.status).toBe(
        InquiryStatus.SELLER_RESPONDED,
      );
    });

    it('refuses a seller reply unless the thread is RELAYED_TO_SELLER', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.PENDING_ADMIN_REVIEW }),
      );

      await expect(
        service.appendMessage(sellerUserId, UserRole.MARKETER, inquiryId, {
          body: 'رد مبكر',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_INVALID_STATE_TRANSITION } });
    });

    it('refuses any message on a CLOSED thread', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({ status: InquiryStatus.CLOSED }),
      );

      await expect(
        service.appendMessage(userId, UserRole.BUYER, inquiryId, {
          body: 'متابعة',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_CLOSED } });
    });

    it('refuses a message from somebody who is not a party to the thread', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile,
        id: 'another-buyer-profile',
      });

      await expect(
        service.appendMessage(userId, UserRole.BUYER, inquiryId, {
          body: 'متابعة',
          attachmentIds: [],
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_NOT_PARTY } });
    });
  });

  describe('getThread (AC-4 — direct chat is strictly blocked)', () => {
    it('hides an unrelayed seller reply from the buyer', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({
          status: InquiryStatus.SELLER_RESPONDED,
          messages: [
            messageRow(),
            messageRow({
              id: 'message-2',
              authorRole: InquiryAuthorRole.SELLER,
              authorProfileId: sellerProfileId,
              body: 'اتصل بي على 0551234567',
              relayedAt: null,
            }),
          ],
        }),
      );

      const thread = await service.getThread(userId, UserRole.BUYER, inquiryId);

      expect(thread.messages.map((message) => message.id)).toEqual(['message-1']);
    });

    it('shows the seller reply to the buyer once it was relayed', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({
          status: InquiryStatus.RELAYED_TO_BUYER,
          messages: [
            messageRow(),
            messageRow({
              id: 'message-2',
              authorRole: InquiryAuthorRole.SELLER,
              authorProfileId: sellerProfileId,
              body: 'السعر قابل للتفاوض',
              relayedAt: mockNow,
            }),
            messageRow({
              id: 'message-3',
              authorRole: InquiryAuthorRole.ADMIN,
              authorProfileId: null,
              body: 'تمت إحالة الرد',
              relayedAt: mockNow,
            }),
          ],
        }),
      );

      const thread = await service.getThread(userId, UserRole.BUYER, inquiryId);

      expect(thread.messages.map((message) => message.id)).toEqual([
        'message-1',
        'message-2',
        'message-3',
      ]);
    });

    it('hides an unrelayed buyer follow-up from the seller', async () => {
      prisma.listingInquiry.findUnique.mockResolvedValue(
        inquiryRow({
          messages: [
            messageRow({ authorRole: InquiryAuthorRole.BUYER, relayedAt: null }),
            messageRow({
              id: 'message-2',
              authorRole: InquiryAuthorRole.SELLER,
              authorProfileId: sellerProfileId,
            }),
          ],
        }),
      );

      const thread = await service.getThread(sellerUserId, UserRole.MARKETER, inquiryId);

      expect(thread.messages.map((message) => message.id)).toEqual(['message-2']);
    });

    it('returns no contact fields on the thread payload', async () => {
      const thread = await service.getThread(userId, UserRole.BUYER, inquiryId);

      const serialized = JSON.stringify(thread);
      expect(serialized).not.toContain('mobileNumber');
      expect(serialized).not.toContain('payoutIban');
      expect(thread.buyerName).toBe('مشتري العقار');
      expect(thread.sellerName).toBe('بائع العقار');
    });

    it('refuses a reader who is not a party', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...buyerProfile,
        id: 'another-buyer-profile',
      });

      await expect(service.getThread(userId, UserRole.BUYER, inquiryId)).rejects.toMatchObject({
        response: { code: INQUIRY_NOT_PARTY },
      });
    });
  });

  describe('lists (AC-4)', () => {
    it('scopes the buyer list to their own profile, most recently active first', async () => {
      await service.listMyInquiries(userId, UserRole.BUYER);

      const arg = prisma.listingInquiry.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ buyerProfileId });
      expect(arg.orderBy).toEqual({ lastMessageAt: 'desc' });
    });

    it('scopes the seller inbox to the active provider workspace', async () => {
      await service.listReceivedInquiries(sellerUserId, UserRole.OWNER);

      const arg = prisma.listingInquiry.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ sellerProfileId });
    });

    it('does not let a provider read the seller inbox while browsing as a buyer', async () => {
      await expect(
        service.listReceivedInquiries(sellerUserId, UserRole.BUYER),
      ).rejects.toMatchObject({ response: { code: 'INQUIRY_SELLER_PROFILE_REQUIRED' } });
    });
  });

  describe('attachments (AC-2)', () => {
    it('refuses to attach a file that did not pass the quarantine scan', async () => {
      quarantineService.scanAndProcess.mockResolvedValue({ isClean: false });

      await expect(
        service.uploadAttachment(userId, UserRole.BUYER, {
          originalname: 'contract.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('x'),
        } as any),
      ).rejects.toMatchObject({ response: { code: INQUIRY_ATTACHMENT_NOT_CLEAN } });
    });

    it('stores a CLEAN upload as an unlinked draft in the inquiries partition', async () => {
      const draft = await service.uploadAttachment(userId, UserRole.BUYER, {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('x'),
      } as any);

      expect(quarantineService.scanAndProcess).toHaveBeenCalledWith(
        'file-1',
        'inquiries',
        { userId },
        userId,
      );
      expect(prisma.inquiryAttachment.create.mock.calls[0][0].data).toMatchObject({
        uploadedByProfileId: buyerProfileId,
        messageId: null,
      });
      expect(draft.id).toBe(attachmentId);
    });

    it('never serves a draft attachment (messageId = null)', async () => {
      prisma.inquiryAttachment.findUnique.mockResolvedValue({
        id: attachmentId,
        fileObjectId: 'file-1',
        message: null,
      });

      await expect(
        service.getAttachmentDownloadUrl(userId, UserRole.BUYER, attachmentId),
      ).rejects.toMatchObject({ response: { code: INQUIRY_ATTACHMENT_NOT_FOUND } });
    });

    it('never serves an attachment of a message the viewer may not see', async () => {
      prisma.inquiryAttachment.findUnique.mockResolvedValue({
        id: attachmentId,
        fileObjectId: 'file-1',
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        message: {
          id: 'message-2',
          authorRole: InquiryAuthorRole.SELLER,
          relayedAt: null,
          inquiry: inquiryRow(),
        },
      });

      await expect(
        service.getAttachmentDownloadUrl(userId, UserRole.BUYER, attachmentId),
      ).rejects.toMatchObject({ response: { code: INQUIRY_ATTACHMENT_NOT_FOUND } });
      expect(storageService.getVerifiedDownloadUrl).not.toHaveBeenCalled();
    });

    it('returns a 5-minute presigned URL for a visible CLEAN attachment', async () => {
      prisma.inquiryAttachment.findUnique.mockResolvedValue({
        id: attachmentId,
        fileObjectId: 'file-1',
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        message: {
          id: 'message-1',
          authorRole: InquiryAuthorRole.BUYER,
          relayedAt: null,
          inquiry: inquiryRow(),
        },
      });
      prisma.userProfile.findUnique.mockResolvedValue(buyerProfile);

      const result = await service.getAttachmentDownloadUrl(userId, UserRole.BUYER, attachmentId);

      expect(storageService.getVerifiedDownloadUrl).toHaveBeenCalledWith('file-1');
      expect(result.expiresInSeconds).toBe(300);
      expect(result.downloadUrl).toBe('https://signed.example/x');
    });
  });
});
