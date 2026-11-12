import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  updatePlatformSettingsSchema,
  UpdatePlatformSettingsInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('Admin Platform Settings Operations')
@Controller('admin/settings')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Settings.Manage', 'Settings.Commission')
export class AdminSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get complete platform configuration (Settings.Manage or Settings.Commission)',
  })
  async getSettings(@Req() req: any) {
    const data = await this.platformSettingsService.getSettings();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع إعدادات المنصة بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update platform parameters with justification and immutable audit log',
  })
  async updateSettings(
    @Req() req: any,
    @Body(new ZodValidationPipe(updatePlatformSettingsSchema))
    body: UpdatePlatformSettingsInput,
  ) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const ipAddress =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.socket?.remoteAddress ||
      req.ip;

    const data = await this.platformSettingsService.updateSettings(
      body,
      req.admin,
      ipAddress,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحديث إعدادات المنصة وتوثيق التغيير في سجل التدقيق بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get chronological audit log trail of platform settings alterations',
  })
  async getAuditHistory(@Req() req: any) {
    const data = await this.platformSettingsService.getAuditHistory();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع سجل تدقيق تعديلات إعدادات المنصة بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

