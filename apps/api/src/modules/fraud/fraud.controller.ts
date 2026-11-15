import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FraudService } from './fraud.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createFraudLogSchema,
  resolveFraudLogSchema,
  CreateFraudLogInput,
  ResolveFraudLogInput,
  FraudEventType,
  FraudSeverity,
  FraudStatus,
} from '@elmasaif/shared';

@ApiTags('Admin Fraud Management')
@Controller('admin/fraud')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Fraud.View', 'Compliance.Manage', 'Security.Manage')
  @ApiOperation({ summary: 'List and filter fraud and suspicious activity logs' })
  @ApiResponse({ status: 200, description: 'Paginated fraud logs retrieved successfully' })
  async getFraudLogs(
    @Query('status') status?: FraudStatus,
    @Query('severity') severity?: FraudSeverity,
    @Query('eventType') eventType?: FraudEventType,
    @Query('targetUserId') targetUserId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.fraudService.getFraudLogs({
      status,
      severity,
      eventType,
      targetUserId,
      search,
      page,
      limit,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع سجلات مكافحة الاحتيال بنجاح',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireAdminPermission('Compliance.Manage', 'Security.Manage')
  @ApiOperation({ summary: 'Log suspicious fraud activity with optional penalty or suspension' })
  @ApiResponse({ status: 201, description: 'Fraud case logged successfully' })
  async createFraudLog(
    @Body(new ZodValidationPipe(createFraudLogSchema)) body: CreateFraudLogInput,
    @Req() req: any,
  ) {
    const data = await this.fraudService.createFraudLog(req.admin.id, body);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم تسجيل حالة الاشتباه بنجاح',
      data,
    };
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Compliance.Manage', 'Security.Manage')
  @ApiOperation({ summary: 'Resolve or dismiss fraud case with resolution notes' })
  @ApiResponse({ status: 200, description: 'Fraud case resolved successfully' })
  async resolveFraudLog(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveFraudLogSchema)) body: ResolveFraudLogInput,
    @Req() req: any,
  ) {
    const data = await this.fraudService.resolveFraudLog(req.admin.id, id, body);

    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحديث ومعالجة حالة الاشتباه بنجاح',
      data,
    };
  }
}

