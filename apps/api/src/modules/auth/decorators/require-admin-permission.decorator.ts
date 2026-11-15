import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSION_METADATA_KEY = 'required_admin_permission';

export const RequireAdminPermission = (...permissions: (string | string[])[]) => {
  const flattened = permissions.flat();
  return SetMetadata(
    ADMIN_PERMISSION_METADATA_KEY,
    flattened.length === 1 ? flattened[0] : flattened,
  );
};

export const RequirePermissions = RequireAdminPermission;


