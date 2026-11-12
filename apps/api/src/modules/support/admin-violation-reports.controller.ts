import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  adjudicateViolationReportSchema,
  AdjudicateViolationReportInput,
  adminViolationQueueQuerySchema,
  AdminViolationQueueQueryInput,
  dismissViolationReportSchema,
  DismissViolationReportInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ViolationReportsService } from './violation-reports.service';

@ApiTags('Admin Violation Reports Operations')
@Controller('admin/reports')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Reports.Handle')
export class AdminViolationReportsController {
  constructor(
    private readonly violationReportsService: ViolationReportsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List paginated violation reports queue with KPI counts (Reports.Handle)',
  })
  async getQueue(
    @Req() req: any,
    @Query(new ZodValidationPipe(adminViolationQueueQuerySchema))
    query: AdminViolationQueueQueryInput,
  ) {
    const result = await this.violationReportsService.getQueue(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع طابور بلاغات المخالفات بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full violation report details with evidence and audit history (Reports.Handle)',
  })
  async getReportById(@Req() req: any, @Param('id') id: string) {
    const result = await this.violationReportsService.getReportById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع تفاصيل بلاغ المخالفة بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Post(':id/adjudicate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Adjudicate a violation report with legal action and notes (Reports.Handle)',
  })
  async adjudicateReport(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjudicateViolationReportSchema))
    body: AdjudicateViolationReportInput,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;
    const result = await this.violationReportsService.adjudicateReport(
      id,
      body,
      req.admin,
      ipAddress,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اتخاذ الإجراء النظامي على البلاغ بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dismiss a violation report with justification notes (Reports.Handle)',
  })
  async dismissReport(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dismissViolationReportSchema))
    body: DismissViolationReportInput,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;
    const result = await this.violationReportsService.dismissReport(
      id,
      body,
      req.admin,
      ipAddress,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استبعاد البلاغ بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

