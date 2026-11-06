import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService, MAX_EXPIRATION_SECONDS } from '../storage/storage.service';
import { QuarantineService } from '../storage/quarantine.service';
import {
  BUYER_FOLLOW_UP_STATUSES,
  INQUIRY_ATTACHMENT_NOT_CLEAN,
  INQUIRY_ATTACHMENT_NOT_FOUND,
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_BUYER_PROFILE_REQUIRED,
  INQUIRY_CLOSED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_LISTING_NOT_FOUND,
  INQUIRY_LISTING_NOT_INQUIRABLE,
  INQUIRY_NOT_FOUND,
  INQUIRY_NOT_PARTY,
  INQUIRY_SELLER_PROFILE_REQUIRED,
  INQUIRY_SELF_SUBMISSION_FORBIDDEN,
  InquiryAuthorRole,
  InquiryStatus,
  InquiryThreadItem,
  InquiryThreadSummary,
  AppendInquiryMessageInput,
  CreateInquiryInput,
  ListingStatus,
  ProfileStatus,
  UserRole,
} from '@elmasaif/shared';
import {
  INQUIRY_SUMMARY_INCLUDE,
  INQUIRY_THREAD_INCLUDE,
  isMessageVisibleTo,
  toInquiryThreadItem,
  toInquiryThreadSummary,
  type InquiryViewerRole,
} from './inquiry-thread.mapper';
import { maskInquiryBody } from './inquiry-masking';
import { createInquiryMessage } from './inquiry-message-writer';

/** AC-1: an inquiry is only possible on a listing that is still live. */
const INQUIRABLE_LISTING_STATUSES: readonly ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
];

/**
 * Buyer/seller surface of the mediated inquiry funnel (Story 4.4 / FR-35, FR-51).
 *
 * Two invariants shape this whole service:
 *
 * 1. **Masking is authoritative here** (AC-1, D4). The web form masks too, but the client is
 *    never trusted: every persisted body is re-processed and `maskingApplied` / `maskedTypes`
 *    are recorded from the server's own detection.
 * 2. **No message travels between the parties without a relay** (AC-4). Reads are party-scoped
 *    and the projection drops any counterparty message whose `relayedAt` is still `null`, so
 *    direct buyer↔seller contact is impossible by construction rather than by convention.
 *
 * Every mutation runs in one `prisma.$transaction` behind a `::text` `FOR UPDATE` row lock,
 * takes its timestamps from `ClockService`, bumps `version` and writes its `AuditLog` row
 * inside that same transaction (AC-6).
 */
