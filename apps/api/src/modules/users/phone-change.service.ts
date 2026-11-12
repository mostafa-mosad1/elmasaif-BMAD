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
import { OtpService } from '../auth/otp/otp.service';
import {
  AdminRole,
  ACTIVE_DEAL_STATUSES,
  ProfileStatus,
  InitiatePhoneChangeInput,
  VerifyPhoneChangeOtpInput,
  ResendPhoneChangeOtpInput,
  AdminPhoneChangeInput,
  InitiatePhoneChangeResponse,
  VerifyPhoneChangeOtpResponse,
  PhoneChangeCompletionResponse,
  AUTH_PHONE_IN_USE,
  AUTH_PHONE_SAME_AS_CURRENT,
  AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
  AUTH_PHONE_CHANGE_EXPIRED,
  AUTH_PHONE_CHANGE_NOT_FOUND,
  AUTH_PHONE_CHANGE_ALREADY_VERIFIED,
  AUTH_PHONE_CHANGE_INITIATED,
  AUTH_PHONE_OLD_VERIFIED,
  AUTH_PHONE_NEW_VERIFIED,
  AUTH_PHONE_CHANGE_SUCCESS,
  ADMIN_PHONE_CHANGE_SUCCESS,
  PHONE_CHANGE_OTP_EXPIRY_SECONDS,
  AUTH_NOT_AUTHORIZED,
  resolveAdminPermissions,
} from '@elmasaif/shared';

@Injectable()
export class PhoneChangeService {
  private readonly logger = new Logger(PhoneChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly otpService: OtpService
  ) {}

  private maskSaudiMobile(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  }

