import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ADMIN_AUTH_REQUIRED,
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_INACTIVITY_MS,
  AdminRole
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

    if (
      !session ||
      session.expiresAt <= now ||
      !session.admin.isActive
    ) {
      throw this.unauthorized();
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

    const role = session.admin.role as AdminRole;
    request.adminSessionToken = token;
    request.admin = {
      id: session.admin.id,
      username: session.admin.username,
      email: session.admin.email,
      fullName: session.admin.fullName,
      role,
      isActive: session.admin.isActive,
      permissions: ADMIN_ROLE_PERMISSIONS[role] || []
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
