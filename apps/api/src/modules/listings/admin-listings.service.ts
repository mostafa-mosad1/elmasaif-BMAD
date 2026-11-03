import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { EmailTransportService } from '../auth/email/email-transport.service';
import { ListingsService } from './listings.service';
import {
  ApproveListingInput,
  CreatePriceSuggestionInput,
  ForceUnlockListingInput,
  LISTING_FORCE_UNLOCK_REASON_REQUIRED,
  LISTING_INVALID_STATE_TRANSITION,
  LISTING_LOCK_CONFLICT,
  LISTING_LOCK_DURATION_MS,
  LISTING_LOCK_EXPIRED,
  LISTING_LOCK_REQUIRED,
  LISTING_NOT_FOUND,
  LISTING_PRICE_OUT_OF_RANGE,
  LISTING_REJECTION_REASON_REQUIRED,
  LISTING_VERSION_CONFLICT,
  ListingLockInfo,
  ListingModerationQueueQuery,
  ListingStatus,
  MAX_LISTING_PRICE_SAR,
  MIN_LISTING_PRICE_SAR,
  ModerationQueueItem,
  ModerationQueueResponse,
  PRICE_SUGGESTION_REASON_REQUIRED,
  PRICE_SUGGESTION_SAME_AS_CURRENT,
  PriceSuggestionItem,
  PriceSuggestionStatus,
  RejectListingInput,
  UserRole,
} from '@elmasaif/shared';

export interface AuthenticatedAdminActor {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  permissions: string[];
}

@Injectable()
export class AdminListingsService {
  private readonly logger = new Logger(AdminListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly listingsService: ListingsService,
    @Optional() private readonly emailTransportService?: EmailTransportService,
  ) {}

  private mapPriceSuggestionItem(s: any): PriceSuggestionItem {
    return {
      id: s.id,
      listingId: s.listingId,
      currentAskPrice: Number(s.currentAskPrice),
      suggestedPrice: Number(s.suggestedPrice),
      reason: s.reason,
      status: s.status as PriceSuggestionStatus,
      suggestedByAdminId: s.suggestedByAdminId,
      suggestedByAdminName: s.suggestedByAdminName,
      sellerResponseNote: s.sellerResponseNote ?? null,
      respondedAt: s.respondedAt
        ? s.respondedAt instanceof Date
          ? s.respondedAt.toISOString()
          : String(s.respondedAt)
        : null,
      createdAt:
        s.createdAt instanceof Date
          ? s.createdAt.toISOString()
          : String(s.createdAt),
    };
  }

  /**
   * Computes deterministic lock state using ClockService.now().
   * Treats expired locks (lockExpiresAt <= now) as unlocked (lazy expiry per AD-10).
   */
  private buildLockInfo(
    listing: {
      lockedByAdminId?: string | null;
      lockedAt?: Date | null;
      lockExpiresAt?: Date | null;
    },
    now: Date,
    currentAdminId: string,
    adminNameMap?: Map<string, string>,
  ): ListingLockInfo {
    const expiresAt = listing.lockExpiresAt ? new Date(listing.lockExpiresAt) : null;
    const lockedAt = listing.lockedAt ? new Date(listing.lockedAt) : null;
    const isActivelyLocked = Boolean(
      listing.lockedByAdminId && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!isActivelyLocked || !listing.lockedByAdminId || !expiresAt) {
      return {
        isLocked: false,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: null,
        lockedByAdminName: null,
        lockedAt: null,
        lockExpiresAt: null,
        remainingSeconds: 0,
      };
    }

    const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const lockedByAdminName =
      adminNameMap?.get(listing.lockedByAdminId) ?? null;

    return {
      isLocked: true,
      isLockedByCurrentAdmin: listing.lockedByAdminId === currentAdminId,
      lockedByAdminId: listing.lockedByAdminId,
      lockedByAdminName,
      lockedAt: lockedAt ? lockedAt.toISOString() : null,
      lockExpiresAt: expiresAt.toISOString(),
      remainingSeconds,
    };
  }

