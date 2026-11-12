import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ADMIN_PERMISSIONS_UPDATED,
  ADMIN_STAFF_CREATED,
  ADMIN_STAFF_HARD_DELETED,
  ADMIN_STAFF_SOFT_DELETED,
  ADMIN_STAFF_STATUS_CHANGED,
  adminCreateStaffRequestSchema,
  AdminCreateStaffRequestInput,
  adminHardDeleteStaffRequestSchema,
  AdminHardDeleteStaffRequestInput,
  adminUpdateStaffPermissionsRequestSchema,
  AdminUpdateStaffPermissionsRequestInput,
  adminUpdateStaffStatusRequestSchema,
  AdminUpdateStaffStatusRequestInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthService } from './admin-auth.service';
import { AuthenticatedAdminRequest } from './admin-auth.controller';
import { RequirePermissions } from './decorators/require-admin-permission.decorator';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminSessionAuthGuard } from './guards/admin-session-auth.guard';

@ApiTags('Admin Staff & Dynamic RBAC Management')
@Controller('admin/staff')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequirePermissions('Rbac.Manage')
export class AdminStaffController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all administrative staff accounts, permission catalog groups, and role presets (Rbac.Manage)',
  })
  async listStaff(@Req() req: AuthenticatedAdminRequest) {
    const result = await this.adminAuthService.listStaffWithCatalog(
      req.admin.role,
      req.admin.permissions
    );

    return {
      code: 'ADMIN_STAFF_LIST',
      message: 'تم استرجاع قائمة الموظفين وكتالوج الصلاحيات بنجاح',
      data: result,
      requestId: req.headers['x-request-id'],
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a new administrative staff account with granular Area.Action permissions (Rbac.Manage)',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Staff account created' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Duplicate username or email' })
  async createStaff(
    @Body(new ZodValidationPipe(adminCreateStaffRequestSchema))
    dto: AdminCreateStaffRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const staff = await this.adminAuthService.createStaffAccount(
      req.admin.id,
      req.admin.role,
      dto,
      ip,
      req.admin.permissions
    );

    return {
      code: ADMIN_STAFF_CREATED,
      message: 'تم إنشاء حساب الموظف وتخصيص صلاحياته بنجاح',
      data: {
        staff,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Patch(':adminId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Update staff role, fullName, and granular permissions matrix with immediate session revocation (Rbac.Manage)',
  })
  async updateStaffPermissions(
    @Param('adminId') targetAdminId: string,
    @Body(new ZodValidationPipe(adminUpdateStaffPermissionsRequestSchema))
    dto: AdminUpdateStaffPermissionsRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const staff = await this.adminAuthService.updateStaffPermissions(
      req.admin.id,
      req.admin.role,
      targetAdminId,
      dto,
      ip,
      req.admin.permissions
    );

    return {
      code: ADMIN_PERMISSIONS_UPDATED,
      message:
        'تم تحديث مصفوفة صلاحيات الموظف وإلغاء جلساته النشطة لتطبيق الصلاحيات فوراً',
      data: {
        staff,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Post(':adminId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Enable, disable, or soft-delete a staff account with immediate session revocation (Rbac.Manage)',
  })
  async updateStaffStatus(
    @Param('adminId') targetAdminId: string,
    @Body(new ZodValidationPipe(adminUpdateStaffStatusRequestSchema))
    dto: AdminUpdateStaffStatusRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const staff = await this.adminAuthService.updateStaffStatus(
      req.admin.id,
      req.admin.role,
      targetAdminId,
      dto,
      ip,
      req.admin.permissions
    );

    const code =
      dto.action === 'SOFT_DELETE'
        ? ADMIN_STAFF_SOFT_DELETED
        : ADMIN_STAFF_STATUS_CHANGED;

    return {
      code,
      message:
        dto.action === 'ENABLE'
          ? 'تم تفعيل حساب الموظف بنجاح'
          : dto.action === 'SOFT_DELETE'
            ? 'تم الحذف الناعم لحساب الموظف وإلغاء جلساته النشطة مع حفظ سجلات التدقيق'
            : 'تم تعطيل حساب الموظف وإلغاء جلساته النشطة فوراً',
      data: {
        staff,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Delete(':adminId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Guarded hard-delete of a staff account; strictly blocked with 409 ADMIN_HARD_DELETE_HISTORY_EXISTS if any operational/audit history exists',
  })
  async hardDeleteStaff(
    @Param('adminId') targetAdminId: string,
    @Body(new ZodValidationPipe(adminHardDeleteStaffRequestSchema))
    dto: AdminHardDeleteStaffRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const result = await this.adminAuthService.hardDeleteStaff(
      req.admin.id,
      req.admin.role,
      targetAdminId,
      dto,
      ip,
      req.admin.permissions
    );

    return {
      code: ADMIN_STAFF_HARD_DELETED,
      message: 'تم الحذف النهائي لحساب الموظف لعدم وجود أي سجل عمليات مرتبط به',
      data: result,
      requestId: req.headers['x-request-id'],
    };
  }
}

