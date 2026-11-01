import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  UserRole,
  UpdateUserProfileInput,
  VerifyEmailInput,
  UpdateUserProfileResponse,
  VerifyEmailResponse,
  ResendEmailVerificationResponse,
  CancelPendingEmailResponse,
  AUTH_EMAIL_IN_USE,
  AUTH_EMAIL_SAME_AS_CURRENT,
  AUTH_EMAIL_VERIFICATION_INITIATED,
  AUTH_EMAIL_VERIFICATION_EXPIRED,
  AUTH_EMAIL_VERIFICATION_INVALID,
  AUTH_EMAIL_VERIFICATION_STALE,
  AUTH_EMAIL_VERIFIED_SUCCESS,
  AUTH_EMAIL_VERIFICATION_RESENT,
  AUTH_EMAIL_PENDING_CANCELLED,
  AUTH_NO_PENDING_EMAIL,
  AUTH_OTP_THROTTLED,
  EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
} from '@elmasaif/shared';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly resendCooldowns = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService
  ) {}

  private getSecret(): string {
    return (
      this.configService.get<string>('SESSION_SECRET') ||
      process.env.SESSION_SECRET ||
      'super-secret-session-key-for-elmasaif-2026-development'
    );
  }

  generateEmailVerificationToken(userId: string, pendingEmail: string): string {
    const payload = {
      userId,
      pendingEmail,
      exp: this.clockService.now().getTime() + EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS * 1000
    };
    const secret = this.getSecret();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
  }

  verifyEmailVerificationToken(token: string): {
    userId: string;
    pendingEmail: string;
    exp: number;
  } {
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);
      const { payload, signature } = parsed;

      if (!payload || !signature || !payload.userId || !payload.pendingEmail || !payload.exp) {
        throw new Error('Malformed token payload');
      }

      const secret = this.getSecret();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        throw new HttpException(
          {
            code: AUTH_EMAIL_VERIFICATION_INVALID,
            message: 'رابط التحقق من البريد الإلكتروني غير صالح أو تم التلاعب به'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const expMs = payload.exp > 1e11 ? payload.exp : payload.exp * 1000;
      if (this.clockService.now().getTime() > expMs) {
        throw new HttpException(
          {
            code: AUTH_EMAIL_VERIFICATION_EXPIRED,
            message:
              'انتهت صلاحية رابط التحقق من البريد الإلكتروني (24 ساعة). يرجى طلب رابط جديد'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          code: AUTH_EMAIL_VERIFICATION_INVALID,
          message: 'رابط التحقق من البريد الإلكتروني غير صالح'
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async getProfile(userId: string) {
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
      throw new NotFoundException('المستخدم غير موجود');
    }

    const marketerProfile = user.profiles.find(
      (p) => p.role === UserRole.MARKETER && p.falLicense
    );

    let hasCommercialNameMismatch = false;
    let commercialNameMismatchNotice: string | undefined;

    if (marketerProfile?.falLicense?.commercialName) {
      const commercialName = marketerProfile.falLicense.commercialName.trim().toLowerCase();
      const currentFullName = user.fullName.trim().toLowerCase();
      if (currentFullName !== commercialName) {
        hasCommercialNameMismatch = true;
        commercialNameMismatchNotice =
          'تنبيه: الاسم المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال. تم تسجيل إشعار رقابي للمطابقة الإدارية';
      }
    }

    return {
      code: 'PROFILE_FETCH_SUCCESS',
      message: 'تم استرجاع بيانات الملف الشخصي بنجاح',
      data: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        mobileNumber: user.mobileNumber,
        nationalId: user.nationalId,
        email: user.email,
        pendingEmail: user.pendingEmail,
        isEmailPending: Boolean(user.pendingEmail),
        emailVerifiedAt: user.emailVerifiedAt,
        hasCommercialNameMismatch,
        commercialNameMismatchNotice
      }
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileInput,
    ip?: string,
    userAgent?: string
  ): Promise<UpdateUserProfileResponse> {
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
      throw new NotFoundException('المستخدم غير موجود');
    }

    const updates: { fullName?: string; pendingEmail?: string } = {};
    let hasCommercialNameMismatch = false;
    let commercialNameMismatchNotice: string | undefined;

    // 1. Process Full Name Update
    if (dto.fullName !== undefined) {
      const trimmedFullName = dto.fullName.trim();

      const marketerProfile = user.profiles.find(
        (p) => p.role === UserRole.MARKETER && p.falLicense
      );

      if (marketerProfile?.falLicense?.commercialName) {
        const commercialName = marketerProfile.falLicense.commercialName.trim().toLowerCase();
        const candidateName = trimmedFullName.toLowerCase();

        if (candidateName !== commercialName) {
          hasCommercialNameMismatch = true;
          commercialNameMismatchNotice =
            'تنبيه: الاسم المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال. تم تسجيل إشعار رقابي للمطابقة الإدارية';

          await this.prisma.auditLog.create({
            data: {
              actorId: user.id,
              actorType: 'USER',
              action: 'PROFILE_NAME_MISMATCH_WARNING',
              entityType: 'User',
              entityId: user.id,
              ipAddress: ip || null,
              payload: {
                newFullName: trimmedFullName,
                commercialName: marketerProfile.falLicense.commercialName,
                falLicenseNumber: marketerProfile.falLicense.licenseNumber
              }
            }
          });
        }
      }

      if (trimmedFullName !== user.fullName) {
        updates.fullName = trimmedFullName;
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            actorType: 'USER',
            action: 'USER_PROFILE_UPDATED',
            entityType: 'User',
            entityId: user.id,
            ipAddress: ip || null,
            payload: {
              field: 'fullName',
              oldValue: user.fullName,
              newValue: trimmedFullName,
              userAgent: userAgent || null
            }
          }
        });
      }
    }

    // 2. Process Contact Email Update
    let isEmailInitiated = false;
    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();

      if (user.email && normalizedEmail === user.email.trim().toLowerCase()) {
        throw new HttpException(
          {
            code: AUTH_EMAIL_SAME_AS_CURRENT,
            message: 'البريد الإلكتروني المدخل مطابق للبريد الحالي المسجل'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: userId }
        }
      });

      if (existingUser) {
        throw new HttpException(
          {
            code: AUTH_EMAIL_IN_USE,
            message: 'البريد الإلكتروني المدخل مستخدم بالفعل في حساب آخر'
          },
          HttpStatus.CONFLICT
        );
      }

      updates.pendingEmail = normalizedEmail;
      isEmailInitiated = true;

      const token = this.generateEmailVerificationToken(userId, normalizedEmail);
      this.logger.log(
        `[auth.email_verification] Resend link: /auth/verify-email?token= (IP: )${token}`
      );

      this.resendCooldowns.set(
        userId,
        this.clockService.now().getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000
      );

      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'USER',
          action: 'USER_EMAIL_CHANGE_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ip || null,
          payload: {
            currentEmail: user.email,
            pendingEmail: normalizedEmail,
            expiresInSeconds: EMAIL_VERIFICATION_TOKEN_EXPIRY_SECONDS
          }
        }
      });
    }

    let updatedUser: any = user;
    if (Object.keys(updates).length > 0) {
      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updates
      });
    }

    if (isEmailInitiated) {
      return {
        code: AUTH_EMAIL_VERIFICATION_INITIATED,
        message:
          'تم حفظ الاسم وإرسال رابط تأكيد إلى بريدك الإلكتروني الجديد. يرجى تفعيله خلال 24 ساعة',
        data: {
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          pendingEmail: updatedUser.pendingEmail,
          isEmailPending: true,
          emailVerifiedAt: updatedUser.emailVerifiedAt,
          hasCommercialNameMismatch,
          commercialNameMismatchNotice
        }
      };
    }

    return {
      code: 'USER_PROFILE_UPDATED',
      message: 'تم تحديث البيانات الشخصية بنجاح',
      data: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        pendingEmail: updatedUser.pendingEmail,
        isEmailPending: Boolean(updatedUser.pendingEmail),
        emailVerifiedAt: updatedUser.emailVerifiedAt,
        hasCommercialNameMismatch,
        commercialNameMismatchNotice
      }
    };
  }

  async verifyEmail(dto: VerifyEmailInput, ip?: string): Promise<VerifyEmailResponse> {
    const payload = this.verifyEmailVerificationToken(dto.token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user || !user.pendingEmail || user.pendingEmail !== payload.pendingEmail) {
      throw new HttpException(
        {
          code: AUTH_EMAIL_VERIFICATION_STALE,
          message: 'طلب التحقق من البريد الإلكتروني غير متطابق أو تم إلغاؤه مسبقاً'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Verify interim conflict
    const conflictUser = await this.prisma.user.findFirst({
      where: {
        email: payload.pendingEmail,
        id: { not: user.id }
      }
    });

    if (conflictUser) {
      throw new HttpException(
        {
          code: AUTH_EMAIL_IN_USE,
          message: 'البريد الإلكتروني مستخدم بالفعل في حساب آخر'
        },
        HttpStatus.CONFLICT
      );
    }

    const now = this.clockService.now();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          emailVerifiedAt: now
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'USER',
          action: 'USER_EMAIL_VERIFIED',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ip || null,
          payload: {
            oldEmail: user.email,
            newEmail: user.pendingEmail,
            verifiedAt: now
          }
        }
      });
    });

    this.resendCooldowns.delete(user.id);

    return {
      code: AUTH_EMAIL_VERIFIED_SUCCESS,
      message: 'تم تأكيد البريد الإلكتروني بنجاح وتحديث بيانات الحساب',
      data: {
        email: payload.pendingEmail,
        emailVerifiedAt: now
      }
    };
  }

  async resendVerificationEmail(
    userId: string,
    ip?: string
  ): Promise<ResendEmailVerificationResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (!user.pendingEmail) {
      throw new HttpException(
        {
          code: AUTH_NO_PENDING_EMAIL,
          message: 'لا يوجد بريد إلكتروني معلق بانتظار التحقق'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const nowMs = this.clockService.now().getTime();
    const cooldownUntil = this.resendCooldowns.get(userId);

    if (cooldownUntil && cooldownUntil > nowMs) {
      const waitSeconds = Math.ceil((cooldownUntil - nowMs) / 1000);
      throw new HttpException(
        {
          code: AUTH_OTP_THROTTLED,
          message: `يرجى الانتظار ${waitSeconds} ثانية قبل إعادة إرسال الرابط`,
          details: { retryAfterSeconds: waitSeconds }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    this.resendCooldowns.set(
      userId,
      nowMs + EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000
    );

    const token = this.generateEmailVerificationToken(userId, user.pendingEmail);
    this.logger.log(
      `[auth.email_verification] Resend link: /auth/verify-email?token=${token} (IP: ${ip || 'unknown'})`
    );

    return {
      code: AUTH_EMAIL_VERIFICATION_RESENT,
      message: 'تم إعادة إرسال رابط التحقق إلى بريدك الإلكتروني بنجاح',
      data: {
        resendAvailableInSeconds: EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
      }
    };
  }

  async cancelPendingEmail(
    userId: string,
    ip?: string
  ): Promise<CancelPendingEmailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (!user.pendingEmail) {
      throw new HttpException(
        {
          code: AUTH_NO_PENDING_EMAIL,
          message: 'لا يوجد بريد إلكتروني معلق بانتظار التحقق'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const cancelledPendingEmail = user.pendingEmail;

    await this.prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: null }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: 'USER',
        action: 'USER_EMAIL_CHANGE_CANCELLED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip || null,
        payload: { cancelledPendingEmail }
      }
    });

    this.resendCooldowns.delete(userId);

    return {
      code: AUTH_EMAIL_PENDING_CANCELLED,
      message: 'تم إلغاء طلب تحديث البريد الإلكتروني المعلق بنجاح'
    };
  }
}
