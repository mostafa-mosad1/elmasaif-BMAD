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
  LoginInput,
  VerifyStepUpOtpInput,
  DEFAULT_TERMS_VERSION,
  DEFAULT_PRIVACY_VERSION,
  SESSION_EXPIRY_DAYS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
  AUTH_PHONE_ALREADY_EXISTS,
  AUTH_NATIONAL_ID_ALREADY_EXISTS,
  AUTH_USERNAME_ALREADY_EXISTS,
  AUTH_OTP_EXPIRED,
  AUTH_INVALID_CREDENTIALS,
  AUTH_ACCOUNT_LOCKED,
  AUTH_ACCOUNT_DEACTIVATED,
  AUTH_ACCOUNT_DISABLED,
  AUTH_STEP_UP_INVALID,
  ProfileStatus,
  UserRole
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
      const profile = await tx.userProfile.create({
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

      return { user, profile, session };
    });

    // 5. Clean up consumed OTP record
    await this.otpService.cleanupOtp(otpRecord.id);

    return {
      user: {
        id: created.user.id,
        fullName: created.user.fullName,
        mobileNumber: created.user.mobileNumber,
        username: created.user.username,
        role: UserRole.BUYER,
        activeRole: UserRole.BUYER,
        profiles: [
          {
            id: created.profile.id,
            role: UserRole.BUYER,
            status: ProfileStatus.ACTIVE,
            payoutIban: null,
            falLicenseNumber: null,
            falStatus: null,
            createdAt: created.profile.createdAt
          }
        ]
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
            profiles: {
              include: {
                falLicense: true
              }
            }
          }
        }
      }
    });

    if (!session) return null;

    if (this.clockService.now() > session.expiresAt) {
      return null;
    }

    return this.formatSessionUser(session.user, session.activeRole as UserRole);
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

  private getSecret(): string {
    return process.env.SESSION_SECRET || 'super-secret-session-key-for-elmasaif-2026-development';
  }

  private maskSaudiMobile(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  }

  private generateStepUpToken(payload: {
    userId: string;
    mobileNumber: string;
    deviceHash: string;
    deviceId?: string;
    exp: number;
  }): string {
    const secret = this.getSecret();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
  }

  private verifyStepUpToken(token: string): {
    userId: string;
    mobileNumber: string;
    deviceHash: string;
    deviceId?: string;
    exp: number;
  } {
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);
      const { payload, signature } = parsed;
      const secret = this.getSecret();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        throw new Error('Invalid signature');
      }

      if (this.clockService.now().getTime() > payload.exp) {
        throw new Error('Token expired');
      }

      return payload;
    } catch {
      throw new HttpException(
        {
          code: AUTH_STEP_UP_INVALID,
          message: 'جلسة التحقق الإضافي غير صالحة أو منتهية الصلاحية'
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async login(
    dto: LoginInput,
    ip: string,
    userAgent: string,
    clientDeviceId?: string
  ): Promise<
    | {
        stepUpRequired: true;
        mobileNumber: string;
        stepUpToken: string;
        resendAvailableInSeconds: number;
        deviceId?: string;
      }
    | {
        stepUpRequired: false;
        user: SessionUser;
        sessionToken: string;
        sessionExpiresAt: Date;
        deviceId?: string;
        deletionCancelled?: boolean;
      }
  > {
    // 1. Normalize identifier if not already normalized
    let identifier = dto.identifier.trim();
    const cleanPhone = identifier.replace(/[\s-]/g, '');
    if (/^(\+966|0)?5[0-9]{8}$/.test(cleanPhone)) {
      if (cleanPhone.startsWith('+966')) identifier = cleanPhone;
      else if (cleanPhone.startsWith('0')) identifier = `+966${cleanPhone.slice(1)}`;
      else if (cleanPhone.startsWith('5')) identifier = `+966${cleanPhone}`;
    } else {
      identifier = identifier.toLowerCase();
    }

    // 2. Query user by mobileNumber or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ mobileNumber: identifier }, { username: identifier }]
      },
      include: {
        profiles: {
          include: {
            falLicense: true
          }
        },
        knownDevices: true
      }
    });

    // 3. Check active lockout
    if (user?.lockedUntil && this.clockService.now() < user.lockedUntil) {
      const retryAfterSeconds = Math.ceil(
        (user.lockedUntil.getTime() - this.clockService.now().getTime()) / 1000
      );
      throw new HttpException(
        {
          code: AUTH_ACCOUNT_LOCKED,
          message: 'تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة',
          data: {
            lockedUntil: user.lockedUntil.toISOString(),
            retryAfterSeconds: Math.max(0, retryAfterSeconds)
          }
        },
        423
      );
    }

    // 4. Constant-time dummy verify if user does not exist
    if (!user) {
      try {
        await argon2.verify(
          '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgqlfreuzweveAQ',
          dto.password
        );
      } catch {
        // Ignore dummy verify failure
      }
      throw new HttpException(
        {
          code: AUTH_INVALID_CREDENTIALS,
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // 5. Verify password hash
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      if (newAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(
          this.clockService.now().getTime() + LOGIN_LOCKOUT_MINUTES * 60 * 1000
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil
          }
        });
        throw new HttpException(
          {
            code: AUTH_ACCOUNT_LOCKED,
            message: 'تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة',
            data: {
              lockedUntil: lockedUntil.toISOString(),
              retryAfterSeconds: LOGIN_LOCKOUT_MINUTES * 60
            }
          },
          423
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts
        }
      });

      throw new HttpException(
        {
          code: AUTH_INVALID_CREDENTIALS,
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // 6. Account Lifecycle status checks
    if (user.status === ProfileStatus.DEACTIVATED) {
      throw new HttpException(
        {
          code: AUTH_ACCOUNT_DEACTIVATED,
          message: 'هذا الحساب معطل. يرجى التواصل مع الدعم الفني'
        },
        HttpStatus.FORBIDDEN
      );
    }

    if (
      user.status === ProfileStatus.DISABLED ||
      user.status === ProfileStatus.SOFT_DELETED ||
      user.status === ProfileStatus.SUSPENDED
    ) {
      throw new HttpException(
        {
          code: AUTH_ACCOUNT_DISABLED,
          message: 'هذا الحساب موقوف من قبل الإدارة'
        },
        HttpStatus.FORBIDDEN
      );
    }

    let deletionCancelled = false;
    if (user.status === ProfileStatus.DELETION_PENDING) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: ProfileStatus.ACTIVE,
          deletionRequestedAt: null,
          deletionDueAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      deletionCancelled = true;
    } else if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
    }

    // 7. Device Recognition
    const effectiveDeviceId = clientDeviceId || dto.deviceId;
    const deviceRaw = effectiveDeviceId || `${ip || '127.0.0.1'}:${userAgent || 'unknown'}`;
    const deviceHash = crypto.createHash('sha256').update(deviceRaw).digest('hex');

    const knownDevice = await this.prisma.knownDevice.findUnique({
      where: {
        userId_deviceHash: {
          userId: user.id,
          deviceHash
        }
      }
    });

    if (!knownDevice) {
      // Unrecognized device -> trigger Step-Up OTP
      const otpResult = await this.otpService.generateAndSendOtp(
        user.mobileNumber,
        'LOGIN_STEP_UP',
        {
          userId: user.id,
          deviceHash,
          deviceId: effectiveDeviceId
        }
      );

      const stepUpToken = this.generateStepUpToken({
        userId: user.id,
        mobileNumber: user.mobileNumber,
        deviceHash,
        deviceId: effectiveDeviceId,
        exp: this.clockService.now().getTime() + 300 * 1000
      });

      return {
        stepUpRequired: true,
        mobileNumber: this.maskSaudiMobile(user.mobileNumber),
        stepUpToken,
        resendAvailableInSeconds: otpResult.resendAvailableInSeconds || 60,
        deviceId: effectiveDeviceId
      };
    }

    // Recognized device -> Update lastSeenAt & Establish Session
    await this.prisma.knownDevice.update({
      where: { id: knownDevice.id },
      data: {
        lastSeenAt: this.clockService.now(),
        ipAddress: ip || '127.0.0.1',
        userAgent: userAgent || 'unknown'
      }
    });

    const sessionExpiresAt = new Date(
      this.clockService.now().getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: ip || '127.0.0.1',
        userAgent: userAgent || 'unknown',
        expiresAt: sessionExpiresAt
      }
    });

    return {
      stepUpRequired: false,
      user: this.formatSessionUser(user, UserRole.BUYER),
      sessionToken,
      sessionExpiresAt,
      deviceId: effectiveDeviceId,
      deletionCancelled
    };
  }

  async verifyStepUpOtp(
    dto: VerifyStepUpOtpInput,
    ip: string,
    userAgent: string,
    clientDeviceId?: string
  ): Promise<{
    user: SessionUser;
    sessionToken: string;
    sessionExpiresAt: Date;
    deviceId?: string;
  }> {
    const payload = this.verifyStepUpToken(dto.stepUpToken);
    if (payload.mobileNumber !== dto.mobileNumber) {
      throw new HttpException(
        {
          code: AUTH_STEP_UP_INVALID,
          message: 'رمز التحقق الإضافي غير مطابق لرقم الجوال'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    await this.otpService.verifyOtp(dto.mobileNumber, 'LOGIN_STEP_UP', dto.code);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        profiles: {
          include: {
            falLicense: true
          }
        }
      }
    });

    if (!user) {
      throw new HttpException(
        {
          code: AUTH_INVALID_CREDENTIALS,
          message: 'المستخدم غير موجود'
        },
        HttpStatus.NOT_FOUND
      );
    }

    const now = this.clockService.now();
    const effectiveDeviceId = payload.deviceId || dto.deviceId || clientDeviceId;

    await this.prisma.knownDevice.upsert({
      where: {
        userId_deviceHash: {
          userId: user.id,
          deviceHash: payload.deviceHash
        }
      },
      create: {
        userId: user.id,
        deviceHash: payload.deviceHash,
        ipAddress: ip || '127.0.0.1',
        userAgent: userAgent || 'unknown',
        lastSeenAt: now
      },
      update: {
        lastSeenAt: now,
        ipAddress: ip || '127.0.0.1',
        userAgent: userAgent || 'unknown'
      }
    });

    this.logger.log(
      `[auth.security_alert] New device recognized and verified for user ${user.id} (${user.mobileNumber}) from IP ${ip}`
    );

    const sessionExpiresAt = new Date(
      now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: ip || '127.0.0.1',
        userAgent: userAgent || 'unknown',
        expiresAt: sessionExpiresAt
      }
    });

    return {
      user: this.formatSessionUser(user, UserRole.BUYER),
      sessionToken,
      sessionExpiresAt,
      deviceId: effectiveDeviceId
    };
  }

  private formatSessionUser(user: any, activeRole?: UserRole): SessionUser {
    const role = activeRole || (user.profiles?.[0]?.role as UserRole) || UserRole.BUYER;
    const profiles = (user.profiles || []).map((p: any) => ({
      id: p.id,
      role: p.role as UserRole,
      status: p.status as ProfileStatus,
      payoutIban: p.payoutIban || null,
      falLicenseNumber: p.falLicense?.licenseNumber || null,
      falStatus: (p.falLicense?.status as ProfileStatus) || null,
      createdAt: p.createdAt
    }));

    return {
      id: user.id,
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
      username: user.username,
      role,
      activeRole: role,
      profiles
    };
  }
}

