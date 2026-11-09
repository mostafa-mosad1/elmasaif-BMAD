import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjudicateDisputeInput,
  DEAL_CANCEL_REASON_ADMIN,
  DEAL_DISPUTED,
  DEAL_DISPUTE_CLAIMED,
  DEAL_DISPUTE_FORCE_UNLOCKED,
  DEAL_DISPUTE_RELEASED,
  DEAL_DISPUTE_RESOLVED_CANCELLED,
  DEAL_DISPUTE_RESOLVED_COMPLETED,
  DEAL_DISPUTE_RETURNED_TO_REVIEW,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_PAYMENT_STATUS,
  DEAL_TERMINAL,
  DISPUTE_ALREADY_OPEN,
  DISPUTE_LOCK_CONFLICT,
  DISPUTE_LOCK_DURATION_MS,
  DISPUTE_NOT_CLAIMABLE,
  DISPUTE_PROOF_REQUIRED,
  DISPUTE_RESOLUTION_ACTION,
  DISPUTE_SELF_ADJUDICATION_FORBIDDEN,
  DISPUTE_STATUS,
  DealStatus,
  FileDisputeInput,
  ListingStatus,
  TERMINAL_DEAL_STATUSES,
  UserRole,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { DealCompletionService } from './deal-completion.service';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import {
  assertDisputeLockHeld,
  buildDisputeLockInfo,
  disputeNotFound,
  resolveDisputeLockHolderNames,
} from './dispute-lock';

export function projectDisputeQueueItem(
  dispute: any,
  currentAdminId: string,
  now: Date,
  adminNameMap: Map<string, string>,
) {
  const deal = dispute.deal;
  const buyerUser = deal?.buyerProfile?.user;
  const sellerUser = deal?.sellerProfile?.user;

  let filedByRole: 'BUYER' | 'SELLER' | 'SYSTEM' = 'SYSTEM';
  let filedByName = 'النظام الآلي (انتهاء مهلة)';

  if (dispute.initiatorId) {
    if (
      buyerUser &&
      (dispute.initiatorId === buyerUser.id || dispute.initiatorId === deal?.buyerProfile?.userId)
    ) {
      filedByRole = 'BUYER';
      filedByName = buyerUser.fullName || 'المشتري';
    } else if (
      sellerUser &&
      (dispute.initiatorId === sellerUser.id || dispute.initiatorId === deal?.sellerProfile?.userId)
    ) {
      filedByRole = 'SELLER';
      filedByName = sellerUser.fullName || 'البائع';
    }
  }

  const resolvedByAdminName = dispute.resolvedByAdminId
    ? adminNameMap.get(dispute.resolvedByAdminId) || null
    : null;

  return {
    ...dispute,
    dealId: dispute.dealId,
    dealNumber: deal?.dealNumber || '—',
    dealStatus: deal?.status || null,
    filedByRole,
    filedByName,
    resolvedByAdminName,
    lockInfo: buildDisputeLockInfo(dispute, now, currentAdminId, adminNameMap),
  };
}

/**
 * Story 5.6 / AC-4, AC-7, AC-8: Dispute Service.
 *
 * Handles:
 * 1. Formal deal dispute filing by transaction counterparties (Buyer or Seller).
 * 2. Super Admin dispute adjudication queue & AD-10 task claim locking (15m lease, 5m heartbeat).
 * 3. Super Admin binding dispute adjudication verdicts: COMPLETE, CANCEL, or RETURN_TO_REVIEW.
 */