@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
    private readonly quarantineService: QuarantineService,
  ) {}

  /**
   * `POST /inquiries` — opens a mediated thread and records the buyer's first message
   * (AC-1). The listing row is locked first so two concurrent submissions both see a
   * consistent seller/status picture.
   */
  async createInquiry(
    userId: string,
    activeRole: UserRole,
    dto: CreateInquiryInput,
  ): Promise<InquiryThreadItem> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);
    const now = this.clockService.now();
    const masked = maskInquiryBody(dto.body);

    const inquiryId = await this.prisma.$transaction(async (tx: any): Promise<string> => {
      // `listings.id` is a `text` column: cast to `text`, never `uuid` (Postgres 42883).
      await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${dto.listingId}::text FOR UPDATE`;

      const listing = await tx.listing.findUnique({
        where: { id: dto.listingId },
        include: { sellerProfile: true },
      });
      if (!listing) {
        throw new NotFoundException({
          code: INQUIRY_LISTING_NOT_FOUND,
          message: 'العقار المطلوب غير موجود',
        });
      }

      if (listing.sellerProfile?.userId === userId) {
        throw new BadRequestException({
          code: INQUIRY_SELF_SUBMISSION_FORBIDDEN,
          message: 'لا يمكنك إرسال استفسار على عقار تملكه أو تعلنه بنفسك',
        });
      }

      if (!INQUIRABLE_LISTING_STATUSES.includes(listing.status)) {
        throw new BadRequestException({
          code: INQUIRY_LISTING_NOT_INQUIRABLE,
          message: 'لا يمكن إرسال استفسار على العقار في حالته الحالية',
        });
      }

      const created = await tx.listingInquiry.create({
        data: {
          listingId: listing.id,
          buyerProfileId: profile.id,
          sellerProfileId: listing.sellerProfileId,
          status: InquiryStatus.PENDING_ADMIN_REVIEW,
          subject: dto.subject ?? null,
          lastMessageAt: now,
        },
      });

      await createInquiryMessage(tx, {
        inquiryId: created.id,
        authorRole: InquiryAuthorRole.BUYER,
        authorProfileId: profile.id,
        body: masked.body,
        maskingApplied: masked.maskingApplied,
        maskedTypes: masked.maskedTypes,
        createdAt: now,
        attachmentIds: dto.attachmentIds,
        uploaderProfileId: profile.id,
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: INQUIRY_AUDIT_ACTIONS.SUBMITTED,
          entityType: 'ListingInquiry',
          entityId: created.id,
          payload: {
            listingId: listing.id,
            buyerProfileId: profile.id,
            sellerProfileId: listing.sellerProfileId,
            maskingApplied: masked.maskingApplied,
            maskedTypes: masked.types,
          },
        },
      });

      return created.id;
    });

    this.logger.log(`Inquiry ${inquiryId} opened on listing ${dto.listingId}`);
    return this.loadThreadForViewerOrThrow(inquiryId, 'BUYER');
  }

  /** `GET /inquiries/my` — the caller's own threads, most recently active first (AC-4). */
  async listMyInquiries(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ items: InquiryThreadSummary[] }> {
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    const inquiries = await this.prisma.listingInquiry.findMany({
      where: { buyerProfileId: profile.id },
      orderBy: { lastMessageAt: 'desc' },
      include: INQUIRY_SUMMARY_INCLUDE as any,
    });

    return { items: inquiries.map((inquiry: any) => toInquiryThreadSummary(inquiry)) };
  }

  /**
   * `GET /inquiries/received` — threads opened on the caller's own listings (AC-4, AC-5).
   * Scoped by the *active* workspace's MARKETER/OWNER profile: a provider browsing as BUYER
   * cannot reach it (FR-3).
   */
  async listReceivedInquiries(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ items: InquiryThreadSummary[] }> {
    const profile = await this.resolveSellerProfile(userId, activeRole);

    const inquiries = await this.prisma.listingInquiry.findMany({
      where: { sellerProfileId: profile.id },
      orderBy: { lastMessageAt: 'desc' },
      include: INQUIRY_SUMMARY_INCLUDE as any,
    });

    return { items: inquiries.map((inquiry: any) => toInquiryThreadSummary(inquiry)) };
  }

  /** `GET /inquiries/:id` — party-scoped, viewer-aware projection (AC-4). */
  async getThread(
    userId: string,
    activeRole: UserRole,
    inquiryId: string,
  ): Promise<InquiryThreadItem> {
    const inquiry = await this.prisma.listingInquiry.findUnique({
      where: { id: inquiryId },
      include: INQUIRY_THREAD_INCLUDE as any,
    });
    if (!inquiry) {
      throw new NotFoundException({ code: INQUIRY_NOT_FOUND, message: 'الاستفسار المطلوب غير موجود' });
    }

    const profile = await this.resolvePartyProfile(userId, activeRole);
    this.assertParty(inquiry, profile);

    return toInquiryThreadItem(inquiry, this.toViewerRole(profile.role));
  }

  /**
   * `POST /inquiries/:id/messages` — a buyer follow-up or a seller reply (AC-4, AC-5).
   *
   * The status the caller may act from is decided by their role, not by a request field: a
   * seller may only reply while the thread is `RELAYED_TO_SELLER`, and a buyer only from
   * `PENDING_ADMIN_REVIEW` or `RELAYED_TO_BUYER`. Anything else is refused as an invalid
   * transition, so neither party can graft a message onto a leg that is not theirs.
   */
  async appendMessage(
    userId: string,
    activeRole: UserRole,
    inquiryId: string,
    dto: AppendInquiryMessageInput,
  ): Promise<InquiryThreadItem> {
    const profile = await this.resolvePartyProfile(userId, activeRole);
    const now = this.clockService.now();
    const masked = maskInquiryBody(dto.body);

    await this.prisma.$transaction(async (tx: any): Promise<void> => {
      const inquiry = await this.loadInquiryForUpdate(tx, inquiryId);
      this.assertParty(inquiry, profile);

      if (inquiry.status === InquiryStatus.CLOSED) {
        throw new ConflictException({
          code: INQUIRY_CLOSED,
          message: 'المحادثة مغلقة ولا تقبل رسائل جديدة',
        });
      }

      const authorRole =
        profile.role === UserRole.BUYER ? InquiryAuthorRole.BUYER : InquiryAuthorRole.SELLER;
      const nextStatus =
        authorRole === InquiryAuthorRole.BUYER
          ? this.nextStatusForBuyer(profile, inquiry)
          : this.nextStatusForSeller(profile, inquiry);

      await createInquiryMessage(tx, {
        inquiryId: inquiry.id,
        authorRole,
        authorProfileId: profile.id,
        body: masked.body,
        maskingApplied: masked.maskingApplied,
        maskedTypes: masked.maskedTypes,
        createdAt: now,
        attachmentIds: dto.attachmentIds,
        uploaderProfileId: profile.id,
      });

      await tx.listingInquiry.update({
        where: { id: inquiry.id },
        data: {
          status: nextStatus,
          lastMessageAt: now,
          version: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: INQUIRY_AUDIT_ACTIONS.MESSAGE_ADDED,
          entityType: 'ListingInquiry',
          entityId: inquiry.id,
          payload: {
            authorRole,
            fromStatus: inquiry.status,
            toStatus: nextStatus,
            maskingApplied: masked.maskingApplied,
            maskedTypes: masked.types,
          },
        },
      });
    });

    return this.loadThreadForViewerOrThrow(inquiryId, this.toViewerRole(profile.role));
  }

  /**
   * `POST /inquiries/attachments` — draft upload (AC-2, D7). The file is staged in
   * `quarantine/`, scanned synchronously and only then promoted to `inquiries/`. A file that
   * fails the scan never becomes an attachment, so no download endpoint can serve it.
   */
  async uploadAttachment(
    userId: string,
    activeRole: UserRole,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const profile = await this.resolveBuyerProfile(userId, activeRole);

    if (!file) {
      throw new BadRequestException('الملف مطلوب للرفع');
    }

    const staged = await this.quarantineService.stageFileForQuarantine({
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      buffer: file.buffer,
      userId,
    });

    const outcome = await this.quarantineService.scanAndProcess(
      staged.fileObjectId,
      'inquiries',
      { userId },
      userId,
    );

    if (!outcome.isClean) {
      throw new BadRequestException({
        code: INQUIRY_ATTACHMENT_NOT_CLEAN,
        message: 'لم تجتز الملفات فحص السلامة ولم يتم إرفاقها',
      });
    }

    const draft = await this.prisma.inquiryAttachment.create({
      data: {
        fileObjectId: staged.fileObjectId,
        uploadedByProfileId: profile.id,
        messageId: null,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });

    return {
      id: draft.id,
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      fileSize: draft.fileSize,
      createdAt: draft.createdAt.toISOString(),
    };
  }

  /**
   * `GET /inquiries/attachments/:id/download` — a 5-minute presigned URL (AC-2, NFR2).
   *
   * Three gates, in order: the attachment must be linked to a message (drafts are invisible),
   * the caller must be a party to that thread, and the message must be visible to their side.
   * The URL itself comes from `StorageService.getVerifiedDownloadUrl`, which re-checks the scan
   * verdict and refuses `quarantine/` keys.
   */
  async getAttachmentDownloadUrl(
    userId: string,
    activeRole: UserRole,
    attachmentId: string,
  ) {
    const profile = await this.resolvePartyProfile(userId, activeRole);

    const attachment = await this.prisma.inquiryAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            inquiry: {
              include: {
                buyerProfile: { include: { user: { select: { fullName: true } } } },
                sellerProfile: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    });

    if (!attachment || !attachment.message) {
      throw new NotFoundException({
        code: INQUIRY_ATTACHMENT_NOT_FOUND,
        message: 'المرفق المطلوب غير موجود',
      });
    }

    const inquiry = attachment.message.inquiry;
    this.assertParty(inquiry, profile);

    const viewerRole = this.toViewerRole(profile.role);
    if (!isMessageVisibleTo(attachment.message, viewerRole)) {
      throw new NotFoundException({
        code: INQUIRY_ATTACHMENT_NOT_FOUND,
        message: 'المرفق المطلوب غير موجود',
      });
    }

    const downloadUrl = await this.storageService.getVerifiedDownloadUrl(
      attachment.fileObjectId,
    );

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      downloadUrl,
      expiresInSeconds: MAX_EXPIRATION_SECONDS,
    };
  }

  // ---- internals -----------------------------------------------------------

  // Message persistence, attachment linking and the masking audit row live in
  // `inquiry-message-writer.ts` so the mediation surface cannot drift from this one.

  /** Buyer transitions per AC-4/D5: `PENDING_ADMIN_REVIEW` or `RELAYED_TO_BUYER` → review. */
  private nextStatusForBuyer(
    profile: { id: string },
    inquiry: any,
  ): InquiryStatus {
    if (inquiry.buyerProfileId !== profile.id) {
      throw new ForbiddenException({
        code: INQUIRY_NOT_PARTY,
        message: 'هذا الاستفسار لم يقدمه حسابك',
      });
    }
    if (!BUYER_FOLLOW_UP_STATUSES.includes(inquiry.status)) {
      throw new ConflictException({
        code: INQUIRY_INVALID_STATE_TRANSITION,
        message: 'لا يمكن إرسال متابعة في حالة المحادثة الحالية',
      });
    }
    return InquiryStatus.PENDING_ADMIN_REVIEW;
  }

  /** Seller may only reply while the thread is `RELAYED_TO_SELLER` → `SELLER_RESPONDED`. */
  private nextStatusForSeller(
    profile: { id: string },
    inquiry: any,
  ): InquiryStatus {
    if (inquiry.sellerProfileId !== profile.id) {
      throw new ForbiddenException({
        code: INQUIRY_NOT_PARTY,
        message: 'هذا الاستفسار لا يخص عقاراتك',
      });
    }
    if (inquiry.status !== InquiryStatus.RELAYED_TO_SELLER) {
      throw new ConflictException({
        code: INQUIRY_INVALID_STATE_TRANSITION,
        message: 'لا يمكن للبائع الرد إلا بعد إحالة الاستفسار إليه من الإدارة',
      });
    }
    return InquiryStatus.SELLER_RESPONDED;
  }

  /**
   * AD-4: serialise concurrent mutations on the same thread. `listing_inquiries.id` is a `text`
   * column, so the parameter is cast to `text` (Postgres 42883 otherwise).
   */
  private async loadInquiryForUpdate(tx: any, inquiryId: string): Promise<any> {
    await tx.$queryRaw`SELECT "id" FROM "listing_inquiries" WHERE "id" = ${inquiryId}::text FOR UPDATE`;

    const inquiry = await tx.listingInquiry.findUnique({
      where: { id: inquiryId },
      include: INQUIRY_THREAD_INCLUDE as any,
    });
    if (!inquiry) {
      throw new NotFoundException({
        code: INQUIRY_NOT_FOUND,
        message: 'الاستفسار المطلوب غير موجود',
      });
    }
    return inquiry;
  }

  private async loadThreadForViewerOrThrow(
    inquiryId: string,
    viewerRole: InquiryViewerRole,
  ): Promise<InquiryThreadItem> {
    const inquiry = await this.prisma.listingInquiry.findUnique({
      where: { id: inquiryId },
      include: INQUIRY_THREAD_INCLUDE as any,
    });
    if (!inquiry) {
      throw new NotFoundException({
        code: INQUIRY_NOT_FOUND,
        message: 'الاستفسار المطلوب غير موجود',
      });
    }
    return toInquiryThreadItem(inquiry, viewerRole);
  }

  /** Prisma hands back a string union here, not the shared enum — accept both. */
  private toViewerRole(role: string): InquiryViewerRole {
    if (role === UserRole.BUYER) return 'BUYER';
    if (role === UserRole.MARKETER || role === UserRole.OWNER) return 'SELLER';
    return 'ADMIN';
  }

  private assertParty(inquiry: any, profile: { id: string }): void {
    if (inquiry?.buyerProfileId !== profile.id && inquiry?.sellerProfileId !== profile.id) {
      throw new ForbiddenException({
        code: INQUIRY_NOT_PARTY,
        message: 'لا تملك صلاحية الاطلاع على هذا الاستفسار',
      });
    }
  }

  /**
   * The caller's profile on whichever side of the conversation their *active* workspace puts
   * them on (FR-3: a provider must switch workspace before acting as a buyer, and vice versa).
   */
  private async resolvePartyProfile(userId: string, activeRole: UserRole) {
    return activeRole === UserRole.BUYER
      ? this.resolveBuyerProfile(userId, activeRole)
      : this.resolveSellerProfile(userId, activeRole);
  }

  private async resolveBuyerProfile(userId: string, activeRole: UserRole) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: UserRole.BUYER } },
    });
    if (
      !profile ||
      profile.status !== ProfileStatus.ACTIVE ||
      activeRole !== UserRole.BUYER
    ) {
      throw new ForbiddenException({
        code: INQUIRY_BUYER_PROFILE_REQUIRED,
        message: 'يلزم وجود ملف مشتري نشط لإرسال استفسار على العقار',
      });
    }
    return profile;
  }

  private async resolveSellerProfile(userId: string, activeRole: UserRole) {
    if (activeRole !== UserRole.MARKETER && activeRole !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: INQUIRY_SELLER_PROFILE_REQUIRED,
        message: 'يلزم تفعيل مساحة الوسيط أو المالك للرد على استفسارات العقارات',
      });
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId_role: { userId, role: activeRole } },
    });
    if (!profile || profile.status !== ProfileStatus.ACTIVE) {
      throw new ForbiddenException({
        code: INQUIRY_SELLER_PROFILE_REQUIRED,
        message: 'يلزم وجود ملف وسيط أو مالك نشط للرد على استفسارات العقارات',
      });
    }
    return profile;
  }
}
