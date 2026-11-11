import {
  Controller,
  Patch,
  Param,
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
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BrokersService } from './brokers.service';

/**
 * Story 6.5 / FR-52, UC-69, AC-8: Administrative Review Moderation Controller.
 * Protected by `AdminSessionAuthGuard` and `@RequireAdminPermission('Reviews.Moderate')`.
 */
@ApiTags('Admin Reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminReviewsController {
  constructor(private readonly brokersService: BrokersService) {}

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
      message: body.isHidden
        ? 'تم حجب التقييم بنجاح'
        : 'تم إلغاء حجب التقييم وإعادته للعرض العام',
      data,
    };
  }
}

