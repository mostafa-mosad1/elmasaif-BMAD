import {
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BackupOffersService } from './backup-offers.service';
import { BackupOfferQueueQuery, backupOfferQueueQuerySchema } from '@elmasaif/shared';

/**
 * Administrative backup offer queue (Story 4.3 / FR-27, OQ-04, AD-10, AD-12).
 *
 * A dedicated `admin/backup-offers` prefix (not `admin/offers`) is deliberate: it cannot collide
 * with the existing `@Get(':id')`, so there is no NestJS declaration-order trap and no chance of
 * a literal segment ever being parsed as an offer id.
 *
 * Claiming, heartbeating and releasing stay on the canonical
 * `POST /admin/offers/:id/{claim,heartbeat,release}` routes: `Offer` keeps exactly one lease
 * implementation.
 */
@ApiTags('Admin Backup Offer Queue')
@ApiBearerAuth()
@Controller('admin/backup-offers')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminBackupOffersController {
  constructor(private readonly backupOffersService: BackupOffersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'List backup offer queues grouped per listing (oldest approved first)',
    description:
      'Derived queueState per listing (SURFACED on ACTIVE, QUEUED on RESERVED, CLOSABLE on SOLD, FROZEN otherwise), 1-based queuePosition per offer, and the active 15-minute claim lock. No task claim on read (AD-10: claiming is an explicit POST).',
  })
  @ApiResponse({ status: 200, description: 'Backup queue retrieved successfully' })
  async getQueue(
    @Query(new ZodValidationPipe(backupOfferQueueQuerySchema)) query: BackupOfferQueueQuery,
    @Req() req: any,
  ) {
    const data = await this.backupOffersService.getBackupQueue(query, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'Activate a surfaced backup offer (ACTIVE listing, claim lease held)',
    description:
      'Stamps Offer.activatedAt, writes OfferHistory + AuditLog and releases the lease in one transaction. The offer keeps SELECTED_PENDING_FINAL_ADMIN_APPROVAL and no Deal is created (Story 5.1).',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Backup offer activated' })
  @ApiResponse({ status: 404, description: 'OFFER_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description:
      'OFFER_BACKUP_NOT_QUEUED / OFFER_BACKUP_ALREADY_ACTIVATED / OFFER_BACKUP_PRIMARY_DEAL_ACTIVE / OFFER_BACKUP_LISTING_UNAVAILABLE / OFFER_LOCK_REQUIRED / OFFER_LOCK_CONFLICT / OFFER_LOCK_EXPIRED',
  })
  async activateBackupOffer(@Param('id') id: string, @Req() req: any) {
    const data = await this.backupOffersService.activateBackupOffer(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تفعيل العرض الاحتياطي؛ سيُحال إلى الموافقة النهائية',
      data,
    };
  }
}
