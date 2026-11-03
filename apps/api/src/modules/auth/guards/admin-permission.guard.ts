import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole, AUTH_NOT_AUTHORIZED } from '@elmasaif/shared';
import { ADMIN_PERMISSION_METADATA_KEY } from '../decorators/require-admin-permission.decorator';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<
      string | string[] | undefined
    >(ADMIN_PERMISSION_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin?.id || !admin.isActive) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'غير مصرح لك بتنفيذ هذا الإجراء الإداري',
      });
    }

    if (admin.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    const permissions: string[] = Array.isArray(admin.permissions)
      ? admin.permissions
      : [];

    const requiredList = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    const hasPermission = requiredList.some((perm) =>
      permissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: `الدور الإداري الحالي لا يملك الصلاحية المطلوبة (${requiredList.join(', ')})`,
      });
    }

    return true;
  }
}

