import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { OtpService } from '../auth/otp/otp.service';
import {
  UserRole,
  DealStatus,
  validateSaudiIban,
  getSaudiBankName,
  formatSaudiIban,
  maskSaudiIban,
  CreatePayoutAccountInput,
  UpdatePayoutAccountInput,
  PayoutAccountResponse,
  PAYOUT_INVALID_IBAN,
  PAYOUT_ROLE_NOT_AUTHORIZED,
  PAYOUT_ACTIVE_DEAL_RESTRICTION,
  PAYOUT_ACCOUNT_NOT_FOUND,
  AUTH_PROFILE_NOT_FOUND
} from '@elmasaif/shared';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly cryptoService: CryptoService,
    private readonly otpService: OtpService
  ) {}

  private validateSellerRole(role: UserRole): void {
    if (role !== UserRole.MARKETER && role !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: PAYOUT_ROLE_NOT_AUTHORIZED,
        message: 'إدارة حسابات التحويل البنكي مقتصرة على المسوقين وملاك العقارات'
      });
    }
  }

  async requestPayoutOtp(userId: string): Promise<{ success: boolean; resendAvailableInSeconds: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'المستخدم غير موجود'
      });
    }

    const result = await this.otpService.generateAndSendOtp(
      user.mobileNumber,
      'PAYOUT_ACCOUNT_UPDATE'
    );

    return {
      success: true,
      resendAvailableInSeconds: result.resendAvailableInSeconds
    };
  }

  async isAccountBoundToActiveDeal(profileId: string): Promise<boolean> {
    const activeDeal = await this.prisma.deal.findFirst({
      where: {
        sellerProfileId: profileId,
        status: {
          in: [
            DealStatus.AWAITING_PAYMENT_PROOF,
            DealStatus.UNDER_ADMIN_AUDIT,
            DealStatus.PAYMENT_REJECTED
          ]
        }
      }
    });

    return Boolean(activeDeal);
  }

  async getPayoutAccounts(userId: string, activeRole: UserRole): Promise<PayoutAccountResponse[]> {
    this.validateSellerRole(activeRole);

    const profile = await this.prisma.userProfile.findUnique({
      where: {
        userId_role: {
          userId,
          role: activeRole
        }
      }
    });

    if (!profile) {
      throw new NotFoundException({
        code: AUTH_PROFILE_NOT_FOUND,
        message: 'ملف المستخدم غير موجود'
      });
    }

    const accounts = await this.prisma.payoutAccount.findMany({
      where: { profileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    const isBound = await this.isAccountBoundToActiveDeal(profile.id);

    return accounts.map((acc: any) => {
      let formatted: string | undefined;
      try {
        const plain = this.cryptoService.decrypt(acc.ibanEncrypted);
        formatted = formatSaudiIban(plain);
      } catch (err) {
        this.logger.error(`Error decrypting payout account ${acc.id}: ${(err as Error).message}`);
      }

      return {
        id: acc.id,
        profileId: acc.profileId,
        accountHolderName: acc.accountHolderName,
        bankName: acc.bankName,
        ibanMasked: acc.ibanMasked,
        ibanLast4: acc.ibanLast4,
        ibanFormatted: formatted,
        isDefault: acc.isDefault,
        hasCommercialNameMismatch: acc.hasCommercialNameMismatch,
        isBoundToActiveDeal: isBound,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      };
    });
  }

  async createPayoutAccount(
    userId: string,
    activeRole: UserRole,
    input: CreatePayoutAccountInput
  ): Promise<{ account: PayoutAccountResponse; warning?: string; warningMessage?: string }> {
    this.validateSellerRole(activeRole);

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
        code: 'USER_NOT_FOUND',
        message: 'المستخدم غير موجود'
      });
    }

    const profile = user.profiles.find((p: any) => p.role === activeRole);
    if (!profile) {
      throw new NotFoundException({
        code: AUTH_PROFILE_NOT_FOUND,
        message: 'الملف الشخصي للدور المحدد غير موجود'
      });
    }

    // Step-up OTP verification
    await this.otpService.verifyOtp(user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE', input.otpCode);

    // Mod-97 checksum validation
    if (!validateSaudiIban(input.iban)) {
      throw new BadRequestException({
        code: PAYOUT_INVALID_IBAN,
        message: 'رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)'
      });
    }

    const cleanIban = input.iban.replace(/\s+/g, '').toUpperCase();
    const bankName = getSaudiBankName(cleanIban);
    const ibanLast4 = cleanIban.substring(cleanIban.length - 4);
    const ibanMasked = maskSaudiIban(cleanIban);
    const ibanEncrypted = this.cryptoService.encrypt(cleanIban);

    // Commercial name mismatch check
    const normalizedHolderName = input.accountHolderName.trim().toLowerCase();
    const normalizedUserFullName = (user.fullName || '').trim().toLowerCase();
    const normalizedCommercialName = (profile.falLicense?.commercialName || '').trim().toLowerCase();

    let hasCommercialNameMismatch = false;
    if (
      normalizedHolderName !== normalizedUserFullName &&
      (!normalizedCommercialName || normalizedHolderName !== normalizedCommercialName)
    ) {
      hasCommercialNameMismatch = true;
    }

    const existingCount = await this.prisma.payoutAccount.count({
      where: { profileId: profile.id }
    });

    const isDefault = existingCount === 0 ? true : Boolean(input.isDefault);

    const result = await this.prisma.$transaction(async (tx: any) => {
      if (isDefault) {
        await tx.payoutAccount.updateMany({
          where: { profileId: profile.id, isDefault: true },
          data: { isDefault: false }
        });

        await tx.userProfile.update({
          where: { id: profile.id },
          data: { payoutIban: ibanMasked }
        });
      }

      const account = await tx.payoutAccount.create({
        data: {
          profileId: profile.id,
          accountHolderName: input.accountHolderName.trim(),
          bankName,
          ibanEncrypted,
          ibanMasked,
          ibanLast4,
          isDefault,
          hasCommercialNameMismatch
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PAYOUT_ACCOUNT_CREATED',
          entityType: 'PayoutAccount',
          entityId: account.id,
          payload: {
            accountHolderName: account.accountHolderName,
            bankName: account.bankName,
            ibanMasked: account.ibanMasked,
            isDefault: account.isDefault,
            hasCommercialNameMismatch: account.hasCommercialNameMismatch
          }
        }
      });

      if (hasCommercialNameMismatch) {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            actorType: 'USER',
            action: 'PAYOUT_NAME_MISMATCH_WARNING',
            entityType: 'PayoutAccount',
            entityId: account.id,
            payload: {
              accountHolderName: input.accountHolderName,
              userFullName: user.fullName,
              commercialName: profile.falLicense?.commercialName || null
            }
          }
        });
      }

      return account;
    });

    return {
      account: {
        id: result.id,
        profileId: result.profileId,
        accountHolderName: result.accountHolderName,
        bankName: result.bankName,
        ibanMasked: result.ibanMasked,
        ibanLast4: result.ibanLast4,
        ibanFormatted: formatSaudiIban(cleanIban),
        isDefault: result.isDefault,
        hasCommercialNameMismatch: result.hasCommercialNameMismatch,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      },
      warning: hasCommercialNameMismatch ? 'ACCOUNT_HOLDER_NAME_MISMATCH' : undefined,
      warningMessage: hasCommercialNameMismatch
        ? 'تنبيه: اسم صاحب الحساب البنكي لا يتطابق تماماً مع الاسم المسجل بالمنصة. سيتم التحقق الإضافي عند تدقيق المدفوعات'
        : undefined
    };
  }

  async updatePayoutAccount(
    userId: string,
    activeRole: UserRole,
    accountId: string,
    input: UpdatePayoutAccountInput
  ): Promise<PayoutAccountResponse> {
    this.validateSellerRole(activeRole);

    const account = await this.prisma.payoutAccount.findUnique({
      where: { id: accountId },
      include: {
        profile: {
          include: {
            user: true,
            falLicense: true
          }
        }
      }
    });

    if (!account || account.profile.userId !== userId || account.profile.role !== activeRole) {
      throw new NotFoundException({
        code: PAYOUT_ACCOUNT_NOT_FOUND,
        message: 'الحساب البنكي غير موجود أو غير تابع لهذا الحساب'
      });
    }

    // Active non-terminal deal restriction (AC: 5)
    const isBound = await this.isAccountBoundToActiveDeal(account.profileId);
    if (isBound) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PAYOUT_MODIFICATION_BLOCKED_ACTIVE_DEAL',
          entityType: 'PayoutAccount',
          entityId: account.id,
          payload: {
            profileId: account.profileId,
            reason: 'Seller has active deals in progress'
          }
        }
      });

      throw new ConflictException({
        code: PAYOUT_ACTIVE_DEAL_RESTRICTION,
        message: 'لا يمكن تعديل أو حذف الحساب البنكي لوجود صفقات نشطة قيد التنفيذ'
      });
    }

    // Step-up OTP verification
    await this.otpService.verifyOtp(account.profile.user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE', input.otpCode);

    const updateData: any = {};
    let cleanIban: string | undefined;

    if (input.iban) {
      if (!validateSaudiIban(input.iban)) {
        throw new BadRequestException({
          code: PAYOUT_INVALID_IBAN,
          message: 'رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)'
        });
      }

      cleanIban = input.iban.replace(/\s+/g, '').toUpperCase();
      updateData.bankName = getSaudiBankName(cleanIban);
      updateData.ibanEncrypted = this.cryptoService.encrypt(cleanIban);
      updateData.ibanMasked = maskSaudiIban(cleanIban);
      updateData.ibanLast4 = cleanIban.substring(cleanIban.length - 4);
    }

    if (input.accountHolderName) {
      const holderName = input.accountHolderName.trim();
      updateData.accountHolderName = holderName;

      const normalizedHolderName = holderName.toLowerCase();
      const normalizedUserFullName = (account.profile.user.fullName || '').trim().toLowerCase();
      const normalizedCommercialName = (account.profile.falLicense?.commercialName || '').trim().toLowerCase();

      updateData.hasCommercialNameMismatch =
        normalizedHolderName !== normalizedUserFullName &&
        (!normalizedCommercialName || normalizedHolderName !== normalizedCommercialName);
    }

    if (input.isDefault !== undefined) {
      updateData.isDefault = input.isDefault;
    }

    const updated = await this.prisma.$transaction(async (tx: any) => {
      if (input.isDefault) {
        await tx.payoutAccount.updateMany({
          where: { profileId: account.profileId, isDefault: true, id: { not: account.id } },
          data: { isDefault: false }
        });

        await tx.userProfile.update({
          where: { id: account.profileId },
          data: { payoutIban: updateData.ibanMasked || account.ibanMasked }
        });
      }

      const res = await tx.payoutAccount.update({
        where: { id: account.id },
        data: updateData
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PAYOUT_ACCOUNT_UPDATED',
          entityType: 'PayoutAccount',
          entityId: account.id,
          payload: {
            updatedFields: Object.keys(updateData)
          }
        }
      });

      return res;
    });

    const plain = cleanIban || this.cryptoService.decrypt(updated.ibanEncrypted);

    return {
      id: updated.id,
      profileId: updated.profileId,
      accountHolderName: updated.accountHolderName,
      bankName: updated.bankName,
      ibanMasked: updated.ibanMasked,
      ibanLast4: updated.ibanLast4,
      ibanFormatted: formatSaudiIban(plain),
      isDefault: updated.isDefault,
      hasCommercialNameMismatch: updated.hasCommercialNameMismatch,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  async deletePayoutAccount(
    userId: string,
    activeRole: UserRole,
    accountId: string,
    otpCode: string
  ): Promise<{ success: boolean; message: string }> {
    this.validateSellerRole(activeRole);

    const account = await this.prisma.payoutAccount.findUnique({
      where: { id: accountId },
      include: {
        profile: {
          include: {
            user: true
          }
        }
      }
    });

    if (!account || account.profile.userId !== userId || account.profile.role !== activeRole) {
      throw new NotFoundException({
        code: PAYOUT_ACCOUNT_NOT_FOUND,
        message: 'الحساب البنكي غير موجود أو غير تابع لهذا الحساب'
      });
    }

    // Active non-terminal deal restriction
    const isBound = await this.isAccountBoundToActiveDeal(account.profileId);
    if (isBound) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PAYOUT_MODIFICATION_BLOCKED_ACTIVE_DEAL',
          entityType: 'PayoutAccount',
          entityId: account.id,
          payload: {
            profileId: account.profileId,
            reason: 'Seller has active deals in progress'
          }
        }
      });

      throw new ConflictException({
        code: PAYOUT_ACTIVE_DEAL_RESTRICTION,
        message: 'لا يمكن تعديل أو حذف الحساب البنكي لوجود صفقات نشطة قيد التنفيذ'
      });
    }

    // Step-up OTP verification
    await this.otpService.verifyOtp(account.profile.user.mobileNumber, 'PAYOUT_ACCOUNT_UPDATE', otpCode);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.payoutAccount.delete({
        where: { id: account.id }
      });

      if (account.isDefault) {
        // Designate another account if available
        const nextAccount = await tx.payoutAccount.findFirst({
          where: { profileId: account.profileId },
          orderBy: { createdAt: 'desc' }
        });

        if (nextAccount) {
          await tx.payoutAccount.update({
            where: { id: nextAccount.id },
            data: { isDefault: true }
          });
          await tx.userProfile.update({
            where: { id: account.profileId },
            data: { payoutIban: nextAccount.ibanMasked }
          });
        } else {
          await tx.userProfile.update({
            where: { id: account.profileId },
            data: { payoutIban: null }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PAYOUT_ACCOUNT_DELETED',
          entityType: 'PayoutAccount',
          entityId: account.id,
          payload: {
            deletedAccountHolderName: account.accountHolderName,
            bankName: account.bankName,
            ibanLast4: account.ibanLast4
          }
        }
      });
    });

    return {
      success: true,
      message: 'تم حذف الحساب البنكي بنجاح'
    };
  }
}