  async isUserBoundToActiveDealOrDispute(userId: string): Promise<boolean> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { userId },
      select: { id: true }
    });
    const profileIds = userProfiles.map((p) => p.id);
    if (profileIds.length === 0) {
      return false;
    }

    const activeDeal = await this.prisma.deal.findFirst({
      where: {
        AND: [
          {
            OR: [
              { buyerProfileId: { in: profileIds } },
              { sellerProfileId: { in: profileIds } }
            ]
          },
          {
            OR: [
              // Story 5.1: the shared predicate. This guard previously omitted PAYMENT_REJECTED,
              // so a buyer under a rejected-payment deal could still move their mobile number.
              { status: { in: [...ACTIVE_DEAL_STATUSES] as any } },
              {
                disputes: {
                  some: { status: 'OPEN' }
                }
              }
            ]
          }
        ]
      }
    });

    return Boolean(activeDeal);
  }

  async initiatePhoneChange(
    userId: string,
    dto: InitiatePhoneChangeInput,
    ip?: string,
    userAgent?: string
  ): Promise<InitiatePhoneChangeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'المستخدم غير موجود'
      });
    }

    if (dto.newMobileNumber === user.mobileNumber) {
      throw new BadRequestException({
        code: AUTH_PHONE_SAME_AS_CURRENT,
        message: 'رقم الجوال الجديد مطابق لرقم الجوال الحالي المسجل'
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { mobileNumber: dto.newMobileNumber }
    });
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException({
        code: AUTH_PHONE_IN_USE,
        message: 'رقم الجوال المدخل مستخدم بالفعل في حساب آخر'
      });
    }

    const isDealBlocked = await this.isUserBoundToActiveDealOrDispute(userId);
    if (isDealBlocked) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'PHONE_CHANGE_BLOCKED_ACTIVE_DEAL',
          entityType: 'User',
          entityId: userId,
          ipAddress: ip || '127.0.0.1',
          payload: { reason: 'Active deal or dispute present' }
        }
      });

      throw new ConflictException({
        code: AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
        message: 'لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع'
      });
    }

    // Cancel any previous pending requests for this user
    await this.prisma.phoneChangeRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'CANCELLED' }
    });

    const now = this.clockService.now();
    const expiresAt = new Date(now.getTime() + PHONE_CHANGE_OTP_EXPIRY_SECONDS * 1000);

    const request = await this.prisma.phoneChangeRequest.create({
      data: {
        userId,
        oldPhoneNumber: user.mobileNumber,
        newPhoneNumber: dto.newMobileNumber,
        oldVerified: false,
        newVerified: false,
        isSupportAssisted: false,
        status: 'PENDING',
        expiresAt
      }
    });

    // Dispatch OTPs to both numbers
    await this.otpService.generateAndSendOtp(user.mobileNumber, 'PHONE_CHANGE_OLD', {
      requestId: request.id
    });
    const newOtpResult = await this.otpService.generateAndSendOtp(
      dto.newMobileNumber,
      'PHONE_CHANGE_NEW',
      { requestId: request.id }
    );

    this.logger.log(
      `[phone_change.initiated] Dual OTP dispatched for user ${userId} (old: ${user.mobileNumber}, new: ${dto.newMobileNumber}) from IP ${ip}`
    );

    return {
      code: AUTH_PHONE_CHANGE_INITIATED,
      message: 'تم إرسال رموز التحقق إلى رقم جوالك الحالي والرقم الجديد بنجاح',
      data: {
        requestId: request.id,
        oldPhoneNumberMasked: this.maskSaudiMobile(user.mobileNumber),
        newPhoneNumberMasked: this.maskSaudiMobile(dto.newMobileNumber),
        expiresInSeconds: PHONE_CHANGE_OTP_EXPIRY_SECONDS,
        resendAvailableInSeconds: newOtpResult.resendAvailableInSeconds || 60
      }
    };
  }

  async verifyOldPhoneOtp(
    userId: string,
    dto: VerifyPhoneChangeOtpInput,
    ip?: string
  ): Promise<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse> {
    const request = await this.prisma.phoneChangeRequest.findUnique({
      where: { id: dto.requestId }
    });

    if (!request || request.userId !== userId) {
      throw new NotFoundException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير موجود'
      });
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير صالح أو مكتمل مسبقاً'
      });
    }

    const now = this.clockService.now();
    if (now > request.expiresAt) {
      await this.prisma.phoneChangeRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' }
      });
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_EXPIRED,
        message: 'انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد'
      });
    }

    if (request.oldVerified) {
      return {
        code: AUTH_PHONE_OLD_VERIFIED,
        message: 'تم التحقق من رقم الجوال الحالي مسبقاً',
        data: {
          requestId: request.id,
          oldVerified: true,
          newVerified: request.newVerified,
          isCompleted: false
        }
      };
    }

    await this.otpService.verifyOtp(request.oldPhoneNumber, 'PHONE_CHANGE_OLD', dto.code);

    if (request.newVerified) {
      return await this.completePhoneChange(request.id, ip);
    }

    await this.prisma.phoneChangeRequest.update({
      where: { id: request.id },
      data: { oldVerified: true }
    });

    return {
      code: AUTH_PHONE_OLD_VERIFIED,
      message: 'تم التحقق من رقم الجوال الحالي بنجاح',
      data: {
        requestId: request.id,
        oldVerified: true,
        newVerified: request.newVerified,
        isCompleted: false
      }
    };
  }

  async verifyNewPhoneOtp(
    userId: string,
    dto: VerifyPhoneChangeOtpInput,
    ip?: string
  ): Promise<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse> {
    const request = await this.prisma.phoneChangeRequest.findUnique({
      where: { id: dto.requestId }
    });

    if (!request || request.userId !== userId) {
      throw new NotFoundException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير موجود'
      });
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير صالح أو مكتمل مسبقاً'
      });
    }

    const now = this.clockService.now();
    if (now > request.expiresAt) {
      await this.prisma.phoneChangeRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' }
      });
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_EXPIRED,
        message: 'انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد'
      });
    }

    if (request.newVerified) {
      return {
        code: AUTH_PHONE_NEW_VERIFIED,
        message: 'تم التحقق من رقم الجوال الجديد مسبقاً',
        data: {
          requestId: request.id,
          oldVerified: request.oldVerified,
          newVerified: true,
          isCompleted: false
        }
      };
    }

    await this.otpService.verifyOtp(request.newPhoneNumber, 'PHONE_CHANGE_NEW', dto.code);

    if (request.oldVerified) {
      return await this.completePhoneChange(request.id, ip);
    }

    await this.prisma.phoneChangeRequest.update({
      where: { id: request.id },
      data: { newVerified: true }
    });

    return {
      code: AUTH_PHONE_NEW_VERIFIED,
      message: 'تم التحقق من رقم الجوال الجديد بنجاح',
      data: {
        requestId: request.id,
        oldVerified: request.oldVerified,
        newVerified: true,
        isCompleted: false
      }
    };
  }

  async completePhoneChange(
    requestId: string,
    ip?: string
  ): Promise<PhoneChangeCompletionResponse> {
    const request = await this.prisma.phoneChangeRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new NotFoundException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير موجود'
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Re-verify uniqueness
      const existing = await tx.user.findUnique({
        where: { mobileNumber: request.newPhoneNumber }
      });
      if (existing && existing.id !== request.userId) {
        throw new ConflictException({
          code: AUTH_PHONE_IN_USE,
          message: 'رقم الجوال المدخل مستخدم بالفعل في حساب آخر'
        });
      }

      // Re-verify active deal guard
      const isBlocked = await this.isUserBoundToActiveDealOrDispute(request.userId);
      if (isBlocked) {
        throw new ConflictException({
          code: AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
          message: 'لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع'
        });
      }

      // Update User mobile number
      await tx.user.update({
        where: { id: request.userId },
        data: { mobileNumber: request.newPhoneNumber }
      });

      // Update PhoneChangeRequest status
      await tx.phoneChangeRequest.update({
        where: { id: request.id },
        data: {
          oldVerified: true,
          newVerified: true,
          status: 'COMPLETED'
        }
      });

      // Immutable AuditLog
      await tx.auditLog.create({
        data: {
          actorId: request.userId,
          actorType: 'USER',
          action: 'USER_PHONE_CHANGED',
          entityType: 'User',
          entityId: request.userId,
          ipAddress: ip || '127.0.0.1',
          payload: {
            oldPhoneNumber: request.oldPhoneNumber,
            newPhoneNumber: request.newPhoneNumber,
            method: 'DUAL_OTP'
          }
        }
      });

      // Clean up OTP records
      await tx.otpVerification.deleteMany({
        where: {
          OR: [
            { mobileNumber: request.oldPhoneNumber, purpose: 'PHONE_CHANGE_OLD' },
            { mobileNumber: request.newPhoneNumber, purpose: 'PHONE_CHANGE_NEW' }
          ]
        }
      });
    });

    this.logger.log(
      `[phone_change.completed] Phone updated for user ${request.userId} to ${request.newPhoneNumber} (IP: ${ip})`
    );

    return {
      code: AUTH_PHONE_CHANGE_SUCCESS,
      message: 'تم تحديث رقم الجوال بنجاح وربطه بحسابك',
      data: {
        mobileNumber: request.newPhoneNumber,
        isCompleted: true
      }
    };
  }

  async resendPhoneChangeOtp(
    userId: string,
    dto: ResendPhoneChangeOtpInput
  ): Promise<{ code: string; message: string; data: { resendAvailableInSeconds: number } }> {
    const request = await this.prisma.phoneChangeRequest.findUnique({
      where: { id: dto.requestId }
    });

    if (!request || request.userId !== userId) {
      throw new NotFoundException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير موجود'
      });
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_NOT_FOUND,
        message: 'طلب تغيير رقم الجوال غير صالح'
      });
    }

    const now = this.clockService.now();
    if (now > request.expiresAt) {
      await this.prisma.phoneChangeRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' }
      });
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_EXPIRED,
        message: 'انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد'
      });
    }

    if (
      (dto.target === 'OLD' && request.oldVerified) ||
      (dto.target === 'NEW' && request.newVerified)
    ) {
      throw new BadRequestException({
        code: AUTH_PHONE_CHANGE_ALREADY_VERIFIED,
        message: 'تم التحقق من هذا الرقم بالفعل'
      });
    }

    const targetPhone = dto.target === 'OLD' ? request.oldPhoneNumber : request.newPhoneNumber;
    const purpose = dto.target === 'OLD' ? 'PHONE_CHANGE_OLD' : 'PHONE_CHANGE_NEW';

    const result = await this.otpService.generateAndSendOtp(targetPhone, purpose, {
      requestId: request.id
    });

    return {
      code: 'SUCCESS',
      message: 'تم إرسال رمز التحقق بنجاح',
      data: {
        resendAvailableInSeconds: result.resendAvailableInSeconds
      }
    };
  }

  async adminPhoneChange(
    adminId: string,
    adminRole: AdminRole,
    targetUserId: string,
    dto: AdminPhoneChangeInput,
    ip?: string,
    adminPermissions?: string[]
  ): Promise<PhoneChangeCompletionResponse> {
    const effectivePermissions = resolveAdminPermissions(adminRole, adminPermissions);
    if (
      adminRole !== AdminRole.SUPER_ADMIN &&
      !effectivePermissions.includes('Users.PhoneChange')
    ) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'تتطلب هذه العملية صلاحية Users.PhoneChange المقتصرة على المشرف العام أو المفوضين'
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'المستخدم غير موجود'
      });
    }

    const inactiveStatuses = [
      ProfileStatus.DEACTIVATED,
      ProfileStatus.DISABLED,
      ProfileStatus.SOFT_DELETED
    ];
    if (inactiveStatuses.includes(targetUser.status as any)) {
      throw new BadRequestException({
        code: 'USER_ACCOUNT_INACTIVE',
        message: 'لا يمكن تحديث رقم جوال لحساب معطل أو محذوف'
      });
    }

    if (dto.newMobileNumber === targetUser.mobileNumber) {
      throw new BadRequestException({
        code: AUTH_PHONE_SAME_AS_CURRENT,
        message: 'رقم الجوال الجديد مطابق لرقم الجوال الحالي المسجل'
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { mobileNumber: dto.newMobileNumber }
    });
    if (existingUser && existingUser.id !== targetUserId) {
      throw new ConflictException({
        code: AUTH_PHONE_IN_USE,
        message: 'رقم الجوال المدخل مستخدم بالفعل في حساب آخر'
      });
    }

    const isDealBlocked = await this.isUserBoundToActiveDealOrDispute(targetUserId);
    if (isDealBlocked) {
      throw new ConflictException({
        code: AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
        message: 'لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع'
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Update target user mobile number
      await tx.user.update({
        where: { id: targetUserId },
        data: { mobileNumber: dto.newMobileNumber }
      });

      // Cancel any prior pending requests
      await tx.phoneChangeRequest.updateMany({
        where: { userId: targetUserId, status: 'PENDING' },
        data: { status: 'CANCELLED' }
      });

      // Create support-assisted record
      await tx.phoneChangeRequest.create({
        data: {
          userId: targetUserId,
          oldPhoneNumber: targetUser.mobileNumber,
          newPhoneNumber: dto.newMobileNumber,
          oldVerified: false,
          newVerified: true,
          isSupportAssisted: true,
          supportReason: dto.reason,
          adminId,
          status: 'COMPLETED',
          expiresAt: this.clockService.now()
        }
      });

      // Immutable AuditLog
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'ADMIN_PHONE_CHANGED',
          entityType: 'User',
          entityId: targetUserId,
          ipAddress: ip || '127.0.0.1',
          payload: {
            oldPhoneNumber: targetUser.mobileNumber,
            newPhoneNumber: dto.newMobileNumber,
            reason: dto.reason,
            adminRole,
            officialIdVerified: true
          }
        }
      });
    });

    this.logger.log(
      `[admin.phone_change] Support-assisted phone change completed by admin ${adminId} for user ${targetUserId} to ${dto.newMobileNumber}`
    );

    return {
      code: ADMIN_PHONE_CHANGE_SUCCESS,
      message: 'تم تحديث رقم جوال المستخدم بنجاح عبر الدعم الفني وتوثيق سجل الرقابة',
      data: {
        mobileNumber: dto.newMobileNumber,
        isCompleted: true
      }
    };
  }
}
