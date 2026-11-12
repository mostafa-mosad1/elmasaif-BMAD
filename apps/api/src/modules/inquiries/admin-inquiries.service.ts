import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { assertOptimisticVersion } from '../../common/locks/claim-lock';
import {
  CLAIMABLE_INQUIRY_STATUSES,
  DEFAULT_PAGE_SIZE,
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_CLOSED,
  INQUIRY_CLOSE_REASON_REQUIRED,
  INQUIRY_FORCE_UNLOCK_REASON_REQUIRED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_DURATION_MS,
  INQUIRY_QUEUE_STATUSES,
  InquiryAuthorRole,
  InquiryLockInfo,
  InquiryQueueQuery,
  InquiryStatus,
  InquiryThreadItem,
  InquiryThreadSummary,
  MAX_PAGE_SIZE,
} from '@elmasaif/shared';
import {
  INQUIRY_SUMMARY_INCLUDE,
  INQUIRY_THREAD_INCLUDE,
  toInquiryThreadItem,
  toInquiryThreadSummary,
} from './inquiry-thread.mapper';
import {
  assertInquiryLockHeld,
  buildInquiryLockInfo,
  inquiryNotFound,
  resolveInquiryLockHolderNames,
} from './inquiry-lock';
import { maskInquiryBody } from './inquiry-masking';
import { createInquiryMessage } from './inquiry-message-writer';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';

export interface AdminInquiryQueueResponse {
  items: InquiryThreadSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type AdminInquiryThread = InquiryThreadItem & { lockInfo: InquiryLockInfo };

/** One mediated relay/close step of the AC-5 loop. */
interface InquiryTransition {
  allowedFrom: readonly InquiryStatus[];
  toStatus: InquiryStatus;
  auditAction: string;
  invalidStateMessage: string;
  /** Messages of this role still waiting for a relay get stamped in the same transaction. */
  relayAuthorRole?: InquiryAuthorRole;
  /** Admin-authored note relayed to the other side (masked like every persisted body). */
  note?: string | null;
  /** Set for `CLOSED` only — the documented reason is mandatory. */
  closeReason?: string | null;
  expectedVersion?: number;
}

/**
 * Administrative conversation queue for mediated listing inquiries (Story 4.4 / AC-3, AC-5,
 * `Conversations.Handle`, AD-10).
 *
 * `ListingInquiry` is the ninth claim-locked queue and reuses the exact offer-queue semantics:
 * a 15-minute lease, lazy expiry, an explicit `POST` claim (never a read), a conditional
 * `updateMany` as the race-free conflict signal, and the lease released on decision commit.
 *
 * The relay step is what makes AC-4 enforceable: the status change and the `relayedAt` stamp on
 * every pending counterparty message commit in one transaction, so a buyer or seller can never
 * observe a message that an administrator has not forwarded.
 */
@Injectable()
export class AdminInquiriesService {
  private readonly logger = new Logger(AdminInquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /** `GET /admin/inquiries` — threads awaiting a relay decision, oldest first (AC-3). */
  async getQueue(
    query: InquiryQueueQuery,
    currentAdminId: string,
  ): Promise<AdminInquiryQueueResponse> {
    const now = this.clockService.now();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    // Membership is a view over INQUIRY_QUEUE_STATUSES — no operator-supplied filter, so the
    // queue can never silently widen to threads that owe the platform nothing.
    const where = { status: { in: [...INQUIRY_QUEUE_STATUSES] as any } };

    const [inquiries, total] = await Promise.all([
      this.prisma.listingInquiry.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: INQUIRY_SUMMARY_INCLUDE as any,
      }),
      this.prisma.listingInquiry.count({ where }),
    ]);

    // One lookup for every holder name — never an N+1 per row.
    const adminNameMap = await resolveInquiryLockHolderNames(this.prisma, inquiries, now);

