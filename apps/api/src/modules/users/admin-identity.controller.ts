import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AUTH_NOT_AUTHORIZED,
  IDENTITY_INVALID_DOCUMENT,
  AdminRole,
  adminRejectIdentitySchema,
  adminVerifyIdentitySchema,
  resolveAdminPermissions,
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { IdentityService } from './identity.service';

export type IdentityAdminPermission =
  | 'Users.View'
  | 'Users.Verify'
  | 'Users.Review'
  | 'Audit.View'
  | 'Compliance.Review';
export const IDENTITY_ADMIN_PERMISSIONS = 'identity-admin-permissions';

export const RequireIdentityAdminPermissions = (...permissions: IdentityAdminPermission[]) =>
  SetMetadata(IDENTITY_ADMIN_PERMISSIONS, permissions);

@Injectable()
export class AdminIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const admin = request.admin;
    const requiredPermissions = Reflect.getMetadata(
      IDENTITY_ADMIN_PERMISSIONS,
      context.getHandler()
    ) as IdentityAdminPermission[] | undefined;

    if (!admin?.id || !admin.isActive || admin.deletedAt || !requiredPermissions?.length) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'لا تملك صلاحية الوصول إلى مراجعة وثائق الهوية'
      });
    }

    if (admin.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    const effectivePermissions = resolveAdminPermissions(
      admin.role as AdminRole,
      admin.permissions
    );

    const rolePermissions: Record<AdminRole, IdentityAdminPermission[]> = {
      [AdminRole.SUPER_ADMIN]: ['Users.View', 'Users.Verify', 'Users.Review', 'Audit.View', 'Compliance.Review'],
      [AdminRole.MODERATOR]: ['Users.View', 'Users.Verify', 'Users.Review'],
      [AdminRole.COMPLIANCE_OFFICER]: ['Users.View', 'Users.Verify', 'Audit.View', 'Compliance.Review'],
      [AdminRole.FINANCIAL_AUDITOR]: ['Users.View', 'Audit.View']
    };

    const hasDynamicMatch = requiredPermissions.some((permission) => {
      if (effectivePermissions.includes(permission)) return true;
      if (permission === 'Users.Review' && effectivePermissions.includes('Users.Verify')) {
        return true;
      }
      if (
        permission === 'Compliance.Review' &&
        (effectivePermissions.includes('Users.Verify') ||
          effectivePermissions.includes('Compliance.Manage') ||
          effectivePermissions.includes('Compliance.View'))
      ) {
        return true;
      }
      return false;
    });

    if (
      hasDynamicMatch ||
      (!admin.permissions?.length &&
        requiredPermissions.some((permission) =>
          rolePermissions[admin.role as AdminRole]?.includes(permission)
        ))
    ) {
      return true;
    }
    throw new ForbiddenException({
      code: AUTH_NOT_AUTHORIZED,
      message: 'الدور الإداري لا يملك الصلاحية المطلوبة لوثائق الهوية'
    });
  }
}

@ApiTags('Administrative Identity Review')
@Controller('admin/identity')
@UseGuards(AdminSessionAuthGuard, AdminIdentityGuard)
export class AdminIdentityController {
  constructor(
    private readonly identityService: IdentityService
  ) {}

  @Get('list')
  @ApiOperation({ summary: 'List identity documents filtered by status with statistics' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @RequireIdentityAdminPermissions('Users.Review', 'Compliance.Review', 'Users.View')
  async getList(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return {
      code: 'SUCCESS',
      data: await this.identityService.getIdentityDocumentsList({
        status,
        page: this.parsePositiveInteger(page, 1, 'page'),
        limit: this.parsePositiveInteger(limit, 20, 'limit', 100),
        search: search?.trim(),
      }),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get summary statistics of identity documents and user statuses' })
  @RequireIdentityAdminPermissions('Users.Review', 'Compliance.Review', 'Users.View')
  async getStats(@Req() req: any) {
    return {
      code: 'SUCCESS',
      data: await this.identityService.getIdentityReviewStats(),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Get('pending')
  @ApiOperation({ summary: 'List clean identity documents awaiting administrative review' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pending identity documents retrieved' })
  @RequireIdentityAdminPermissions('Users.Review', 'Compliance.Review')
  async getPending(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return {
      code: 'SUCCESS',
      data: await this.identityService.getPendingIdentityDocuments(
        this.parsePositiveInteger(page, 1, 'page'),
        this.parsePositiveInteger(limit, 20, 'limit', 100)
      ),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending identity document (Users.Review or Compliance.Review)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Identity document verified' })
  @RequireIdentityAdminPermissions('Users.Review', 'Compliance.Review')
  async verify(@Param('id') id: string, @Req() req: any) {
    const parsed = adminVerifyIdentitySchema.safeParse({ documentId: id });
    if (!parsed.success) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_DOCUMENT,
        message: 'معرف وثيقة الهوية غير صالح'
      });
    }
    return {
      code: 'SUCCESS',
      data: await this.identityService.verifyIdentityDocument(parsed.data.documentId, req.admin.id),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an identity document with a required reason (Users.Review or Compliance.Review)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Identity document rejected' })
  @RequireIdentityAdminPermissions('Users.Review', 'Compliance.Review')
  async reject(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const reason = typeof body === 'object' && body !== null && 'reason' in body
      ? (body as { reason?: unknown }).reason
      : undefined;
    const parsed = adminRejectIdentitySchema.safeParse({ documentId: id, reason });
    if (!parsed.success) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_DOCUMENT,
        message: 'معرف الوثيقة أو سبب الرفض غير صالح',
        details: parsed.error.format()
      });
    }
    return {
      code: 'SUCCESS',
      data: await this.identityService.rejectIdentityDocument(
        parsed.data.documentId,
        req.admin.id,
        parsed.data.reason
      ),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Generate a short-lived identity document URL (Users.View or Audit.View)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Private document URL generated' })
  @RequireIdentityAdminPermissions('Users.View', 'Audit.View')
  async getDocumentUrl(@Param('id') id: string, @Req() req: any) {
    const parsed = adminVerifyIdentitySchema.safeParse({ documentId: id });
    if (!parsed.success) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_DOCUMENT,
        message: 'معرف وثيقة الهوية غير صالح'
      });
    }
    return {
      code: 'SUCCESS',
      data: await this.identityService.getAdminIdentityDocumentDownloadUrl(parsed.data.documentId),
      requestId: req.headers?.['x-request-id']
    };
  }

  private parsePositiveInteger(value: string | undefined, defaultValue: number, field: string, max = 10_000) {
    if (value === undefined) {
      return defaultValue;
    }
    if (!/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be a positive integer`
      });
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > max) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be between 1 and ${max}`
      });
    }
    return parsed;
  }
}
