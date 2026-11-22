import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { OtpService } from '../auth/otp/otp.service';
import { QuarantineService } from '../storage/quarantine.service';
import { StorageService } from '../storage/storage.service';
import {
  UserRole,
  PropertyType,
  ListingStatus,
  OwnerContractStatus,
  AUTH_NOT_AUTHORIZED,
  OWNER_CONTRACT_NOT_FOUND,
  OWNER_CONTRACT_INVALID_STATE,
  OWNER_CONTRACT_EXPIRED,
  OWNER_CONTRACT_ALREADY_SIGNED,
  CONTRACT_FEE_PROOF_REQUIRED,
  CONTRACT_FEE_PROOF_UNSUPPORTED_TYPE,
  CONTRACT_FEE_PROOF_TOO_LARGE,
  CONTRACT_FEE_PROOF_SCAN_FAILED,
  CONTRACT_FEE_PAYMENT_STATUS,
  type ContractFeePaymentStatus,
  type OwnerContractDetailResponse,
  type SignOwnerContractInput,
  type SignOwnerContractResult,
  type RequestSignatureOtpResult,
  type UploadContractFeeProofInput,
  type OwnerContractFeeStatusResponse,
} from '@elmasaif/shared';

export interface ContractFeeProofUploadFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class OwnerContractsService {
  private readonly logger = new Logger(OwnerContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly otpService: OtpService,
    private readonly quarantineService: QuarantineService,
    private readonly storageService: StorageService,
  ) {}

  private maskSaudiMobile(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  }

