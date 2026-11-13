import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  NotificationDto,
  NotificationQueryInput,
  PaginatedNotificationsDto,
  UnreadNotificationCountDto,
  notificationQuerySchema,
} from '@elmasaif/shared';
import { NotificationsService } from './notifications.service';
import { NotificationAuthGuard } from './guards/notification-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(NotificationAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user notifications with unread count and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications feed retrieved successfully' })
  async getNotifications(
    @Req() req: any,
    @Query(new ZodValidationPipe(notificationQuerySchema)) query: NotificationQueryInput,
  ): Promise<PaginatedNotificationsDto> {
    return this.notificationsService.getUserNotifications(req.user.id, query);
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current unread notifications count for header badge polling' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Unread count retrieved successfully' })
  async getUnreadCount(@Req() req: any): Promise<UnreadNotificationCountDto> {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Notification not found or unauthorized' })
  async markAsRead(
    @Req() req: any,
    @Param('id') notificationId: string,
  ): Promise<NotificationDto> {
    return this.notificationsService.markAsRead(req.user.id, notificationId);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications for current user as read' })
  @ApiResponse({ status: HttpStatus.OK, description: 'All notifications marked as read' })
  async markAllAsRead(@Req() req: any): Promise<{ markedCount: number }> {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}

