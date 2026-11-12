import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import {
  AdminRole,
  ListingStatus,
  OwnerContractStatus,
  CONTRACT_FEE_PAYMENT_NOT_FOUND,
  CONTRACT_FEE_LOCK_CONFLICT,
  CONTRACT_FEE_PAYMENT_STATUS,
  PLATFORM_BANK_DETAILS,
  computeVatBreakdown,
  maskSaudiIban,
  type ContractFeeQueueQuery,
  type RejectContractFeeInput,
  type ForceUnlockContractFeeInput,
  type ContractFeePaymentQueueItem,
  type ContractFeePaymentDetailResponse,
  type ConfirmContractFeeResult,
  type RejectContractFeeResult,
  type ContractFeePaymentStatus,
} from '@elmasaif/shared';
import {
  buildLockInfo,
  assertLockHeld,
  resolveLockHolderNames,
  CONTRACT_FEE_LOCK_CODES,
} from './contract-fee-lock';

@Injectable()
export class AdminContractFeesService {
  private readonly logger = new Logger(AdminContractFeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
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

  async getQueue(query: Partial<ContractFeeQueueQuery> = {}, adminId: string) {
    const now = this.clockService.now();
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      where.OR = [
        { ownerContract: { listing: { title: { contains: searchTerm, mode: 'insensitive' } } } },
        { ownerContract: { ownerProfile: { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } } } },
        { ownerContract: { ownerProfile: { user: { mobileNumber: { contains: searchTerm, mode: 'insensitive' } } } } },
        { bankReferenceCode: { contains: searchTerm, mode: 'insensitive' } },
        { senderBankName: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [total, payments] = await Promise.all([
      this.prisma.contractFeePayment.count({ where }),
      this.prisma.contractFeePayment.findMany({
        where,
        include: {
          ownerContract: {
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
          },
        },
        orderBy: [
          { status: 'asc' }, // PROOF_UPLOADED, UNDER_REVIEW first
          { uploadedAt: 'asc' }, // Oldest uploaded first for SLA compliance
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    const adminNameMap = await resolveLockHolderNames(this.prisma, payments, now);

    const items: ContractFeePaymentQueueItem[] = payments.map((p) => {
      const lockInfo = buildLockInfo(p, now, adminId, adminNameMap);
      const listing = p.ownerContract?.listing;
      const ownerUser = p.ownerContract?.ownerProfile?.user;

      return {
        id: p.id,
        ownerContractId: p.ownerContractId,
        listingId: listing?.id ?? null,
        propertyTitle: listing?.title ?? 'طلب إدراج عقاري',
        propertyType: (listing?.propertyType as any) ?? 'VILLA',
        ownerLegalName: ownerUser?.fullName ?? '',
        maskedMobileNumber: this.maskSaudiMobile(ownerUser?.mobileNumber ?? ''),
        amount: Number(p.amount),
        status: p.status as ContractFeePaymentStatus,
        bankReferenceCode: p.bankReferenceCode ?? null,
        senderBankName: p.senderBankName ?? null,
        uploadedAt: p.uploadedAt ? p.uploadedAt.toISOString() : null,
        lockInfo,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.ownerContract?.expiresAt ? p.ownerContract.expiresAt.toISOString() : p.createdAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getDetail(id: string, adminId: string): Promise<ContractFeePaymentDetailResponse> {
    const now = this.clockService.now();
    const detailInclude = {
      ownerContract: {
        include: {
          listing: {
            include: {
              city: true,
              district: true,
              documents: true,
              ownerListingRequest: true,
            },
          },
          ownerProfile: {
            include: {
              user: true,
            },
          },
        },
      },
    };

    let payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
      include: detailInclude,
    });

    // Fallback if id passed is ownerContractId
    if (!payment) {
      payment = await this.prisma.contractFeePayment.findFirst({
        where: { ownerContractId: id },
        include: detailInclude,
      });
    }

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    const adminNameMap = await resolveLockHolderNames(this.prisma, [payment], now);
    const lockInfo = buildLockInfo(payment, now, adminId, adminNameMap);

    let presignedProofUrl: string | null = null;
    if (payment.proofFileUrl) {
      presignedProofUrl = await this.resolveDownloadUrl(payment.proofFileUrl, 300);
    }

    const listing = payment.ownerContract.listing;
    const ownerUser = payment.ownerContract.ownerProfile?.user;
    const listingRequest = listing?.ownerListingRequest;

    const photos = (listing?.documents ?? [])
      .filter((d) => d.documentType === 'PHOTO')
      .map((d) => ({
        id: d.id,
        fileUrl: d.fileUrl,
        isPrimary: false,
      }));

    return {
      payment: {
        id: payment.id,
        ownerContractId: payment.ownerContractId,
        amount: Number(payment.amount),
        status: payment.status as ContractFeePaymentStatus,
        proofFileUrl: presignedProofUrl,
        bankReferenceCode: payment.bankReferenceCode,
        senderBankName: payment.senderBankName,
        uploadedAt: payment.uploadedAt ? payment.uploadedAt.toISOString() : null,
        verifiedByAdminId: payment.verifiedByAdminId,
        verifiedAt: payment.verifiedAt ? payment.verifiedAt.toISOString() : null,
        rejectionReason: payment.rejectionReason,
        createdAt: payment.createdAt.toISOString(),
      },
      contract: {
        id: payment.ownerContract.id,
        listingId: payment.ownerContract.listingId,
        contractFee: Number(payment.ownerContract.contractFee),
        feeOverrideReason: payment.ownerContract.feeOverrideReason,
        contractTerms: payment.ownerContract.contractTerms,
        status: payment.ownerContract.status as any,
        expiresAt: payment.ownerContract.expiresAt.toISOString(),
        signedAt: payment.ownerContract.signedAt ? payment.ownerContract.signedAt.toISOString() : null,
        signatureData: payment.ownerContract.signatureData,
        ipAddress: payment.ownerContract.ipAddress,
        userAgent: payment.ownerContract.userAgent,
      },
      listing: listing
        ? {
            id: listing.id,
            title: listing.title,
            propertyType: listing.propertyType as any,
            askPrice: Number(listing.askPrice),
            areaSquareMeters: listing.areaSquareMeters,
            cityName: listing.city?.nameAr ?? '',
            districtName: listing.district?.nameAr ?? '',
            titleDeedNumber: listingRequest?.titleDeedNumber ?? '',
            photos,
          }
        : null,
      owner: {
        id: payment.ownerContract.ownerProfileId,
        legalName: ownerUser?.fullName ?? '',
        maskedMobileNumber: this.maskSaudiMobile(ownerUser?.mobileNumber ?? ''),
        nationalId: (ownerUser as any)?.nationalId ?? null,
        payoutIban: listing?.payoutIban ? maskSaudiIban(listing.payoutIban) : '',
      },
      lockInfo,
    };
  }

  async claimLock(id: string, adminId: string) {
    const now = this.clockService.now();
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    const lockExpiresAt = payment.lockExpiresAt ? new Date(payment.lockExpiresAt) : null;
    const isActivelyLocked = Boolean(
      payment.lockedByAdminId && lockExpiresAt && lockExpiresAt.getTime() > now.getTime(),
    );

    if (isActivelyLocked && payment.lockedByAdminId !== adminId) {
      const conflictNames = await resolveLockHolderNames(this.prisma, [payment], now);
      throw new ConflictException({
        code: CONTRACT_FEE_LOCK_CONFLICT,
        message: CONTRACT_FEE_LOCK_CODES.conflict.message,
        lockInfo: buildLockInfo(payment, now, adminId, conflictNames),
      });
    }

    const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const shouldAdvanceStatus = payment.status === CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED;

    if (typeof (this.prisma.contractFeePayment as any).updateMany === 'function') {
      const claimed = await this.prisma.contractFeePayment.updateMany({
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
          status: shouldAdvanceStatus ? CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW : payment.status,
        },
      });
      if (claimed.count === 0) {
        const conflictNames = await resolveLockHolderNames(this.prisma, [payment], now);
        throw new ConflictException({
          code: CONTRACT_FEE_LOCK_CONFLICT,
          message: CONTRACT_FEE_LOCK_CODES.conflict.message,
          lockInfo: buildLockInfo(payment, now, adminId, conflictNames),
        });
      }
    }

    const updated = await this.prisma.contractFeePayment.update({
      where: { id },
      data: {
        lockedByAdminId: adminId,
        lockedAt: now,
        lockExpiresAt: newExpiresAt,
        status: shouldAdvanceStatus ? CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW : payment.status,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'CONTRACT_FEE_CLAIMED',
        entityType: 'ContractFeePayment',
        entityId: id,
        payload: {
          previousStatus: payment.status,
          currentStatus: updated.status,
          lockExpiresAt: newExpiresAt.toISOString(),
        },
      },
    });

    const adminNameMap = await resolveLockHolderNames(this.prisma, [updated], now);
    return buildLockInfo(updated, now, adminId, adminNameMap);
  }

  async heartbeatLock(id: string, adminId: string) {
    const now = this.clockService.now();
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    assertLockHeld(payment, adminId, now);

    const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const updated = await this.prisma.contractFeePayment.update({
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
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    if (payment.lockedByAdminId === adminId) {
      const resetStatus =
        payment.status === CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW
          ? CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED
          : payment.status;

      const updated = await this.prisma.contractFeePayment.update({
        where: { id },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          status: resetStatus,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'CONTRACT_FEE_RELEASED',
          entityType: 'ContractFeePayment',
          entityId: id,
          payload: {
            releasedBy: adminId,
            status: resetStatus,
          },
        },
      });

      return buildLockInfo(updated, now, adminId);
    }

    return buildLockInfo(payment, now, adminId);
  }

  async forceUnlock(id: string, admin: any, dto: ForceUnlockContractFeeInput) {
    const now = this.clockService.now();
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    const previousLockHolder = payment.lockedByAdminId;

    await this.prisma.$transaction([
      this.prisma.contractFeePayment.update({
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
          action: 'CONTRACT_FEE_FORCE_UNLOCKED',
          entityType: 'ContractFeePayment',
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

  async confirmPayment(id: string, admin: any): Promise<ConfirmContractFeeResult> {
    const now = this.clockService.now();
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
      include: {
        ownerContract: {
          include: {
            listing: true,
            ownerProfile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    assertLockHeld(payment, admin.id, now);

    if (payment.status === CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED) {
      throw new ConflictException('تم تأكيد سداد هذا العقد مسبقاً');
    }

    const contract = payment.ownerContract;
    const listingId = contract.listingId;
    const feeStr = Number(payment.amount).toFixed(2);
    const vat = computeVatBreakdown(feeStr, 0.15);
    const invoiceNumber = `INV-FEES-${now.getUTCFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`;

    const partyDetails = {
      platform: {
        name: PLATFORM_BANK_DETAILS.beneficiaryName,
        bank: PLATFORM_BANK_DETAILS.bankName,
        iban: PLATFORM_BANK_DETAILS.iban,
      },
      seller: {
        profileId: contract.ownerProfileId,
        userId: contract.ownerProfile?.userId ?? '',
        fullName: contract.ownerProfile?.user?.fullName ?? '',
        nationalId: (contract.ownerProfile?.user as any)?.nationalId ?? null,
        mobileNumber: contract.ownerProfile?.user?.mobileNumber ?? '',
        email: contract.ownerProfile?.user?.email ?? null,
      },
      contract: {
        contractId: contract.id,
        listingId,
        feeAmount: feeStr,
      },
    };

    await this.prisma.$transaction(async (tx) => {
      // 1. Confirm ContractFeePayment & release lock
      await tx.contractFeePayment.update({
        where: { id: payment.id },
        data: {
          status: CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED,
          verifiedByAdminId: admin.id,
          verifiedAt: now,
          rejectionReason: null,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      // 2. Activate OwnerContract
      await tx.ownerContract.update({
        where: { id: contract.id },
        data: {
          status: OwnerContractStatus.ACTIVE,
        },
      });

      // 3. Publish Listing to ACTIVE status
      if (listingId) {
        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: ListingStatus.ACTIVE,
          },
        });

        // 4. Update associated OwnerListingRequest to COMPLETED if present
        await tx.ownerListingRequest.updateMany({
          where: { listingId },
          data: {
            status: 'COMPLETED' as any,
          },
        });
      }

      // 5. Generate InvoiceRecord
      await tx.invoiceRecord.create({
        data: {
          invoiceNumber,
          contractFeePaymentId: payment.id,
          sellerId: contract.ownerProfile?.userId ?? contract.ownerProfileId,
          subtotalAmount: vat.subtotalAmount,
          vatAmount: vat.vatAmount,
          vatRate: 0.15,
          totalAmount: vat.totalAmount,
          vatTreatment: 'STANDARD_15_PERCENT',
          partyDetails,
          createdAt: now,
        },
      });

      // 6. Write AuditLog
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'CONTRACT_FEE_CONFIRMED',
          entityType: 'ContractFeePayment',
          entityId: payment.id,
          payload: {
            contractId: contract.id,
            listingId,
            amount: Number(payment.amount),
            publishedAt: now.toISOString(),
            invoiceNumber,
          },
        },
      });
    });

    this.logger.log(
      `Contract fee ${payment.id} confirmed by admin ${admin.id}. Contract ${contract.id} and Listing ${listingId} are now ACTIVE. Invoice ${invoiceNumber} created.`,
    );

    return {
      success: true,
      paymentId: payment.id,
      contractId: contract.id,
      listingId: listingId ?? '',
      invoiceNumber,
      status: CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED,
    };
  }

  async rejectPayment(id: string, admin: any, dto: RejectContractFeeInput): Promise<RejectContractFeeResult> {
    const now = this.clockService.now();
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
      include: {
        ownerContract: true,
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    assertLockHeld(payment, admin.id, now);

    if (payment.status === CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED) {
      throw new ConflictException('لا يمكن رفض إشعار دفع مؤكد مسبقاً');
    }

    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      // 1. Update ContractFeePayment
      await tx.contractFeePayment.update({
        where: { id: payment.id },
        data: {
          status: CONTRACT_FEE_PAYMENT_STATUS.REJECTED,
          verifiedByAdminId: admin.id,
          verifiedAt: now,
          rejectionReason: reason,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      // 2. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'CONTRACT_FEE_REJECTED',
          entityType: 'ContractFeePayment',
          entityId: payment.id,
          payload: {
            contractId: payment.ownerContractId,
            reason,
            rejectedAt: now.toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `Contract fee ${payment.id} rejected by admin ${admin.id}. Reason: ${reason}`,
    );

    return {
      success: true,
      paymentId: payment.id,
      status: CONTRACT_FEE_PAYMENT_STATUS.REJECTED,
      rejectionReason: reason,
    };
  }

  async getProofDownloadUrl(id: string, _adminId: string) {
    const payment = await this.prisma.contractFeePayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException({
        code: CONTRACT_FEE_PAYMENT_NOT_FOUND,
        message: 'إشعار رسوم العقد غير موجود',
      });
    }

    if (!payment.proofFileUrl) {
      throw new NotFoundException({
        code: 'CONTRACT_FEE_PROOF_NOT_FOUND',
        message: 'لا يوجد ملف إشعار مرفوع لهذه الدفعة',
      });
    }

    const downloadUrl = await this.resolveDownloadUrl(payment.proofFileUrl, 300);

    return {
      downloadUrl,
      expiresInSeconds: 300,
    };
  }
}
