import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import {
  AdminRole,
  AdminLoginInput,
  AdminInitiatePasswordResetInput,
  AdminCompletePasswordResetInput,
  AdminSessionUser,
  ADMIN_ACCOUNT_DISABLED,
  ADMIN_ACCOUNT_LOCKED,
  ADMIN_INVALID_CREDENTIALS,
  ADMIN_LOGIN_LOCKOUT_MINUTES,
  ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
  ADMIN_NOT_FOUND,
  ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
  ADMIN_RESET_TOKEN_EXPIRED,
  ADMIN_RESET_TOKEN_INVALID,
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_SESSION_INACTIVITY_MS,
  AUTH_NOT_AUTHORIZED,
  AUTH_PASSWORD_SAME_AS_CURRENT,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { EmailTransportService } from './email/email-transport.service';

interface AdminResetTokenPayload {
  adminId: string;
  email: string;
  nonce: string;
  exp: number;
  purpose: 'ADMIN_PASSWORD_RESET';
}

// Precomputed valid Argon2id hash for constant-time anti-enumeration verification when admin is not found
const DUMMY_ADMIN_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly emailTransportService: EmailTransportService
  ) {}

  private getResetSigningSecret(): string {
    return (
      process.env.ADMIN_RESET_SECRET ||
      process.env.SESSION_SECRET ||
      'elmasaif-admin-reset-hmac-secret-2026'
    );
  }

  private signResetToken(payload: AdminResetTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getResetSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyResetTokenSignature(token: string): AdminResetTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_INVALID,
          message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تالف',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const [encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.getResetSigningSecret())
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_INVALID,
          message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تالف',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8')
      ) as AdminResetTokenPayload;
      if (
        !parsed ||
        parsed.purpose !== 'ADMIN_PASSWORD_RESET' ||
        typeof parsed.adminId !== 'string' ||
        typeof parsed.exp !== 'number'
      ) {
        throw new Error('Invalid payload structure');
      }
      return parsed;
    } catch {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_INVALID,
          message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تالف',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toAdminSessionUser(
    admin: {
      id: string;
      username: string;
      email: string;
      fullName: string;
      role: string | AdminRole;
      isActive: boolean;
      lastLoginAt?: Date | null;
    },
    lastLoginOverride?: Date
  ): AdminSessionUser {
    const role = admin.role as AdminRole;
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role,
      isActive: admin.isActive,
      lastLoginAt: lastLoginOverride ?? admin.lastLoginAt ?? null,
      permissions: ADMIN_ROLE_PERMISSIONS[role] || [],
    };
  }

  async login(
    dto: AdminLoginInput,
    ip: string,
    userAgent: string
  ): Promise<{
    sessionToken: string;
    expiresAt: Date;
    admin: AdminSessionUser;
  }> {
    const identifier = dto.identifier.trim().toLowerCase();
    const now = this.clockService.now();

    const admin = await this.prisma.adminUser.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!admin) {
      await argon2.verify(DUMMY_ADMIN_ARGON2_HASH, dto.password).catch(() => false);
      throw new HttpException(
        {
          code: ADMIN_INVALID_CREDENTIALS,
          message: 'بيانات الدخول الإدارية غير صحيحة',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // 1. Check active 15-minute brute-force lockout window
    if (admin.lockedUntil && now < admin.lockedUntil) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((admin.lockedUntil.getTime() - now.getTime()) / 1000)
      );

      await this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'ADMIN_LOGIN_BLOCKED_LOCKOUT',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: ip,
          payload: {
            lockedUntil: admin.lockedUntil.toISOString(),
            retryAfterSeconds,
          },
        },
      });

      throw new HttpException(
        {
          code: ADMIN_ACCOUNT_LOCKED,
          message: 'تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة',
          details: {
            lockedUntil: admin.lockedUntil.toISOString(),
            retryAfterSeconds,
          },
        },
        423
      );
    }

    // 2. Check if account is disabled
    if (!admin.isActive) {
      await this.prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'ADMIN_LOGIN_BLOCKED_DISABLED',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: ip,
        },
      });

      throw new HttpException(
        {
          code: ADMIN_ACCOUNT_DISABLED,
          message: 'حساب المشرف معطل من قبل الإدارة العليا',
        },
        HttpStatus.FORBIDDEN
      );
    }

    // 3. Verify Argon2id password
    const isPasswordValid = await argon2
      .verify(admin.passwordHash, dto.password)
      .catch(() => false);

    if (!isPasswordValid) {
      const previousAttempts =
        admin.lockedUntil && now >= admin.lockedUntil ? 0 : admin.failedLoginAttempts || 0;
      const nextAttempts = previousAttempts + 1;

      if (nextAttempts >= ADMIN_LOGIN_MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(
          now.getTime() + ADMIN_LOGIN_LOCKOUT_MINUTES * 60 * 1000
        );
        const retryAfterSeconds = ADMIN_LOGIN_LOCKOUT_MINUTES * 60;

        await this.prisma.$transaction(async (tx) => {
          await tx.adminUser.update({
            where: { id: admin.id },
            data: {
              failedLoginAttempts: nextAttempts,
              lockedUntil,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: admin.id,
              actorType: 'ADMIN',
              action: 'ADMIN_ACCOUNT_LOCKED',
              entityType: 'AdminUser',
              entityId: admin.id,
              ipAddress: ip,
              payload: {
                failedLoginAttempts: nextAttempts,
                lockedUntil: lockedUntil.toISOString(),
              },
            },
          });
        });

        throw new HttpException(
          {
            code: ADMIN_ACCOUNT_LOCKED,
            message: 'تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة',
            details: {
              lockedUntil: lockedUntil.toISOString(),
              retryAfterSeconds,
            },
          },
          423
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLoginAttempts: nextAttempts,
            lockedUntil: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            actorType: 'ADMIN',
            action: 'ADMIN_LOGIN_FAILED',
            entityType: 'AdminUser',
            entityId: admin.id,
            ipAddress: ip,
            payload: {
              failedLoginAttempts: nextAttempts,
              remainingAttempts: ADMIN_LOGIN_MAX_FAILED_ATTEMPTS - nextAttempts,
            },
          },
        });
      });

      throw new HttpException(
        {
          code: ADMIN_INVALID_CREDENTIALS,
          message: 'بيانات الدخول الإدارية غير صحيحة',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    // 4. Valid credentials: create isolated 8-hour inactivity session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_INACTIVITY_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });

      await tx.adminSession.create({
        data: {
          adminId: admin.id,
          token: sessionToken,
          ipAddress: ip,
          userAgent,
          lastActivityAt: now,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'ADMIN_LOGIN_SUCCESS',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: ip,
          payload: {
            role: admin.role,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });

    return {
      sessionToken,
      expiresAt,
      admin: this.toAdminSessionUser(admin, now),
    };
  }

  async logout(token: string | undefined, ip?: string): Promise<{ success: boolean }> {
    if (!token) {
      return { success: true };
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { token },
    });

    if (session) {
      await this.prisma.$transaction(async (tx) => {
        await tx.adminSession.delete({
          where: { id: session.id },
        });

        await tx.auditLog.create({
          data: {
            actorId: session.adminId,
            actorType: 'ADMIN',
            action: 'ADMIN_LOGOUT',
            entityType: 'AdminUser',
            entityId: session.adminId,
            ipAddress: ip || null,
          },
        });
      });
    }

    return { success: true };
  }

  async getMe(adminId: string): Promise<AdminSessionUser> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      throw new HttpException(
        {
          code: ADMIN_ACCOUNT_DISABLED,
          message: 'حساب المشرف غير نشط أو غير موجود',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.toAdminSessionUser(admin);
  }

  async listAdminsForSuperAdmin(actorRole: AdminRole): Promise<AdminSessionUser[]> {
    const permissions = ADMIN_ROLE_PERMISSIONS[actorRole] || [];
    if (!permissions.includes('Rbac.Manage')) {
      throw new HttpException(
        {
          code: AUTH_NOT_AUTHORIZED,
          message: 'هذه العملية مخصصة للمشرف العام فقط (Rbac.Manage)',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return admins.map((a) => this.toAdminSessionUser(a));
  }

  async initiatePasswordReset(
    actorAdminId: string,
    actorRole: AdminRole,
    targetAdminId: string,
    dto: AdminInitiatePasswordResetInput,
    ip: string
  ): Promise<{
    adminId: string;
    email: string;
    expiresInSeconds: number;
    activeSessionsRevoked: boolean;
  }> {
    const permissions = ADMIN_ROLE_PERMISSIONS[actorRole] || [];
    if (!permissions.includes('Rbac.Manage')) {
      throw new HttpException(
        {
          code: AUTH_NOT_AUTHORIZED,
          message: 'إعادة تعيين كلمة مرور المشرفين مخصصة للمشرف العام فقط (Rbac.Manage)',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const targetAdmin = await this.prisma.adminUser.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) {
      throw new HttpException(
        {
          code: ADMIN_NOT_FOUND,
          message: 'حساب المشرف المستهدف غير موجود',
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (!targetAdmin.isActive) {
      throw new HttpException(
        {
          code: ADMIN_ACCOUNT_DISABLED,
          message: 'لا يمكن إرسال رابط إعادة تعيين كلمة المرور لحساب مشرف معطل',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const now = this.clockService.now();
    const expiresAt = new Date(
      now.getTime() + ADMIN_PASSWORD_RESET_EXPIRY_SECONDS * 1000
    );

    const tokenPayload: AdminResetTokenPayload = {
      adminId: targetAdmin.id,
      email: targetAdmin.email,
      nonce: crypto.randomBytes(16).toString('hex'),
      exp: expiresAt.getTime(),
      purpose: 'ADMIN_PASSWORD_RESET',
    };

    const token = this.signResetToken(tokenPayload);
    const tokenHash = this.hashToken(token);

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: targetAdmin.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      });

      await tx.adminSession.deleteMany({
        where: { adminId: targetAdmin.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_PASSWORD_RESET_INITIATED',
          entityType: 'AdminUser',
          entityId: targetAdmin.id,
          ipAddress: ip,
          payload: {
            targetAdminEmail: targetAdmin.email,
            targetAdminUsername: targetAdmin.username,
            reason: dto.reason,
            expiresInSeconds: ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
            activeSessionsRevoked: true,
          },
        },
      });
    });

    const webBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${webBaseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;

    await this.emailTransportService.sendAdminPasswordResetEmail({
      to: targetAdmin.email,
      fullName: targetAdmin.fullName,
      resetUrl,
      expiresInMinutes: Math.floor(ADMIN_PASSWORD_RESET_EXPIRY_SECONDS / 60),
    });

    return {
      adminId: targetAdmin.id,
      email: targetAdmin.email,
      expiresInSeconds: ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
      activeSessionsRevoked: true,
    };
  }

  async completePasswordReset(
    dto: AdminCompletePasswordResetInput,
    ip: string,
    userAgent: string
  ): Promise<{ success: boolean }> {
    const payload = this.verifyResetTokenSignature(dto.token);
    const now = this.clockService.now();

    if (now.getTime() > payload.exp) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_EXPIRED,
          message: 'انتهت صلاحية رابط إعادة تعيين كلمة المرور الإدارية (15 دقيقة)',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_INVALID,
          message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تم استخدامه مسبقاً',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (!admin.isActive) {
      throw new HttpException(
        {
          code: ADMIN_ACCOUNT_DISABLED,
          message: 'حساب المشرف معطل من قبل الإدارة العليا',
        },
        HttpStatus.FORBIDDEN
      );
    }

    if (admin.passwordResetExpiresAt && now > admin.passwordResetExpiresAt) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_EXPIRED,
          message: 'انتهت صلاحية رابط إعادة تعيين كلمة المرور الإدارية (15 دقيقة)',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const incomingTokenHash = this.hashToken(dto.token);
    if (
      !admin.passwordResetTokenHash ||
      admin.passwordResetTokenHash !== incomingTokenHash
    ) {
      throw new HttpException(
        {
          code: ADMIN_RESET_TOKEN_INVALID,
          message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تم استخدامه مسبقاً',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const isSamePassword = await argon2
      .verify(admin.passwordHash, dto.newPassword)
      .catch(() => false);

    if (isSamePassword) {
      throw new HttpException(
        {
          code: AUTH_PASSWORD_SAME_AS_CURRENT,
          message: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: admin.id },
        data: {
          passwordHash: newPasswordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.adminSession.deleteMany({
        where: { adminId: admin.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: 'ADMIN_PASSWORD_RESET_COMPLETED',
          entityType: 'AdminUser',
          entityId: admin.id,
          ipAddress: ip,
          payload: {
            sessionsRevoked: true,
            userAgent,
          },
        },
      });
    });

    return { success: true };
  }
}

