import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ADMIN_AUTH_REQUIRED, ADMIN_SESSION_COOKIE_NAME } from '@elmasaif/shared';
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

    if (
      !session ||
      session.expiresAt <= this.clockService.now() ||
      !session.admin.isActive
    ) {
      throw this.unauthorized();
    }

    request.admin = {
      id: session.admin.id,
      username: session.admin.username,
      email: session.admin.email,
      fullName: session.admin.fullName,
      role: session.admin.role,
      isActive: session.admin.isActive
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
