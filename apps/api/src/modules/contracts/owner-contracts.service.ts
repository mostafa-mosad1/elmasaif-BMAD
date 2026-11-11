import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { OtpService } from '../auth/otp/otp.service';
import {
  UserRole,
  PropertyType,
  OwnerContractStatus,
  AUTH_NOT_AUTHORIZED,
  OWNER_CONTRACT_NOT_FOUND,
  OWNER_CONTRACT_INVALID_STATE,
  OWNER_CONTRACT_EXPIRED,
  OWNER_CONTRACT_ALREADY_SIGNED,
  type OwnerContractDetailResponse,
  type SignOwnerContractInput,
  type SignOwnerContractResult,
  type RequestSignatureOtpResult,
} from '@elmasaif/shared';

@Injectable()
export class OwnerContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly otpService: OtpService,
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
}