  /**
   * Lists listings in the moderation queue ordered by oldest submission first (createdAt ASC).
   */
  async getModerationQueue(
    query: ListingModerationQueueQuery,
    currentAdminId: string,
  ): Promise<ModerationQueueResponse> {
    const status = query.status ?? ListingStatus.PENDING_REVIEW;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {
      status,
    };

    if (query.cityId) {
      where.cityId = query.cityId;
    }

    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          city: true,
          district: true,
          documents: {
            select: {
              id: true,
              documentType: true,
              visibility: true,
            },
          },
          priceSuggestions: {
            orderBy: { createdAt: 'desc' },
          },
          sellerProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  username: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    const now = this.clockService.now();

    // Collect active lock holder admin IDs to resolve names in a single query
    const activeAdminIds = Array.from(
      new Set(
        listings
          .filter(
            (l: any) =>
              l.lockedByAdminId &&
              l.lockExpiresAt &&
              new Date(l.lockExpiresAt).getTime() > now.getTime(),
          )
          .map((l: any) => l.lockedByAdminId as string),
      ),
    );

    const adminNameMap = new Map<string, string>();
    if (activeAdminIds.length > 0) {
      const admins = await this.prisma.adminUser.findMany({
        where: { id: { in: activeAdminIds } },
        select: { id: true, fullName: true, username: true },
      });
      for (const a of admins) {
        adminNameMap.set(a.id, a.fullName || a.username);
      }
    }

    const items: ModerationQueueItem[] = listings.map((listing: any) => {
      const docs = Array.isArray(listing.documents) ? listing.documents : [];
      const photoCount = docs.filter((d: any) => d.documentType === 'PHOTO').length;
      const documentCount = docs.filter((d: any) => d.documentType !== 'PHOTO').length;
      const rawSuggestions = Array.isArray(listing.priceSuggestions)
        ? listing.priceSuggestions
        : [];
      const priceSuggestions = rawSuggestions.map((s: any) =>
        this.mapPriceSuggestionItem(s),
      );
      const activePriceSuggestion =
        priceSuggestions.find(
          (s: PriceSuggestionItem) => s.status === PriceSuggestionStatus.PENDING,
        ) ?? null;

      return {
        id: listing.id,
        title: listing.title,
        propertyType: listing.propertyType,
        cityId: listing.cityId,
        districtId: listing.districtId,
        cityName: listing.city?.nameAr || '',
        districtName: listing.district?.nameAr || '',
        askPrice: Number(listing.askPrice),
        areaSquareMeters: listing.areaSquareMeters,
        status: listing.status,
        version: listing.version,
        sellerRole: (listing.sellerProfile?.role as UserRole) || UserRole.OWNER,
        sellerName:
          listing.sellerProfile?.user?.fullName ||
          listing.sellerProfile?.user?.username ||
          'غير معروف',
        sellerProfileId: listing.sellerProfileId,
        photoCount,
        documentCount,
        rejectionReason: listing.rejectionReason ?? null,
        createdAt:
          listing.createdAt instanceof Date
            ? listing.createdAt.toISOString()
            : String(listing.createdAt),
        updatedAt:
          listing.updatedAt instanceof Date
            ? listing.updatedAt.toISOString()
            : String(listing.updatedAt),
        lockInfo: this.buildLockInfo(listing, now, currentAdminId, adminNameMap),
        activePriceSuggestion,
        priceSuggestions,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves full listing details for admin moderation review, including signed URLs for ADMIN_ONLY documents
   * and current lock status.
   */
  async getAdminListingDetail(
    listingId: string,
    currentAdminId: string,
  ): Promise<any> {
    const rawListing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!rawListing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();
    const adminNameMap = new Map<string, string>();

    if (
      rawListing.lockedByAdminId &&
      rawListing.lockExpiresAt &&
      new Date(rawListing.lockExpiresAt).getTime() > now.getTime()
    ) {
      const holder = await this.prisma.adminUser.findUnique({
        where: { id: rawListing.lockedByAdminId },
        select: { id: true, fullName: true, username: true },
      });
      if (holder) {
        adminNameMap.set(holder.id, holder.fullName || holder.username);
      }
    }

    const detail = await this.listingsService.getListingById(
      listingId,
      undefined,
      true,
    );

    const lockInfo = this.buildLockInfo(
      rawListing,
      now,
      currentAdminId,
      adminNameMap,
    );

    return {
      ...detail,
      rejectionReason: (rawListing as any).rejectionReason ?? null,
      reviewedByAdminId: (rawListing as any).reviewedByAdminId ?? null,
      reviewedAt: (rawListing as any).reviewedAt
        ? new Date((rawListing as any).reviewedAt).toISOString()
        : null,
      lockInfo,
    };
  }

  /**
   * Acquires or extends an exclusive 15-minute task claim lock on a PENDING_REVIEW listing.
   */
  async claimListing(
    listingId: string,
    admin: AuthenticatedAdminActor,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      throw new BadRequestException({
        code: LISTING_INVALID_STATE_TRANSITION,
        message: 'لا يمكن استلام مهمة المراجعة إلا للإعلانات التي في حالة بانتظار المراجعة (PENDING_REVIEW)',
      });
    }

    const now = this.clockService.now();
    const isActivelyLockedByOther = Boolean(
      listing.lockedByAdminId &&
        listing.lockedByAdminId !== admin.id &&
        listing.lockExpiresAt &&
        new Date(listing.lockExpiresAt).getTime() > now.getTime(),
    );

    if (isActivelyLockedByOther && listing.lockedByAdminId) {
      const holder = await this.prisma.adminUser.findUnique({
        where: { id: listing.lockedByAdminId },
        select: { id: true, fullName: true, username: true },
      });
      const adminNameMap = new Map<string, string>();
      if (holder) {
        adminNameMap.set(holder.id, holder.fullName || holder.username);
      }
      const conflictLockInfo = this.buildLockInfo(
        listing,
        now,
        admin.id,
        adminNameMap,
      );

      throw new ConflictException({
        code: LISTING_LOCK_CONFLICT,
        message: `هذا الإعلان قيد المراجعة حالياً بواسطة ${conflictLockInfo.lockedByAdminName || 'مشرف آخر'}`,
        lockInfo: conflictLockInfo,
      });
    }

    const lockExpiresAt = new Date(now.getTime() + LISTING_LOCK_DURATION_MS);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          lockedByAdminId: admin.id,
          lockedAt: now,
          lockExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'LISTING_MODERATION_CLAIMED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            lockedByAdminId: admin.id,
            lockedByAdminName: admin.fullName,
            lockedAt: now.toISOString(),
            lockExpiresAt: lockExpiresAt.toISOString(),
          },
        },
      });

