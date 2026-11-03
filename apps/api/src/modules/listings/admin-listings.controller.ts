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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ApproveListingInput,
  approveListingSchema,
  CreatePriceSuggestionInput,
  createPriceSuggestionSchema,
  ForceUnlockListingInput,
  forceUnlockListingSchema,
  ListingModerationQueueQuery,
  listingModerationQueueQuerySchema,
  RejectListingInput,
  rejectListingSchema,
  SuspendListingInput,
  suspendListingSchema,
  BlockListingInput,
  blockListingSchema,
  UnsuspendListingInput,
  unsuspendListingSchema,
  listingAnalyticsQuerySchema,
  ListingAnalyticsQuery,
} from '@elmasaif/shared';
import { AdminListingsService } from './admin-listings.service';

@ApiTags('Admin Listing Moderation Queue')
@ApiBearerAuth()
@Controller('admin/listings')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminListingsController {
  constructor(private readonly adminListingsService: AdminListingsService) {}

  @Get('moderation-queue')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'List property listings in the moderation queue',
    description:
      'Returns paginated listings ordered by oldest submission first (createdAt ASC) with active task claim lock status.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Moderation queue retrieved successfully',
  })
  async getModerationQueue(
    @Query(new ZodValidationPipe(listingModerationQueueQuerySchema))
    query: ListingModerationQueueQuery,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.getModerationQueue(
      query,
      req.admin.id,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get('analytics/overview')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reports.Analytics', 'Listings.Review')
  @ApiOperation({
    summary: 'Retrieve global platform-level listing engagement analytics',
  })
  async getGlobalEngagementAnalytics(
    @Query(new ZodValidationPipe(listingAnalyticsQuerySchema))
    query: ListingAnalyticsQuery,
  ) {
    const result = await this.adminListingsService.getGlobalEngagementAnalytics(
      query.days ?? 30,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Get full listing moderation detail with ADMIN_ONLY signed URLs and lock status',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async getAdminListingDetail(@Param('id') id: string, @Req() req: any) {
    const result = await this.adminListingsService.getAdminListingDetail(
      id,
      req.admin.id,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Acquire or extend a 15-minute exclusive task claim lock on a listing',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async claimListing(@Param('id') id: string, @Req() req: any) {
    const result = await this.adminListingsService.claimListing(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استلام مهمة مراجعة الإعلان وقفلها لمدة 15 دقيقة',
      data: result,
    };
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Extend an active listing moderation lock by 15 minutes from ClockService.now()',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async heartbeatListingLock(@Param('id') id: string, @Req() req: any) {
    const result = await this.adminListingsService.heartbeatListingLock(
      id,
      req.admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تمديد مهلة مراجعة الإعلان لمدة 15 دقيقة إضافية',
      data: result,
    };
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Explicitly release an active listing moderation lock',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async releaseListingLock(@Param('id') id: string, @Req() req: any) {
    const result = await this.adminListingsService.releaseListingLock(
      id,
      req.admin,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحرير مهمة مراجعة الإعلان بنجاح',
      data: result,
    };
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({
    summary: 'Super Admin Force-Unlock override with mandatory reason',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async forceUnlockListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(forceUnlockListingSchema))
    body: ForceUnlockListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.forceUnlockListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم فك القفل الإجباري للمهمة وتسجيل الإجراء في سجل التدقيق',
      data: result,
    };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Approve a PENDING_REVIEW listing and transition to ACTIVE',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async approveListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveListingSchema))
    body: ApproveListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.approveListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اعتماد الإعلان العقاري ونشره بنجاح',
      data: result,
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Review')
  @ApiOperation({
    summary: 'Reject a PENDING_REVIEW listing with mandatory rejection notes',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async rejectListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectListingSchema))
    body: RejectListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.rejectListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض الإعلان العقاري وإشعار مقدم الطلب بالملاحظات',
      data: result,
    };
  }

  @Post(':id/suggest-price')
  @HttpCode(HttpStatus.CREATED)
  @RequireAdminPermission('Price.Suggest')
  @ApiOperation({
    summary: 'Submit an administrative price adjustment suggestion with market rationale (FR-57, BR-16)',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async suggestListingPrice(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPriceSuggestionSchema))
    body: CreatePriceSuggestionInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.suggestListingPrice(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم إرسال مقترح تعديل السعر الاسترشادي وإشعار البائع بنجاح',
      data: result,
    };
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Compliance')
  @ApiOperation({
    summary: 'Suspend a property listing for compliance violation (FR-14, UC-66)',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async suspendListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(suspendListingSchema)) body: SuspendListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.suspendListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إيقاف الإعلان مؤقتاً للامتثال وإخفاؤه من البحث العام',
      data: result,
    };
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Compliance')
  @ApiOperation({
    summary: 'Permanently block a violating property listing (FR-14, UC-66, BR-16)',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async blockListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(blockListingSchema)) body: BlockListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.blockListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حظر الإعلان نهائياً وإلغاء العروض المعلقة',
      data: result,
    };
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Listings.Compliance')
  @ApiOperation({
    summary: 'Unsuspend and reactivate a suspended listing (UC-66, Listings.Compliance)',
  })
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  async unsuspendListing(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(unsuspendListingSchema)) body: UnsuspendListingInput,
    @Req() req: any,
  ) {
    const result = await this.adminListingsService.unsuspendListing(
      id,
      req.admin,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفع الإيقاف وإعادة تنشيط الإعلان في البحث العام بنجاح',
      data: result,
    };
  }
}

