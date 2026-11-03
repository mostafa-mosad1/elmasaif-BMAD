import { HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AdminRole,
  ADMIN_ACCOUNT_DISABLED,
  ADMIN_ACCOUNT_LOCKED,
  ADMIN_INVALID_CREDENTIALS,
  ADMIN_NOT_FOUND,
  ADMIN_RESET_TOKEN_EXPIRED,
  ADMIN_RESET_TOKEN_INVALID,
  ADMIN_SESSION_INACTIVITY_MS,
  AUTH_NOT_AUTHORIZED,
  AUTH_PASSWORD_SAME_AS_CURRENT,
} from '@elmasaif/shared';
import { AdminAuthService } from '../admin-auth.service';
import { EmailTransportService } from '../email/email-transport.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

describe('AdminAuthService (Story 8.1)', () => {
  const fixedNow = new Date('2026-11-03T10:00:00.000Z');
  let service: AdminAuthService;
  let prisma: {
    adminUser: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    adminSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let clockService: { now: jest.Mock };
  let emailTransportService: {
    sendAdminPasswordResetEmail: jest.Mock;
    sendEmail: jest.Mock;
  };
  let validPasswordHash: string;

  beforeAll(async () => {
    validPasswordHash = await argon2.hash('Admin@Elmasaif2026', {
      type: argon2.argon2id,
    });
  });

  beforeEach(() => {
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      adminSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };

    clockService = {
      now: jest.fn(() => new Date(fixedNow.getTime())),
    };

    emailTransportService = {
      sendAdminPasswordResetEmail: jest.fn().mockResolvedValue({ delivered: true }),
      sendEmail: jest.fn().mockResolvedValue({ delivered: true }),
    };

    service = new AdminAuthService(
      prisma as unknown as PrismaService,
      clockService as unknown as ClockService,
      emailTransportService as unknown as EmailTransportService
    );
  });

  describe('login', () => {
    it('authenticates valid active AdminUser, creates 8-hour session, resets lockout counters, and records AuditLog', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 'admin-super-1',
        username: 'superadmin',
        email: 'admin@elmasaif.sa',
        fullName: 'المشرف العام - المصايف',
        passwordHash: validPasswordHash,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
        failedLoginAttempts: 2,
        lockedUntil: null,
        lastLoginAt: null,
      });
      prisma.adminUser.update.mockResolvedValue({});
      prisma.adminSession.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.login(
        { identifier: 'superadmin', password: 'Admin@Elmasaif2026' },
        '10.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.sessionToken).toHaveLength(64);
      expect(result.expiresAt).toEqual(new Date(fixedNow.getTime() + ADMIN_SESSION_INACTIVITY_MS));
      expect(result.admin.id).toBe('admin-super-1');
      expect(result.admin.permissions).toContain('Rbac.Manage');
      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 'admin-super-1' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: fixedNow,
        },
      });
      expect(prisma.adminSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin-super-1',
            ipAddress: '10.0.0.1',
            userAgent: 'Mozilla/5.0',
            lastActivityAt: fixedNow,
            expiresAt: new Date(fixedNow.getTime() + ADMIN_SESSION_INACTIVITY_MS),
          }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin-super-1',
            actorType: 'ADMIN',
            action: 'ADMIN_LOGIN_SUCCESS',
            entityType: 'AdminUser',
            entityId: 'admin-super-1',
          }),
        })
      );
    });

    it('performs constant-time verification and throws 401 ADMIN_INVALID_CREDENTIALS when admin does not exist', async () => {
      prisma.adminUser.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'unknown_admin', password: 'WrongPassword123' }, '10.0.0.1', 'UA')
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: expect.objectContaining({
          code: ADMIN_INVALID_CREDENTIALS,
        }),
      });
    });

    it('rejects immediately with 423 Locked when admin.lockedUntil is in the future', async () => {
      const futureLock = new Date(fixedNow.getTime() + 10 * 60 * 1000);
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 'admin-locked-1',
        username: 'moderator',
        email: 'moderator@elmasaif.sa',
        fullName: 'مشرف العمليات',
        passwordHash: validPasswordHash,
        role: AdminRole.MODERATOR,
        isActive: true,
        failedLoginAttempts: 5,
        lockedUntil: futureLock,
      });

      await expect(
        service.login({ identifier: 'moderator', password: 'Admin@Elmasaif2026' }, '10.0.0.1', 'UA')
      ).rejects.toMatchObject({
        status: 423,
        response: expect.objectContaining({
          code: ADMIN_ACCOUNT_LOCKED,
          details: expect.objectContaining({
            retryAfterSeconds: 600,
          }),
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_LOGIN_BLOCKED_LOCKOUT',
          }),
        })
      );
    });

    it('locks the account for 15 minutes on the 5th consecutive failed password attempt (423 Locked)', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 'admin-mod-1',
        username: 'moderator',
        email: 'moderator@elmasaif.sa',
        fullName: 'مشرف العمليات',
        passwordHash: validPasswordHash,
        role: AdminRole.MODERATOR,
        isActive: true,
        failedLoginAttempts: 4,
        lockedUntil: null,
      });

      await expect(
        service.login({ identifier: 'moderator', password: 'WrongPassword999' }, '10.0.0.1', 'UA')
      ).rejects.toMatchObject({
        status: 423,
        response: expect.objectContaining({
          code: ADMIN_ACCOUNT_LOCKED,
        }),
      });

      const expectedLockUntil = new Date(fixedNow.getTime() + 15 * 60 * 1000);
      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 'admin-mod-1' },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expectedLockUntil,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_ACCOUNT_LOCKED',
          }),
        })
      );
    });

    it('rejects disabled admin account with 403 ADMIN_ACCOUNT_DISABLED', async () => {
      prisma.adminUser.findFirst.mockResolvedValue({
        id: 'admin-disabled-1',
        username: 'disabled_mod',
        email: 'disabled@elmasaif.sa',
        fullName: 'مشرف معطل',
        passwordHash: validPasswordHash,
        role: AdminRole.MODERATOR,
        isActive: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      await expect(
        service.login({ identifier: 'disabled_mod', password: 'Admin@Elmasaif2026' }, '10.0.0.1', 'UA')
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: expect.objectContaining({
          code: ADMIN_ACCOUNT_DISABLED,
        }),
      });
    });
  });

  describe('initiatePasswordReset & completePasswordReset', () => {
    it('blocks non-Super Admin roles from initiating password reset (403 AUTH_NOT_AUTHORIZED)', async () => {
      await expect(
        service.initiatePasswordReset(
          'mod-1',
          AdminRole.MODERATOR,
          'target-admin-1',
          { reason: 'محاولة غير مصرح بها لإعادة تعيين كلمة المرور' },
          '10.0.0.1'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: expect.objectContaining({
          code: AUTH_NOT_AUTHORIZED,
        }),
      });
    });

    it('returns 404 ADMIN_NOT_FOUND when target admin does not exist', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePasswordReset(
          'super-1',
          AdminRole.SUPER_ADMIN,
          'missing-admin-id',
          { reason: 'إعادة تعيين كلمة المرور بناءً على طلب رسمي' },
          '10.0.0.1'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: expect.objectContaining({
          code: ADMIN_NOT_FOUND,
        }),
      });
    });

    it('allows SUPER_ADMIN to initiate 15-minute single-use password reset, revokes target sessions, logs audit, and dispatches email', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: 'target-mod-1',
        username: 'moderator',
        email: 'moderator@elmasaif.sa',
        fullName: 'مشرف العمليات',
        role: AdminRole.MODERATOR,
        isActive: true,
      });

      const result = await service.initiatePasswordReset(
        'super-1',
        AdminRole.SUPER_ADMIN,
        'target-mod-1',
        { reason: 'نسيان كلمة المرور والتحقق من الهوية الوظيفية للمشرف' },
        '10.0.0.1'
      );

      expect(result.adminId).toBe('target-mod-1');
      expect(result.email).toBe('moderator@elmasaif.sa');
      expect(result.expiresInSeconds).toBe(900);
      expect(result.activeSessionsRevoked).toBe(true);
      expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
        where: { adminId: 'target-mod-1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'super-1',
            actorType: 'ADMIN',
            action: 'ADMIN_PASSWORD_RESET_INITIATED',
            entityType: 'AdminUser',
            entityId: 'target-mod-1',
          }),
        })
      );
      expect(emailTransportService.sendAdminPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('completes password reset within 15 minutes, enforces single-use token, and rejects reuse or expired token', async () => {
      let storedTokenHash: string | null = null;
      let storedExpiresAt: Date | null = null;

      prisma.adminUser.findUnique.mockImplementation(async () => ({
        id: 'target-mod-1',
        username: 'moderator',
        email: 'moderator@elmasaif.sa',
        fullName: 'مشرف العمليات',
        passwordHash: validPasswordHash,
        role: AdminRole.MODERATOR,
        isActive: true,
        passwordResetTokenHash: storedTokenHash,
        passwordResetExpiresAt: storedExpiresAt,
      }));

      prisma.adminUser.update.mockImplementation(async ({ data }) => {
        if ('passwordResetTokenHash' in data) {
          storedTokenHash = data.passwordResetTokenHash;
        }
        if ('passwordResetExpiresAt' in data) {
          storedExpiresAt = data.passwordResetExpiresAt;
        }
        return {};
      });

      const initiated = await service.initiatePasswordReset(
        'super-1',
        AdminRole.SUPER_ADMIN,
        'target-mod-1',
        { reason: 'إعادة تعيين كلمة المرور للمشرف بعد التحقق' },
        '10.0.0.1'
      );

      // Extract token from email call
      const emailArgs = emailTransportService.sendAdminPasswordResetEmail.mock.calls[0][0];
      const resetUrl = new URL(emailArgs.resetUrl);
      const token = resetUrl.searchParams.get('token')!;
      expect(token).toBeTruthy();
      expect(initiated.expiresInSeconds).toBe(900);

      // Rejects if newPassword is same as current password
      await expect(
        service.completePasswordReset(
          { token, newPassword: 'Admin@Elmasaif2026' },
          '10.0.0.2',
          'UA'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: expect.objectContaining({
          code: AUTH_PASSWORD_SAME_AS_CURRENT,
        }),
      });

      // Completes successfully with a new password
      const completed = await service.completePasswordReset(
        { token, newPassword: 'NewSecureAdminPass2026' },
        '10.0.0.2',
        'UA'
      );
      expect(completed.success).toBe(true);
      expect(storedTokenHash).toBeNull();
      expect(storedExpiresAt).toBeNull();

      // Rejects second attempt with the same token (single-use enforcement)
      await expect(
        service.completePasswordReset(
          { token, newPassword: 'AnotherSecurePass2026' },
          '10.0.0.2',
          'UA'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: expect.objectContaining({
          code: ADMIN_RESET_TOKEN_INVALID,
        }),
      });

      // Initiate another token and advance clock past 15 minutes
      await service.initiatePasswordReset(
        'super-1',
        AdminRole.SUPER_ADMIN,
        'target-mod-1',
        { reason: 'إعادة تعيين ثانية لاختبار انتهاء الصلاحية' },
        '10.0.0.1'
      );
      const secondEmailArgs = emailTransportService.sendAdminPasswordResetEmail.mock.calls[1][0];
      const secondToken = new URL(secondEmailArgs.resetUrl).searchParams.get('token')!;

      clockService.now.mockReturnValue(new Date(fixedNow.getTime() + 16 * 60 * 1000));

      await expect(
        service.completePasswordReset(
          { token: secondToken, newPassword: 'ExpiredAttemptPass2026' },
          '10.0.0.2',
          'UA'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: expect.objectContaining({
          code: ADMIN_RESET_TOKEN_EXPIRED,
        }),
      });
    });
  });
});

