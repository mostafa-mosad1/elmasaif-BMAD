import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import {
  FinalApproveDealInput,
  RejectSellerCancelInput,
  finalApproveDealSchema,
  rejectSellerCancelSchema,
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import { DealsService } from './deals.service';
import { DealsCancellationService } from './deals-cancellation.service';
import { FinalApproveDealDto } from './dto/final-approve-deal.dto';

/**
 * Final approval of an agreed offer into a `Deal` (Story 5.1 / FR-28, AD-2, AD-12).
 * Administrative review of seller cancellation requests (Story 5.6 / UC-46, AD-10).
 *
 * Deviation from the architecture spine's illustrative `POST /admin/deals/:id/final-approve`:
 * no deal id exists before approval, so the *offer* is the subject and it travels in the body.
 * Grouping under `admin/deals` keeps Stories 5.3/5.6 in the same namespace.
 */
@ApiTags('Admin Deals')
@ApiBearerAuth()
@Controller('admin/deals')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminDealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly dealsCancellationService: DealsCancellationService,
  ) {}

  @Post('final-approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Deals.FinalApprove')
  @ApiOperation({
    summary:
      'SELECTED_PENDING_FINAL_ADMIN_APPROVAL → CONVERTED_TO_DEAL, binding a frozen Deal (FR-28/FR-29)',
    description:
      'Atomically creates the Deal with frozen financial and payout snapshots, reserves the listing and releases the mediation lease.',
  })
  @ApiBody({ type: FinalApproveDealDto })
  @ApiResponse({ status: 200, description: 'Deal created and listing reserved' })
  @ApiResponse({
    status: 409,
    description:
      'OFFER_LOCK_* / OFFER_INVALID_STATE_TRANSITION / OFFER_ALREADY_EXPIRED / DEAL_LISTING_UNAVAILABLE / DEAL_ALREADY_ACTIVE_FOR_LISTING / DEAL_SELLER_PAYOUT_REQUIRED',
  })
  async finalApprove(
    @Body(new ZodValidationPipe(finalApproveDealSchema))
    body: FinalApproveDealInput,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.dealsService.finalApprove(body.offerId, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إنشاء الصفقة وحجز الإعلان بنجاح',
      data,
    };
  }

  @Post(':id/seller-cancel/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Deals.DisputeResolve')
  @ApiOperation({ summary: 'Approve seller deal cancellation request (AC-3)' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Seller cancellation approved and listing reverted to ACTIVE' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'SELLER_CANCEL_REQUEST_NOT_FOUND / DEAL_CANCEL_INVALID_STATE' })
  async approveSellerCancel(
    @Param('id') id: string,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.dealsCancellationService.approveSellerCancellation(req.admin.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اعتماد إلغاء الصفقة وإعادة العقار للعرض النشط',
      data,
    };
  }

  @Post(':id/seller-cancel/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Deals.DisputeResolve')
  @ApiOperation({ summary: 'Reject seller deal cancellation request (AC-3)' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Seller cancellation request rejected' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'SELLER_CANCEL_REQUEST_NOT_FOUND' })
  async rejectSellerCancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectSellerCancelSchema)) body: RejectSellerCancelInput,
    @Req() req: { admin: AuthenticatedAdminActor },
  ) {
    const data = await this.dealsCancellationService.rejectSellerCancellation(req.admin.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض طلب إلغاء الصفقة واستمرار المعاملة',
      data,
    };
  }
}

