import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_OFFER_STATUSES,
  CLAIMABLE_INQUIRY_STATUSES,
  CONTRACT_FEE_LOCK_CONFLICT,
  CONTRACT_FEE_LOCK_EXPIRED,
  CONTRACT_FEE_LOCK_REQUIRED,
  CONTRACT_FEE_PAYMENT_NOT_FOUND,
  CONTRACT_FEE_PAYMENT_STATUS,
  CONTRACT_FEE_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_TYPE_LABELS_AR,
  DISPUTE_LOCK_CONFLICT,
  DISPUTE_LOCK_EXPIRED,
  DISPUTE_LOCK_REQUIRED,
  DISPUTE_NOT_FOUND,
  DISPUTE_STATUS,
  forceUnlockTaskSchema,
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_LOCK_REQUIRED,
  INQUIRY_NOT_FOUND,
  INQUIRY_STATUS_LABELS_AR,
  LICENSE_LOCK_CONFLICT,
  LICENSE_LOCK_EXPIRED,
  LICENSE_LOCK_REQUIRED,
  LICENSE_NOT_FOUND,
  LISTING_LOCK_CONFLICT,
  LISTING_LOCK_EXPIRED,
  LISTING_LOCK_REQUIRED,
  LISTING_NOT_FOUND,
  LISTING_STATUS_LABELS_AR,
  ListingStatus,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
  OFFER_STATUS_LABELS_AR,
  OPERATIONAL_QUEUE_METADATA,
  OPERATIONAL_QUEUE_TYPES,
  OWNER_REQUEST_LOCK_CONFLICT,
  OWNER_REQUEST_LOCK_EXPIRED,
  OWNER_REQUEST_LOCK_REQUIRED,
  OWNER_REQUEST_NOT_FOUND,
  PAYMENT_CLAIMABLE_STATUSES,
  PAYMENT_LOCK_CONFLICT,
  PAYMENT_LOCK_EXPIRED,
  PAYMENT_LOCK_REQUIRED,
  PAYMENT_NOT_FOUND,
  ProfileStatus,
  PROPERTY_TYPE_LABELS_AR,
  resolveOperationalQueueType,
  TASK_CLAIM_ACQUIRED,
  TASK_CLAIM_FORCE_UNLOCKED,
  TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS,
  TASK_CLAIM_LEASE_DURATION_MS,
  TASK_CLAIM_LEASE_DURATION_SECONDS,
  TASK_CLAIM_RELEASED,
  TASK_CLAIM_RENEWED,
  TASK_FORCE_UNLOCK_REASON_REQUIRED,
  type ClaimLockInfo,
  type OperationalQueueCounts,
  type OperationalQueueFilterInput,
  type OperationalQueueItemSummary,
  type OperationalQueuesHubResponse,
  type OperationalQueueType,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../clock/clock.service';
import {
  assertClaimLockHeld,
  buildClaimLockInfo,
  resolveClaimLockHolderNames,
  type ClaimLockCodes,
} from './claim-lock';

export interface AdminLockActor {
  id: string;
  username?: string;
  fullName?: string;
  role?: string;
  permissions?: string[];
}

interface QueueAdapterConfig {
  queueType: OperationalQueueType;
  modelName:
    | 'listing'
    | 'falLicense'
    | 'ownerListingRequest'
    | 'payment'
    | 'contractFeePayment'
    | 'listingInquiry'
    | 'dispute'
    | 'offer';
  entityTypeAudit: string;
  notFoundCode: string;
  notFoundMessage: string;
  lockCodes: ClaimLockCodes;
  auditActions: {
    claimed: string;
    released: string;
    forceUnlocked: string;
  };
}

