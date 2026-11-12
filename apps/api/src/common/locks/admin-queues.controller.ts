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
import {
  forceUnlockTaskSchema,
  type ForceUnlockTaskInput,
  OPERATIONAL_QUEUES_SUMMARY_RETRIEVED,
  operationalQueueFilterSchema,
  type OperationalQueueFilterInput,
  TASK_CLAIM_ACQUIRED,
  TASK_CLAIM_FORCE_UNLOCKED,
  TASK_CLAIM_RELEASED,
  TASK_CLAIM_RENEWED,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { AdminSessionAuthGuard } from '../../modules/auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../modules/auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../../modules/auth/decorators/require-admin-permission.decorator';
import { TaskClaimLockService } from './task-claim-lock.service';

@ApiTags('Admin Unified Operational Queues & Task Claim Locks')
@ApiBearerAuth()
@Controller('admin/queues')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminQueuesController {
  constructor(private readonly taskClaimLockService: TaskClaimLockService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission(
    'Tasks.View',
    'Tasks.Claim',
    'Tasks.ForceUnlock',
    'Listings.Review',
    'Licenses.Review',
    'Licenses.Verify',
    'Contracts.Review',
    'Payments.Review',
    'Payments.Verify',
    'ContractFees.Review',
    'Conversations.Handle',
    'Conversations.Relay',
    'Deals.DisputeResolve',
    'Offers.Review',
    'Offers.Manage',
  )
  @ApiOperation({
    summary:
      'Retrieve unified operational queues hub summary and claimable items across all 8 queues',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Operational queues summary and items retrieved',
  })
  async getQueuesHub(
    @Query(new ZodValidationPipe(operationalQueueFilterSchema))
    query: OperationalQueueFilterInput,
    @Req() req: any,
  ) {
    const data = await this.taskClaimLockService.getOperationalQueuesHub(
      req.admin,
      query,
    );
    return {
      statusCode: HttpStatus.OK,
      code: OPERATIONAL_QUEUES_SUMMARY_RETRIEVED,
      message: 'تم استرجاع ملخص طوابير المهام التشغيلية وحالة الأقفال بنجاح',
      data,
    };
  }

  @Post(':queue/:id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission(
    'Tasks.Claim',
    'Listings.Review',
    'Licenses.Review',
    'Licenses.Verify',
    'Contracts.Review',
    'Payments.Review',
    'Payments.Verify',
    'ContractFees.Review',
    'Conversations.Handle',
    'Conversations.Relay',
    'Deals.DisputeResolve',
    'Offers.Review',
    'Offers.Manage',
  )
  @ApiOperation({
    summary: 'Acquire a 15-minute exclusive claim lock on an operational queue task',
  })
  @ApiParam({ name: 'queue', description: 'Queue slug or type (e.g. listings, licenses, payments)' })
  @ApiParam({ name: 'id', description: 'Target entity ID' })
  async claimQueueTask(
    @Param('queue') queue: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.taskClaimLockService.claimTask(queue, id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      code: TASK_CLAIM_ACQUIRED,
      message: 'تم استلام المهمة وحجز القفل الحصري لمدة 15 دقيقة',
      data,
    };
  }

  @Post(':queue/:id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission(
    'Tasks.Claim',
    'Listings.Review',
    'Licenses.Review',
    'Licenses.Verify',
    'Contracts.Review',
    'Payments.Review',
    'Payments.Verify',
    'ContractFees.Review',
    'Conversations.Handle',
    'Conversations.Relay',
    'Deals.DisputeResolve',
    'Offers.Review',
    'Offers.Manage',
  )
  @ApiOperation({
    summary: 'Renew an active claim lock (+15m lease extension) on 5-minute heartbeat cadence',
  })
  async heartbeatQueueTask(
    @Param('queue') queue: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.taskClaimLockService.heartbeatTask(
      queue,
      id,
      req.admin,
    );
    return {
      statusCode: HttpStatus.OK,
      code: TASK_CLAIM_RENEWED,
      message: 'تم تجديد حجز المهمة لمدة 15 دقيقة إضافية',
      data,
    };
  }

  @Post(':queue/:id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission(
    'Tasks.Claim',
    'Listings.Review',
    'Licenses.Review',
    'Licenses.Verify',
    'Contracts.Review',
    'Payments.Review',
    'Payments.Verify',
    'ContractFees.Review',
    'Conversations.Handle',
    'Conversations.Relay',
    'Deals.DisputeResolve',
    'Offers.Review',
    'Offers.Manage',
  )
  @ApiOperation({
    summary: 'Voluntarily release an active claim lock held by the current admin',
  })
  async releaseQueueTask(
    @Param('queue') queue: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.taskClaimLockService.releaseTask(
      queue,
      id,
      req.admin,
    );
    return {
      statusCode: HttpStatus.OK,
      code: TASK_CLAIM_RELEASED,
      message: 'تم تحرير قفل المهمة وإعادتها لطابور المراجعة',
      data,
    };
  }

  @Post(':queue/:id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({
    summary:
      'Force-unlock an operational queue task held by another admin with mandatory justification reason (Tasks.ForceUnlock)',
  })
  async forceUnlockQueueTask(
    @Param('queue') queue: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(forceUnlockTaskSchema))
    body: ForceUnlockTaskInput,
    @Req() req: any,
  ) {
    const data = await this.taskClaimLockService.forceUnlockTask(
      queue,
      id,
      req.admin,
      body.reason,
    );
    return {
      statusCode: HttpStatus.OK,
      code: TASK_CLAIM_FORCE_UNLOCKED,
      message: 'تم فك القفل قسرياً وتوثيق السبب في سجل التدقيق',
      data,
    };
  }
}