      const adminNameMap = new Map<string, string>([[admin.id, admin.fullName]]);
      return {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        lockInfo: this.buildLockInfo(updated, now, admin.id, adminNameMap),
      };
    });
  }

  /**
   * Renews an active claim lock by extending lockExpiresAt to ClockService.now() + 15 minutes.
   */
  async heartbeatListingLock(
    listingId: string,
    admin: AuthenticatedAdminActor,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();

    if (!listing.lockedByAdminId) {
      throw new ConflictException({
        code: LISTING_LOCK_REQUIRED,
        message: 'لا يوجد قفل مراجعة نشط لهذا الإعلان لتمديده',
      });
    }

    if (listing.lockedByAdminId !== admin.id) {
      throw new ConflictException({
        code: LISTING_LOCK_CONFLICT,
        message: 'لا يمكنك تمديد قفل المراجعة لأنه مملوك لمشرف آخر',
      });
    }

    if (
      !listing.lockExpiresAt ||
      new Date(listing.lockExpiresAt).getTime() <= now.getTime()
    ) {
      throw new ConflictException({
        code: LISTING_LOCK_EXPIRED,
        message: 'انتهت مهلة قفل المراجعة (15 دقيقة). يرجى إعادة استلام المهمة',
      });
    }

    const newLockExpiresAt = new Date(now.getTime() + LISTING_LOCK_DURATION_MS);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        lockExpiresAt: newLockExpiresAt,
      },
    });

    const adminNameMap = new Map<string, string>([[admin.id, admin.fullName]]);
    return {
      id: updated.id,
      status: updated.status,
      version: updated.version,
      lockInfo: this.buildLockInfo(updated, now, admin.id, adminNameMap),
    };
  }

  /**
   * Explicitly releases the active claim lock held by the calling administrator.
   */
  async releaseListingLock(
    listingId: string,
    admin: AuthenticatedAdminActor,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();
    const isActivelyLockedByOther = Boolean(
      listing.lockedByAdminId &&
        listing.lockedByAdminId !== admin.id &&
        listing.lockExpiresAt &&
        new Date(listing.lockExpiresAt).getTime() > now.getTime(),
    );

    if (isActivelyLockedByOther) {
      throw new ConflictException({
        code: LISTING_LOCK_CONFLICT,
        message: 'لا يمكنك تحرير قفل مراجعة مملوك لمشرف آخر',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
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
          action: 'LISTING_MODERATION_RELEASED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            releasedByAdminId: admin.id,
            releasedAt: now.toISOString(),
          },
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        lockInfo: this.buildLockInfo(updated, now, admin.id),
      };
    });
  }

  /**
   * Super Admin Force-Unlock override with mandatory reason and immutable AuditLog entry.
   */
  async forceUnlockListing(
    listingId: string,
    admin: AuthenticatedAdminActor,
    dto: ForceUnlockListingInput,
  ): Promise<any> {
    const reason = dto?.reason?.trim();
    if (!reason || reason.length < 5) {
      throw new BadRequestException({
        code: LISTING_FORCE_UNLOCK_REASON_REQUIRED,
        message: 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف',
      });
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();
    const previousLockHolderId = listing.lockedByAdminId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({
        where: { id: listingId },
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
          action: 'LISTING_MODERATION_FORCE_UNLOCKED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            previousLockHolderId,
            superAdminId: admin.id,
            superAdminName: admin.fullName,
            reason,
            forceUnlockedAt: now.toISOString(),
          },
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        lockInfo: this.buildLockInfo(updated, now, admin.id),
      };
    });
  }

  /**
   * Validates that a listing is in PENDING_REVIEW, actively locked by the caller, and matches the expected optimistic concurrency version.
   */
  private assertActiveLockAndVersion(
    listing: any,
    admin: AuthenticatedAdminActor,
    expectedVersion: number,
    now: Date,
  ): void {
    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      throw new ConflictException({
        code: LISTING_INVALID_STATE_TRANSITION,
        message: `لا يمكن اتخاذ قرار المراجعة لأن حالة الإعلان الحالية هي ${listing.status} وليست PENDING_REVIEW`,
      });
    }

    const hasActiveLock = Boolean(
      listing.lockedByAdminId === admin.id &&
        listing.lockExpiresAt &&
        new Date(listing.lockExpiresAt).getTime() > now.getTime(),
    );

    if (!hasActiveLock) {
      if (
        listing.lockedByAdminId === admin.id &&
        listing.lockExpiresAt &&
        new Date(listing.lockExpiresAt).getTime() <= now.getTime()
      ) {
        throw new ConflictException({
          code: LISTING_LOCK_EXPIRED,
          message: 'انتهت مهلة قفل المراجعة (15 دقيقة). يرجى إعادة استلام المهمة قبل الاعتماد أو الرفض',
        });
      }

      throw new ConflictException({
        code: LISTING_LOCK_REQUIRED,
        message: 'يجب استلام مهمة المراجعة (Claim Lock) أولاً قبل اتخاذ قرار الاعتماد أو الرفض',
      });
    }

    if (listing.version !== expectedVersion) {
      throw new ConflictException({
        code: LISTING_VERSION_CONFLICT,
        message: 'تعارض في نسخة البيانات (Optimistic Concurrency): تم تحديث الإعلان بواسطة عملية أخرى',
      });
    }
  }

  /**
   * Approves a PENDING_REVIEW listing, transitioning it to ACTIVE and releasing the task lock.
   */
  async approveListing(
    listingId: string,
    admin: AuthenticatedAdminActor,
    dto: ApproveListingInput,
  ): Promise<any> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();
    this.assertActiveLockAndVersion(listing, admin, dto.version, now);

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.listing.updateMany({
        where: {
          id: listingId,
          version: dto.version,
          status: ListingStatus.PENDING_REVIEW,
        },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          rejectionReason: null,
          reviewedByAdminId: admin.id,
          reviewedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          code: LISTING_VERSION_CONFLICT,
          message: 'تعذر اعتماد الإعلان بسبب تغير نسخة السجل أو حالته بالتزامن',
        });
      }

      const updated = await tx.listing.findUnique({
        where: { id: listingId },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'LISTING_APPROVED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            previousStatus: ListingStatus.PENDING_REVIEW,
            newStatus: ListingStatus.ACTIVE,
            previousVersion: dto.version,
            newVersion: dto.version + 1,
            reviewedByAdminId: admin.id,
            reviewedByAdminName: admin.fullName,
            notes: dto.notes ?? null,
            approvedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(
        `Listing '${listingId}' approved by admin '${admin.id}' (version ${dto.version} -> ${dto.version + 1})`,
      );

      return {
        ...updated,
        askPrice: updated?.askPrice ? Number(updated.askPrice) : Number(listing.askPrice),
        lockInfo: this.buildLockInfo(updated || {}, now, admin.id),
      };
    });
  }

  /**
   * Rejects a PENDING_REVIEW listing with mandatory rejectionReason, transitioning it to REJECTED and releasing the task lock.
   */
  async rejectListing(
    listingId: string,
    admin: AuthenticatedAdminActor,
    dto: RejectListingInput,
  ): Promise<any> {
    const rejectionReason = dto?.rejectionReason?.trim();
    if (!rejectionReason || rejectionReason.length < 10) {
      throw new BadRequestException({
        code: LISTING_REJECTION_REASON_REQUIRED,
        message: 'سبب الرفض يجب ألا يقل عن 10 أحرف',
      });
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    const now = this.clockService.now();
    this.assertActiveLockAndVersion(listing, admin, dto.version, now);

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.listing.updateMany({
        where: {
          id: listingId,
          version: dto.version,
          status: ListingStatus.PENDING_REVIEW,
        },
        data: {
          status: ListingStatus.REJECTED,
          version: { increment: 1 },
          rejectionReason,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          reviewedByAdminId: admin.id,
          reviewedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          code: LISTING_VERSION_CONFLICT,
          message: 'تعذر رفض الإعلان بسبب تغير نسخة السجل أو حالته بالتزامن',
        });
      }

      const updated = await tx.listing.findUnique({
        where: { id: listingId },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'LISTING_REJECTED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            previousStatus: ListingStatus.PENDING_REVIEW,
            newStatus: ListingStatus.REJECTED,
            previousVersion: dto.version,
            newVersion: dto.version + 1,
            reviewedByAdminId: admin.id,
            reviewedByAdminName: admin.fullName,
            rejectionReason,
            rejectedAt: now.toISOString(),
          },
        },
      });

      this.logger.log(
        `Listing '${listingId}' rejected by admin '${admin.id}' (version ${dto.version} -> ${dto.version + 1})`,
      );

      return {
        ...updated,
        askPrice: updated?.askPrice ? Number(updated.askPrice) : Number(listing.askPrice),
        lockInfo: this.buildLockInfo(updated || {}, now, admin.id),
      };
    });
  }

  /**
   * Submits an administrative price adjustment suggestion with market rationale without altering Listing.askPrice (FR-57, BR-16).
   */
  async suggestListingPrice(
    listingId: string,
    admin: AuthenticatedAdminActor,
    dto: CreatePriceSuggestionInput,
  ): Promise<PriceSuggestionItem> {
    const reason = dto?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException({
        code: PRICE_SUGGESTION_REASON_REQUIRED,
        message: 'سبب ومبررات اقتراح السعر يجب ألا يقل عن 10 أحرف',
      });
    }

    const suggestedPrice = Number(dto?.suggestedPrice);
    if (
      !Number.isFinite(suggestedPrice) ||
      suggestedPrice < MIN_LISTING_PRICE_SAR ||
      suggestedPrice > MAX_LISTING_PRICE_SAR
    ) {
      throw new BadRequestException({
        code: LISTING_PRICE_OUT_OF_RANGE,
        message: `السعر المقترح يجب أن يكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
      });
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        sellerProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: LISTING_NOT_FOUND,
        message: `العقار المطلوب برقم '${listingId}' غير موجود`,
      });
    }

    if (
      listing.status !== ListingStatus.PENDING_REVIEW &&
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: LISTING_INVALID_STATE_TRANSITION,
        message: `لا يمكن تقديم اقتراح تعديل سعر لإعلان في حالة ${listing.status}؛ يُسمح فقط للإعلانات بانتظار المراجعة أو النشطة`,
      });
    }

    const now = this.clockService.now();
    const isActivelyLockedByOther = Boolean(
      listing.lockedByAdminId &&
        listing.lockedByAdminId !== admin.id &&
        listing.lockExpiresAt &&
        new Date(listing.lockExpiresAt).getTime() > now.getTime(),
    );

    if (isActivelyLockedByOther && listing.lockedByAdminId) {
      const holder = await this.prisma.adminUser.findUnique({
        where: { id: listing.lockedByAdminId },
        select: { id: true, fullName: true, username: true },
      });
      const adminNameMap = new Map<string, string>();
      if (holder) {
        adminNameMap.set(holder.id, holder.fullName || holder.username);
      }
      const conflictLockInfo = this.buildLockInfo(
        listing,
        now,
        admin.id,
        adminNameMap,
      );

      throw new ConflictException({
        code: LISTING_LOCK_CONFLICT,
        message: `هذا الإعلان قيد المراجعة حالياً بواسطة ${conflictLockInfo.lockedByAdminName || 'مشرف آخر'}`,
        lockInfo: conflictLockInfo,
      });
    }

    const currentAskPrice = Number(listing.askPrice);
    if (Math.abs(suggestedPrice - currentAskPrice) < 0.005) {
      throw new BadRequestException({
        code: PRICE_SUGGESTION_SAME_AS_CURRENT,
        message: 'السعر المقترح مطابق للسعر الحالي المطلوب؛ يرجى إدخال سعر استرشادي مختلف',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // 1. Supersede any existing PENDING suggestion on this listing
      await tx.priceSuggestion.updateMany({
        where: {
          listingId,
          status: PriceSuggestionStatus.PENDING,
        },
        data: {
          status: PriceSuggestionStatus.SUPERSEDED,
          respondedAt: now,
        },
      });

      // 2. Create new PENDING PriceSuggestion record (BR-16: NEVER update listing.askPrice here)
      const suggestion = await tx.priceSuggestion.create({
        data: {
          listingId,
          currentAskPrice: listing.askPrice,
          suggestedPrice: new Prisma.Decimal(suggestedPrice),
          reason,
          status: PriceSuggestionStatus.PENDING,
          suggestedByAdminId: admin.id,
          suggestedByAdminName: admin.fullName,
          createdAt: now,
        },
      });

      // 3. Record immutable AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'LISTING_PRICE_SUGGESTED',
          entityType: 'Listing',
          entityId: listingId,
          payload: {
            suggestionId: suggestion.id,
            currentAskPrice,
            suggestedPrice,
            reason,
            suggestedByAdminId: admin.id,
            suggestedByAdminName: admin.fullName,
            suggestedAt: now.toISOString(),
          },
        },
      });

      return suggestion;
    });

    // 4. Dispatch email notification if seller has an email address (FR-44, FR-57)
    const sellerEmail = (listing as any).sellerProfile?.user?.email;
    const sellerName =
      (listing as any).sellerProfile?.user?.fullName ||
      (listing as any).sellerProfile?.user?.username ||
      'عزيزنا العميل';

    if (sellerEmail && this.emailTransportService) {
      try {
        await this.emailTransportService.sendEmail({
          to: sellerEmail,
          subject: `المصايف العقارية — مقترح تعديل السعر الاسترشادي لإعلانك: ${listing.title}`,
          text: [
            `مرحباً ${sellerName}،`,
            '',
            `قام فريق التقييم والمراجعة العقارية في منصة المصايف بدراسة إعلانك "${listing.title}" وتقديم مقترح استرشادي لتعديل السعر المطلوب:`,
            `- السعر المطلوب الحالي: ${currentAskPrice.toLocaleString('en-US')} ريال سعودي`,
            `- السعر الاسترشادي المقترح: ${suggestedPrice.toLocaleString('en-US')} ريال سعودي`,
            `- المبررات السوقية: ${reason}`,
            '',
            'يمكنك الدخول إلى لوحة التحكم الخاصة بك لقبول السعر المقترح أو رفضه مع الاحتفاظ بسعرك الحالي دون أي التزام.',
          ].join('\n'),
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch price suggestion email for listing '${listingId}': ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Price suggestion '${created.id}' (${currentAskPrice} -> ${suggestedPrice} SAR) submitted on listing '${listingId}' by admin '${admin.id}'`,
    );

    return this.mapPriceSuggestionItem(created);
  }
}

