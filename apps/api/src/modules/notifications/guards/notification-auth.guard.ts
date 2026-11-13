import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  NOTIFICATION_UNAUTHORIZED,
} from '@elmasaif/shared';

@Injectable()
export class NotificationAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Check user session first
    const userToken =
      request.cookies?.[SESSION_COOKIE_NAME] ||
      request.headers?.['authorization']?.replace(/^Bearer\s+/i, '');

    const now = this.clockService.now();

    if (userToken) {
      const userSession = await this.prisma.session.findUnique({
        where: { token: userToken },
        include: { user: true },
      });

      if (userSession && userSession.expiresAt > now && userSession.user) {
        request.user = {
          id: userSession.user.id,
          username: userSession.user.username,
          fullName: userSession.user.fullName,
          email: userSession.user.email,
          role: userSession.activeRole,
          isAdmin: false,
        };
        return true;
      }
    }

    // 2. Fall back to admin session
    const adminToken =
      request.cookies?.[ADMIN_SESSION_COOKIE_NAME] ||
      request.headers?.['authorization']?.replace(/^Bearer\s+/i, '');

    if (adminToken) {
      const adminSession = await this.prisma.adminSession.findUnique({
        where: { token: adminToken },
        include: { admin: true },
      });

      if (adminSession && adminSession.expiresAt > now && adminSession.admin) {
        const admin = adminSession.admin;
        if (admin.isActive && !admin.deletedAt) {
          request.user = {
            id: admin.id,
            username: admin.username,
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role,
            isAdmin: true,
          };
          return true;
        }
      }
    }

    throw new UnauthorizedException({
      code: NOTIFICATION_UNAUTHORIZED,
      message: 'جلسة المستخدم أو المشرف غير مصرح لها أو منتهية الصلاحية',
    });
  }
}

