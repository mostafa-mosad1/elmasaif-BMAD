import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { OtpService } from './otp/otp.service';
import {
  RegisterInput,
  VerifyOtpRegisterInput,
  ResendOtpInput,
  SessionUser,
  DEFAULT_TERMS_VERSION,
  DEFAULT_PRIVACY_VERSION,
  SESSION_EXPIRY_DAYS,
  AUTH_PHONE_ALREADY_EXISTS,
  AUTH_NATIONAL_ID_ALREADY_EXISTS,
  AUTH_USERNAME_ALREADY_EXISTS,
  AUTH_OTP_EXPIRED
} from '@elmasaif/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly otpService: OtpService
  ) {}

  async register(
    dto: RegisterInput,
    ip: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; mobileNumber: string; resendAvailableInSeconds: number }> {
    // 1. Verify uniqueness against active users
    const existingMobile = await this.prisma.user.findFirst({
      where: { mobileNumber: dto.mobileNumber }
    });
    if (existingMobile) {
      throw new HttpException(
        {
          code: AUTH_PHONE_ALREADY_EXISTS,
          message: 'رقم الجوال مسجل مسبقاً في المنصة'
        },
        HttpStatus.CONFLICT
      );
    }

    const existingNationalId = await this.prisma.user.findFirst({
      where: { nationalId: dto.nationalId }
    });
    if (existingNationalId) {
      throw new HttpException(
        {
          code: AUTH_NATIONAL_ID_ALREADY_EXISTS,
          message: 'رقم الهوية الوطنية أو الإقامة مسجل مسبقاً في المنصة'
        },
        HttpStatus.CONFLICT
      );
    }

    if (dto.username) {
      const existingUsername = await this.prisma.user.findFirst({
        where: { username: dto.username }
      });
      if (existingUsername) {
        throw new HttpException(
          {
            code: AUTH_USERNAME_ALREADY_EXISTS,
            message: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر'
          },
          HttpStatus.CONFLICT
        );
      }
    }

    // 2. Hash password with Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id
    });

    // 3. Store pending registration in OTP metadata
    const metadata = {
      fullName: dto.fullName,
      mobileNumber: dto.mobileNumber,
      nationalId: dto.nationalId,
      username: dto.username,
      passwordHash,
      termsVersion: DEFAULT_TERMS_VERSION,
      privacyVersion: DEFAULT_PRIVACY_VERSION,
      ip,
      userAgent
    };

    // 4. Dispatch OTP
    const otpResult = await this.otpService.generateAndSendOtp(
      dto.mobileNumber,
      'REGISTRATION',
      metadata
    );

    return {
      success: true,
      message: 'OTP_SENT',
      mobileNumber: dto.mobileNumber,
      resendAvailableInSeconds: otpResult.resendAvailableInSeconds
    };
  }

  async verifyRegistrationOtp(
    dto: VerifyOtpRegisterInput,
    ip: string,
    userAgent: string
  ): Promise<{ user: SessionUser; sessionToken: string; sessionExpiresAt: Date }> {
    const otpRecord = await this.otpService.verifyOtp(
      dto.mobileNumber,
      'REGISTRATION',
      dto.code
    );

    const metadata = (otpRecord.metadata || {}) as Record<string, any>;
    if (!metadata.mobileNumber || !metadata.passwordHash) {
      throw new HttpException(
        {
          code: AUTH_OTP_EXPIRED,
          message: 'بيانات التسجيل المسبقة منتهية الصلاحية. يرجى إعادة بدء عملية التسجيل'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const now = this.clockService.now();
    const sessionExpiresAt = new Date(
      now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Atomic creation inside transaction
    const created = await this.prisma.$transaction(async (tx: any) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          fullName: metadata.fullName,
          mobileNumber: metadata.mobileNumber,
          nationalId: metadata.nationalId,
          username: metadata.username,
          passwordHash: metadata.passwordHash,
          status: 'ACTIVE'
        }
      });

      // 2. Create UserProfile (BUYER role)
      await tx.userProfile.create({
        data: {
          userId: user.id,
          role: 'BUYER',
          status: 'ACTIVE'
        }
      });

      // 3. Create Immutable PDPL ConsentRecord
      await tx.consentRecord.create({
        data: {
          userId: user.id,
          termsVersion: metadata.termsVersion || DEFAULT_TERMS_VERSION,
          privacyVersion: metadata.privacyVersion || DEFAULT_PRIVACY_VERSION,
          consentTimestamp: now,
          ipAddress: ip || '127.0.0.1',
          userAgent: userAgent || 'unknown',
          source: 'REGISTRATION_WEB'
        }
      });

      // 4. Create Server-Side Session
      const session = await tx.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          ipAddress: ip || '127.0.0.1',
          userAgent: userAgent || 'unknown',
          expiresAt: sessionExpiresAt
        }
      });

      return { user, session };
    });

    // 5. Clean up consumed OTP record
    await this.otpService.cleanupOtp(otpRecord.id);

    return {
      user: {
        id: created.user.id,
        fullName: created.user.fullName,
        mobileNumber: created.user.mobileNumber,
        username: created.user.username,
        role: 'BUYER'
      },
      sessionToken,
      sessionExpiresAt
    };
  }

  async resendOtp(
    dto: ResendOtpInput
  ): Promise<{ success: boolean; resendAvailableInSeconds: number }> {
    const existing = await this.prisma.otpVerification.findFirst({
      where: { mobileNumber: dto.mobileNumber, purpose: 'REGISTRATION' }
    });

    if (!existing) {
      throw new HttpException(
        {
          code: AUTH_OTP_EXPIRED,
          message: 'لا يوجد طلب تسجيل معلق لرقم الجوال المدخل'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.otpService.generateAndSendOtp(
      dto.mobileNumber,
      'REGISTRATION',
      (existing.metadata || undefined) as Record<string, any>
    );
  }

  async validateSession(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            profiles: true
          }
        }
      }
    });

    if (!session) return null;

    if (this.clockService.now() > session.expiresAt) {
      return null;
    }

    return {
      id: session.user.id,
      fullName: session.user.fullName,
      mobileNumber: session.user.mobileNumber,
      username: session.user.username,
      role: session.user.profiles?.[0]?.role || 'BUYER'
    };
  }

  async logout(token: string): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: { token }
      });
    } catch (err) {
      this.logger.warn(`Failed to delete session token during logout: ${err}`);
    }
  }
}