    return {
      items: (inquiries as any[]).map((inquiry) => ({
        ...toInquiryThreadSummary(inquiry),
        lockInfo: buildInquiryLockInfo(inquiry, now, currentAdminId, adminNameMap),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** `GET /admin/inquiries/:id` — the full mediation view, unfiltered (AC-4: ADMIN sees all). */
  async getInquiry(inquiryId: string, currentAdminId: string): Promise<AdminInquiryThread> {
    return this.loadAdminThread(inquiryId, currentAdminId);
  }

  /**
   * `POST /admin/inquiries/:id/claim` — acquires or extends the 15-minute lease (AC-3).
   * The conditional `UPDATE` is the conflict signal; there is no read-then-write race.
   */
  async claimInquiry(inquiryId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + INQUIRY_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const inquiry = await tx.listingInquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) {
        throw inquiryNotFound();
      }

      this.assertClaimable(inquiry);

      const { count } = await tx.listingInquiry.updateMany({
        where: {
          id: inquiryId,
          OR: [
            { lockedByAdminId: null },
            { lockExpiresAt: { lt: now } },
            { lockedByAdminId: admin.id },
          ],
        },
        data: {
          lockedByAdminId: admin.id,
          lockedAt: now,
          lockExpiresAt,
        },
      });

      if (count === 0) {
        const holder = await this.loadLockHolder(tx, inquiry.lockedByAdminId);
        const lockInfo = buildInquiryLockInfo(
          inquiry,
          now,
          admin.id,
          holder ? new Map([[holder.id, holder.name]]) : undefined,
        );
        throw new ConflictException({
          code: INQUIRY_LOCK_CONFLICT,
          message: `هذه المحادثة قيد المعالجة حالياً بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`,
          lockInfo,
          details: { lockInfo },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: INQUIRY_AUDIT_ACTIONS.MODERATION_CLAIMED,
          entityType: 'ListingInquiry',
          entityId: inquiryId,
          payload: {
            lockedByAdminId: admin.id,
            lockedByAdminName: admin.fullName,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
          },
        },
      });

      this.logger.log(`Inquiry ${inquiryId} claimed by admin ${admin.id}`);
      return {
        id: inquiryId,
        status: inquiry.status,
        lockInfo: buildInquiryLockInfo(
          { lockedByAdminId: admin.id, lockedAt: now, lockExpiresAt },
          now,
          admin.id,
          new Map([[admin.id, admin.fullName]]),
        ),
      };
    });
  }

  /** `POST /admin/inquiries/:id/heartbeat` — renews the caller's own lease by 15 minutes. */
  async heartbeatInquiry(inquiryId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + INQUIRY_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const inquiry = await tx.listingInquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) {
        throw inquiryNotFound();
      }

      assertInquiryLockHeld(inquiry, admin.id, now);

      const updated = await tx.listingInquiry.update({
        where: { id: inquiryId },
        data: { lockExpiresAt },
      });

      return {
        id: updated.id,
        status: updated.status,
        lockInfo: buildInquiryLockInfo(
          updated,
          now,
          admin.id,
          new Map([[admin.id, admin.fullName]]),
        ),
      };
    });
  }

  /** `POST /admin/inquiries/:id/release` — hands the lease back without a decision. */
  async releaseInquiry(inquiryId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const inquiry = await tx.listingInquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) {
        throw inquiryNotFound();
      }

      assertInquiryLockHeld(inquiry, admin.id, now);

      const updated = await tx.listingInquiry.update({
        where: { id: inquiryId },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: INQUIRY_AUDIT_ACTIONS.MODERATION_RELEASED,
          entityType: 'ListingInquiry',
          entityId: inquiryId,
          payload: {
            releasedByAdminId: admin.id,
            releasedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.log(`Inquiry ${inquiryId} lease released by admin ${admin.id}`);
      return {
        id: updated.id,
        status: updated.status,
        lockInfo: buildInquiryLockInfo(updated, now, admin.id),
      };
    });
  }

  /** `POST /admin/inquiries/:id/force-unlock` — `Tasks.ForceUnlock` + a documented reason. */
  async forceUnlockInquiry(
    inquiryId: string,
    admin: AuthenticatedAdminActor,
    reason: string,
  ) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException({
        code: INQUIRY_FORCE_UNLOCK_REASON_REQUIRED,
        message: 'يجب إدخال سبب معتمد لإلغاء قفل المحادثة (5 أحرف على الأقل)',
      });
    }

    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const inquiry = await tx.listingInquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) {
        throw inquiryNotFound();
      }

      const previousLockHolderId = inquiry.lockedByAdminId ?? null;

      const updated = await tx.listingInquiry.update({
        where: { id: inquiryId },
        data: { lockedByAdminId: null, lockedAt: null, lockExpiresAt: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: INQUIRY_AUDIT_ACTIONS.MODERATION_FORCE_UNLOCKED,
          entityType: 'ListingInquiry',
          entityId: inquiryId,
          payload: {
            previousLockHolderId,
            reason: trimmedReason,
            unlockedByAdminId: admin.id,
            unlockedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });

      this.logger.warn(
        `Inquiry ${inquiryId} lease force-unlocked by admin ${admin.id} (previous holder: ${previousLockHolderId ?? 'none'})`,
      );
      return {
        id: updated.id,
        status: updated.status,
        lockInfo: buildInquiryLockInfo(updated, now, admin.id),
      };
    });
  }

  /** `POST /admin/inquiries/:id/relay-to-seller` — AC-5: `PENDING_ADMIN_REVIEW` → `RELAYED_TO_SELLER`. */
  async relayToSeller(
    inquiryId: string,
    admin: AuthenticatedAdminActor,
    note?: string | null,
    expectedVersion?: number,
  ): Promise<AdminInquiryThread> {
    return this.applyTransition(inquiryId, admin, {
      allowedFrom: [InquiryStatus.PENDING_ADMIN_REVIEW],
      toStatus: InquiryStatus.RELAYED_TO_SELLER,
      auditAction: INQUIRY_AUDIT_ACTIONS.RELAYED_TO_SELLER,
      relayAuthorRole: InquiryAuthorRole.BUYER,
      note,
      expectedVersion,
      invalidStateMessage:
        'لا يمكن إحالة الاستفسار إلى البائع إلا إذا كان بانتظار مراجعة الإدارة',
    });
  }

  /** `POST /admin/inquiries/:id/relay-to-buyer` — AC-5: `SELLER_RESPONDED` → `RELAYED_TO_BUYER`. */
  async relayToBuyer(
    inquiryId: string,
    admin: AuthenticatedAdminActor,
    note?: string | null,
    expectedVersion?: number,
  ): Promise<AdminInquiryThread> {
    return this.applyTransition(inquiryId, admin, {
      allowedFrom: [InquiryStatus.SELLER_RESPONDED],
      toStatus: InquiryStatus.RELAYED_TO_BUYER,
      auditAction: INQUIRY_AUDIT_ACTIONS.RELAYED_TO_BUYER,
      relayAuthorRole: InquiryAuthorRole.SELLER,
      note,
      expectedVersion,
      invalidStateMessage:
        'لا يمكن إحالة الرد إلى المشتري إلا إذا كان البائع قد رد على الاستفسار',
    });
  }

  /** `POST /admin/inquiries/:id/close` — AC-5: any non-terminal status → `CLOSED` (terminal). */
  async closeInquiry(
    inquiryId: string,
    admin: AuthenticatedAdminActor,
    reason: string,
    expectedVersion?: number,
  ): Promise<AdminInquiryThread> {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException({
        code: INQUIRY_CLOSE_REASON_REQUIRED,
        message: 'يجب إدخال سبب إغلاق موثّق للمحادثة (5 أحرف على الأقل)',
      });
    }

    return this.applyTransition(inquiryId, admin, {
      allowedFrom: [...CLAIMABLE_INQUIRY_STATUSES],
      toStatus: InquiryStatus.CLOSED,
      auditAction: INQUIRY_AUDIT_ACTIONS.CLOSED,
      closeReason: trimmedReason,
      expectedVersion,
      invalidStateMessage: 'لا يمكن إغلاق المحادثة في حالتها الحالية',
    });
  }

  // ---- internals -----------------------------------------------------------

  /**
   * One relay/close step: row lock → lease check → state check → status change + relay stamps +
   * optional admin note + audit, all in a single transaction (AC-6, AD-10, AD-11).
   */
  private async applyTransition(
    inquiryId: string,
    admin: AuthenticatedAdminActor,
    transition: InquiryTransition,
  ): Promise<AdminInquiryThread> {
    const now = this.clockService.now();
    const trimmedNote = (transition.note ?? '').trim();
    const maskedNote = trimmedNote.length > 0 ? maskInquiryBody(trimmedNote) : null;
    let relayedMessageCount = 0;

    await this.prisma.$transaction(async (tx: any): Promise<void> => {
      // AD-4/AD-11: `listing_inquiries.id` is a `text` column — cast to `text`, never `uuid`.
      await tx.$queryRaw`SELECT "id" FROM "listing_inquiries" WHERE "id" = ${inquiryId}::text FOR UPDATE`;

      const inquiry = await tx.listingInquiry.findUnique({
        where: { id: inquiryId },
        include: INQUIRY_THREAD_INCLUDE as any,
      });
      if (!inquiry) {
        throw inquiryNotFound();
      }

      // AD-10: validate the lease in-transaction so a stale decision cannot commit.
      assertInquiryLockHeld(inquiry, admin.id, now);

      if (transition.expectedVersion !== undefined && typeof inquiry.version === 'number') {
        assertOptimisticVersion(transition.expectedVersion, inquiry.version);
      }

      if (inquiry.status === InquiryStatus.CLOSED) {
        throw new ConflictException({
          code: INQUIRY_CLOSED,
          message: 'المحادثة مغلقة ولا تقبل أي إجراء جديد',
        });
      }

      if (!transition.allowedFrom.includes(inquiry.status)) {
        throw new ConflictException({
          code: INQUIRY_INVALID_STATE_TRANSITION,
          message: transition.invalidStateMessage,
        });
      }

      const data: any = {
        status: transition.toStatus,
        version: { increment: 1 },
        // AD-10: "lock is released on decision commit".
        lockedByAdminId: null,
        lockedAt: null,
        lockExpiresAt: null,
      };

      if (transition.toStatus === InquiryStatus.CLOSED) {
        data.closedAt = now;
        data.closedByAdminId = admin.id;
        data.closeReason = transition.closeReason ?? null;
      }

      if (maskedNote) {
        data.lastMessageAt = now;
      }

      await tx.listingInquiry.update({ where: { id: inquiryId }, data });

      if (transition.relayAuthorRole) {
        // AC-4: the stamp is what makes the message visible to the other side.
        const { count } = await tx.inquiryMessage.updateMany({
          where: {
            inquiryId,
            authorRole: transition.relayAuthorRole,
            relayedAt: null,
          },
          data: { relayedAt: now, relayedByAdminId: admin.id },
        });
        relayedMessageCount = count;
      }

      if (maskedNote) {
        await createInquiryMessage(tx, {
          inquiryId,
          authorRole: InquiryAuthorRole.ADMIN,
          authorProfileId: null,
          authorAdminId: admin.id,
          body: maskedNote.body,
          maskingApplied: maskedNote.maskingApplied,
          maskedTypes: maskedNote.maskedTypes,
          createdAt: now,
          attachmentIds: [],
          uploaderProfileId: null,
          auditActorId: admin.id,
          auditActorType: 'ADMIN',
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: transition.auditAction,
          entityType: 'ListingInquiry',
          entityId: inquiryId,
          payload: {
            fromStatus: inquiry.status,
            toStatus: transition.toStatus,
            relayedMessageCount,
            noteMasking: maskedNote
              ? { maskingApplied: maskedNote.maskingApplied, maskedTypes: maskedNote.types }
              : null,
            closeReason: transition.closeReason ?? null,
            actedByAdminId: admin.id,
            actedByAdminName: admin.fullName,
            at: now.toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `Inquiry ${inquiryId} -> ${transition.toStatus} by admin ${admin.id} (relayed messages: ${relayedMessageCount})`,
    );

    // The lease is gone at this point, so the projection reports the thread as unlocked.
    return this.loadAdminThread(inquiryId, admin.id);
  }

  private async loadAdminThread(
    inquiryId: string,
    currentAdminId: string,
  ): Promise<AdminInquiryThread> {
    const now = this.clockService.now();

    const inquiry = await this.prisma.listingInquiry.findUnique({
      where: { id: inquiryId },
      include: INQUIRY_THREAD_INCLUDE as any,
    });
    if (!inquiry) {
      throw inquiryNotFound();
    }

    const adminNameMap = await resolveInquiryLockHolderNames(this.prisma, [inquiry], now);
    const lockInfo = buildInquiryLockInfo(inquiry, now, currentAdminId, adminNameMap);

    return toInquiryThreadItem(inquiry, 'ADMIN', lockInfo) as AdminInquiryThread;
  }

  private assertClaimable(inquiry: any): void {
    if (!CLAIMABLE_INQUIRY_STATUSES.includes(inquiry.status)) {
      throw new BadRequestException({
        code: INQUIRY_INVALID_STATE_TRANSITION,
        message: 'لا يمكن استلام المحادثة إلا إذا كانت نشطة ولم يتم إغلاقها',
      });
    }
  }

  private async loadLockHolder(
    tx: any,
    adminId: string | null,
  ): Promise<{ id: string; name: string } | null> {
    if (!adminId) return null;
    const holder = await tx.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, fullName: true, username: true },
    });
    if (!holder) return null;
    return { id: holder.id, name: holder.fullName || holder.username };
  }
}
