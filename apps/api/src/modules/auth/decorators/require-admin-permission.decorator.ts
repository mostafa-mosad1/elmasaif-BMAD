import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSION_METADATA_KEY = 'required_admin_permission';

export const RequireAdminPermission = (...permissions: string[]) =>
  SetMetadata(
    ADMIN_PERMISSION_METADATA_KEY,
    permissions.length === 1 ? permissions[0] : permissions,
  );

export const RequirePermissions = RequireAdminPermission;


