import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ADMIN_USER_HARD_DELETED,
  ADMIN_USER_STATUS_CHANGED,
  adminHardDeleteUserRequestSchema,
  AdminHardDeleteUserRequestInput,
  adminUpdateUserStatusRequestSchema,
  AdminUpdateUserStatusRequestInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedAdminRequest } from '../auth/admin-auth.controller';
import { RequirePermissions } from '../auth/decorators/require-admin-permission.decorator';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin Platform User Governance')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @RequirePermissions('Users.View')
  @ApiOperation({
    summary:
      'List platform user accounts with status, soft-delete timestamp, and transactionHistoryCount (Users.View)',
  })
  async listUsers(@Req() req: AuthenticatedAdminRequest) {
    const users = await this.adminUsersService.listUsers();

    return {
      code: 'ADMIN_USERS_LIST',
      message: 'تم استرجاع قائمة حسابات المستخدمين بنجاح',
      data: {
        users,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Post(':userId/status')
  @RequirePermissions('Users.Status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Enable, disable, or soft-delete a platform user account and revoke active sessions (Users.Status)',
  })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(adminUpdateUserStatusRequestSchema))
    dto: AdminUpdateUserStatusRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const user = await this.adminUsersService.updateUserStatus(
      req.admin.id,
      userId,
      dto,
      ip
    );

    return {
      code: ADMIN_USER_STATUS_CHANGED,
      message:
        dto.action === 'ENABLE'
          ? 'تم تفعيل حساب المستخدم بنجاح'
          : dto.action === 'SOFT_DELETE'
            ? 'تم الحذف الناعم لحساب المستخدم وإلغاء جلساته النشطة مع الاحتفاظ بسجلاته'
            : 'تم تعطيل حساب المستخدم وإلغاء جلساته النشطة فوراً',
      data: {
        user,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Delete(':userId')
  @RequirePermissions('Users.HardDelete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Guarded hard-delete of a platform user account; strictly blocked with 409 USER_HARD_DELETE_HISTORY_EXISTS if any transaction history exists (Users.HardDelete)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User permanently deleted' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Hard deletion blocked due to existing transaction history (BR-18 / FR-43)',
  })
  async hardDeleteUser(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(adminHardDeleteUserRequestSchema))
    dto: AdminHardDeleteUserRequestInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const result = await this.adminUsersService.hardDeleteUser(
      req.admin.id,
      userId,
      dto,
      ip
    );

    return {
      code: ADMIN_USER_HARD_DELETED,
      message: 'تم الحذف النهائي لحساب المستخدم لعدم وجود أي سجل معاملات مرتبط به',
      data: result,
      requestId: req.headers['x-request-id'],
    };
  }
}

