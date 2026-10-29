import { Injectable, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { OTP_PROVIDER_TOKEN, OtpProvider } from './otp-provider.interface';
import {
  OTP_EXPIRY_SECONDS,
  OTP_THROTTLE_SECONDS,
  OTP_MAX_HOURLY_REQUESTS,
  OTP_LOCKOUT_ATTEMPTS,
  OTP_LOCKOUT_MINUTES,
  STATIC_DEV_OTP,
  AUTH_OTP_LOCKED,
  AUTH_OTP_THROTTLED,
  AUTH_OTP_MAX_EXCEEDED,
  AUTH_OTP_EXPIRED,
  AUTH_OTP_INVALID
} from '@elmasaif/shared';

export const HTTP_STATUS_LOCKED = 423;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    @Inject(OTP_PROVIDER_TOKEN) private readonly otpProvider: OtpProvider
  ) {}

  async generateAndSendOtp(
    mobileNumber: string,
    purpose: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; resendAvailableInSeconds: number }> {
    const now = this.clockService.now();

    const existing = await this.prisma.otpVerification.findFirst({
      where: { mobileNumber, purpose }
    });

    if (existing?.lockedUntil && existing.lockedUntil > now) {
      throw new HttpException(
        {
          code: AUTH_OTP_LOCKED,
          message: 'تم قفل التحقق مؤقتاً لتجاوز عدد المحاولات المسموح به. يرجى المحاولة لاحقاً',
          details: { lockedUntil: existing.lockedUntil }
        },
        HTTP_STATUS_LOCKED
      );
    }

    if (existing?.resendAvailableAt && existing.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          code: AUTH_OTP_THROTTLED,
          message: `يرجى الانتظار ${waitSeconds} ثانية قبل طلب رمز تحقق جديد`,
          details: { retryAfterSeconds: waitSeconds }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    let hourlyCount = 1;
    if (existing?.lastSentAt && (now.getTime() - existing.lastSentAt.getTime() < 3600 * 1000)) {
      if (existing.hourlyCount >= OTP_MAX_HOURLY_REQUESTS) {
        throw new HttpException(
          {
            code: AUTH_OTP_MAX_EXCEEDED,
            message: 'تم تجاوز الحد الأقصى لطلبات رمز التحقق خلال هذه الساعة (3 محاولات كحد أقصى)',
            details: { maxHourlyRequests: OTP_MAX_HOURLY_REQUESTS }
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      hourlyCount = existing.hourlyCount + 1;
    }

    const enableStaticOtp = this.configService.get<string>('ENABLE_STATIC_OTP') === 'true' ||
      this.configService.get<string>('OTP_PROVIDER') === 'static';

    const otpCode = enableStaticOtp
      ? STATIC_DEV_OTP
      : crypto.randomInt(100000, 1000000).toString();

    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + OTP_THROTTLE_SECONDS * 1000);

    const recordId = existing ? existing.id : crypto.randomUUID();

    await this.prisma.otpVerification.upsert({
      where: { id: recordId },
      create: {
        id: recordId,
        mobileNumber,
        purpose,
        otpCode,
        attempts: 0,
        maxAttempts: OTP_LOCKOUT_ATTEMPTS,
        expiresAt,
        resendAvailableAt,
        lockedUntil: null,
        hourlyCount,
        lastSentAt: now,
        metadata: metadata || undefined
      },
      update: {
        otpCode,
        attempts: 0,
        expiresAt,
        resendAvailableAt,
        lockedUntil: null,
        hourlyCount,
        lastSentAt: now,
        metadata: metadata || undefined
      }
    });

    await this.otpProvider.sendOtp(mobileNumber, otpCode);

    return {
      success: true,
      resendAvailableInSeconds: OTP_THROTTLE_SECONDS
    };
  }

  async verifyOtp(
    mobileNumber: string,
    purpose: string,
    code: string
  ): Promise<any> {
    const now = this.clockService.now();

    const record = await this.prisma.otpVerification.findFirst({
      where: { mobileNumber, purpose }
    });

    if (!record) {
      throw new HttpException(
        {
          code: AUTH_OTP_EXPIRED,
          message: 'رمز التحقق غير موجود أو منتهي الصلاحية'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (record.lockedUntil && record.lockedUntil > now) {
      throw new HttpException(
        {
          code: AUTH_OTP_LOCKED,
          message: 'تم قفل التحقق مؤقتاً لتجاوز عدد المحاولات المسموح به. يرجى المحاولة لاحقاً',
          details: { lockedUntil: record.lockedUntil }
        },
        HTTP_STATUS_LOCKED
      );
    }

    if (now > record.expiresAt) {
      throw new HttpException(
        {
          code: AUTH_OTP_EXPIRED,
          message: 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (record.otpCode !== code) {
      const newAttempts = record.attempts + 1;
      if (newAttempts >= OTP_LOCKOUT_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + OTP_LOCKOUT_MINUTES * 60 * 1000);
        await this.prisma.otpVerification.update({
          where: { id: record.id },
          data: {
            attempts: newAttempts,
            lockedUntil
          }
        });

        throw new HttpException(
          {
            code: AUTH_OTP_LOCKED,
            message: 'تم قفل التحقق لمدة 15 دقيقة بعد استنفاد 3 محاولات خاطئة',
            details: { lockedUntil }
          },
          HTTP_STATUS_LOCKED
        );
      }

      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: newAttempts }
      });

      const remainingAttempts = OTP_LOCKOUT_ATTEMPTS - newAttempts;
      throw new HttpException(
        {
          code: AUTH_OTP_INVALID,
          message: `رمز التحقق غير صحيح. متبقي ${remainingAttempts} محاولات`,
          details: { remainingAttempts }
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return record;
  }

  async cleanupOtp(id: string): Promise<void> {
    try {
      await this.prisma.otpVerification.delete({ where: { id } });
    } catch (error) {
      this.logger.warn(`Failed to cleanup OTP record ${id}: ${error}`);
    }
  }
}
