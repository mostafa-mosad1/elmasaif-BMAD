import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import {
  AdminRole,
  AdminLoginInput,
  AdminInitiatePasswordResetInput,
  AdminCompletePasswordResetInput,
  AdminCreateStaffRequestInput,
  AdminUpdateStaffPermissionsRequestInput,
  AdminUpdateStaffStatusRequestInput,
  AdminHardDeleteStaffRequestInput,
  AdminSessionUser,
  AdminStaffSummaryDto,
  ADMIN_ACCOUNT_DISABLED,
  ADMIN_ACCOUNT_LOCKED,
  ADMIN_EMAIL_ALREADY_EXISTS,
  ADMIN_HARD_DELETE_HISTORY_EXISTS,
  ADMIN_INVALID_CREDENTIALS,
  ADMIN_LOGIN_LOCKOUT_MINUTES,
  ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
  ADMIN_NOT_FOUND,
  ADMIN_PASSWORD_RESET_EXPIRY_SECONDS,
  ADMIN_PERMISSION_GROUPS,
  ADMIN_RESET_TOKEN_EXPIRED,
  ADMIN_RESET_TOKEN_INVALID,
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_SELF_MODIFICATION_FORBIDDEN,
  ADMIN_SESSION_INACTIVITY_MS,
  ADMIN_USERNAME_ALREADY_EXISTS,
  ALL_ADMIN_PERMISSIONS,
  AUTH_NOT_AUTHORIZED,
  AUTH_PASSWORD_SAME_AS_CURRENT,
  resolveAdminPermissions,
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
      permissions?: string[] | null;
      isActive: boolean;
      deletedAt?: Date | null;
      lastLoginAt?: Date | null;
      createdAt?: Date;
    },
    lastLoginOverride?: Date,
    hasOperationalHistory?: boolean
  ): AdminSessionUser {
    const role = admin.role as AdminRole;
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role,
      isActive: admin.isActive && !admin.deletedAt,
      deletedAt: admin.deletedAt ?? null,
      lastLoginAt: lastLoginOverride ?? admin.lastLoginAt ?? null,
      ...(admin.createdAt !== undefined ? { createdAt: admin.createdAt } : {}),
      ...(hasOperationalHistory !== undefined ? { hasOperationalHistory } : {}),
      permissions: resolveAdminPermissions(role, admin.permissions),
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

    // 2. Check if account is disabled or soft-deleted
    if (!admin.isActive || (admin as any).deletedAt) {
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

    if (!admin || !admin.isActive || (admin as any).deletedAt) {
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

  private assertRbacManagePermission(
    actorRole: AdminRole,
    actorPermissions?: string[]
  ): void {
    const permissions = resolveAdminPermissions(actorRole, actorPermissions);
    if (!permissions.includes('Rbac.Manage')) {
      throw new HttpException(
        {
          code: AUTH_NOT_AUTHORIZED,
          message: 'هذه العملية مخصصة للمشرف العام أو المفوضين بصلاحية (Rbac.Manage)',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async safeCount(
    model: any,
    where: Record<string, unknown>
  ): Promise<number> {
    if (!model || typeof model.count !== 'function') {
      return 0;
    }
    const c = await model.count({ where });
    return typeof c === 'number' ? c : 0;
  }

  async countAdminOperationalHistory(adminId: string): Promise<number> {
    const p = this.prisma as any;
    const counts = await Promise.all([
      this.safeCount(p.auditLog, { actorId: adminId }),
      this.safeCount(p.listing, {
        OR: [
          { reviewedByAdminId: adminId },
          { complianceOfficerId: adminId },
          { lockedByAdminId: adminId },
        ],
      }),
      this.safeCount(p.falLicense, {
        OR: [{ reviewedByAdminId: adminId }, { lockedByAdminId: adminId }],
      }),
      this.safeCount(p.identityDocument, { verifiedByAdminId: adminId }),
      this.safeCount(p.contractTemplate, { createdByAdminId: adminId }),
      this.safeCount(p.offerHistory, { actorAdminId: adminId }),
      this.safeCount(p.deal, { approvedByAdminId: adminId }),
      this.safeCount(p.payment, {
        OR: [{ verifiedByAdminId: adminId }, { lockedByAdminId: adminId }],
      }),
      this.safeCount(p.contractFeePayment, {
        OR: [{ verifiedByAdminId: adminId }, { lockedByAdminId: adminId }],
      }),
      this.safeCount(p.dispute, {
        OR: [{ resolvedByAdminId: adminId }, { lockedByAdminId: adminId }],
      }),
      this.safeCount(p.rating, { hiddenByAdminId: adminId }),
      this.safeCount(p.priceSuggestion, { suggestedByAdminId: adminId }),
      this.safeCount(p.inquiryMessage, {
        OR: [{ relayedByAdminId: adminId }, { authorAdminId: adminId }],
      }),
    ]);

    return counts.reduce((acc, val) => acc + val, 0);
  }

  private toStaffSummaryDto(
    admin: any,
    hasOperationalHistory: boolean
  ): AdminStaffSummaryDto {
    const role = admin.role as AdminRole;
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
      role,
      permissions: resolveAdminPermissions(role, admin.permissions),
      isActive: Boolean(admin.isActive && !admin.deletedAt),
      deletedAt: admin.deletedAt ?? null,
      lastLoginAt: admin.lastLoginAt ?? null,
      createdAt: admin.createdAt,
      hasOperationalHistory,
    };
  }

  async listAdminsForSuperAdmin(
    actorRole: AdminRole,
    actorPermissions?: string[]
  ): Promise<AdminSessionUser[]> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const results: AdminSessionUser[] = [];
    for (const admin of admins) {
      const historyCount = await this.countAdminOperationalHistory(admin.id);
      results.push(this.toAdminSessionUser(admin, undefined, historyCount > 0));
    }
    return results;
  }

  async listStaffWithCatalog(
    actorRole: AdminRole,
    actorPermissions?: string[]
  ): Promise<{
    staff: AdminStaffSummaryDto[];
    permissionGroups: typeof ADMIN_PERMISSION_GROUPS;
    rolePresets: typeof ADMIN_ROLE_PERMISSIONS;
  }> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const staff: AdminStaffSummaryDto[] = [];
    for (const admin of admins) {
      const historyCount = await this.countAdminOperationalHistory(admin.id);
      staff.push(this.toStaffSummaryDto(admin, historyCount > 0));
    }

    return {
      staff,
      permissionGroups: ADMIN_PERMISSION_GROUPS,
      rolePresets: ADMIN_ROLE_PERMISSIONS,
    };
  }

  async createStaffAccount(
    actorAdminId: string,
    actorRole: AdminRole,
    dto: AdminCreateStaffRequestInput,
    ip: string,
    actorPermissions?: string[]
  ): Promise<AdminStaffSummaryDto> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();

    const existingByUsername = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    if (existingByUsername) {
      throw new ConflictException({
        code: ADMIN_USERNAME_ALREADY_EXISTS,
        message: 'اسم المستخدم الإداري مستخدم بالفعل لموظف آخر',
      });
    }

    const existingByEmail = await this.prisma.adminUser.findUnique({
      where: { email },
    });
    if (existingByEmail) {
      throw new ConflictException({
        code: ADMIN_EMAIL_ALREADY_EXISTS,
        message: 'البريد الإلكتروني الإداري مستخدم بالفعل لموظف آخر',
      });
    }

    const assignedPermissions =
      dto.role === AdminRole.SUPER_ADMIN
        ? [...ALL_ADMIN_PERMISSIONS]
        : dto.permissions && dto.permissions.length > 0
          ? Array.from(new Set(dto.permissions))
          : [...(ADMIN_ROLE_PERMISSIONS[dto.role] ?? [])];

    const invalidPerms = assignedPermissions.filter(
      (p) => !ALL_ADMIN_PERMISSIONS.includes(p)
    );
    if (invalidPerms.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_ADMIN_PERMISSIONS',
        message: `صلاحيات غير صالحة: ${invalidPerms.join(', ')}`,
      });
    }

    const passwordHash = await argon2.hash(dto.initialPassword, {
      type: argon2.argon2id,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.adminUser.create({
        data: {
          username,
          email,
          fullName,
          role: dto.role,
          passwordHash,
          permissions: assignedPermissions,
          isActive: true,
          deletedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_STAFF_CREATED',
          entityType: 'AdminUser',
          entityId: staff.id,
          ipAddress: ip,
          payload: {
            username: staff.username,
            email: staff.email,
            fullName: staff.fullName,
            role: staff.role,
            permissions: assignedPermissions,
          },
        },
      });

      return staff;
    });

    return this.toStaffSummaryDto(created, false);
  }

  async updateStaffPermissions(
    actorAdminId: string,
    actorRole: AdminRole,
    targetAdminId: string,
    dto: AdminUpdateStaffPermissionsRequestInput,
    ip: string,
    actorPermissions?: string[]
  ): Promise<AdminStaffSummaryDto> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    if (actorAdminId === targetAdminId) {
      throw new BadRequestException({
        code: ADMIN_SELF_MODIFICATION_FORBIDDEN,
        message:
          'لا يمكن للمشرف تعديل صلاحيات أو دور حسابه الشخصي مباشرة لمنع فقدان الصلاحيات',
      });
    }

    const targetAdmin = await this.prisma.adminUser.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) {
      throw new NotFoundException({
        code: ADMIN_NOT_FOUND,
        message: 'حساب الموظف المستهدف غير موجود',
      });
    }

    const nextRole = dto.role ?? (targetAdmin.role as AdminRole);
    const nextFullName = dto.fullName?.trim() || targetAdmin.fullName;
    const nextPermissions =
      nextRole === AdminRole.SUPER_ADMIN
        ? [...ALL_ADMIN_PERMISSIONS]
        : Array.from(new Set(dto.permissions));

    const invalidPerms = nextPermissions.filter(
      (p) => !ALL_ADMIN_PERMISSIONS.includes(p)
    );
    if (invalidPerms.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_ADMIN_PERMISSIONS',
        message: `صلاحيات غير صالحة: ${invalidPerms.join(', ')}`,
      });
    }

    const beforeSnapshot = {
      role: targetAdmin.role,
      fullName: targetAdmin.fullName,
      permissions: resolveAdminPermissions(
        targetAdmin.role as AdminRole,
        (targetAdmin as any).permissions
      ),
    };

    const afterSnapshot = {
      role: nextRole,
      fullName: nextFullName,
      permissions: nextPermissions,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.adminUser.update({
        where: { id: targetAdmin.id },
        data: {
          role: nextRole,
          fullName: nextFullName,
          permissions: nextPermissions,
        },
      });

      await tx.adminSession.deleteMany({
        where: { adminId: targetAdmin.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_PERMISSIONS_UPDATED',
          entityType: 'AdminUser',
          entityId: targetAdmin.id,
          ipAddress: ip,
          payload: {
            beforeSnapshot,
            afterSnapshot,
            reason: dto.reason,
            activeSessionsRevoked: true,
          },
        },
      });

      return staff;
    });

    const historyCount = await this.countAdminOperationalHistory(targetAdmin.id);
    return this.toStaffSummaryDto(updated, historyCount > 0);
  }

  async updateStaffStatus(
    actorAdminId: string,
    actorRole: AdminRole,
    targetAdminId: string,
    dto: AdminUpdateStaffStatusRequestInput,
    ip: string,
    actorPermissions?: string[]
  ): Promise<AdminStaffSummaryDto> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    if (actorAdminId === targetAdminId) {
      throw new BadRequestException({
        code: ADMIN_SELF_MODIFICATION_FORBIDDEN,
        message: 'لا يمكن للمشرف تعطيل أو حذف حسابه الشخصي',
      });
    }

    const targetAdmin = await this.prisma.adminUser.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) {
      throw new NotFoundException({
        code: ADMIN_NOT_FOUND,
        message: 'حساب الموظف المستهدف غير موجود',
      });
    }

    const now = this.clockService.now();
    const isEnable = dto.action === 'ENABLE';
    const isSoftDelete = dto.action === 'SOFT_DELETE';

    const nextIsActive = isEnable;
    const nextDeletedAt = isSoftDelete
      ? now
      : isEnable
        ? null
        : (targetAdmin as any).deletedAt ?? null;
    const auditAction = isSoftDelete
      ? 'ADMIN_STAFF_SOFT_DELETED'
      : 'ADMIN_STAFF_STATUS_CHANGED';

    const beforeSnapshot = {
      isActive: targetAdmin.isActive,
      deletedAt: (targetAdmin as any).deletedAt ?? null,
    };
    const afterSnapshot = {
      isActive: nextIsActive,
      deletedAt: nextDeletedAt,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.adminUser.update({
        where: { id: targetAdmin.id },
        data: {
          isActive: nextIsActive,
          deletedAt: nextDeletedAt,
        },
      });

      if (!isEnable) {
        await tx.adminSession.deleteMany({
          where: { adminId: targetAdmin.id },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: auditAction,
          entityType: 'AdminUser',
          entityId: targetAdmin.id,
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

      return staff;
    });

    const historyCount = await this.countAdminOperationalHistory(targetAdmin.id);
    return this.toStaffSummaryDto(updated, historyCount > 0);
  }

  async hardDeleteStaff(
    actorAdminId: string,
    actorRole: AdminRole,
    targetAdminId: string,
    dto: AdminHardDeleteStaffRequestInput,
    ip: string,
    actorPermissions?: string[]
  ): Promise<{ id: string; deleted: boolean }> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

    if (actorAdminId === targetAdminId) {
      throw new BadRequestException({
        code: ADMIN_SELF_MODIFICATION_FORBIDDEN,
        message: 'لا يمكن للمشرف حذف حسابه الشخصي نهائياً',
      });
    }

    const targetAdmin = await this.prisma.adminUser.findUnique({
      where: { id: targetAdminId },
    });

    if (!targetAdmin) {
      throw new NotFoundException({
        code: ADMIN_NOT_FOUND,
        message: 'حساب الموظف المستهدف غير موجود',
      });
    }

    const historyCount = await this.countAdminOperationalHistory(targetAdmin.id);
    if (historyCount > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_STAFF_HARD_DELETE_BLOCKED',
          entityType: 'AdminUser',
          entityId: targetAdmin.id,
          ipAddress: ip,
          payload: {
            reason: dto.reason,
            historyCount,
            code: ADMIN_HARD_DELETE_HISTORY_EXISTS,
          },
        },
      });

      throw new ConflictException({
        code: ADMIN_HARD_DELETE_HISTORY_EXISTS,
        message:
          'لا يمكن الحذف النهائي لحساب الموظف لوجود سجل عمليات أو تدقيق مرتبط به؛ يرجى استخدام التعطيل أو الحذف الناعم',
        details: {
          historyCount,
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.adminSession.deleteMany({
        where: { adminId: targetAdmin.id },
      });

      await tx.adminUser.delete({
        where: { id: targetAdmin.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorAdminId,
          actorType: 'ADMIN',
          action: 'ADMIN_STAFF_HARD_DELETED',
          entityType: 'AdminUser',
          entityId: targetAdmin.id,
          ipAddress: ip,
          payload: {
            deletedUsername: targetAdmin.username,
            deletedEmail: targetAdmin.email,
            deletedFullName: targetAdmin.fullName,
            deletedRole: targetAdmin.role,
            reason: dto.reason,
          },
        },
      });
    });

    return {
      id: targetAdmin.id,
      deleted: true,
    };
  }

  async initiatePasswordReset(
    actorAdminId: string,
    actorRole: AdminRole,
    targetAdminId: string,
    dto: AdminInitiatePasswordResetInput,
    ip: string,
    actorPermissions?: string[]
  ): Promise<{
    adminId: string;
    email: string;
    expiresInSeconds: number;
    activeSessionsRevoked: boolean;
  }> {
    this.assertRbacManagePermission(actorRole, actorPermissions);

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

