import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, AUTH_ROLE_NOT_AUTHORIZED } from '@elmasaif/shared';
import { ROLES_KEY } from '../decorators/require-role.decorator';

@Injectable()
export class ActiveRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const currentActiveRole = user?.activeRole || user?.role;

    if (currentActiveRole && requiredRoles.includes(currentActiveRole)) {
      return true;
    }

    throw new ForbiddenException({
      code: AUTH_ROLE_NOT_AUTHORIZED,
      message: 'ليس لديك صلاحية الوصول إلى هذه الخدمة بالدور النشط الحالي. يرجى التبديل إلى مساحة العمل المناسبة',
      details: {
        requiredRoles,
        currentActiveRole: currentActiveRole || null
      }
    });
  }
}