@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly dealCompletionService: DealCompletionService,
  ) {}

  /**
   * Formal Deal Dispute Filing by Counterparties (AC-4, FR-36, UC-29C).
   */
  async fileDispute(
    userId: string,
    activeRole: UserRole,
    dealId: string,
    input: FileDisputeInput,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Deal row FOR UPDATE casting ${dealId}::text
      await tx.$queryRaw`SELECT "id" FROM "deals" WHERE "id" = ${dealId}::text FOR UPDATE`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          payments: true,
          disputes: true,
        },
      });

      if (!deal) {
        throw new NotFoundException({
          code: DEAL_NOT_FOUND,
          message: 'الصفقة غير موجودة',
        });
      }

      // Validate caller is buyer or seller
      const callerProfile = await tx.userProfile.findFirst({
        where: { userId, role: activeRole },
      });

      const isBuyer = callerProfile && deal.buyerProfileId === callerProfile.id;
      const isSeller = callerProfile && deal.sellerProfileId === callerProfile.id;

      if (!isBuyer && !isSeller) {
        throw new ForbiddenException({
          code: DEAL_NOT_PARTY,
          message: 'يحق لمشتري أو بائع الصفقة فقط تقديم نزاع',
        });
      }

      // Validate deal is not in terminal state
      if ((TERMINAL_DEAL_STATUSES as readonly string[]).includes(deal.status)) {
        throw new ConflictException({
          code: DEAL_TERMINAL,
          message: 'لا يمكن تقديم نزاع على صفقة مكتملة أو ملغاة أو منتهية',
        });
      }

      // Validate proof existence: at least one payment proof must be uploaded
      const hasProof = deal.payments.some(
        (p: any) => p.status !== DEAL_PAYMENT_STATUS.PENDING,
      );
      if (!hasProof) {
        throw new ConflictException({
          code: DISPUTE_PROOF_REQUIRED,
          message: 'لا يمكن تقديم نزاع قبل رفع إثبات دفع واحد على الأقل',
        });
      }

      // Validate no active open dispute exists
      const hasActiveDispute = deal.disputes.some(
        (d: any) => d.status === DISPUTE_STATUS.OPEN,
      );
      if (hasActiveDispute) {
        throw new ConflictException({
          code: DISPUTE_ALREADY_OPEN,
          message: 'يوجد نزاع مفتوح بالفعل لهذه الصفقة قيد التدقيق الإداري',
        });
      }

      // Transition Deal to DISPUTED
      const updatedDeal = await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.DISPUTED,
          version: { increment: 1 },
        },
      });

      // Create Dispute row
      const dispute = await tx.dispute.create({
        data: {
          dealId: deal.id,
          initiatorId: userId,
          reason: input.reason.trim(),
          status: DISPUTE_STATUS.OPEN,
        },
      });

      // Insert AuditLog
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: DEAL_DISPUTED,
          entityType: 'Dispute',
          entityId: dispute.id,
          payload: {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            initiatorRole: activeRole,
            reason: input.reason.trim(),
            disputedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(`Dispute filed for deal ${deal.dealNumber} by ${userId} (${activeRole})`);

      return {
        disputeId: dispute.id,
        dealId: updatedDeal.id,
        status: updatedDeal.status,
      };
    });
  }

  /**
   * Super Admin Dispute Adjudication Queue (AC-7).
   */
  async getDisputesQueue(
    query: { status?: string; page?: number; limit?: number },
    currentAdminId: string,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          deal: {
            include: {
              listing: {
                include: {
                  city: true,
                  district: true,
                },
              },
              buyerProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      mobileNumber: true,
                      nationalId: true,
                      email: true,
                    },
                  },
                },
              },
              sellerProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      mobileNumber: true,
                      nationalId: true,
                      email: true,
                    },
                  },
                },
              },
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    const now = this.clockService.now();
    const adminNameMap = await resolveDisputeLockHolderNames(this.prisma, items, now);

    // Also resolve resolvedByAdminId names if any disputes are resolved
    const resolvedAdminIds = items
      .map((d: any) => d.resolvedByAdminId)
      .filter((id: string | null): id is string => Boolean(id) && !adminNameMap.has(id!));
    if (resolvedAdminIds.length > 0) {
      const resolvedAdmins = await this.prisma.adminUser.findMany({
        where: { id: { in: resolvedAdminIds } },
        select: { id: true, fullName: true },
      });
      for (const admin of resolvedAdmins) {
        adminNameMap.set(admin.id, admin.fullName);
      }
    }

    const projectedItems = items.map((dispute: any) =>
      projectDisputeQueueItem(dispute, currentAdminId, now, adminNameMap),
    );

    return {
      items: projectedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single dispute with details and lock info (AC-7, AC-11).
   */
  async getDisputeById(disputeId: string, currentAdminId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        deal: {
          include: {
            listing: {
              include: {
                city: true,
                district: true,
              },
            },
            buyerProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    mobileNumber: true,
                    nationalId: true,
                    email: true,
                  },
                },
              },
            },
            sellerProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    mobileNumber: true,
                    nationalId: true,
                    email: true,
                  },
                },
              },
            },
            payments: true,
          },
        },
      },
    });

    if (!dispute) {
      throw disputeNotFound();
    }

    const now = this.clockService.now();
    const adminNameMap = await resolveDisputeLockHolderNames(this.prisma, [dispute], now);

    const [auditLogs, resolvedAdmin] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'Dispute', entityId: dispute.id },
            { entityType: 'Deal', entityId: dispute.dealId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      dispute.resolvedByAdminId
        ? this.prisma.adminUser.findUnique({
            where: { id: dispute.resolvedByAdminId },
            select: { id: true, fullName: true },
          })
        : null,
    ]);

    if (resolvedAdmin) {
      adminNameMap.set(resolvedAdmin.id, resolvedAdmin.fullName);
    }

    const base = projectDisputeQueueItem(dispute, currentAdminId, now, adminNameMap);
    const deal = dispute.deal;
    const buyerUser = deal?.buyerProfile?.user;
    const sellerUser = deal?.sellerProfile?.user;

    return {
      ...base,
      deal: {
        id: deal?.id,
        dealNumber: deal?.dealNumber || '—',
        status: deal?.status,
        createdAt: deal?.createdAt,
        paymentDeadline: deal?.paymentDeadline,
        buyer: {
          id: buyerUser?.id || deal?.buyerProfileId,
          name: buyerUser?.fullName || 'غير معروف',
          phone: buyerUser?.mobileNumber || null,
          nationalId: buyerUser?.nationalId || null,
        },
        seller: {
          id: sellerUser?.id || deal?.sellerProfileId,
          name: sellerUser?.fullName || 'غير معروف',
          phone: sellerUser?.mobileNumber || null,
          nationalId: sellerUser?.nationalId || null,
          iban: deal?.sellerPayoutIbanMasked || null,
        },
        listing: {
          id: deal?.listing?.id,
          title: deal?.listing?.title || 'عقار',
          propertyType: deal?.listing?.propertyType || null,
          cityName: deal?.listing?.city?.nameAr || null,
          districtName: deal?.listing?.district?.nameAr || null,
          askPrice: deal?.listing?.askPrice ? Number(deal.listing.askPrice) : null,
          finalPrice: deal?.dealPrice ? Number(deal.dealPrice) : null,
        },
        payments: (deal?.payments || []).map((p: any) => ({
          id: p.id,
          paymentType: p.paymentType,
          amount: p.amount ? Number(p.amount) : 0,
          status: p.status,
          hasProof: Boolean(p.proofFileUrl),
          proofFileObjectId: p.proofFileUrl,
          bankReferenceCode: p.bankReferenceCode,
          senderBankName: p.senderBankName,
          uploadedAt: p.uploadedAt,
          rejectionReason: p.rejectionReason,
        })),
        auditLogs: auditLogs.map((log: any) => ({
          id: log.id,
          action: log.action,
          actorRole: log.actorType,
          actorName: log.actorName || null,
          notes: log.notes || (log.payload ? JSON.stringify(log.payload) : null),
          createdAt: log.createdAt,
        })),
      },
    };
  }

  /**
   * Acquire 15-minute claim lease (AC-7).
   */
  async claimDispute(disputeId: string, adminId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      await tx.$queryRaw`SELECT "id" FROM "disputes" WHERE "id" = ${disputeId}::text FOR UPDATE`;

      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
      });

      if (!dispute) {
        throw disputeNotFound();
      }

      if (dispute.status !== DISPUTE_STATUS.OPEN) {
        throw new ConflictException({
          code: DISPUTE_NOT_CLAIMABLE,
          message: 'لا يمكن حجز نزاع غير مفتوح',
        });
      }

      const activeLock =
        dispute.lockedByAdminId &&
        dispute.lockedByAdminId !== adminId &&
        dispute.lockExpiresAt &&
        dispute.lockExpiresAt.getTime() > now.getTime();

      if (activeLock) {
        throw new ConflictException({
          code: DISPUTE_LOCK_CONFLICT,
          message: 'قفل النزاع محجوز حالياً بواسطة مسؤول آخر',
        });
      }

      const lockExpiresAt = new Date(now.getTime() + DISPUTE_LOCK_DURATION_MS);

      const updatedDispute = await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          lockedByAdminId: adminId,
          lockedAt: now,
          lockExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: DEAL_DISPUTE_CLAIMED,
          entityType: 'Dispute',
          entityId: dispute.id,
          payload: {
            disputeId: dispute.id,
            dealId: dispute.dealId,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
          },
        },
      });

      return {
        ...updatedDispute,
        lockInfo: buildDisputeLockInfo(updatedDispute, now, adminId),
      };
    });
  }

  /**
   * Renew 15-minute lease (AC-7).
   */
  async renewDisputeLock(disputeId: string, adminId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      await tx.$queryRaw`SELECT "id" FROM "disputes" WHERE "id" = ${disputeId}::text FOR UPDATE`;

      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
      });

      if (!dispute) {
        throw disputeNotFound();
      }

      assertDisputeLockHeld(dispute, adminId, now);

      const lockExpiresAt = new Date(now.getTime() + DISPUTE_LOCK_DURATION_MS);

      const updatedDispute = await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          lockExpiresAt,
        },
      });

      return {
        ...updatedDispute,
        lockInfo: buildDisputeLockInfo(updatedDispute, now, adminId),
      };
    });
  }

  /**
   * Release lease voluntarily back to queue (AC-7).
   */
  async releaseDisputeLock(disputeId: string, adminId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      await tx.$queryRaw`SELECT "id" FROM "disputes" WHERE "id" = ${disputeId}::text FOR UPDATE`;

      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
      });

      if (!dispute) {
        throw disputeNotFound();
      }

      assertDisputeLockHeld(dispute, adminId, now);

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: DEAL_DISPUTE_RELEASED,
          entityType: 'Dispute',
          entityId: dispute.id,
          payload: {
            disputeId: dispute.id,
            dealId: dispute.dealId,
            releasedAt: now.toISOString(),
          },
        },
      });

      return { released: true };
    });
  }

  /**
   * Force unlock override with reason (AC-7).
   */
  async forceUnlockDispute(disputeId: string, adminId: string, reason: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      await tx.$queryRaw`SELECT "id" FROM "disputes" WHERE "id" = ${disputeId}::text FOR UPDATE`;

      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
      });

      if (!dispute) {
        throw disputeNotFound();
      }

      const previousHolder = dispute.lockedByAdminId;

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: DEAL_DISPUTE_FORCE_UNLOCKED,
          entityType: 'Dispute',
          entityId: dispute.id,
          payload: {
            disputeId: dispute.id,
            dealId: dispute.dealId,
            previousHolder,
            reason: reason.trim(),
            unlockedAt: now.toISOString(),
          },
        },
      });

      return { unlocked: true };
    });
  }

  /**
   * Super Admin Binding Dispute Adjudication Verdicts (AC-8, FR-36, UC-70C).
   */
  async adjudicateDispute(
    disputeId: string,
    admin: AuthenticatedAdminActor,
    input: AdjudicateDisputeInput,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const now = this.clockService.now();

      // 1. Lock Dispute row FOR UPDATE
      await tx.$queryRaw`SELECT "id" FROM "disputes" WHERE "id" = ${disputeId}::text FOR UPDATE`;

      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: {
          deal: {
            include: {
              payments: true,
              listing: true,
            },
          },
        },
      });

      if (!dispute) {
        throw disputeNotFound();
      }

      if (dispute.status !== DISPUTE_STATUS.OPEN) {
        throw new ConflictException({
          code: DISPUTE_NOT_CLAIMABLE,
          message: 'تم البت في هذا النزاع مسبقاً',
        });
      }

      // Assert lease held by this administrator
      assertDisputeLockHeld(dispute, admin.id, now);

      // Super admin conflict of interest check
      if (admin.id === dispute.initiatorId) {
        throw new ForbiddenException({
          code: DISPUTE_SELF_ADJUDICATION_FORBIDDEN,
          message: 'لا يمكن للمسؤول البت في نزاع هو طرف فيه',
        });
      }

      const deal = dispute.deal;

      // Verdict 1: COMPLETE (Deal Approval)
      if (input.action === DISPUTE_RESOLUTION_ACTION.COMPLETE) {
        await this.dealCompletionService.completeDealInTransaction(deal.id, admin, tx);

        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: DISPUTE_STATUS.RESOLVED,
            resolutionAction: DISPUTE_RESOLUTION_ACTION.COMPLETE,
            resolutionNotes: input.notes.trim(),
            resolvedByAdminId: admin.id,
            resolvedAt: now,
            lockedByAdminId: null,
            lockedAt: null,
            lockExpiresAt: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            actorType: 'ADMIN',
            action: DEAL_DISPUTE_RESOLVED_COMPLETED,
            entityType: 'Dispute',
            entityId: dispute.id,
            payload: {
              disputeId: dispute.id,
              dealId: deal.id,
              dealNumber: deal.dealNumber,
              action: 'COMPLETE',
              notes: input.notes.trim(),
              resolvedAt: now.toISOString(),
            },
          },
        });

        this.logger.log(`Dispute ${dispute.id} resolved with COMPLETE for deal ${deal.dealNumber}`);

        return {
          disputeId: dispute.id,
          dealId: deal.id,
          action: 'COMPLETE',
          status: 'RESOLVED',
        };
      }

      // Verdict 2: CANCEL (Deal Cancellation)
      if (input.action === DISPUTE_RESOLUTION_ACTION.CANCEL) {
        // Lock Listing & Payments
        if (deal.listingId) {
          await tx.$queryRaw`SELECT "id" FROM "listings" WHERE "id" = ${deal.listingId}::text FOR UPDATE`;
        }
        await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "dealId" = ${deal.id}::text FOR UPDATE`;

        await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: DealStatus.CANCELLED,
            cancellationReason: DEAL_CANCEL_REASON_ADMIN,
            version: { increment: 1 },
          },
        });

        if (deal.listingId) {
          await tx.listing.update({
            where: { id: deal.listingId },
            data: {
              status: ListingStatus.ACTIVE,
              version: { increment: 1 },
            },
          });
        }

        // Expire non-confirmed payments
        await tx.payment.updateMany({
          where: {
            dealId: deal.id,
            status: { not: DEAL_PAYMENT_STATUS.CONFIRMED },
          },
          data: {
            status: DEAL_PAYMENT_STATUS.EXPIRED,
          },
        });

        const hasConfirmedCommission = deal.payments.some(
          (p: any) =>
            p.type === 'PLATFORM_COMMISSION' &&
            p.status === DEAL_PAYMENT_STATUS.CONFIRMED,
        );

        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: DISPUTE_STATUS.RESOLVED,
            resolutionAction: DISPUTE_RESOLUTION_ACTION.CANCEL,
            resolutionNotes: input.notes.trim(),
            resolvedByAdminId: admin.id,
            resolvedAt: now,
            lockedByAdminId: null,
            lockedAt: null,
            lockExpiresAt: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            actorType: 'ADMIN',
            action: DEAL_DISPUTE_RESOLVED_CANCELLED,
            entityType: 'Dispute',
            entityId: dispute.id,
            payload: {
              disputeId: dispute.id,
              dealId: deal.id,
              dealNumber: deal.dealNumber,
              action: 'CANCEL',
              notes: input.notes.trim(),
              flag: hasConfirmedCommission
                ? 'SUPER_ADMIN_COMMISSION_REFUND_REVIEW_REQUIRED'
                : undefined,
              resolvedAt: now.toISOString(),
            },
          },
        });

        this.logger.log(`Dispute ${dispute.id} resolved with CANCEL for deal ${deal.dealNumber}`);

        return {
          disputeId: dispute.id,
          dealId: deal.id,
          action: 'CANCEL',
          status: 'RESOLVED',
        };
      }

      // Verdict 3: RETURN_TO_REVIEW (Review Extension)
      const newDeadlineHours = input.newDeadlineHours || 24;
      const newDeadline = new Date(now.getTime() + newDeadlineHours * 3600 * 1000);

      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DealStatus.UNDER_ADMIN_AUDIT,
          paymentDeadline: newDeadline,
          version: { increment: 1 },
        },
      });

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: DISPUTE_STATUS.RESOLVED,
          resolutionAction: DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW,
          resolutionNotes: input.notes.trim(),
          resolvedByAdminId: admin.id,
          resolvedAt: now,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: DEAL_DISPUTE_RETURNED_TO_REVIEW,
          entityType: 'Dispute',
          entityId: dispute.id,
          payload: {
            disputeId: dispute.id,
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            action: 'RETURN_TO_REVIEW',
            newDeadlineHours,
            newDeadline: newDeadline.toISOString(),
            notes: input.notes.trim(),
            resolvedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(
        `Dispute ${dispute.id} resolved with RETURN_TO_REVIEW for deal ${deal.dealNumber} (+${newDeadlineHours}h)`,
      );

      return {
        disputeId: dispute.id,
        dealId: deal.id,
        action: 'RETURN_TO_REVIEW',
        status: 'RESOLVED',
        newDeadline,
      };
    });
  }
}

