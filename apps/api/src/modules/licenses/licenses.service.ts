import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService } from '../storage/storage.service';
import {
  FAL_EXPIRED_DATE,
  FAL_LICENSE_ALREADY_EXISTS,
  ProfileStatus,
  SubmitFalLicenseInput,
  UserRole,
  calculateCalendarDaysRemaining,
  getFalLicenseWarningWindow,
  isFalLicenseExpired,
} from '@elmasaif/shared';

@Injectable()
export class LicensesService {
  private readonly logger = new Logger(LicensesService.name);

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
   * Submits or re-submits a REGA Fal license certificate and credentials for administrative review.
   */
  async submitFalLicense(userId: string, input: SubmitFalLicenseInput) {
    const now = this.clockService.now();
    const expiryDate = new Date(input.expiryDate);

    // 1. Strict future date validation
    if (expiryDate.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: FAL_EXPIRED_DATE,
        message: 'تاريخ انتهاء رخصة فال يجب أن يكون في المستقبل',
      });
    }

    // 2. Uniqueness verification across other users
    const existingOther = await this.prisma.falLicense.findFirst({
      where: {
        licenseNumber: input.licenseNumber,
        profile: {
          userId: { not: userId },
        },
      },
      include: {
        profile: true,
      },
    });

    if (existingOther) {
      throw new ConflictException({
        code: FAL_LICENSE_ALREADY_EXISTS,
        message: 'رقم رخصة فال مسجل مسبقاً لمستخدم آخر',
      });
    }

    // 3. Atomic transaction: upsert UserProfile + upsert FalLicense + insert AuditLog
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert Marketer UserProfile
      const profile = await tx.userProfile.upsert({
        where: {
          userId_role: {
            userId,
            role: UserRole.MARKETER,
          },
        },
        create: {
          userId,
          role: UserRole.MARKETER,
          status: ProfileStatus.UNDER_REVIEW,
        },
        update: {
          status: ProfileStatus.UNDER_REVIEW,
        },
      });

      // Upsert FalLicense
      const falLicense = await tx.falLicense.upsert({
        where: {
          profileId: profile.id,
        },
        create: {
          profileId: profile.id,
          licenseNumber: input.licenseNumber,
          certificateUrl: input.certificateUrl,
          expiryDate,
          commercialName: input.commercialName,
          crNumber: input.crNumber,
          supportingDocumentUrls: input.supportingDocumentUrls || [],
          status: ProfileStatus.UNDER_REVIEW,
          version: 1,
        },
        update: {
          licenseNumber: input.licenseNumber,
          certificateUrl: input.certificateUrl,
          expiryDate,
          commercialName: input.commercialName,
          crNumber: input.crNumber,
          supportingDocumentUrls: input.supportingDocumentUrls || [],
          status: ProfileStatus.UNDER_REVIEW,
          rejectionReason: null,
          reviewedByAdminId: null,
          reviewedAt: null,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          version: { increment: 1 },
        },
      });

      // Insert immutable AuditLog entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'FAL_LICENSE_SUBMITTED',
          entityType: 'FalLicense',
          entityId: falLicense.id,
          payload: {
            licenseNumber: input.licenseNumber,
            commercialName: input.commercialName,
            crNumber: input.crNumber,
            expiryDate: expiryDate.toISOString(),
          },
        },
      });

      this.logger.log(
        `User '${userId}' submitted Fal license '${input.licenseNumber}' for administrative review.`,
      );

      return falLicense;
    });

    return {
      statusCode: 201,
      message: 'تم إرسال طلب اعتماد رخصة فال بنجاح وجارٍ التدقيق الإداري',
      data: result,
    };
  }

  /**
   * Retrieves the current user's marketer profile and Fal license status with short-lived download URLs.
   */
  async getMyFalLicense(userId: string) {
    const profile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        role: UserRole.MARKETER,
      },
      include: {
        falLicense: true,
      },
    });

    if (!profile || !profile.falLicense) {
      return {
        profile: profile ? { id: profile.id, status: profile.status } : null,
        falLicense: null,
      };
    }

    const fal = profile.falLicense;

    // Mint short-lived download URLs for certificate and supporting docs
    let certificateDownloadUrl: string | undefined;
    if (fal.certificateUrl) {
      try {
        certificateDownloadUrl = await this.resolveDownloadUrl(fal.certificateUrl, 300);
      } catch {
        certificateDownloadUrl = undefined;
      }
    }

    const supportingDocumentDownloadUrls: string[] = [];
    if (Array.isArray(fal.supportingDocumentUrls)) {
      for (const docKey of fal.supportingDocumentUrls) {
        try {
          const url = await this.resolveDownloadUrl(docKey, 300);
          supportingDocumentDownloadUrls.push(url);
        } catch {
          // ignore individual URL minting errors
        }
      }
    }

    const now = this.clockService.now();
    const daysRemaining = calculateCalendarDaysRemaining(fal.expiryDate, now);
    const isExpired = isFalLicenseExpired(fal, now);
    const warningWindow = getFalLicenseWarningWindow(fal.expiryDate, now);

    return {
      profile: {
        id: profile.id,
        role: profile.role,
        status: profile.status,
      },
      falLicense: {
        ...fal,
        certificateDownloadUrl,
        supportingDocumentDownloadUrls,
        daysRemaining,
        isExpired,
        warningWindow,
      },
    };
  }
}