const QUEUE_ADAPTERS: Record<OperationalQueueType, QueueAdapterConfig> = {
  LISTING: {
    queueType: 'LISTING',
    modelName: 'listing',
    entityTypeAudit: 'Listing',
    notFoundCode: LISTING_NOT_FOUND,
    notFoundMessage: 'الإعلان العقاري غير موجود',
    lockCodes: {
      required: {
        code: LISTING_LOCK_REQUIRED,
        message: 'يجب حجز الإعلان العقاري للمراجعة أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: LISTING_LOCK_CONFLICT,
        message: 'الإعلان العقاري محجوز حالياً لمشرف آخر قيد المراجعة',
      },
      expired: {
        code: LISTING_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز الإعلان العقاري (15 دقيقة)، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'LISTING_MODERATION_CLAIMED',
      released: 'LISTING_MODERATION_RELEASED',
      forceUnlocked: 'LISTING_MODERATION_FORCE_UNLOCKED',
    },
  },
  FAL_PROFILE: {
    queueType: 'FAL_PROFILE',
    modelName: 'falLicense',
    entityTypeAudit: 'FalLicense',
    notFoundCode: LICENSE_NOT_FOUND,
    notFoundMessage: 'طلب توثيق رخصة فال غير موجود',
    lockCodes: {
      required: {
        code: LICENSE_LOCK_REQUIRED,
        message: 'يجب حجز طلب رخصة فال أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: LICENSE_LOCK_CONFLICT,
        message: 'طلب رخصة فال محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: LICENSE_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز طلب رخصة فال، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'FAL_LICENSE_CLAIMED',
      released: 'FAL_LICENSE_RELEASED',
      forceUnlocked: 'FAL_LICENSE_FORCE_UNLOCKED',
    },
  },
  OWNER_REQUEST: {
    queueType: 'OWNER_REQUEST',
    modelName: 'ownerListingRequest',
    entityTypeAudit: 'OwnerListingRequest',
    notFoundCode: OWNER_REQUEST_NOT_FOUND,
    notFoundMessage: 'طلب إدراج المالك غير موجود',
    lockCodes: {
      required: {
        code: OWNER_REQUEST_LOCK_REQUIRED,
        message: 'يجب حجز طلب المالك أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: OWNER_REQUEST_LOCK_CONFLICT,
        message: 'طلب المالك محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: OWNER_REQUEST_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز طلب المالك، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'OWNER_REQUEST_CLAIMED',
      released: 'OWNER_REQUEST_RELEASED',
      forceUnlocked: 'OWNER_REQUEST_FORCE_UNLOCKED',
    },
  },
  PAYMENT: {
    queueType: 'PAYMENT',
    modelName: 'payment',
    entityTypeAudit: 'Payment',
    notFoundCode: PAYMENT_NOT_FOUND,
    notFoundMessage: 'إيصال السداد البنكي غير موجود',
    lockCodes: {
      required: {
        code: PAYMENT_LOCK_REQUIRED,
        message: 'يجب حجز إيصال السداد أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: PAYMENT_LOCK_CONFLICT,
        message: 'إيصال السداد محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: PAYMENT_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز إيصال السداد، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'PAYMENT_PROOF_CLAIMED',
      released: 'PAYMENT_MODERATION_RELEASED',
      forceUnlocked: 'PAYMENT_LOCK_FORCE_UNLOCKED',
    },
  },
  CONTRACT_FEE: {
    queueType: 'CONTRACT_FEE',
    modelName: 'contractFeePayment',
    entityTypeAudit: 'ContractFeePayment',
    notFoundCode: CONTRACT_FEE_PAYMENT_NOT_FOUND,
    notFoundMessage: 'إشعار سداد رسوم العقد غير موجود',
    lockCodes: {
      required: {
        code: CONTRACT_FEE_LOCK_REQUIRED,
        message: 'يجب حجز إشعار رسوم العقد أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: CONTRACT_FEE_LOCK_CONFLICT,
        message: 'إشعار رسوم العقد محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: CONTRACT_FEE_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز إشعار رسوم العقد، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'CONTRACT_FEE_CLAIMED',
      released: 'CONTRACT_FEE_RELEASED',
      forceUnlocked: 'CONTRACT_FEE_FORCE_UNLOCKED',
    },
  },
  CONVERSATION: {
    queueType: 'CONVERSATION',
    modelName: 'listingInquiry',
    entityTypeAudit: 'ListingInquiry',
    notFoundCode: INQUIRY_NOT_FOUND,
    notFoundMessage: 'محادثة الاستفسار غير موجودة',
    lockCodes: {
      required: {
        code: INQUIRY_LOCK_REQUIRED,
        message: 'يجب حجز محادثة الاستفسار أولاً قبل التمرير أو الإغلاق',
      },
      conflict: {
        code: INQUIRY_LOCK_CONFLICT,
        message: 'محادثة الاستفسار محجوزة حالياً لمشرف آخر',
      },
      expired: {
        code: INQUIRY_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز المحادثة، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'INQUIRY_MODERATION_CLAIMED',
      released: 'INQUIRY_MODERATION_RELEASED',
      forceUnlocked: 'INQUIRY_MODERATION_FORCE_UNLOCKED',
    },
  },
  DISPUTE: {
    queueType: 'DISPUTE',
    modelName: 'dispute',
    entityTypeAudit: 'Dispute',
    notFoundCode: DISPUTE_NOT_FOUND,
    notFoundMessage: 'النزاع العقاري غير موجود',
    lockCodes: {
      required: {
        code: DISPUTE_LOCK_REQUIRED,
        message: 'يجب حجز النزاع أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: DISPUTE_LOCK_CONFLICT,
        message: 'النزاع محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: DISPUTE_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز النزاع، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'DEAL_DISPUTE_CLAIMED',
      released: 'DEAL_DISPUTE_RELEASED',
      forceUnlocked: 'DEAL_DISPUTE_FORCE_UNLOCKED',
    },
  },
  OFFER: {
    queueType: 'OFFER',
    modelName: 'offer',
    entityTypeAudit: 'Offer',
    notFoundCode: OFFER_NOT_FOUND,
    notFoundMessage: 'عرض الشراء غير موجود',
    lockCodes: {
      required: {
        code: OFFER_LOCK_REQUIRED,
        message: 'يجب حجز عرض الشراء أولاً قبل اتخاذ القرار',
      },
      conflict: {
        code: OFFER_LOCK_CONFLICT,
        message: 'عرض الشراء محجوز حالياً لمشرف آخر',
      },
      expired: {
        code: OFFER_LOCK_EXPIRED,
        message: 'انتهت صلاحية حجز عرض الشراء، يرجى إعادة الحجز',
      },
    },
    auditActions: {
      claimed: 'OFFER_MODERATION_CLAIMED',
      released: 'OFFER_MODERATION_RELEASED',
      forceUnlocked: 'OFFER_MODERATION_FORCE_UNLOCKED',
    },
  },
};

@Injectable()
export class TaskClaimLockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  private resolveAdapter(queueOrSlug: string): QueueAdapterConfig {
    const queueType = resolveOperationalQueueType(queueOrSlug);
    if (!queueType || !QUEUE_ADAPTERS[queueType]) {
      throw new NotFoundException({
        code: 'OPERATIONAL_QUEUE_NOT_FOUND',
        message: `طابور المهام المحدد غير معروف (${queueOrSlug})`,
      });
    }
    return QUEUE_ADAPTERS[queueType];
  }

  /**
   * Acquires an exclusive 15-minute claim lease using an atomic conditional `updateMany`
   * (`OR: [{ lockedByAdminId: null }, { lockExpiresAt: { lte: now } }, { lockedByAdminId: admin.id }]`).
   */
  async claimTask(queueOrSlug: string, entityId: string, admin: AdminLockActor) {
    const adapter = this.resolveAdapter(queueOrSlug);
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + TASK_CLAIM_LEASE_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const delegate = tx[adapter.modelName];
      const existing = await delegate.findUnique({ where: { id: entityId } });
      if (!existing) {
        throw new NotFoundException({
          code: adapter.notFoundCode,
          message: adapter.notFoundMessage,
        });
      }

      const claimed = await delegate.updateMany({
        where: {
          id: entityId,
          OR: [
            { lockedByAdminId: null },
            { lockExpiresAt: { lte: now } },
            { lockedByAdminId: admin.id },
          ],
        },
        data: {
          lockedByAdminId: admin.id,
          lockedAt: now,
          lockExpiresAt,
        },
      });

      if (claimed.count === 0) {
        const current = (await delegate.findUnique({ where: { id: entityId } })) ?? existing;
        const nameMap = await resolveClaimLockHolderNames(tx, [current], now);
        throw new ConflictException({
          code: adapter.lockCodes.conflict.code,
          message: adapter.lockCodes.conflict.message,
          lockInfo: buildClaimLockInfo(current, now, admin.id, nameMap),
        });
      }

      const updated = (await delegate.findUnique({ where: { id: entityId } })) ?? {
        ...existing,
        lockedByAdminId: admin.id,
        lockedAt: now,
        lockExpiresAt,
      };
      const nameMap = await resolveClaimLockHolderNames(tx, [updated], now);
      if (admin.fullName || admin.username) {
        nameMap.set(admin.id, admin.fullName || admin.username || admin.id);
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: adapter.auditActions.claimed,
          entityType: adapter.entityTypeAudit,
          entityId,
          payload: {
            queueType: adapter.queueType,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
            leaseDurationSeconds: TASK_CLAIM_LEASE_DURATION_SECONDS,
          },
        },
      });

      return {
        code: TASK_CLAIM_ACQUIRED,
        queueType: adapter.queueType,
        entityId,
        lockInfo: buildClaimLockInfo(updated, now, admin.id, nameMap),
      };
    });
  }

  /**
   * Renews an active claim lease (+15 minutes from `ClockService.now()`) on a 5-minute heartbeat cadence.
   */
  async heartbeatTask(queueOrSlug: string, entityId: string, admin: AdminLockActor) {
    const adapter = this.resolveAdapter(queueOrSlug);
    const now = this.clockService.now();
    const lockExpiresAt = new Date(now.getTime() + TASK_CLAIM_LEASE_DURATION_MS);

    return this.prisma.$transaction(async (tx: any) => {
      const delegate = tx[adapter.modelName];
      const existing = await delegate.findUnique({ where: { id: entityId } });
      if (!existing) {
        throw new NotFoundException({
          code: adapter.notFoundCode,
          message: adapter.notFoundMessage,
        });
      }

      if (
        existing.lockedByAdminId &&
        existing.lockedByAdminId !== admin.id &&
        existing.lockExpiresAt &&
        new Date(existing.lockExpiresAt).getTime() > now.getTime()
      ) {
        const nameMap = await resolveClaimLockHolderNames(tx, [existing], now);
        throw new ConflictException({
          code: adapter.lockCodes.conflict.code,
          message: adapter.lockCodes.conflict.message,
          lockInfo: buildClaimLockInfo(existing, now, admin.id, nameMap),
        });
      }

      assertClaimLockHeld(existing, admin.id, now, adapter.lockCodes);

      const updated = await delegate.update({
        where: { id: entityId },
        data: {
          lockExpiresAt,
        },
      });

      const nameMap = await resolveClaimLockHolderNames(tx, [updated], now);
      if (admin.fullName || admin.username) {
        nameMap.set(admin.id, admin.fullName || admin.username || admin.id);
      }

      return {
        code: TASK_CLAIM_RENEWED,
        queueType: adapter.queueType,
        entityId,
        lockInfo: buildClaimLockInfo(updated, now, admin.id, nameMap),
      };
    });
  }

  /**
   * Voluntarily releases an active claim lock held by the calling admin.
   */
  async releaseTask(queueOrSlug: string, entityId: string, admin: AdminLockActor) {
    const adapter = this.resolveAdapter(queueOrSlug);
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx: any) => {
      const delegate = tx[adapter.modelName];
      const existing = await delegate.findUnique({ where: { id: entityId } });
      if (!existing) {
        throw new NotFoundException({
          code: adapter.notFoundCode,
          message: adapter.notFoundMessage,
        });
      }

      assertClaimLockHeld(existing, admin.id, now, adapter.lockCodes);

      const updated = await delegate.update({
        where: { id: entityId },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: adapter.auditActions.released,
          entityType: adapter.entityTypeAudit,
          entityId,
          payload: {
            queueType: adapter.queueType,
            releasedAt: now.toISOString(),
          },
        },
      });

      return {
        code: TASK_CLAIM_RELEASED,
        queueType: adapter.queueType,
        entityId,
        lockInfo: buildClaimLockInfo(updated, now, admin.id),
      };
    });
  }

  /**
   * Super Admin (`Tasks.ForceUnlock`) break-lock override with mandatory justification reason (>= 5 chars)
   * and immutable `AuditLog` trail.
   */
  async forceUnlockTask(
    queueOrSlug: string,
    entityId: string,
    admin: AdminLockActor,
    reason: string,
  ) {
    const parsed = forceUnlockTaskSchema.safeParse({ reason });
    if (!parsed.success) {
      throw new BadRequestException({
        code: TASK_FORCE_UNLOCK_REASON_REQUIRED,
        message:
          parsed.error.issues[0]?.message ??
          'سبب فك القفل القسري مطلوب ويجب ألا يقل عن 5 أحرف',
      });
    }

    const adapter = this.resolveAdapter(queueOrSlug);
    const now = this.clockService.now();
    const cleanReason = parsed.data.reason;

    return this.prisma.$transaction(async (tx: any) => {
      const delegate = tx[adapter.modelName];
      const existing = await delegate.findUnique({ where: { id: entityId } });
      if (!existing) {
        throw new NotFoundException({
          code: adapter.notFoundCode,
          message: adapter.notFoundMessage,
        });
      }

      const previousLockedByAdminId: string | null = existing.lockedByAdminId ?? null;
      let previousLockedByAdminName: string | null = null;
      if (previousLockedByAdminId) {
        const holders = await tx.adminUser.findMany({
          where: { id: { in: [previousLockedByAdminId] } },
          select: { id: true, fullName: true, username: true },
        });
        const holder = holders[0];
        if (holder) {
          previousLockedByAdminName = holder.fullName || holder.username || null;
        }
      }

      const updated = await delegate.update({
        where: { id: entityId },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: adapter.auditActions.forceUnlocked,
          entityType: adapter.entityTypeAudit,
          entityId,
          payload: {
            queueType: adapter.queueType,
            reason: cleanReason,
            previousLockedByAdminId,
            previousLockedByAdminName,
            unlockedAt: now.toISOString(),
          },
        },
      });

      return {
        code: TASK_CLAIM_FORCE_UNLOCKED,
        queueType: adapter.queueType,
        entityId,
        previousLockedByAdminId,
        previousLockedByAdminName,
        reason: cleanReason,
        lockInfo: buildClaimLockInfo(updated, now, admin.id),
      };
    });
  }

  /**
   * Unified Operational Queues Hub (`GET /api/v1/admin/queues`):
   * Aggregates pending claimable items and active lock telemetry across all 8 operational queues.
   */
  async getOperationalQueuesHub(
    admin: AdminLockActor,
    query: Partial<OperationalQueueFilterInput> = {},
  ): Promise<OperationalQueuesHubResponse> {
    const now = this.clockService.now();
    const lockState = query.lockState ?? 'ALL';
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const [
      listings,
      licenses,
      ownerRequests,
      payments,
      contractFees,
      inquiries,
      disputes,
      offers,
    ] = await Promise.all([
      this.prisma.listing.findMany({
        where: {
          status: {
            in: [ListingStatus.PENDING_REVIEW, ListingStatus.UNDER_COMPLIANCE_REVIEW],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.falLicense.findMany({
        where: {
          status: {
            in: [ProfileStatus.UNDER_REVIEW, ProfileStatus.RENEWAL_UNDER_REVIEW],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ownerListingRequest.findMany({
        where: {
          status: {
            in: ['PENDING', 'SUBMITTED', 'UNDER_ADMIN_REVIEW', 'AGREEMENT_SENT', 'AWAITING_SIGNATURE'],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: [...PAYMENT_CLAIMABLE_STATUSES] },
        },
        include: {
          deal: { select: { dealNumber: true, version: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contractFeePayment.findMany({
        where: {
          status: {
            in: [
              CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
              CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.listingInquiry.findMany({
        where: {
          status: { in: [...CLAIMABLE_INQUIRY_STATUSES] },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dispute.findMany({
        where: {
          status: DISPUTE_STATUS.OPEN,
        },
        include: {
          deal: { select: { dealNumber: true, version: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.offer.findMany({
        where: {
          status: { in: [...ACTIVE_OFFER_STATUSES] },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const allRawRecords = [
      ...listings,
      ...licenses,
      ...ownerRequests,
      ...payments,
      ...contractFees,
      ...inquiries,
      ...disputes,
      ...offers,
    ];

    const adminNameMap = await resolveClaimLockHolderNames(
      this.prisma as any,
      allRawRecords,
      now,
    );

    const buildSummaryItem = (
      queueType: OperationalQueueType,
      record: any,
      referenceNumber: string,
      titleAr: string,
      subtitleAr: string,
      statusLabelAr: string,
      workspaceHref: string,
      version?: number,
    ): OperationalQueueItemSummary => {
      const meta = OPERATIONAL_QUEUE_METADATA[queueType];
      return {
        id: record.id,
        queue: queueType,
        queueType,
        queueSlug: meta.primarySlug,
        queueLabelAr: meta.labelAr,
        referenceCode: referenceNumber,
        referenceNumber,
        titleAr,
        subtitleAr,
        status: String(record.status),
        statusLabelAr,
        version: typeof version === 'number' ? version : 1,
        createdAt: new Date(record.createdAt ?? now).toISOString(),
        updatedAt: new Date(record.updatedAt ?? record.createdAt ?? now).toISOString(),
        workspaceHref,
        lockInfo: buildClaimLockInfo(record, now, admin.id, adminNameMap),
      };
    };

    const itemsByQueue: Record<OperationalQueueType, OperationalQueueItemSummary[]> = {
      LISTING: listings.map((r: any) =>
        buildSummaryItem(
          'LISTING',
          r,
          `LST-${String(r.id).slice(0, 8).toUpperCase()}`,
          r.title || 'إعلان عقاري قيد المراجعة',
          PROPERTY_TYPE_LABELS_AR[r.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR] || 'عقار',
          LISTING_STATUS_LABELS_AR[r.status as keyof typeof LISTING_STATUS_LABELS_AR] || String(r.status),
          `/admin/listings/moderation`,
          r.version,
        ),
      ),
      FAL_PROFILE: licenses.map((r: any) =>
        buildSummaryItem(
          'FAL_PROFILE',
          r,
          `FAL-${r.licenseNumber || String(r.id).slice(0, 8)}`,
          r.commercialName || `رخصة فال رقم ${r.licenseNumber}`,
          `رقم الرخصة: ${r.licenseNumber}`,
          r.status === ProfileStatus.RENEWAL_UNDER_REVIEW
            ? 'طلب تجديد قيد المراجعة'
            : 'طلب توثيق قيد المراجعة',
          `/admin/licenses`,
          r.version,
        ),
      ),
      OWNER_REQUEST: ownerRequests.map((r: any) =>
        buildSummaryItem(
          'OWNER_REQUEST',
          r,
          `OWN-${String(r.id).slice(0, 8).toUpperCase()}`,
          `طلب إدراج مالك — صك ${r.titleDeedNumber}`,
          PROPERTY_TYPE_LABELS_AR[r.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR] || 'عقار مالك مباشر',
          String(r.status),
          `/admin/owner-requests`,
        ),
      ),
      PAYMENT: payments.map((r: any) =>
        buildSummaryItem(
          'PAYMENT',
          r,
          r.deal?.dealNumber || `PAY-${String(r.id).slice(0, 8).toUpperCase()}`,
          DEAL_PAYMENT_TYPE_LABELS_AR[r.paymentType as keyof typeof DEAL_PAYMENT_TYPE_LABELS_AR] ||
            'إيصال سداد صفقة',
          `المبلغ: ${r.amount} ر.س — مرجع: ${r.bankReferenceCode || '—'}`,
          DEAL_PAYMENT_STATUS_LABELS_AR[r.status as keyof typeof DEAL_PAYMENT_STATUS_LABELS_AR] ||
            String(r.status),
          `/admin/payments`,
          r.deal?.version,
        ),
      ),
      CONTRACT_FEE: contractFees.map((r: any) =>
        buildSummaryItem(
          'CONTRACT_FEE',
          r,
          `CF-${String(r.id).slice(0, 8).toUpperCase()}`,
          'إشعار سداد رسوم عقد وساطة مالك',
          `المبلغ: ${r.amount} ر.س — مرجع: ${r.bankReferenceCode || '—'}`,
          CONTRACT_FEE_PAYMENT_STATUS_LABELS_AR[
            r.status as keyof typeof CONTRACT_FEE_PAYMENT_STATUS_LABELS_AR
          ] || String(r.status),
          `/admin/contract-fees`,
        ),
      ),
      CONVERSATION: inquiries.map((r: any) =>
        buildSummaryItem(
          'CONVERSATION',
          r,
          `INQ-${String(r.id).slice(0, 8).toUpperCase()}`,
          r.subject || 'محادثة استفسار عقاري',
          `إعلان: ${String(r.listingId).slice(0, 8)}`,
          INQUIRY_STATUS_LABELS_AR[r.status as keyof typeof INQUIRY_STATUS_LABELS_AR] ||
            String(r.status),
          `/admin/conversations`,
          r.version,
        ),
      ),
      DISPUTE: disputes.map((r: any) =>
        buildSummaryItem(
          'DISPUTE',
          r,
          r.deal?.dealNumber || `DSP-${String(r.id).slice(0, 8).toUpperCase()}`,
          'نزاع صفقة عقارية مفتوح',
          r.reason || 'بانتظار الفصل الإداري',
          'نزاع مفتوح',
          `/admin/disputes`,
          r.deal?.version,
        ),
      ),
      OFFER: offers.map((r: any) =>
        buildSummaryItem(
          'OFFER',
          r,
          `OFR-${String(r.id).slice(0, 8).toUpperCase()}`,
          `عرض شراء بقيمة ${r.offerPrice} ر.س`,
          `إعلان: ${String(r.listingId).slice(0, 8)}`,
          OFFER_STATUS_LABELS_AR[r.status as keyof typeof OFFER_STATUS_LABELS_AR] ||
            String(r.status),
          `/admin/negotiations`,
          r.version,
        ),
      ),
    };

    const queues: OperationalQueueCounts[] = OPERATIONAL_QUEUE_TYPES.map((queueType) => {
      const meta = OPERATIONAL_QUEUE_METADATA[queueType];
      const queueItems = itemsByQueue[queueType] ?? [];
      const totalPending = queueItems.length;
      const activelyLocked = queueItems.filter((item) => item.lockInfo.isLocked).length;
      const lockedByCurrentAdmin = queueItems.filter(
        (item) => item.lockInfo.isLockedByCurrentAdmin,
      ).length;
      const unlockedAvailable = totalPending - activelyLocked;
      const lockedByOther = Math.max(0, activelyLocked - lockedByCurrentAdmin);

      return {
        queue: queueType,
        queueType,
        queueSlug: meta.primarySlug,
        labelAr: meta.labelAr,
        descriptionAr: meta.descriptionAr,
        adminWorkspaceHref: meta.adminWorkspaceHref,
        totalOpen: totalPending,
        unlocked: unlockedAvailable,
        lockedByMe: lockedByCurrentAdmin,
        lockedByOther,
        totalPending,
        activelyLocked,
        lockedByCurrentAdmin,
        unlockedAvailable,
      };
    });

    const summary = queues.reduce(
      (acc, q) => ({
        totalPending: acc.totalPending + (q.totalPending ?? 0),
        activelyLocked: acc.activelyLocked + (q.activelyLocked ?? 0),
        lockedByCurrentAdmin: acc.lockedByCurrentAdmin + (q.lockedByCurrentAdmin ?? 0),
        unlockedAvailable: acc.unlockedAvailable + (q.unlockedAvailable ?? 0),
      }),
      {
        totalPending: 0,
        activelyLocked: 0,
        lockedByCurrentAdmin: 0,
        unlockedAvailable: 0,
      },
    );

    const effectiveQueueType = query.queueType ?? (query as any).queue;
    let filteredItems = OPERATIONAL_QUEUE_TYPES.flatMap((qt) => itemsByQueue[qt]);
    if (effectiveQueueType) {
      filteredItems = filteredItems.filter((item) => item.queueType === effectiveQueueType);
    }

    if (lockState === 'LOCKED') {
      filteredItems = filteredItems.filter((item) => item.lockInfo.isLocked);
    } else if (lockState === 'UNLOCKED') {
      filteredItems = filteredItems.filter((item) => !item.lockInfo.isLocked);
    } else if (lockState === 'MY_CLAIMS' || lockState === 'LOCKED_BY_ME') {
      filteredItems = filteredItems.filter((item) => item.lockInfo.isLockedByCurrentAdmin);
    } else if (lockState === 'LOCKED_BY_OTHER') {
      filteredItems = filteredItems.filter(
        (item) => item.lockInfo.isLocked && !item.lockInfo.isLockedByCurrentAdmin,
      );
    }

    filteredItems.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + limit);

    return {
      serverNow: now.toISOString(),
      serverTimestamp: now.toISOString(),
      leaseDurationSeconds: TASK_CLAIM_LEASE_DURATION_SECONDS,
      heartbeatIntervalSeconds: TASK_CLAIM_HEARTBEAT_INTERVAL_SECONDS,
      summary,
      counts: queues,
      queues,
      items: paginatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
