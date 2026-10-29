import { Injectable, HttpException, HttpStatus, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  UserRole,
  ProfileStatus,
  AUTH_MARKETER_NOT_APPROVED,
  AUTH_ROLE_NOT_AUTHORIZED,
  AUTH_PROFILE_NOT_FOUND,
  SessionUser,
  UserProfileSummary,
  ScanStatus,
  VerificationStatus
} from '@elmasaif/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService
  ) {}

  async getUserProfiles(userId: string, sessionToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: {
          include: {
            falLicense: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException({
        code: AUTH_PROFILE_NOT_FOUND,
        message: 'المستخدم غير موجود'
      });
    }

    let activeRole: UserRole = UserRole.BUYER;
    if (sessionToken) {
      const session = await this.prisma.session.findUnique({
        where: { token: sessionToken }
      });
      if (session?.activeRole) {
        activeRole = session.activeRole as UserRole;
      }
    }

    const profiles: UserProfileSummary[] = user.profiles.map((p) => ({
      id: p.id,
      role: p.role as UserRole,
      status: p.status as ProfileStatus,
      payoutIban: p.payoutIban,
      falLicenseNumber: p.falLicense?.licenseNumber || null,
      falStatus: (p.falLicense?.status as ProfileStatus) || null,
      createdAt: p.createdAt
    }));

    const hasOwner = profiles.some((p) => p.role === UserRole.OWNER);
    const marketerProfile = profiles.find((p) => p.role === UserRole.MARKETER);
    const hasActiveMarketer = Boolean(
      marketerProfile &&
      marketerProfile.status === ProfileStatus.ACTIVE &&
      marketerProfile.falStatus === ProfileStatus.ACTIVE
    );

    const availableRoles = [
      {
        role: UserRole.BUYER,
        nameAr: 'حساب مشتري',
        available: true,
        isAttached: true,
        canSwitch: true,
        isInstant: true,
        requiresFal: false
      },
      {
        role: UserRole.OWNER,
        nameAr: 'مالك عقار',
        available: true,
        isAttached: hasOwner,
        canSwitch: true,
        isInstant: true,
        requiresFal: false,
        helperText: 'تفعيل فوري لإدارة وعرض عقاراتك مباشرة'
      },
      {
        role: UserRole.MARKETER,
        nameAr: 'مسوق معتمد',
        available: hasActiveMarketer,
        isAttached: Boolean(marketerProfile),
        canSwitch: hasActiveMarketer,
        isInstant: false,
        requiresFal: true,
        helperText: 'يتطلب رخصة فال سارية من الهيئة العامة للعقار'
      }
    ];

    return {
      activeRole,
      profiles,
      availableRoles
    };
  }

  async switchActiveRole(userId: string, sessionToken: string, targetRole: UserRole): Promise<SessionUser> {
    if (![UserRole.BUYER, UserRole.OWNER, UserRole.MARKETER].includes(targetRole)) {
      throw new ForbiddenException({
        code: AUTH_ROLE_NOT_AUTHORIZED,
        message: 'الدور المطلوب غير متاح للتبديل'
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: {
          include: {
            falLicense: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException({
        code: AUTH_PROFILE_NOT_FOUND,
        message: 'المستخدم غير موجود'
      });
    }

    if (targetRole === UserRole.OWNER) {
      const hasOwner = user.profiles.some((p) => p.role === UserRole.OWNER);
      if (!hasOwner) {
        await this.prisma.userProfile.create({
          data: {
            userId,
            role: UserRole.OWNER,
            status: ProfileStatus.ACTIVE
          }
        });
      }
    } else if (targetRole === UserRole.MARKETER) {
      const marketerProfile = user.profiles.find((p) => p.role === UserRole.MARKETER);
      const isFalActive =
        marketerProfile?.status === ProfileStatus.ACTIVE &&
        marketerProfile?.falLicense?.status === ProfileStatus.ACTIVE;

      if (!marketerProfile || !isFalActive) {
        throw new HttpException(
          {
            code: AUTH_MARKETER_NOT_APPROVED,
            message: 'يتطلب التبديل لحساب مسوق وجود رخصة فال معتمدة وفعالة'
          },
          HttpStatus.FORBIDDEN
        );
      }
    } else if (targetRole === UserRole.BUYER) {
      const hasBuyer = user.profiles.some((p) => p.role === UserRole.BUYER);
      if (!hasBuyer) {
        await this.prisma.userProfile.create({
          data: {
            userId,
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE
          }
        });
      }
    }

    await this.prisma.session.update({
      where: { token: sessionToken },
      data: { activeRole: targetRole }
    });

    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: {
          include: {
            falLicense: true
          }
        }
      }
    });

    const profiles: UserProfileSummary[] = (refreshedUser?.profiles || []).map((p) => ({
      id: p.id,
      role: p.role as UserRole,
      status: p.status as ProfileStatus,
      payoutIban: p.payoutIban,
      falLicenseNumber: p.falLicense?.licenseNumber || null,
      falStatus: (p.falLicense?.status as ProfileStatus) || null,
      createdAt: p.createdAt
    }));

    return {
      id: refreshedUser!.id,
      fullName: refreshedUser!.fullName,
      mobileNumber: refreshedUser!.mobileNumber,
      username: refreshedUser!.username,
      role: targetRole,
      activeRole: targetRole,
      profiles
    };
  }

  async attachOwnerProfile(userId: string) {
    const existing = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: UserRole.OWNER
        }
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userProfile.create({
      data: {
        userId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE
      }
    });
  }

  async verifyBuyerIdentityPrerequisite(userId: string): Promise<boolean> {
    const document = await this.prisma.identityDocument.findFirst({
      where: {
        userId,
        status: { in: [VerificationStatus.PENDING_REVIEW, VerificationStatus.VERIFIED] },
        fileObject: { scanStatus: ScanStatus.CLEAN }
      },
      select: { id: true }
    });
    return Boolean(document);
  }
}
