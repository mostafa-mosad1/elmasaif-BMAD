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
import { AdminOffersService } from './admin-offers.service';
import {
  AdminRejectOfferDto,
  ForceUnlockOfferDto,
} from './dto/respond-to-offer.dto';
import {
  AdminRejectOfferInput,
  OfferQueueQuery,
  adminRejectOfferSchema,
  offerQueueQuerySchema,
  parseIfMatchVersion,
} from '@elmasaif/shared';

/**
 * Administrative mediation queue for purchase offers (Story 4.2 / FR-26, FR-55, AC#1/4/6/9).
 * `Offer` is one of the 8 claim-locked queues (AD-10) gated by `Offers.Review`; breaking
 * someone else's lease additionally needs `Tasks.ForceUnlock`.
 */
@ApiTags('Admin Offer Mediation Queue')
@ApiBearerAuth()
@Controller('admin/offers')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminOffersController {
  constructor(private readonly adminOffersService: AdminOffersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'List offers awaiting mediation (PENDING_ADMIN_REVIEW, COUNTER_OFFERED)',
    description:
      'Paginated, oldest-first, with the active 15-minute claim lock and its holder name. No task claim on read (AD-10: claiming is an explicit POST).',
  })
  @ApiResponse({ status: 200, description: 'Mediation queue retrieved successfully' })
  async getQueue(
    @Query(new ZodValidationPipe(offerQueueQuerySchema)) query: OfferQueueQuery,
    @Req() req: any,
  ) {
    const data = await this.adminOffersService.getQueue(query, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({ summary: 'One mediated offer thread with its lock state' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Thread returned' })
  @ApiResponse({ status: 404, description: 'OFFER_NOT_FOUND' })
  async getOffer(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminOffersService.getOffer(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({ summary: 'Claim the 15-minute mediation lease (AD-10)' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Lease acquired or renewed' })
  @ApiResponse({ status: 409, description: 'OFFER_LOCK_CONFLICT (holder returned in lockInfo)' })
  async claimOffer(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminOffersService.claimOffer(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استلام مهمة الوساطة لمدة 15 دقيقة',
      data,
    };
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({ summary: "Extend the caller's own mediation lease by 15 minutes" })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Lease extended' })
  @ApiResponse({
    status: 409,
    description: 'OFFER_LOCK_REQUIRED / OFFER_LOCK_CONFLICT / OFFER_LOCK_EXPIRED',
  })
  async heartbeatOffer(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminOffersService.heartbeatOffer(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تمديد قفل الوساطة',
      data,
    };
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({ summary: 'Release the mediation lease without a decision' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Lease released' })
  async releaseOffer(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminOffersService.releaseOffer(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحرير قفل الوساطة',
      data,
    };
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({
    summary: 'Force-unlock another administrator\'s mediation lease with a documented reason',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiBody({ type: ForceUnlockOfferDto })
  @ApiResponse({ status: 200, description: 'Lease broken and audited' })
  @ApiResponse({ status: 400, description: 'OFFER_FORCE_UNLOCK_REASON_REQUIRED' })
  async forceUnlockOffer(
    @Param('id') id: string,
    @Body() body: ForceUnlockOfferDto,
    @Req() req: any,
  ) {
    const data = await this.adminOffersService.forceUnlockOffer(
      id,
      req.admin,
      body?.reason,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء قفل الوساطة وتسجيل السبب',
      data,
    };
  }

  @Post(':id/relay-to-seller')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review', 'Offers.Manage')
  @ApiOperation({
    summary: 'PENDING_ADMIN_REVIEW → RELAYED_TO_SELLER with a fresh 7-day expiry (FR-26)',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Offer relayed to the seller' })
  @ApiResponse({
    status: 409,
    description: 'OFFER_LOCK_* / OFFER_INVALID_STATE_TRANSITION / OFFER_ALREADY_EXPIRED',
  })
  async relayToSeller(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminOffersService.relayToSeller(
      id,
      req.admin,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إرسال العرض إلى البائع',
      data,
    };
  }

  @Post(':id/relay-to-buyer')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review', 'Offers.Manage')
  @ApiOperation({
    summary: 'COUNTER_OFFERED → RELAYED_TO_BUYER with a fresh 7-day expiry (FR-26)',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Counter-offer relayed to the buyer' })
  @ApiResponse({
    status: 409,
    description: 'OFFER_LOCK_* / OFFER_INVALID_STATE_TRANSITION / OFFER_ALREADY_EXPIRED',
  })
  async relayToBuyer(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminOffersService.relayToBuyer(
      id,
      req.admin,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إرسال العرض المضاد إلى المشتري',
      data,
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review', 'Offers.Manage')
  @ApiOperation({
    summary: 'Reject the mediated terms with a mandatory reason → REJECTED_BY_ADMIN (AC#6)',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiBody({ type: AdminRejectOfferDto })
  @ApiResponse({ status: 200, description: 'Offer rejected administratively and audited' })
  @ApiResponse({ status: 409, description: 'OFFER_LOCK_* / OFFER_INVALID_STATE_TRANSITION' })
  async rejectOffer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminRejectOfferSchema)) body: AdminRejectOfferInput,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data = await this.adminOffersService.rejectOffer(
      id,
      req.admin,
      body.reason,
      expectedVersion,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض العرض إدارياً وتسجيل السبب',
      data,
    };
  }
}
