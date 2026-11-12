import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AdminRole,
  adminTicketQueueQuerySchema,
  AdminTicketQueueQueryInput,
  assignSupportTicketSchema,
  AssignSupportTicketInput,
  createTicketMessageSchema,
  CreateTicketMessageInput,
  resolveAdminPermissions,
  updateSupportTicketStatusSchema,
  UpdateSupportTicketStatusInput,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { SupportTicketsService } from './support-tickets.service';

@ApiTags('Admin Support Tickets Operations')
@Controller('admin/tickets')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Tickets.Handle')
export class AdminSupportTicketsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List paginated support tickets queue with live SLA status & KPI counts (Tickets.Handle)',
  })
  async getQueue(
    @Req() req: any,
    @Query(new ZodValidationPipe(adminTicketQueueQuerySchema))
    query: AdminTicketQueueQueryInput,
  ) {
    const result = await this.supportTicketsService.getQueue(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع طابور تذاكر الدعم الفني بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get ticket detail, chronological thread messages, and audit trail (Tickets.Handle)',
  })
  async getTicketById(@Req() req: any, @Param('id') id: string) {
    const admin = req.admin;
    const permissions = resolveAdminPermissions(
      admin.role as AdminRole,
      admin.permissions || [],
    );
    const canManageNotes =
      admin.role === AdminRole.SUPER_ADMIN ||
      permissions.includes('Notes.Manage');

    const result = await this.supportTicketsService.getTicketById(
      id,
      canManageNotes,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع تفاصيل التذكرة والمحادثة بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update ticket status with mandatory resolutionSummary for RESOLVED/CLOSED (Tickets.Handle)',
  })
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupportTicketStatusSchema))
    body: UpdateSupportTicketStatusInput,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;
    const result = await this.supportTicketsService.updateStatus(
      id,
      body,
      req.admin,
      ipAddress,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحديث حالة التذكرة بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign ticket to an administrator (Tickets.Handle)',
  })
  async assignTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignSupportTicketSchema))
    body: AssignSupportTicketInput,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;
    const result = await this.supportTicketsService.assignTicket(
      id,
      body.adminId,
      req.admin,
      ipAddress,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تعيين المشرف المسؤول عن التذكرة بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add public response or internal staff note (Notes.Manage for internal)',
  })
  async addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTicketMessageSchema))
    body: CreateTicketMessageInput,
  ) {
    const ipAddress =
      req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress;
    const result = await this.supportTicketsService.addMessage(
      id,
      body,
      {
        id: req.admin.id,
        fullName: req.admin.fullName,
        role: req.admin.role,
        isStaff: true,
        permissions: req.admin.permissions,
      },
      ipAddress,
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: body.isInternal
        ? 'تمت إضافة الملاحظة الداخلية بنجاح'
        : 'تم إرسال الرد للعميل بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

