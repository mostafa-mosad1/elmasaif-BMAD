import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminInquiriesService } from './admin-inquiries.service';
import {
  CloseInquiryDto,
  ForceUnlockInquiryDto,
  RelayInquiryDto,
} from './dto/inquiry.dto';
import {
  CloseInquiryInput,
  InquiryQueueQuery,
  RelayInquiryInput,
  closeInquirySchema,
  inquiryQueueQuerySchema,
  parseIfMatchVersion,
  relayInquirySchema,
} from '@elmasaif/shared';

/**
 * Administrative conversation queue for mediated listing inquiries (Story 4.4 / AC-3, AC-5; Story 8.3).
 * `ListingInquiry` is one of the claim-locked queues (AD-10) gated by `Conversations.Handle`;
 * breaking someone else's lease additionally needs `Tasks.ForceUnlock`.
 */
@ApiTags('Admin Conversation Queue')
@ApiBearerAuth()
@Controller(['admin/inquiries', 'admin/conversations'])
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminInquiriesController {
  constructor(private readonly adminInquiriesService: AdminInquiriesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle')
  @ApiOperation({
    summary: 'List inquiries awaiting a relay decision (PENDING_ADMIN_REVIEW, SELLER_RESPONDED)',
    description:
      'Paginated, oldest-first, with the active 15-minute claim lock and its holder name. No claim on read (AD-10: claiming is an explicit POST).',
  })
  @ApiResponse({ status: 200, description: 'Conversation queue retrieved successfully' })
  async getQueue(
    @Query(new ZodValidationPipe(inquiryQueueQuerySchema)) query: InquiryQueueQuery,
    @Req() req: any,
  ) {
    const data = await this.adminInquiriesService.getQueue(query, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle')
  @ApiOperation({ summary: 'One mediated inquiry thread with its lock state (all messages)' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiResponse({ status: 200, description: 'Thread returned' })
  @ApiResponse({ status: 404, description: 'INQUIRY_NOT_FOUND' })
  async getInquiry(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminInquiriesService.getInquiry(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle')
  @ApiOperation({ summary: 'Claim the 15-minute conversation lease (AD-10)' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiResponse({ status: 200, description: 'Lease acquired or renewed' })
  @ApiResponse({ status: 409, description: 'INQUIRY_LOCK_CONFLICT (holder returned in lockInfo)' })
  async claimInquiry(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminInquiriesService.claimInquiry(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استلام المحادثة لمدة 15 دقيقة',
      data,
    };
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle')
  @ApiOperation({ summary: "Extend the caller's own conversation lease by 15 minutes" })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiResponse({ status: 200, description: 'Lease extended' })
  @ApiResponse({
    status: 409,
    description: 'INQUIRY_LOCK_REQUIRED / INQUIRY_LOCK_CONFLICT / INQUIRY_LOCK_EXPIRED',
  })
  async heartbeatInquiry(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminInquiriesService.heartbeatInquiry(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تمديد قفل المحادثة',
      data,
    };
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle')
  @ApiOperation({ summary: 'Release the conversation lease without a decision' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiResponse({ status: 200, description: 'Lease released' })
  async releaseInquiry(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminInquiriesService.releaseInquiry(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحرير قفل المحادثة',
      data,
    };
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({
    summary: "Force-unlock another administrator's conversation lease with a documented reason",
  })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiBody({ type: ForceUnlockInquiryDto })
  @ApiResponse({ status: 200, description: 'Lease broken and audited' })
  @ApiResponse({ status: 400, description: 'INQUIRY_FORCE_UNLOCK_REASON_REQUIRED' })
  async forceUnlockInquiry(
    @Param('id') id: string,
    @Body() body: ForceUnlockInquiryDto,
    @Req() req: any,
  ) {
    const data = await this.adminInquiriesService.forceUnlockInquiry(
      id,
      req.admin,
      body?.reason,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء قفل المحادثة وتسجيل السبب',
      data,
    };
  }

  @Post(':id/relay-to-seller')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle', 'Conversations.Relay')
  @ApiOperation({
    summary: 'PENDING_ADMIN_REVIEW → RELAYED_TO_SELLER and stamp the buyer messages (AC-4)',
  })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiBody({ type: RelayInquiryDto })
  @ApiResponse({ status: 200, description: 'Inquiry relayed to the seller' })
  @ApiResponse({ status: 409, description: 'INQUIRY_LOCK_* / INQUIRY_INVALID_STATE_TRANSITION' })
  async relayToSeller(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(relayInquirySchema)) body: RelayInquiryInput,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminInquiriesService.relayToSeller(
      id,
      req.admin,
      body?.note,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إحالة الاستفسار إلى البائع',
      data,
    };
  }

  @Post(':id/relay-to-buyer')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle', 'Conversations.Relay')
  @ApiOperation({
    summary: 'SELLER_RESPONDED → RELAYED_TO_BUYER and stamp the seller messages (AC-4)',
  })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiBody({ type: RelayInquiryDto })
  @ApiResponse({ status: 200, description: 'Reply relayed to the buyer' })
  @ApiResponse({ status: 409, description: 'INQUIRY_LOCK_* / INQUIRY_INVALID_STATE_TRANSITION' })
  async relayToBuyer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(relayInquirySchema)) body: RelayInquiryInput,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminInquiriesService.relayToBuyer(
      id,
      req.admin,
      body?.note,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إحالة رد البائع إلى المشتري',
      data,
    };
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Conversations.Handle', 'Conversations.Relay')
  @ApiOperation({ summary: 'Close the thread with a documented reason → CLOSED (terminal)' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiBody({ type: CloseInquiryDto })
  @ApiResponse({ status: 200, description: 'Thread closed and audited' })
  @ApiResponse({ status: 409, description: 'INQUIRY_LOCK_* / INQUIRY_CLOSED' })
  async closeInquiry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeInquirySchema)) body: CloseInquiryInput,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminInquiriesService.closeInquiry(
      id,
      req.admin,
      body.reason,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إغلاق المحادثة وتسجيل السبب',
      data,
    };
  }
}
