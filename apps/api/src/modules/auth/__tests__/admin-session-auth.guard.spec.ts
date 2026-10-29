import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ADMIN_SESSION_COOKIE_NAME, AdminRole } from '@elmasaif/shared';
import { ClockService } from '../../../common/clock/clock.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminSessionAuthGuard } from '../guards/admin-session-auth.guard';

describe('AdminSessionAuthGuard', () => {
  const now = new Date('2026-10-29T13:00:00.000Z');
  let prisma: jest.Mocked<Pick<PrismaService, 'adminSession'>>;
  let clock: jest.Mocked<Pick<ClockService, 'now'>>;
  let guard: AdminSessionAuthGuard;

  function context(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => request })
    } as ExecutionContext;
  }

  beforeEach(() => {
    prisma = {
      adminSession: {
        findUnique: jest.fn().mockResolvedValue({
          expiresAt: new Date(now.getTime() + 60_000),
          admin: {
            id: 'admin-1',
            username: 'moderator',
            email: 'moderator@example.test',
            fullName: 'مشرف',
            role: AdminRole.MODERATOR,
            isActive: true
          }
        })
      }
    } as unknown as jest.Mocked<Pick<PrismaService, 'adminSession'>>;
    clock = { now: jest.fn().mockReturnValue(now) } as unknown as jest.Mocked<Pick<ClockService, 'now'>>;
    guard = new AdminSessionAuthGuard(
      prisma as unknown as PrismaService,
      clock as unknown as ClockService
    );
  });

  it('authenticates using the isolated admin-session cookie and sets the admin principal', async () => {
    const request: Record<string, unknown> = {
      cookies: { [ADMIN_SESSION_COOKIE_NAME]: 'admin-token' },
      headers: {}
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(prisma.adminSession.findUnique).toHaveBeenCalledWith({
      where: { token: 'admin-token' },
      include: { admin: true }
    });
    expect(request.admin).toMatchObject({
      id: 'admin-1',
      role: AdminRole.MODERATOR,
      isActive: true
    });
    expect(request.user).toBeUndefined();
  });

  it('accepts a bearer admin token and rejects missing, expired, or inactive sessions', async () => {
    const bearerRequest = { headers: { authorization: 'Bearer admin-token' } };
    await expect(guard.canActivate(context(bearerRequest))).resolves.toBe(true);

    await expect(guard.canActivate(context({ cookies: {}, headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);

    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValueOnce({
      expiresAt: new Date(now.getTime() - 1),
      admin: { id: 'admin-1', isActive: true, role: AdminRole.MODERATOR }
    });
    await expect(guard.canActivate(context({ cookies: { [ADMIN_SESSION_COOKIE_NAME]: 'expired' }, headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);

    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValueOnce({
      expiresAt: new Date(now.getTime() + 60_000),
      admin: { id: 'admin-1', isActive: false, role: AdminRole.MODERATOR }
    });
    await expect(guard.canActivate(context({ cookies: { [ADMIN_SESSION_COOKIE_NAME]: 'inactive' }, headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
