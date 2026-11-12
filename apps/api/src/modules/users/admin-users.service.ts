import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AdminHardDeleteUserRequestInput,
  AdminPlatformUserSummaryDto,
  AdminUpdateUserStatusRequestInput,
  ProfileStatus,
  USER_HARD_DELETE_HISTORY_EXISTS,
  USER_NOT_FOUND,
  UserRole,
  VerificationStatus,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { AccountDeletionService } from './account-deletion.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    @Optional() private readonly accountDeletionService?: AccountDeletionService
  ) {}

  private async safeCount(
    model: any,
    where: Record<string, unknown>
  ): Promise<number> {
    if (!model || typeof model.count !== 'function') {
      return 0;
    }
    const count = await model.count({ where });
    return typeof count === 'number' ? count : 0;
  }

  async countUserTransactionHistory(userId: string): Promise<number> {
    const p = this.prisma as any;
    let profileIds: string[] = [];

    if (p.userProfile && typeof p.userProfile.findMany === 'function') {
      const profiles = await p.userProfile.findMany({
        where: { userId },
        select: { id: true },
      });
      if (Array.isArray(profiles)) {
        profileIds = profiles.map((prof: any) => prof.id);
      }
    }

    if (
      this.accountDeletionService &&
      typeof this.accountDeletionService.countUserTransactionHistory === 'function'
    ) {
      const baseCount =
        await this.accountDeletionService.countUserTransactionHistory(
          userId,
          profileIds
        );

      const extraCounts =
        profileIds.length > 0
          ? await Promise.all([
              this.safeCount(p.contractFeePayment, {
                ownerContract: { ownerProfileId: { in: profileIds } },
              }),
              this.safeCount(p.listingInquiry, {
                OR: [
                  { buyerProfileId: { in: profileIds } },
                  { sellerProfileId: { in: profileIds } },
                ],
              }),
              this.safeCount(p.inquiryThread, {
                OR: [
                  { buyerProfileId: { in: profileIds } },
                  { sellerProfileId: { in: profileIds } },
                ],
              }),
            ])
          : [0, 0, 0];

      return baseCount + extraCounts.reduce((a, b) => a + b, 0);
    }

    // Fallback direct count when AccountDeletionService is not injected
    const directUserCounts = await Promise.all([
      this.safeCount(p.rating, {
        OR: [{ raterUserId: userId }, { targetUserId: userId }],
      }),
      this.safeCount(p.dispute, { initiatorId: userId }),
    ]);

    if (profileIds.length === 0) {
      const fallbackCounts = await Promise.all([
        this.safeCount(p.listing, { sellerId: userId }),
        this.safeCount(p.offer, { buyerId: userId }),
        this.safeCount(p.deal, {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        }),
        this.safeCount(p.payment, { userId }),
        this.safeCount(p.contractFeePayment, { userId }),
        this.safeCount(p.listingInquiry, {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        }),
        this.safeCount(p.inquiryThread, {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        }),
      ]);
      return (
        directUserCounts.reduce((a, b) => a + b, 0) +
        fallbackCounts.reduce((a, b) => a + b, 0)
      );
    }

    const profileCounts = await Promise.all([
      this.safeCount(p.listing, { sellerProfileId: { in: profileIds } }),
      this.safeCount(p.offer, {
        OR: [
          { buyerProfileId: { in: profileIds } },
          { listing: { sellerProfileId: { in: profileIds } } },
        ],
      }),
      this.safeCount(p.deal, {
        OR: [
          { buyerProfileId: { in: profileIds } },
          { sellerProfileId: { in: profileIds } },
        ],
      }),
      this.safeCount(p.payment, {
        deal: {
          OR: [
            { buyerProfileId: { in: profileIds } },
            { sellerProfileId: { in: profileIds } },
          ],
        },
      }),
      this.safeCount(p.contractFeePayment, {
        ownerContract: { ownerProfileId: { in: profileIds } },
      }),
      this.safeCount(p.ownerContract, { ownerProfileId: { in: profileIds } }),
      this.safeCount(p.conversation, {
        OR: [
          { buyerProfileId: { in: profileIds } },
          { sellerProfileId: { in: profileIds } },
        ],
      }),
      this.safeCount(p.listingInquiry, {
        OR: [
          { buyerProfileId: { in: profileIds } },
          { sellerProfileId: { in: profileIds } },
        ],
      }),
      this.safeCount(p.inquiryThread, {
        OR: [
          { buyerProfileId: { in: profileIds } },
          { sellerProfileId: { in: profileIds } },
        ],
      }),
      this.safeCount(p.demand, { buyerProfileId: { in: profileIds } }),
    ]);

    return (
      directUserCounts.reduce((a, b) => a + b, 0) +
      profileCounts.reduce((a, b) => a + b, 0)
    );
  }

  private toPlatformUserSummaryDto(
    user: any,
    transactionHistoryCount: number
  ): AdminPlatformUserSummaryDto {
    const profileRoles: string[] = Array.isArray(user.profiles)
      ? user.profiles.map((p: any) => p.role)
      : [];
    const primaryRole =
      user.role || profileRoles[0] || UserRole.BUYER;
    const verificationStatus =
      user.verificationStatus ||
      user.identityDocuments?.[0]?.status ||
      VerificationStatus.NOT_UPLOADED;

    const inactiveStatuses = [
      ProfileStatus.DISABLED,
      ProfileStatus.SOFT_DELETED,
      ProfileStatus.DEACTIVATED,
    ];
    const isActive =
      (user.isActive ?? true) &&
      !user.deletedAt &&
      !inactiveStatuses.includes(user.status as ProfileStatus);

    return {
      id: user.id,
      phone: user.mobileNumber || user.phone || '',
      mobileNumber: user.mobileNumber || user.phone || '',
      username: user.username,
      fullName: user.fullName,
      role: primaryRole,
      roles: profileRoles.length > 0 ? profileRoles : [primaryRole],
      verificationStatus,
      status: user.status || ProfileStatus.ACTIVE,
      isActive,
      deletedAt: user.deletedAt ?? null,
      createdAt: user.createdAt,
      transactionHistoryCount,
    };
  }

  async listUsers(): Promise<AdminPlatformUserSummaryDto[]> {
    const users = await this.prisma.user.findMany({
      include: {
        profiles: true,
        identityDocuments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summaries: AdminPlatformUserSummaryDto[] = [];
    for (const user of users) {
      const historyCount = await this.countUserTransactionHistory(user.id);
      summaries.push(this.toPlatformUserSummaryDto(user, historyCount));
    }

    return summaries;
  }

  async updateUserStatus(
    actorAdminId: string,
    userId: string,
    dto: AdminUpdateUserStatusRequestInput,
    ip: string
  ): Promise<AdminPlatformUserSummaryDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: USER_NOT_FOUND,
        message: 'حساب المستخدم غير موجود',
      });
    }

    const now = this.clockService.now();
    const isEnable = dto.action === 'ENABLE';
    const isSoftDelete = dto.action === 'SOFT_DELETE';

    const nextStatus = isEnable
      ? ProfileStatus.ACTIVE
      : isSoftDelete
        ? ProfileStatus.SOFT_DELETED
        : ProfileStatus.DISABLED;
    const nextIsActive = isEnable;
    const nextDeletedAt = isSoftDelete
      ? now
      : isEnable
        ? null
        : (targetUser as any).deletedAt ?? null;

    const beforeSnapshot = {
      status: targetUser.status,
      isActive: (targetUser as any).isActive ?? true,
      deletedAt: (targetUser as any).deletedAt ?? null,
    };

    const afterSnapshot = {
      status: nextStatus,
      isActive: nextIsActive,
      deletedAt: nextDeletedAt,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          status: nextStatus,
          isActive: nextIsActive,
          deletedAt: nextDeletedAt,
        },
      });

      if (!isEnable) {
        if (tx.session && typeof tx.session.deleteMany === 'function') {
          await tx.session.deleteMany({
            where: { userId: targetUser.id },
          });
        }
        if (
          (tx as any).userSession &&
          typeof (tx as any).userSession.deleteMany === 'function'
        ) {
          await (tx as any).userSession.deleteMany({
            where: { userId: targetUser.id },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_STATUS_CHANGED',
          entityType: 'User',
          entityId: targetUser.id,
          ipAddress: ip,
          payload: {
            statusAction: dto.action,
            reason: dto.reason,
            beforeSnapshot,
            afterSnapshot,
            activeSessionsRevoked: !isEnable,
          },
        },
      });

      return userRecord;
    });

    const historyCount = await this.countUserTransactionHistory(targetUser.id);
    return this.toPlatformUserSummaryDto(updated, historyCount);
  }

  async hardDeleteUser(
    actorAdminId: string,
    userId: string,
    dto: AdminHardDeleteUserRequestInput,
    ip: string
  ): Promise<{ id: string; deleted: boolean }> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: USER_NOT_FOUND,
        message: 'حساب المستخدم غير موجود',
      });
    }

    const historyCount = await this.countUserTransactionHistory(targetUser.id);
    if (historyCount > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_HARD_DELETE_BLOCKED',
          entityType: 'User',
          entityId: targetUser.id,
          ipAddress: ip,
          payload: {
            reason: dto.reason,
            historyCount,
            code: USER_HARD_DELETE_HISTORY_EXISTS,
          },
        },
      });

      throw new ConflictException({
        code: USER_HARD_DELETE_HISTORY_EXISTS,
        message:
          'لا يمكن الحذف النهائي لحساب المستخدم لوجود سجل معاملات مرتبط به؛ يرجى استخدام التعطيل أو الحذف الناعم',
        details: {
          historyCount,
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (tx.session && typeof tx.session.deleteMany === 'function') {
        await tx.session.deleteMany({
          where: { userId: targetUser.id },
        });
      }
      if (
        (tx as any).userSession &&
        typeof (tx as any).userSession.deleteMany === 'function'
      ) {
        await (tx as any).userSession.deleteMany({
          where: { userId: targetUser.id },
        });
      }

      await tx.user.delete({
        where: { id: targetUser.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_HARD_DELETED',
          entityType: 'User',
          entityId: targetUser.id,
          ipAddress: ip,
          payload: {
            deletedMobileNumber: targetUser.mobileNumber,
            deletedFullName: targetUser.fullName,
            reason: dto.reason,
          },
        },
      });
    });

    return {
      id: targetUser.id,
      deleted: true,
    };
  }
}

