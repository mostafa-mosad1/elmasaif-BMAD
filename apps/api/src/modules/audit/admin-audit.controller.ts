import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  auditLogQuerySchema,
  AuditLogQueryInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { AuditService } from './audit.service';

@ApiTags('Admin Forensic Audit Operations')
@Controller('admin/audit')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Audit.View')
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search and inspect paginated immutable audit logs (Audit.View)',
    description:
      'Returns paginated audit records with multi-attribute filtering by actor, action, entity, date range, and free-text search.',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit records retrieved' })
  async getAuditLogs(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQueryInput,
    @Req() req: any,
  ) {
    const data = await this.auditService.findAuditLogs(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع سجلات التدقيق بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inspect single audit log detail with state snapshots (Audit.View)',
    description:
      'Returns complete forensic detail including before/after snapshots, changed keys, IP address, and metadata.',
  })
  @ApiResponse({ status: 200, description: 'Audit log detail record retrieved' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getAuditLogById(@Param('id') id: string, @Req() req: any) {
    const data = await this.auditService.getAuditLogById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع تفاصيل سجل التدقيق بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve chronological audit trail for a domain entity (Audit.View)',
    description:
      'Returns full historical transitions for a specific entity ID ordered by timestamp desc.',
  })
  @ApiResponse({ status: 200, description: 'Entity audit history retrieved' })
  async getEntityAuditHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Req() req: any,
  ) {
    const data = await this.auditService.getEntityAuditHistory(
      entityType,
      entityId,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع سجل الكيان بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

