import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { SESSION_COOKIE_NAME } from '@elmasaif/shared';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token =
      request.cookies?.[SESSION_COOKIE_NAME] ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException('جلسة المستخدم غير موجودة أو غير مسجل الدخول');
    }

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

    if (!session) {
      throw new UnauthorizedException('جلسة المستخدم غير صالحة');
    }

    const now = this.clockService.now();
    if (now > session.expiresAt) {
      throw new UnauthorizedException('انتهت صلاحية جلسة المستخدم. يرجى إعادة تسجيل الدخول');
    }

    const primaryRole = session.user.profiles?.[0]?.role || 'BUYER';

    request.user = {
      id: session.user.id,
      fullName: session.user.fullName,
      mobileNumber: session.user.mobileNumber,
      username: session.user.username,
      role: primaryRole,
      profiles: session.user.profiles,
      sessionToken: session.token
    };

    return true;
  }
}

