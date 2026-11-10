import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import {
  ApproveFalLicenseInput,
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED,
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED,
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED,
  AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED,
  COMPLIANCE_CATEGORY_FAL_EXPIRED,
  ClaimLockInfo,
  FAL_LOCK_DURATION_MS,
  FalLicenseDetailResponse,
  FalLicenseQueueItem,
  ForceUnlockFalLicenseInput,
  LICENSE_INVALID_STATE,
  LICENSE_LOCK_CONFLICT,
  LICENSE_LOCK_EXPIRED,
  LICENSE_LOCK_REQUIRED,
  LICENSE_NOT_FOUND,
  LICENSE_REJECTION_REASON_REQUIRED,
  LICENSE_VERSION_CONFLICT,
  LicensingQueueQuery,
  ListingStatus,
  ProfileStatus,
  RejectFalLicenseInput,
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
export class AdminLicensesService {
  private readonly logger = new Logger(AdminLicensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Resolves a download URL safely for a stored document key or file ID (expires in 300s).
   */
  async resolveDownloadUrl(keyOrId: string, expiresInSeconds = 300): Promise<string> {
    try {
      return await this.storageService.getVerifiedDownloadUrl(keyOrId, expiresInSeconds);
    } catch {
      return await this.storageService.getPresignedDownloadUrl(keyOrId, expiresInSeconds);
    }
  }

  /**
   * Builds the normalized 15-minute claim lease status for Fal license records.
   */
  private buildLockInfo(
    license: {
      lockedByAdminId?: string | null;
      lockedAt?: Date | null;
      lockExpiresAt?: Date | null;
    },
    now: Date,
    currentAdminId: string,
    adminNameMap?: Map<string, string>,
  ): ClaimLockInfo {
    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    const lockedAt = license.lockedAt ? new Date(license.lockedAt) : null;
    const isActivelyLocked = Boolean(
      license.lockedByAdminId && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!isActivelyLocked || !license.lockedByAdminId || !expiresAt) {
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
    const lockedByAdminName = adminNameMap?.get(license.lockedByAdminId) ?? null;

    return {
      isLocked: true,
      isLockedByCurrentAdmin: license.lockedByAdminId === currentAdminId,
      lockedByAdminId: license.lockedByAdminId,
      lockedByAdminName,
      lockedAt: lockedAt ? lockedAt.toISOString() : null,
      lockExpiresAt: expiresAt.toISOString(),
      remainingSeconds,
    };
  }

  /**
   * Retrieves paginated Fal license applications for administrative queue review.
   */
  async getLicensingQueue(
    query: LicensingQueueQuery,
    currentAdminId: string,
  ): Promise<{
    items: FalLicenseQueueItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const now = this.clockService.now();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FalLicenseWhereInput = {};

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = ProfileStatus.UNDER_REVIEW;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { licenseNumber: { contains: s, mode: 'insensitive' } },
        { commercialName: { contains: s, mode: 'insensitive' } },
        { crNumber: { contains: s, mode: 'insensitive' } },
        {
          profile: {
            user: {
              OR: [
                { fullName: { contains: s, mode: 'insensitive' } },
                { mobileNumber: { contains: s } },
              ],
            },
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.falLicense.count({ where }),
      this.prisma.falLicense.findMany({
        where,
        include: {
          profile: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // oldest first SLA
        },
        skip,
        take: limit,
      }),
    ]);

    // Preload admin names for active locks
    const adminIds = Array.from(
      new Set(
        records
          .map((r) => r.lockedByAdminId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const adminNameMap = new Map<string, string>();
    if (adminIds.length > 0) {
      const admins = await this.prisma.adminUser.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true },
      });
      for (const a of admins) {
        adminNameMap.set(a.id, a.fullName);
      }
    }

    // Preload suspended listings count for applicant profiles
    const profileIds = records.map((r) => r.profileId);
    const suspendedListingsMap = new Map<string, number>();
    if (profileIds.length > 0) {
      try {
        const suspendedListings = await this.prisma.listing.findMany({
          where: {
            sellerProfileId: { in: profileIds },
            status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
            complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
          },
          select: { sellerProfileId: true },
        });
        for (const l of suspendedListings) {
          suspendedListingsMap.set(l.sellerProfileId, (suspendedListingsMap.get(l.sellerProfileId) || 0) + 1);
        }
      } catch {
        // Fallback gracefully if listing query fails
      }
    }

    const items: FalLicenseQueueItem[] = records.map((record) => {
      const lockInfo = this.buildLockInfo(record, now, currentAdminId, adminNameMap);
      const isRenewal = record.status === ProfileStatus.RENEWAL_UNDER_REVIEW;
      const suspendedListingsCount = suspendedListingsMap.get(record.profileId) ?? 0;
      return {
        id: record.id,
        licenseNumber: record.licenseNumber,
        commercialName: record.commercialName,
        crNumber: record.crNumber,
        expiryDate: record.expiryDate.toISOString(),
        status: record.status as unknown as ProfileStatus,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        applicantName: record.profile.user.fullName || 'غير محدد',
        applicantPhone: record.profile.user.mobileNumber,
        applicantNationalId: record.profile.user.nationalId || null,
        lockInfo,
        isRenewal,
        suspendedListingsCount,
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
   * Retrieves full license details with <= 300s presigned download URLs and lock info.
   */
  async getLicenseDetail(
    licenseId: string,
    currentAdminId: string,
  ): Promise<FalLicenseDetailResponse> {
    const now = this.clockService.now();

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
      include: {
        profile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    const adminNameMap = new Map<string, string>();
    if (license.lockedByAdminId) {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: license.lockedByAdminId },
        select: { id: true, fullName: true },
      });
      if (admin) {
        adminNameMap.set(admin.id, admin.fullName);
      }
    }

    const lockInfo = this.buildLockInfo(license, now, currentAdminId, adminNameMap);

    let certificateDownloadUrl: string | undefined;
    if (license.certificateUrl) {
      try {
        certificateDownloadUrl = await this.resolveDownloadUrl(license.certificateUrl, 300);
      } catch {
        certificateDownloadUrl = undefined;
      }
    }

    const supportingDocumentDownloadUrls: string[] = [];
    if (Array.isArray(license.supportingDocumentUrls)) {
      for (const key of license.supportingDocumentUrls) {
        try {
          const url = await this.resolveDownloadUrl(key, 300);
          supportingDocumentDownloadUrls.push(url);
        } catch {
          // ignore individual URL errors
        }
      }
    }

    const isRenewal = license.status === ProfileStatus.RENEWAL_UNDER_REVIEW;

    // Fetch suspended listings count and details if applicable
    let eligibleSuspendedListings: any[] = [];
    try {
      eligibleSuspendedListings = await this.prisma.listing.findMany({
        where: {
          sellerProfileId: license.profileId,
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        },
        select: {
          id: true,
          title: true,
          askPrice: true,
          complianceCategory: true,
        },
      });
    } catch {
      eligibleSuspendedListings = [];
    }

    let previousExpiryDate: string | null = null;
    if (isRenewal) {
      try {
        const renewalAudit = await this.prisma.auditLog.findFirst({
          where: {
            entityType: 'FalLicense',
            entityId: license.id,
            action: AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED,
          },
          orderBy: { createdAt: 'desc' },
        });
        previousExpiryDate = (renewalAudit?.payload as any)?.previousExpiryDate ?? null;
      } catch {
        previousExpiryDate = null;
      }
    }

    return {
      id: license.id,
      profileId: license.profileId,
      licenseNumber: license.licenseNumber,
      commercialName: license.commercialName,
      crNumber: license.crNumber,
      expiryDate: license.expiryDate.toISOString(),
      status: license.status as unknown as ProfileStatus,
      rejectionReason: license.rejectionReason,
      reviewedByAdminId: license.reviewedByAdminId,
      reviewedAt: license.reviewedAt ? license.reviewedAt.toISOString() : null,
      certificateUrl: license.certificateUrl,
      certificateDownloadUrl,
      supportingDocumentUrls: license.supportingDocumentUrls,
      supportingDocumentDownloadUrls,
      version: license.version,
      createdAt: license.createdAt.toISOString(),
      updatedAt: license.updatedAt.toISOString(),
      applicant: {
        id: license.profile.user.id,
        fullName: license.profile.user.fullName || 'غير محدد',
        phoneNumber: license.profile.user.mobileNumber,
        nationalId: license.profile.user.nationalId || null,
        createdAt: license.profile.user.createdAt.toISOString(),
      },
      lockInfo,
      isRenewal,
      previousExpiryDate,
      suspendedListingsCount: eligibleSuspendedListings.length,
      suspendedListings: eligibleSuspendedListings,
    };
  }

  /**
   * Acquires or extends an exclusive 15-minute claim lease on a Fal license record (FR-51, AD-10).
   */
  async claimLicense(licenseId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    const isActivelyLockedByOther = Boolean(
      license.lockedByAdminId &&
        license.lockedByAdminId !== admin.id &&
        expiresAt &&
        expiresAt.getTime() > now.getTime(),
    );

    if (isActivelyLockedByOther) {
      let lockedByAdminName: string | null = null;
      if (license.lockedByAdminId) {
        const holder = await this.prisma.adminUser.findUnique({
          where: { id: license.lockedByAdminId },
          select: { fullName: true },
        });
        lockedByAdminName = holder?.fullName ?? null;
      }

      const lockInfo = this.buildLockInfo(
        license,
        now,
        admin.id,
        new Map(lockedByAdminName && license.lockedByAdminId ? [[license.lockedByAdminId, lockedByAdminName]] : []),
      );

      throw new ConflictException({
        code: LICENSE_LOCK_CONFLICT,
        message: `طلب الترخيص قيد المراجعة حالياً من قبل ${lockedByAdminName || 'مشرف آخر'}`,
        lockInfo,
      });
    }

    const newLockExpiresAt = new Date(now.getTime() + FAL_LOCK_DURATION_MS);

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.falLicense.update({
        where: { id: licenseId },
        data: {
          lockedByAdminId: admin.id,
          lockedAt: now,
          lockExpiresAt: newLockExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'FAL_LICENSE_CLAIMED',
          entityType: 'FalLicense',
          entityId: licenseId,
          payload: {
            adminName: admin.fullName,
            lockedAt: now.toISOString(),
            lockExpiresAt: newLockExpiresAt.toISOString(),
          },
        },
      });

      return res;
    });

    const lockInfo = this.buildLockInfo(
      updated,
      now,
      admin.id,
      new Map([[admin.id, admin.fullName]]),
    );

    return {
      statusCode: 200,
      message: 'تم حجز الطلب للمراجعة والتدقيق بنجاح',
      lockInfo,
    };
  }

  /**
   * Heartbeat to renew a 15-minute lease (dispatched every 5 minutes by the client).
   */
  async heartbeatLicenseLock(licenseId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    const isHolderAndValid = Boolean(
      license.lockedByAdminId === admin.id && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!isHolderAndValid) {
      throw new ConflictException({
        code: LICENSE_LOCK_EXPIRED,
        message: 'انتهت صلاحية قفل المراجعة أو تم الاستحواذ عليه من قبل مشرف آخر',
      });
    }

    const newLockExpiresAt = new Date(now.getTime() + FAL_LOCK_DURATION_MS);

    await this.prisma.falLicense.update({
      where: { id: licenseId },
      data: {
        lockExpiresAt: newLockExpiresAt,
      },
    });

    return {
      statusCode: 200,
      lockExpiresAt: newLockExpiresAt.toISOString(),
      remainingSeconds: Math.ceil(FAL_LOCK_DURATION_MS / 1000),
    };
  }

  /**
   * Explicitly releases a held claim lock.
   */
  async releaseLicenseLock(licenseId: string, admin: AuthenticatedAdminActor) {
    const now = this.clockService.now();

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    if (
      license.lockedByAdminId &&
      license.lockedByAdminId !== admin.id &&
      expiresAt &&
      expiresAt.getTime() > now.getTime()
    ) {
      throw new ConflictException({
        code: LICENSE_LOCK_CONFLICT,
        message: 'لا يمكنك تحرير قفل محجوز لمشرف آخر',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.falLicense.update({
        where: { id: licenseId },
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
          action: 'FAL_LICENSE_RELEASED',
          entityType: 'FalLicense',
          entityId: licenseId,
          payload: {
            releasedBy: admin.fullName,
          },
        },
      });
    });

    return {
      statusCode: 200,
      message: 'تم تحرير قفل الطلب بنجاح',
    };
  }

  /**
   * Super Admin force unlock override with reason.
   */
  async forceUnlockLicense(
    licenseId: string,
    admin: AuthenticatedAdminActor,
    dto: ForceUnlockFalLicenseInput,
  ) {
    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    const previousLockHolderId = license.lockedByAdminId;

    await this.prisma.$transaction(async (tx) => {
      await tx.falLicense.update({
        where: { id: licenseId },
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
          action: 'FAL_LICENSE_FORCE_UNLOCKED',
          entityType: 'FalLicense',
          entityId: licenseId,
          payload: {
            previousLockHolderId,
            reason: dto.reason,
            superAdminName: admin.fullName,
          },
        },
      });
    });

    return {
      statusCode: 200,
      message: 'تم فك القفل الإجباري بنجاح وتوثيق العملية في سجل التدقيق',
    };
  }

  /**
   * Approves a Fal license application in UNDER_REVIEW state under optimistic concurrency.
   */
  async approveLicense(
    licenseId: string,
    admin: AuthenticatedAdminActor,
    dto: ApproveFalLicenseInput,
  ) {
    const now = this.clockService.now();

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    // 1. Verify valid status
    if (
      license.status !== ProfileStatus.UNDER_REVIEW &&
      license.status !== ProfileStatus.RENEWAL_UNDER_REVIEW
    ) {
      throw new BadRequestException({
        code: LICENSE_INVALID_STATE,
        message: 'لا يمكن اعتماد طلب ليس بحالة قيد المراجعة',
      });
    }

    // 2. Verify claim lock
    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    const hasActiveLock = Boolean(
      license.lockedByAdminId === admin.id && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!hasActiveLock) {
      throw new ConflictException({
        code: LICENSE_LOCK_REQUIRED,
        message: 'يجب حجز قفل مراجعة الطلب قبل اتخاذ القرار',
      });
    }

    // 3. Optimistic concurrency check
    if (license.version !== dto.version) {
      throw new ConflictException({
        code: LICENSE_VERSION_CONFLICT,
        message: 'تم تحديث بيانات الطلب من قبل مستخدم أو مشرف آخر؛ يرجى إعادة تحميل الصفحة',
      });
    }

    const isRenewal = license.status === ProfileStatus.RENEWAL_UNDER_REVIEW;
    let reinstatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.falLicense.update({
        where: { id: licenseId },
        data: {
          status: ProfileStatus.ACTIVE,
          reviewedByAdminId: admin.id,
          reviewedAt: now,
          rejectionReason: null,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });

      await tx.userProfile.update({
        where: { id: license.profileId },
        data: {
          status: ProfileStatus.ACTIVE,
        },
      });

      // Selective automatic reinstatement of marketer listings held in UNDER_COMPLIANCE_REVIEW
      // strictly due to Fal expiry (FR-8, BR-14, UC-43, UC-62)
      const eligibleListings = await tx.listing.findMany({
        where: {
          sellerProfileId: license.profileId,
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        },
      });

      for (const listing of eligibleListings) {
        await tx.listing.update({
          where: { id: listing.id },
          data: {
            status: ListingStatus.ACTIVE,
            complianceReason: null,
            complianceCategory: null,
            complianceActionAt: null,
            complianceOfficerId: null,
            version: { increment: 1 },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            actorType: 'ADMIN',
            action: AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED,
            entityType: 'Listing',
            entityId: listing.id,
            payload: {
              listingId: listing.id,
              listingTitle: listing.title,
              previousStatus: 'UNDER_COMPLIANCE_REVIEW',
              newStatus: 'ACTIVE',
              reason: 'FAL_LICENSE_RENEWED',
            },
          },
        });
      }

      reinstatedCount = eligibleListings.length;

      const approvalAction = isRenewal
        ? AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED
        : 'FAL_LICENSE_APPROVED';

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: approvalAction,
          entityType: 'FalLicense',
          entityId: licenseId,
          payload: {
            adminName: admin.fullName,
            reviewedAt: now.toISOString(),
            reinstatedListingsCount: reinstatedCount,
          },
        },
      });
    });

    this.logger.log(
      `Fal license '${licenseId}' approved by admin '${admin.id}'. Marketer profile activated. Reinstated listings: ${reinstatedCount}`,
    );

    return {
      statusCode: 200,
      message: isRenewal
        ? 'تم اعتماد تجديد رخصة فال بنجاح وإعادة تنشيط الإعلانات المعلقة للامتثال'
        : 'تم اعتماد رخصة فال وتفعيل حساب المسوق بنجاح',
      data: {
        licenseId,
        status: ProfileStatus.ACTIVE,
        reinstatedListingsCount: reinstatedCount,
      },
    };
  }

  /**
   * Rejects a Fal license application with mandatory rationale (>= 10 chars).
   */
  async rejectLicense(
    licenseId: string,
    admin: AuthenticatedAdminActor,
    dto: RejectFalLicenseInput,
  ) {
    const now = this.clockService.now();
    const reason = dto.rejectionReason?.trim();

    if (!reason || reason.length < 10) {
      throw new BadRequestException({
        code: LICENSE_REJECTION_REASON_REQUIRED,
        message: 'سبب الرفض يجب ألا يقل عن 10 أحرف',
      });
    }

    const license = await this.prisma.falLicense.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new NotFoundException({
        code: LICENSE_NOT_FOUND,
        message: 'طلب الترخيص غير موجود',
      });
    }

    if (
      license.status !== ProfileStatus.UNDER_REVIEW &&
      license.status !== ProfileStatus.RENEWAL_UNDER_REVIEW
    ) {
      throw new BadRequestException({
        code: LICENSE_INVALID_STATE,
        message: 'لا يمكن رفض طلب ليس بحالة قيد المراجعة',
      });
    }

    const expiresAt = license.lockExpiresAt ? new Date(license.lockExpiresAt) : null;
    const hasActiveLock = Boolean(
      license.lockedByAdminId === admin.id && expiresAt && expiresAt.getTime() > now.getTime(),
    );

    if (!hasActiveLock) {
      throw new ConflictException({
        code: LICENSE_LOCK_REQUIRED,
        message: 'يجب حجز قفل مراجعة الطلب قبل اتخاذ القرار',
      });
    }

    if (license.version !== dto.version) {
      throw new ConflictException({
        code: LICENSE_VERSION_CONFLICT,
        message: 'تم تحديث بيانات الطلب من قبل مستخدم أو مشرف آخر؛ يرجى إعادة تحميل الصفحة',
      });
    }

    const isRenewal = license.status === ProfileStatus.RENEWAL_UNDER_REVIEW;

    await this.prisma.$transaction(async (tx) => {
      let licenseTargetStatus: ProfileStatus = ProfileStatus.REJECTED;
      let profileTargetStatus: ProfileStatus = ProfileStatus.SUSPENDED;
      let rejectAction = 'FAL_LICENSE_REJECTED';

      if (isRenewal) {
        rejectAction = AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED;
        const expiryTime = new Date(license.expiryDate).getTime();
        if (now.getTime() >= expiryTime) {
          licenseTargetStatus = ProfileStatus.COMPLIANCE_RESTRICTED;
          profileTargetStatus = ProfileStatus.COMPLIANCE_RESTRICTED;
        } else {
          licenseTargetStatus = ProfileStatus.ACTIVE;
          profileTargetStatus = ProfileStatus.ACTIVE;
        }
      }

      await tx.falLicense.update({
        where: { id: licenseId },
        data: {
          status: licenseTargetStatus,
          rejectionReason: reason,
          reviewedByAdminId: admin.id,
          reviewedAt: now,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });

      await tx.userProfile.update({
        where: { id: license.profileId },
        data: {
          status: profileTargetStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: rejectAction,
          entityType: 'FalLicense',
          entityId: licenseId,
          payload: {
            adminName: admin.fullName,
            rejectionReason: reason,
            reviewedAt: now.toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `Fal license '${licenseId}' rejected by admin '${admin.id}'. Reason: ${reason}`,
    );

    return {
      statusCode: 200,
      message: isRenewal
        ? 'تم رفض طلب تجديد رخصة فال وتوثيق السبب للمستخدم'
        : 'تم رفض طلب اعتماد رخصة فال مع توثيق سبب الرفض للمستخدم',
    };
  }
}

