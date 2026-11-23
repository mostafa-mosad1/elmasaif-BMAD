import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import { ContractTemplatesService } from './contract-templates.service';
import {
  AdminRole,
  ListingStatus,
  OwnerListingRequestStatus,
  OwnerContractStatus,
  OWNER_REQUEST_NOT_FOUND,
  OWNER_REQUEST_LOCK_CONFLICT,
  OWNER_REQUEST_INVALID_STATE,
  CONTRACT_FEE_OVERRIDE_UNAUTHORIZED,
  CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
  maskSaudiIban,
  type OwnerRequestsQueueQuery,
  type DispatchOwnerContractInput,
  type RejectOwnerListingRequestInput,
  type RequestModificationInput,
  type ForceUnlockOwnerRequestInput,
  type OwnerListingRequestQueueItem,
  type OwnerListingRequestDetailResponse,
} from '@elmasaif/shared';
import {
  buildLockInfo,
  assertLockHeld,
  resolveLockHolderNames,
  OWNER_REQUEST_LOCK_CODES,
} from './owner-request-lock';

@Injectable()
export class AdminOwnerRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
    private readonly contractTemplatesService: ContractTemplatesService,
    @Optional() private readonly platformSettingsService?: PlatformSettingsService,
  ) {}

  private maskSaudiMobile(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  }

  async resolveDownloadUrl(keyOrId: string, expiresInSeconds = 300): Promise<string> {
    try {
      return await this.storageService.getVerifiedDownloadUrl(keyOrId, expiresInSeconds);
    } catch {
      return await this.storageService.getPresignedDownloadUrl(keyOrId, expiresInSeconds);
    }
  }

  async getQueue(query: Partial<OwnerRequestsQueueQuery> = {}, adminId: string) {
    const now = this.clockService.now();
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      where.OR = [
        { listing: { title: { contains: searchTerm, mode: 'insensitive' } } },
        { ownerProfile: { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } } },
      ];
    }

    const [total, requests] = await Promise.all([
      this.prisma.ownerListingRequest.count({ where }),
      this.prisma.ownerListingRequest.findMany({
        where,
        include: {
          listing: {
            include: {
              city: true,
              district: true,
            },
          },
          ownerProfile: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const adminNameMap = await resolveLockHolderNames(this.prisma, requests, now);

    const items: OwnerListingRequestQueueItem[] = requests.map((req) => ({
      id: req.id,
      listingId: req.listingId,
      propertyTitle: req.listing?.title ?? '',
      propertyType: req.propertyType as any,
      cityId: req.cityId,
      cityName: req.listing?.city?.nameAr ?? '',
      districtId: req.districtId,
      districtName: req.listing?.district?.nameAr ?? '',
      askPrice: Number(req.listing?.askPrice ?? 0),
      submissionTimestamp: req.createdAt.toISOString(),
      ownerLegalName: req.ownerProfile?.user?.fullName ?? '',
      maskedMobileNumber: this.maskSaudiMobile(req.ownerProfile?.user?.mobileNumber ?? ''),
      ownerProfileId: req.ownerProfileId,
      status: req.status as OwnerListingRequestStatus,
      titleDeedNumber: req.titleDeedNumber,
      lockInfo: buildLockInfo(req, now, adminId, adminNameMap),
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getDetail(id: string, adminId: string): Promise<OwnerListingRequestDetailResponse> {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            city: true,
            district: true,
            documents: true,
            ownerContract: true,
          },
        },
        ownerProfile: {
          include: {
            user: true,
            payoutAccounts: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    const adminNameMap = await resolveLockHolderNames(this.prisma, [request], now);
    const lockInfo = buildLockInfo(request, now, adminId, adminNameMap);

    // Find deed document and presign URL
    const deedDoc = request.listing?.documents.find((d) => d.documentType === 'TITLE_DEED');
    let titleDeedDocumentUrl: string | null = null;
    if (deedDoc) {
      try {
        titleDeedDocumentUrl = await this.resolveDownloadUrl(deedDoc.id, 300);
      } catch {
        titleDeedDocumentUrl = deedDoc.fileUrl;
      }
    }

    // Check payout account verification status
    const cleanListingIban = request.listing?.payoutIban?.replace(/\s+/g, '').toUpperCase() ?? '';
    const last4 = cleanListingIban.slice(-4);
    const hasMatchingPayout = request.ownerProfile?.payoutAccounts.some(
      (acc) => acc.ibanMasked.includes(last4) || acc.ibanLast4 === last4,
    );

    const photos = await Promise.all(
      (request.listing?.documents ?? [])
        .filter((d) => d.documentType === 'PHOTO')
        .map(async (d) => {
          let fileUrl = d.fileUrl;
          try {
            fileUrl = await this.resolveDownloadUrl(d.id, 300);
          } catch {
            try {
              fileUrl = await this.storageService.getPresignedDownloadUrl(d.fileUrl, 300);
            } catch {
              fileUrl = d.fileUrl;
            }
          }
          return {
            id: d.id,
            fileUrl,
            isPrimary: false,
          };
        }),
    );

    const documents = (request.listing?.documents ?? [])
      .filter((d) => d.documentType !== 'PHOTO')
      .map((d) => ({
        id: d.id,
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        visibility: d.visibility,
      }));

    return {
      id: request.id,
      listingId: request.listingId,
      ownerProfileId: request.ownerProfileId,
      propertyType: request.propertyType as any,
      cityId: request.cityId,
      cityName: request.listing?.city?.nameAr ?? '',
      districtId: request.districtId,
      districtName: request.listing?.district?.nameAr ?? '',
      streetName: request.listing?.streetName ?? null,
      titleDeedNumber: request.titleDeedNumber,
      titleDeedDocumentUrl,
      status: request.status as OwnerListingRequestStatus,
      rejectionReason: request.rejectionReason,
      modificationNotes: request.modificationNotes,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      lockInfo,
      owner: {
        legalName: request.ownerProfile?.user?.fullName ?? '',
        maskedMobileNumber: this.maskSaudiMobile(request.ownerProfile?.user?.mobileNumber ?? ''),
        nationalId: (request.ownerProfile?.user as any)?.nationalId ?? null,
        payoutIban: cleanListingIban ? maskSaudiIban(cleanListingIban) : '',
        isPayoutIbanVerified: Boolean(hasMatchingPayout),
      },
      listing: request.listing
        ? {
            id: request.listing.id,
            title: request.listing.title,
            description: request.listing.description,
            askPrice: Number(request.listing.askPrice),
            areaSquareMeters: request.listing.areaSquareMeters,
            bedrooms: request.listing.bedrooms,
            yearBuilt: request.listing.yearBuilt,
            latitude: request.listing.latitude,
            longitude: request.listing.longitude,
            photos,
            documents,
          }
        : null,
      contract: request.listing?.ownerContract
        ? {
            id: request.listing.ownerContract.id,
            listingId: request.listing.ownerContract.listingId,
            ownerProfileId: request.listing.ownerContract.ownerProfileId,
            templateId: request.listing.ownerContract.templateId,
            contractFee: Number(request.listing.ownerContract.contractFee),
            feeOverrideReason: request.listing.ownerContract.feeOverrideReason,
            contractTerms: request.listing.ownerContract.contractTerms,
            status: request.listing.ownerContract.status as unknown as OwnerContractStatus,
            expiresAt: request.listing.ownerContract.expiresAt.toISOString(),
            createdAt: request.listing.ownerContract.createdAt.toISOString(),
            signedAt: request.listing.ownerContract.signedAt
              ? request.listing.ownerContract.signedAt.toISOString()
              : null,
          }
        : null,
    };
  }

  async claimLock(id: string, adminId: string) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    const lockExpiresAt = request.lockExpiresAt ? new Date(request.lockExpiresAt) : null;
    const isActivelyLocked = Boolean(
      request.lockedByAdminId && lockExpiresAt && lockExpiresAt.getTime() > now.getTime(),
    );

    if (isActivelyLocked && request.lockedByAdminId !== adminId) {
      const conflictNames = await resolveLockHolderNames(this.prisma, [request], now);
      throw new ConflictException({
        code: OWNER_REQUEST_LOCK_CONFLICT,
        message: OWNER_REQUEST_LOCK_CODES.conflict.message,
        lockInfo: buildLockInfo(request, now, adminId, conflictNames),
      });
    }

    const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    if (typeof (this.prisma.ownerListingRequest as any).updateMany === 'function') {
      const claimed = await this.prisma.ownerListingRequest.updateMany({
        where: {
          id,
          OR: [
            { lockedByAdminId: null },
            { lockExpiresAt: { lte: now } },
            { lockedByAdminId: adminId },
          ],
        },
        data: {
          lockedByAdminId: adminId,
          lockedAt: now,
          lockExpiresAt: newExpiresAt,
        },
      });
      if (claimed.count === 0) {
        const conflictNames = await resolveLockHolderNames(this.prisma, [request], now);
        throw new ConflictException({
          code: OWNER_REQUEST_LOCK_CONFLICT,
          message: OWNER_REQUEST_LOCK_CODES.conflict.message,
          lockInfo: buildLockInfo(request, now, adminId, conflictNames),
        });
      }
    }

    const updated = await this.prisma.ownerListingRequest.update({
      where: { id },
      data: {
        lockedByAdminId: adminId,
        lockedAt: now,
        lockExpiresAt: newExpiresAt,
      },
    });

    const adminNameMap = await resolveLockHolderNames(this.prisma, [updated], now);
    return buildLockInfo(updated, now, adminId, adminNameMap);
  }

  async heartbeatLock(id: string, adminId: string) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    assertLockHeld(request, adminId, now);

    const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const updated = await this.prisma.ownerListingRequest.update({
      where: { id },
      data: {
        lockExpiresAt: newExpiresAt,
      },
    });

    const adminNameMap = await resolveLockHolderNames(this.prisma, [updated], now);
    return buildLockInfo(updated, now, adminId, adminNameMap);
  }

  async releaseLock(id: string, adminId: string) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    if (request.lockedByAdminId === adminId) {
      const updated = await this.prisma.ownerListingRequest.update({
        where: { id },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });
      return buildLockInfo(updated, now, adminId);
    }

    return buildLockInfo(request, now, adminId);
  }

  async forceUnlock(id: string, admin: any, dto: ForceUnlockOwnerRequestInput) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    const previousLockHolder = request.lockedByAdminId;

    await this.prisma.$transaction([
      this.prisma.ownerListingRequest.update({
        where: { id },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'TASK_LOCK_FORCED_RELEASE',
          entityType: 'OwnerListingRequest',
          entityId: id,
          payload: {
            reason: dto.reason,
            releasedAdminId: previousLockHolder,
            forcedByAdminId: admin.id,
          },
        },
      }),
    ]);

    return { success: true, message: 'تم فك القفل الإجباري بنجاح' };
  }

  async dispatchContract(id: string, admin: any, dto: DispatchOwnerContractInput) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            city: true,
            district: true,
          },
        },
        ownerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    assertLockHeld(request, admin.id, now);

    if (request.status !== OwnerListingRequestStatus.PENDING) {
      throw new ConflictException({
        code: OWNER_REQUEST_INVALID_STATE,
        message: 'لا يمكن إرسال عقد لطلب غير معلق للمراجعة',
      });
    }

    const activeSettings = this.platformSettingsService
      ? await this.platformSettingsService.getSettings()
      : null;
    const defaultFee = activeSettings
      ? activeSettings.ownerContractFeeSar
      : DEFAULT_OWNER_CONTRACT_FEE_SAR;

    const fee = Number(dto.contractFee ?? defaultFee);
    if (fee !== defaultFee) {
      const permissions: string[] = Array.isArray(admin.permissions) ? admin.permissions : [];
      const hasFeeOverride =
        admin.role === AdminRole.SUPER_ADMIN || permissions.includes('Contracts.FeeOverride');

      if (!hasFeeOverride) {
        throw new ForbiddenException({
          code: CONTRACT_FEE_OVERRIDE_UNAUTHORIZED,
          message: 'لا تملك صلاحية تعديل رسوم العقد القياسية (Contracts.FeeOverride)',
        });
      }

      if (!dto.feeOverrideReason || dto.feeOverrideReason.trim().length < 3) {
        throw new BadRequestException({
          code: CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
          message: 'سبب تعديل رسوم العقد مطلوب',
        });
      }
    }

    const template = await this.contractTemplatesService.getTemplateById(dto.templateId);

    const compiledTerms = this.contractTemplatesService.compileContractTerms(template.content, {
      ownerName: request.ownerProfile?.user?.fullName ?? '',
      nationalId: (request.ownerProfile?.user as any)?.nationalId ?? 'مكتمل بالتحقق الوطني',
      propertyTitle: request.listing?.title ?? '',
      propertyType: request.propertyType,
      cityName: request.listing?.city?.nameAr ?? '',
      districtName: request.listing?.district?.nameAr ?? '',
      askPrice: Number(request.listing?.askPrice ?? 0).toLocaleString(),
      contractFee: fee.toLocaleString(),
      platformIBAN: 'SA0380000000608010167519',
      dispatchDate: now.toISOString().split('T')[0],
    });

    const finalTerms = dto.customTerms?.trim()
      ? `${compiledTerms}\n\nالبند السادس: شروط وأحكام إضافية:\n${dto.customTerms.trim()}`
      : compiledTerms;

    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days (168 hours)

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.ownerContract.upsert({
        where: { listingId: request.listingId! },
        update: {
          templateId: template.id,
          contractFee: fee,
          feeOverrideReason: dto.feeOverrideReason ?? null,
          contractTerms: finalTerms,
          status: OwnerContractStatus.PENDING_SIGNATURE,
          expiresAt,
        },
        create: {
          listingId: request.listingId!,
          ownerProfileId: request.ownerProfileId,
          templateId: template.id,
          contractFee: fee,
          feeOverrideReason: dto.feeOverrideReason ?? null,
          contractTerms: finalTerms,
          status: OwnerContractStatus.PENDING_SIGNATURE,
          expiresAt,
        },
      });

      await tx.ownerListingRequest.update({
        where: { id },
        data: {
          status: OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      if (request.listingId) {
        await tx.listing.update({
          where: { id: request.listingId },
          data: {
            status: ListingStatus.PENDING_FEE,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OWNER_CONTRACT_DISPATCHED',
          entityType: 'OwnerContract',
          entityId: contract.id,
          payload: {
            requestId: request.id,
            listingId: request.listingId,
            ownerProfileId: request.ownerProfileId,
            templateId: template.id,
            contractFee: fee,
            feeOverrideReason: dto.feeOverrideReason ?? null,
          },
        },
      });

      return {
        success: true,
        contractId: contract.id,
        status: contract.status,
        expiresAt: contract.expiresAt.toISOString(),
      };
    });
  }

  async rejectRequest(id: string, admin: any, dto: RejectOwnerListingRequestInput) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    assertLockHeld(request, admin.id, now);

    if (request.status !== OwnerListingRequestStatus.PENDING) {
      throw new ConflictException({
        code: OWNER_REQUEST_INVALID_STATE,
        message: 'لا يمكن رفض طلب تم اتخاذ إجراء عليه مسبقاً',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ownerListingRequest.update({
        where: { id },
        data: {
          status: OwnerListingRequestStatus.REJECTED,
          rejectionReason: dto.reason,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      if (request.listingId) {
        await tx.listing.update({
          where: { id: request.listingId },
          data: {
            status: ListingStatus.REJECTED,
            rejectionReason: dto.reason,
            reviewedByAdminId: admin.id,
            reviewedAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OWNER_LISTING_REQUEST_REJECTED',
          entityType: 'OwnerListingRequest',
          entityId: id,
          payload: {
            reason: dto.reason,
            listingId: request.listingId,
          },
        },
      });

      return { success: true, message: 'تم رفض طلب الإدراج بنجاح' };
    });
  }

  async requestModification(id: string, admin: any, dto: RequestModificationInput) {
    const now = this.clockService.now();
    const request = await this.prisma.ownerListingRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        code: OWNER_REQUEST_NOT_FOUND,
        message: 'طلب إدراج المالك غير موجود',
      });
    }

    assertLockHeld(request, admin.id, now);

    if (request.status !== OwnerListingRequestStatus.PENDING) {
      throw new ConflictException({
        code: OWNER_REQUEST_INVALID_STATE,
        message: 'لا يمكن طلب تعديل على طلب تم اتخاذ إجراء عليه مسبقاً',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ownerListingRequest.update({
        where: { id },
        data: {
          status: OwnerListingRequestStatus.MODIFICATION_REQUESTED,
          modificationNotes: dto.notes,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'OWNER_LISTING_REQUEST_MODIFICATION_REQUESTED',
          entityType: 'OwnerListingRequest',
          entityId: id,
          payload: {
            notes: dto.notes,
            listingId: request.listingId,
          },
        },
      });

      return { success: true, message: 'تم إرسال طلب التعديل بنجاح إلى المالك' };
    });
  }
}
