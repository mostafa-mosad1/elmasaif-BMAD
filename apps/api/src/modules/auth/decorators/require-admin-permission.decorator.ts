import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSION_METADATA_KEY = 'required_admin_permission';

export const RequireAdminPermission = (permission: string) =>
  SetMetadata(ADMIN_PERMISSION_METADATA_KEY, permission);

