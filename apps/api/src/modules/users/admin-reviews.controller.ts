import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  ModerateReviewInput,
  moderateReviewSchema,
  ReviewModerationReasonInput,
  reviewModerationReasonSchema,
  AdminReviewQueueQueryInput,
  adminReviewQueueQuerySchema,
  REVIEWS_MODERATION_QUEUE_RETRIEVED,
  REVIEW_MODERATION_DETAIL_RETRIEVED,
  REVIEW_HIDDEN,
  REVIEW_UNHIDDEN,
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BrokersService } from './brokers.service';

/**
 * Story 6.5 & Story 8.4 / FR-19, FR-52, UC-69, AD-2, AD-6, AD-8, AD-12:
 * Administrative Review Moderation Controller (`/api/v1/admin/reviews`).
 * Protected by `AdminSessionAuthGuard` and `@RequireAdminPermission('Reviews.Moderate')`.
 */
@ApiTags('Admin Reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminReviewsController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reviews.Moderate')
  @ApiOperation({
    summary: 'List broker reviews for moderation queue (Story 8.4, FR-52)',
    description:
      'Returns KPI counts and paginated ratings filtered by visibility, score, lowScoreOnly, broker, or keyword search.',
  })
  @ApiResponse({ status: 200, description: 'Moderation queue retrieved' })
  async listReviews(
    @Query(new ZodValidationPipe(adminReviewQueueQuerySchema))
    query: AdminReviewQueueQueryInput,
  ) {
    const data = await this.brokersService.listAdminReviews(query);

    return {
      statusCode: HttpStatus.OK,
      code: REVIEWS_MODERATION_QUEUE_RETRIEVED,
      message: 'تم استرجاع طابور مراجعة التقييمات بنجاح',
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reviews.Moderate')
  @ApiOperation({
    summary: 'Get review moderation detail & audit history (Story 8.4, FR-52)',
    description:
      'Returns the full review moderation item along with its immutable AuditLog history.',
  })
  @ApiParam({ name: 'id', description: 'Rating UUID' })
  @ApiResponse({ status: 200, description: 'Review detail retrieved' })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND' })
  async getReviewDetail(@Param('id') id: string) {
    const data = await this.brokersService.getAdminReviewDetail(id);

    return {
      statusCode: HttpStatus.OK,
      code: REVIEW_MODERATION_DETAIL_RETRIEVED,
      message: 'تم استرجاع تفاصيل التقييم وسجل التدقيق بنجاح',
      data,
    };
  }

  @Patch(':id/moderation')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reviews.Moderate')
  @ApiOperation({
    summary: 'Moderate review visibility (FR-52, AC-8)',
    description:
      'Toggles review isHidden status with mandatory reason. Emits immutable AuditLog record.',
  })
  @ApiParam({ name: 'id', description: 'Rating UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['isHidden', 'reason'],
      properties: {
        isHidden: { type: 'boolean' },
        reason: { type: 'string', minLength: 3, maxLength: 500 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Review moderation updated' })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND' })
  async moderateReview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema)) body: ModerateReviewInput,
    @Req() req: any,
  ) {
    const admin = req.admin || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;

    const data = await this.brokersService.moderateReview(
      id,
      body,
      admin,
      ipAddress,
    );

    return {
      statusCode: HttpStatus.OK,
      code: body.isHidden ? REVIEW_HIDDEN : REVIEW_UNHIDDEN,
      message: body.isHidden
        ? 'تم حجب التقييم بنجاح'
        : 'تم إلغاء حجب التقييم وإعادته للعرض العام',
      data,
    };
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reviews.Moderate')
  @ApiOperation({
    summary: 'Hide abusive or non-compliant review (Story 8.4, AD-2, AD-8)',
    description:
      'Hides the review from public display and broker average rating calculation while preserving the physical row and emitting an immutable AuditLog record.',
  })
  @ApiParam({ name: 'id', description: 'Rating UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', minLength: 3, maxLength: 500 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Review hidden' })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND' })
  async hideReview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewModerationReasonSchema))
    body: ReviewModerationReasonInput,
    @Req() req: any,
  ) {
    const admin = req.admin || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;

    const data = await this.brokersService.moderateReview(
      id,
      { isHidden: true, reason: body.reason },
      admin,
      ipAddress,
    );

    return {
      statusCode: HttpStatus.OK,
      code: REVIEW_HIDDEN,
      message: 'تم حجب التقييم واستبعاده من العرض العام ومتوسط التقييم بنجاح',
      data,
    };
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Reviews.Moderate')
  @ApiOperation({
    summary: 'Restore previously hidden review (Story 8.4, AD-2, AD-8)',
    description:
      'Restores the review to public display and broker average rating calculation and emits an immutable AuditLog record.',
  })
  @ApiParam({ name: 'id', description: 'Rating UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', minLength: 3, maxLength: 500 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Review restored' })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND' })
  async restoreReview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewModerationReasonSchema))
    body: ReviewModerationReasonInput,
    @Req() req: any,
  ) {
    const admin = req.admin || req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;

    const data = await this.brokersService.moderateReview(
      id,
      { isHidden: false, reason: body.reason },
      admin,
      ipAddress,
    );

    return {
      statusCode: HttpStatus.OK,
      code: REVIEW_UNHIDDEN,
      message: 'تمت استعادة التقييم وإعادة إدراجه في العرض العام ومتوسط التقييم',
      data,
    };
  }
}
