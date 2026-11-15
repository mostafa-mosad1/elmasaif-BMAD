import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { FinanceService } from './finance.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  financialReportQuerySchema,
  FinancialReportQuery,
} from '@elmasaif/shared';

@ApiTags('Admin Finance & Accounting Reports')
@Controller('admin/finance')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('indicators')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Finance.View', 'Finance.Audit')
  @ApiOperation({ summary: 'Get aggregated financial indicators and KPIs' })
  @ApiResponse({ status: 200, description: 'Financial indicators retrieved successfully' })
  async getIndicators(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
  ) {
    const data = await this.financeService.getIndicators(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم احتساب المؤشرات المالية بنجاح',
      data,
    };
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Finance.View', 'Finance.Audit')
  @ApiOperation({ summary: 'Get paginated financial transactions' })
  @ApiResponse({ status: 200, description: 'Financial transactions retrieved successfully' })
  async getTransactions(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
  ) {
    const data = await this.financeService.getTransactions(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع سجل المعاملات المالية بنجاح',
      data,
    };
  }

  @Get('export')
  @RequireAdminPermission('Finance.Export')
  @ApiOperation({ summary: 'Export financial transactions report as Excel-compatible CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportReport(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { csvContent, filename } = await this.financeService.exportReportCsv(
      req.admin.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(HttpStatus.OK).send(csvContent);
  }
}