  private async getActiveOwnerProfile(userId: string) {
    const ownerProfile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        role: UserRole.OWNER,
        status: 'ACTIVE',
      },
    });

    if (!ownerProfile) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'يجب أن يكون لديك ملف مالك عقار نشط للوصول إلى العقود',
      });
    }

    return ownerProfile;
  }

  private async resolveContract(contractIdOrRequestId: string) {
    let contract = await this.prisma.ownerContract.findUnique({
      where: { id: contractIdOrRequestId },
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

    if (!contract) {
      // Fallback: check if the ID provided is an OwnerListingRequest ID
      const listingRequest = await this.prisma.ownerListingRequest.findUnique({
        where: { id: contractIdOrRequestId },
      });

      if (listingRequest?.listingId) {
        contract = await this.prisma.ownerContract.findUnique({
          where: { listingId: listingRequest.listingId },
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
      }
    }

    return contract;
  }

  async getContractDetail(userId: string, contractId: string): Promise<OwnerContractDetailResponse> {
    const ownerProfile = await this.getActiveOwnerProfile(userId);
    const contract = await this.resolveContract(contractId);

    if (!contract) {
      throw new NotFoundException({
        code: OWNER_CONTRACT_NOT_FOUND,
        message: 'عقد المالك غير موجود',
      });
    }

    if (contract.ownerProfileId !== ownerProfile.id) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول لهذا العقد',
      });
    }

    return {
      id: contract.id,
      listingId: contract.listingId,
      ownerProfileId: contract.ownerProfileId,
      templateId: contract.templateId,
      propertyTitle: contract.listing?.title,
      propertyType: contract.listing?.propertyType as unknown as PropertyType,
      cityName: contract.listing?.city?.nameAr,
      districtName: contract.listing?.district?.nameAr,
      askPrice: contract.listing ? Number(contract.listing.askPrice) : undefined,
      areaSquareMeters: contract.listing ? Number(contract.listing.areaSquareMeters) : undefined,
      contractTerms: contract.contractTerms,
      contractFee: Number(contract.contractFee),
      feeOverrideReason: contract.feeOverrideReason,
      status: contract.status as unknown as OwnerContractStatus,
      expiresAt: contract.expiresAt.toISOString(),
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
      signatureData: contract.signatureData,
      ipAddress: contract.ipAddress,
      userAgent: contract.userAgent,
      otpCode: contract.otpCode,
      ownerName: contract.ownerProfile?.user?.fullName || '',
      ownerMobile: this.maskSaudiMobile(contract.ownerProfile?.user?.mobileNumber || ''),
    };
  }

  async requestSignatureOtp(userId: string, contractId: string): Promise<RequestSignatureOtpResult> {
    const ownerProfile = await this.getActiveOwnerProfile(userId);
    const contract = await this.resolveContract(contractId);

    if (!contract) {
      throw new NotFoundException({
        code: OWNER_CONTRACT_NOT_FOUND,
        message: 'عقد المالك غير موجود',
      });
    }

    if (contract.ownerProfileId !== ownerProfile.id) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول لهذا العقد',
      });
    }

    if (contract.status === OwnerContractStatus.PENDING_FEE || contract.status === OwnerContractStatus.ACTIVE) {
      throw new ConflictException({
        code: OWNER_CONTRACT_ALREADY_SIGNED,
        message: 'تم توقيع هذا العقد مسبقاً',
      });
    }

    if (contract.status !== OwnerContractStatus.PENDING_SIGNATURE) {
      throw new ConflictException({
        code: OWNER_CONTRACT_INVALID_STATE,
        message: 'العقد ليس في حالة انتظار التوقيع',
      });
    }

    const now = this.clockService.now();
    if (contract.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: OWNER_CONTRACT_EXPIRED,
        message: 'انتهت مهلة التوقيع على هذا العقد (7 أيام). يرجى تقديم طلب إدراج جديد أو التواصل مع إدارة المنصة.',
      });
    }

    const mobileNumber = contract.ownerProfile?.user?.mobileNumber;
    if (!mobileNumber) {
      throw new BadRequestException('رقم جوال المالك غير مسجل في الحساب');
    }

    const otpRes = await this.otpService.generateAndSendOtp(
      mobileNumber,
      'CONTRACT_SIGNATURE',
      { contractId: contract.id },
    );

    return {
      success: true,
      resendAvailableInSeconds: otpRes.resendAvailableInSeconds,
    };
  }

  async signContract(
    userId: string,
    contractId: string,
    dto: SignOwnerContractInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SignOwnerContractResult> {
    const ownerProfile = await this.getActiveOwnerProfile(userId);
    const contract = await this.resolveContract(contractId);

    if (!contract) {
      throw new NotFoundException({
        code: OWNER_CONTRACT_NOT_FOUND,
        message: 'عقد المالك غير موجود',
      });
    }

    if (contract.ownerProfileId !== ownerProfile.id) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول لهذا العقد',
      });
    }

    if (contract.status === OwnerContractStatus.PENDING_FEE || contract.status === OwnerContractStatus.ACTIVE) {
      throw new ConflictException({
        code: OWNER_CONTRACT_ALREADY_SIGNED,
        message: 'تم توقيع هذا العقد مسبقاً',
      });
    }

    if (contract.status !== OwnerContractStatus.PENDING_SIGNATURE) {
      throw new ConflictException({
        code: OWNER_CONTRACT_INVALID_STATE,
        message: 'العقد ليس في حالة انتظار التوقيع',
      });
    }

    const now = this.clockService.now();
    if (contract.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: OWNER_CONTRACT_EXPIRED,
        message: 'انتهت مهلة التوقيع على هذا العقد (7 أيام). يرجى تقديم طلب إدراج جديد أو التواصل مع إدارة المنصة.',
      });
    }

    const mobileNumber = contract.ownerProfile?.user?.mobileNumber;
    if (!mobileNumber) {
      throw new BadRequestException('رقم جوال المالك غير مسجل في الحساب');
    }

    // Verify OTP using OtpService (throws AUTH_OTP_INVALID, AUTH_OTP_LOCKED, AUTH_OTP_EXPIRED)
    const otpRecord = await this.otpService.verifyOtp(
      mobileNumber,
      'CONTRACT_SIGNATURE',
      dto.otpCode,
    );

    // 7 days payment window for listing fee proof upload
    const feeExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const maskedOtp = `***${dto.otpCode.slice(-2)}`;

    const updatedContract = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ownerContract.update({
        where: { id: contract.id },
        data: {
          signatureData: dto.signatureData,
          signedAt: now,
          otpCode: maskedOtp,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          status: OwnerContractStatus.PENDING_FEE,
          expiresAt: feeExpiresAt,
        },
      });

      if (contract.listingId && (tx as any).listing?.update) {
        await tx.listing.update({
          where: { id: contract.listingId },
          data: {
            status: ListingStatus.PENDING_FEE,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'OWNER_CONTRACT_SIGNED',
          entityType: 'OwnerContract',
          entityId: contract.id,
          ipAddress: ipAddress || null,
          payload: {
            listingId: contract.listingId,
            ownerProfileId: contract.ownerProfileId,
            signedAt: now.toISOString(),
            ipAddress,
            userAgent,
          },
        },
      });

      return updated;
    });

    if (otpRecord?.id) {
      await this.otpService.cleanupOtp(otpRecord.id);
    }

    return {
      success: true,
      contractId: updatedContract.id,
      status: updatedContract.status as unknown as OwnerContractStatus,
      signedAt: (updatedContract.signedAt || now).toISOString(),
      expiresAt: updatedContract.expiresAt.toISOString(),
    };
  }

  async uploadFeeProof(
    userId: string,
    contractId: string,
    file: ContractFeeProofUploadFile | undefined,
    body: UploadContractFeeProofInput,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: CONTRACT_FEE_PROOF_REQUIRED,
        message: 'ملف إشعار التحويل البنكي مطلوب',
      });
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: CONTRACT_FEE_PROOF_UNSUPPORTED_TYPE,
        message: 'نوع الملف غير مدعوم. يرجى رفع ملف بصيغة PDF أو JPG أو PNG',
      });
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException({
        code: CONTRACT_FEE_PROOF_TOO_LARGE,
        message: 'حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت)',
      });
    }

    const ownerProfile = await this.getActiveOwnerProfile(userId);
    const contract = await this.resolveContract(contractId);

    if (!contract) {
      throw new NotFoundException({
        code: OWNER_CONTRACT_NOT_FOUND,
        message: 'عقد المالك غير موجود',
      });
    }

    if (contract.ownerProfileId !== ownerProfile.id) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول لهذا العقد',
      });
    }

    if (contract.status !== OwnerContractStatus.PENDING_FEE) {
      throw new ConflictException({
        code: OWNER_CONTRACT_INVALID_STATE,
        message: 'العقد ليس في حالة انتظار سداد الرسوم',
      });
    }

    const now = this.clockService.now();
    if (contract.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: OWNER_CONTRACT_EXPIRED,
        message: 'انتهت مهلة سداد رسوم العقد (7 أيام). يرجى التواصل مع إدارة المنصة.',
      });
    }

    // Stage in quarantine and scan for malware
    const staged = await this.quarantineService.stageFileForQuarantine({
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      buffer: file.buffer,
      userId,
    });

    let outcome;
    try {
      outcome = await this.quarantineService.scanAndProcess(
        staged.fileObjectId,
        'contracts',
        { contractId: contract.id },
        userId,
      );
    } catch (error: any) {
      this.logger.error(`Contract fee proof scan failed: ${error?.message ?? error}`);
      throw new ServiceUnavailableException({
        code: CONTRACT_FEE_PROOF_SCAN_FAILED,
        message: 'تعذر فحص الملف حالياً. يرجى المحاولة بعد قليل',
      });
    }

    if (!outcome.isClean) {
      throw new BadRequestException({
        code: 'MALWARE_DETECTED',
        message: 'تم رفض الملف لاحتوائه على برمجيات ضارة أو غير آمنة',
      });
    }

    const existingPayment = await this.prisma.contractFeePayment.findFirst({
      where: { ownerContractId: contract.id },
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      let p;
      if (existingPayment) {
        p = await tx.contractFeePayment.update({
          where: { id: existingPayment.id },
          data: {
            amount: contract.contractFee,
            status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
            proofFileUrl: staged.fileObjectId,
            bankReferenceCode: body.bankReferenceCode?.trim() || null,
            senderBankName: body.senderBankName?.trim() || null,
            uploadedAt: now,
            rejectionReason: null,
          },
        });
      } else {
        p = await tx.contractFeePayment.create({
          data: {
            ownerContractId: contract.id,
            amount: contract.contractFee,
            status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
            proofFileUrl: staged.fileObjectId,
            bankReferenceCode: body.bankReferenceCode?.trim() || null,
            senderBankName: body.senderBankName?.trim() || null,
            uploadedAt: now,
            rejectionReason: null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'CONTRACT_FEE_PROOF_UPLOADED',
          entityType: 'ContractFeePayment',
          entityId: p.id,
          payload: {
            contractId: contract.id,
            amount: Number(contract.contractFee),
            bankReferenceCode: body.bankReferenceCode?.trim() || null,
            senderBankName: body.senderBankName?.trim() || null,
            uploadedAt: now.toISOString(),
          },
        },
      });

      return p;
    });

    this.logger.log(
      `Contract fee proof uploaded for contract ${contract.id} by user ${userId}. Awaiting admin review.`,
    );

    return {
      success: true,
      paymentId: payment.id,
      status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
      uploadedAt: now.toISOString(),
    };
  }

  async getFeePayment(userId: string, contractId: string): Promise<OwnerContractFeeStatusResponse> {
    const ownerProfile = await this.getActiveOwnerProfile(userId);
    const contract = await this.resolveContract(contractId);

    if (!contract) {
      throw new NotFoundException({
        code: OWNER_CONTRACT_NOT_FOUND,
        message: 'عقد المالك غير موجود',
      });
    }

    if (contract.ownerProfileId !== ownerProfile.id) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بالوصول لهذا العقد',
      });
    }

    const payment = await this.prisma.contractFeePayment.findFirst({
      where: { ownerContractId: contract.id },
    });

    let presignedProofUrl: string | null = null;
    if (payment?.proofFileUrl) {
      try {
        presignedProofUrl = await this.storageService.getVerifiedDownloadUrl(payment.proofFileUrl, 300);
      } catch {
        presignedProofUrl = null;
      }
    }

    return {
      id: payment?.id ?? '',
      ownerContractId: contract.id,
      amount: Number(payment?.amount ?? contract.contractFee),
      status: (payment?.status as ContractFeePaymentStatus) ?? CONTRACT_FEE_PAYMENT_STATUS.PENDING,
      proofFileUrl: presignedProofUrl,
      bankReferenceCode: payment?.bankReferenceCode ?? null,
      senderBankName: payment?.senderBankName ?? null,
      uploadedAt: payment?.uploadedAt ? payment.uploadedAt.toISOString() : null,
      rejectionReason: payment?.rejectionReason ?? null,
      verifiedAt: payment?.verifiedAt ? payment.verifiedAt.toISOString() : null,
      expiresAt: contract.expiresAt.toISOString(),
      isContractActive: contract.status === OwnerContractStatus.ACTIVE,
      listingId: contract.listingId ?? null,
    };
  }
}

