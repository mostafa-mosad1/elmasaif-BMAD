import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PhoneChangeService } from './phone-change.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  adminPhoneChangeSchema,
  AdminPhoneChangeInput,
  PhoneChangeCompletionResponse
} from '@elmasaif/shared';

@ApiTags('Admin User Management')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AdminSessionAuthGuard)
export class AdminPhoneChangeController {
  constructor(private readonly phoneChangeService: PhoneChangeService) {}

  @Post(':userId/phone-change')
  @RequirePermissions('Users.PhoneChange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Support-assisted administrative mobile number update (Users.PhoneChange)'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User mobile number updated administratively and audit logged'
  })
  async adminPhoneChange(
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(adminPhoneChangeSchema)) body: AdminPhoneChangeInput,
    @Req() req: any
  ): Promise<PhoneChangeCompletionResponse> {
    const admin = req.admin;
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = Array.isArray(admin?.permissions)
      ? await this.phoneChangeService.adminPhoneChange(
          admin.id,
          admin.role,
          targetUserId,
          body,
          ip,
          admin.permissions
        )
      : await this.phoneChangeService.adminPhoneChange(
          admin.id,
          admin.role,
          targetUserId,
          body,
          ip
        );

    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }
}

