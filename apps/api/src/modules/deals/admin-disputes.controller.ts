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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AdjudicateDisputeInput,
  adjudicateDisputeSchema,
  ForceUnlockDisputeInput,
  forceUnlockDisputeSchema,
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import { DisputesService } from './disputes.service';

/**
 * Story 5.6 / AC-7, AC-8: Super Admin Dispute Adjudication Back-Office Controller.
 *
 * Dedicated admin realm back-office endpoints protected by `Deals.DisputeResolve` permission.
 * Provides queue listing, 15-minute lease management, and binding adjudication decisions.
 */
@ApiTags('Admin Deal Disputes')
@ApiBearerAuth()
@Controller('admin/disputes')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('Deals.DisputeResolve')
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paginated queue of deal disputes (AC-7)' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'RESOLVED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Dispute queue returned with claim lock info' })
  async getQueue(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.getDisputesQueue(
      { status, page, limit },
      req!.admin.id,
    );
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dispute details with full deal snapshot and claim lock info' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiResponse({ status: 200, description: 'Dispute details returned' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  async getById(
    @Param('id') id: string,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.getDisputeById(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acquire 15-minute exclusive adjudication claim lease (AC-7)' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiResponse({ status: 200, description: 'Dispute claimed' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DISPUTE_LOCK_CONFLICT / DISPUTE_NOT_CLAIMABLE' })
  async claim(
    @Param('id') id: string,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.claimDispute(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حجز النزاع بنجاح لمدة 15 دقيقة',
      data,
    };
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend active claim lease by 15 minutes (heartbeat) (AC-7)' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiResponse({ status: 200, description: 'Dispute lease renewed' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DISPUTE_LOCK_REQUIRED / DISPUTE_LOCK_CONFLICT / DISPUTE_LOCK_EXPIRED' })
  async renew(
    @Param('id') id: string,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.renewDisputeLock(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تجديد حجز النزاع بنجاح',
      data,
    };
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Voluntarily release active claim lease back to queue (AC-7)' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiResponse({ status: 200, description: 'Dispute released' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DISPUTE_LOCK_REQUIRED / DISPUTE_LOCK_CONFLICT' })
  async release(
    @Param('id') id: string,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.releaseDisputeLock(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء حجز النزاع وإعادته إلى قائمة الانتظار',
      data,
    };
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin override force unlock with mandatory reason note (AC-7)' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', minLength: 5, maxLength: 500 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Dispute force-unlocked' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  async forceUnlock(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(forceUnlockDisputeSchema)) body: ForceUnlockDisputeInput,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.forceUnlockDispute(id, req.admin.id, body.reason);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم فك حجز النزاع بنجاح',
      data,
    };
  }

  @Post(':id/adjudicate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute binding dispute adjudication verdict (AC-8, FR-36, UC-70C)' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action', 'notes'],
      properties: {
        action: { type: 'string', enum: ['COMPLETE', 'CANCEL', 'RETURN_TO_REVIEW'] },
        notes: { type: 'string', minLength: 5, maxLength: 2000 },
        newDeadlineHours: { type: 'integer', minimum: 1, maximum: 168 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Binding verdict applied' })
  @ApiResponse({ status: 403, description: 'DISPUTE_SELF_ADJUDICATION_FORBIDDEN' })
  @ApiResponse({ status: 404, description: 'DISPUTE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DISPUTE_LOCK_REQUIRED / DISPUTE_LOCK_CONFLICT / DISPUTE_LOCK_EXPIRED / DISPUTE_NOT_CLAIMABLE' })
  async adjudicate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjudicateDisputeSchema)) body: AdjudicateDisputeInput,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.disputesService.adjudicateDispute(id, req.admin, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إصدار القرار الإداري والبت في النزاع بنجاح',
      data,
    };
  }
}

