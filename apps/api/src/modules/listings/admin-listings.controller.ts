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
  ForceUnlockListingInput,
  forceUnlockListingSchema,
  ListingModerationQueueQuery,
  listingModerationQueueQuerySchema,
  RejectListingInput,
  rejectListingSchema,
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
}

