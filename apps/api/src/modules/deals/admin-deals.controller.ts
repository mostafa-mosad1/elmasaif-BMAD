import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FinalApproveDealInput, finalApproveDealSchema } from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedAdminActor } from '../listings/admin-listings.service';
import { DealsService } from './deals.service';
import { FinalApproveDealDto } from './dto/final-approve-deal.dto';

/**
 * Final approval of an agreed offer into a `Deal` (Story 5.1 / FR-28, AD-2, AD-12).
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
  constructor(private readonly dealsService: DealsService) {}

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
}
