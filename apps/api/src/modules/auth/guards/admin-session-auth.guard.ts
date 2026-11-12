import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ADMIN_ACCOUNT_DISABLED,
  ADMIN_AUTH_REQUIRED,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_INACTIVITY_MS,
  AdminRole,
  resolveAdminPermissions,
} from '@elmasaif/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

@Injectable()
export class AdminSessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token =
      request.cookies?.[ADMIN_SESSION_COOKIE_NAME] ||
      request.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw this.unauthorized();
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true }
    });

    const now = this.clockService.now();

    if (!session || session.expiresAt <= now) {
      throw this.unauthorized();
    }

    const adminRecord = session.admin as typeof session.admin & {
      permissions?: string[];
      deletedAt?: Date | null;
    };

    if (!adminRecord || !adminRecord.isActive || adminRecord.deletedAt) {
      if (session.id && typeof (this.prisma.adminSession as any).delete === 'function') {
        await (this.prisma.adminSession as any)
          .delete({ where: { id: session.id } })
          .catch(() => undefined);
      }
      throw new UnauthorizedException({
        code: ADMIN_ACCOUNT_DISABLED,
        message: 'حساب المشرف معطل أو محذوف من قبل الإدارة العليا',
      });
    }

    // Slide the 8-hour inactivity window forward on active requests
    const newExpiresAt = new Date(now.getTime() + ADMIN_SESSION_INACTIVITY_MS);
    if (session.id && typeof this.prisma.adminSession.update === 'function') {
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now,
          expiresAt: newExpiresAt
        }
      });
    }

    const role = adminRecord.role as AdminRole;
    const effectivePermissions = resolveAdminPermissions(role, adminRecord.permissions);

    request.adminSessionToken = token;
    request.admin = {
      id: adminRecord.id,
      username: adminRecord.username,
      email: adminRecord.email,
      fullName: adminRecord.fullName,
      role,
      isActive: adminRecord.isActive,
      deletedAt: adminRecord.deletedAt ?? null,
      permissions: effectivePermissions
    };
    return true;
  }

  private unauthorized() {
    return new UnauthorizedException({
      code: ADMIN_AUTH_REQUIRED,
      message: 'جلسة الإدارة غير صالحة أو منتهية الصلاحية'
    });
  }
}
