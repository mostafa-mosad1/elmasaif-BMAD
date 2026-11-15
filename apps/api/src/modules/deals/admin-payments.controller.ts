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
import {
  type AdminRejectPaymentBodyInput,
  type PaymentQueueQuery,
  adminRejectPaymentBodySchema,
  parseIfMatchVersion,
  paymentQueueQuerySchema,
} from '@elmasaif/shared';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminPaymentsService } from './admin-payments.service';
import {
  AdminRejectPaymentDto,
  ForceUnlockPaymentDto,
} from './dto/admin-payment-review.dto';

/**
 * Story 5.3 / Task 5: Administrative proof review queue and task claim locking.
 *
 * Gated by `AdminSessionAuthGuard` + `AdminPermissionGuard`.
 * Every review action requires `Payments.Review` except `force-unlock` (`Tasks.ForceUnlock`).
 * Declaration order is load-bearing: literal routes (GET queue) precede parameterised ones (:id).
 */
@ApiTags('Admin Payments Proof Review')
@ApiBearerAuth()
@Controller('admin/payments')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({
    summary: 'List payment proofs awaiting admin audit (PROOF_UPLOADED, UNDER_REVIEW)',
    description:
      'Paginated, oldest-first, with active 15-minute claim lease and holder name. Reads never take the lease (AD-10).',
  })
  @ApiResponse({ status: 200, description: 'Queue retrieved successfully' })
  async getQueue(
    @Query(new ZodValidationPipe(paymentQueueQuerySchema)) query: PaymentQueueQuery,
    @Req() req: any,
  ) {
    const data = await this.adminPaymentsService.getQueue(query, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: 'One payment proof review slot with its lease state and deal context' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Payment detail returned' })
  @ApiResponse({ status: 404, description: 'PAYMENT_NOT_FOUND' })
  async getPayment(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminPaymentsService.getPayment(id, req.admin.id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id/proof-url')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review', 'Deals.DisputeResolve')
  @ApiOperation({ summary: 'Verified presigned download URL for the uploaded payment receipt (300 s)' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Download URL minted' })
  @ApiResponse({ status: 403, description: 'ERROR_FILE_QUARANTINED' })
  @ApiResponse({ status: 404, description: 'PAYMENT_NOT_FOUND or PAYMENT_PROOF_NOT_FOUND' })
  async getProofDownloadUrl(@Param('id') id: string) {
    const data = await this.adminPaymentsService.getProofDownloadUrl(id);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: 'Claim the 15-minute audit lease on one Payment row (AD-10)' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Lease acquired' })
  @ApiResponse({ status: 409, description: 'PAYMENT_LOCK_CONFLICT or PAYMENT_NOT_CLAIMABLE' })
  async claimPayment(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminPaymentsService.claimPayment(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استلام مهمة التدقيق لمدة 15 دقيقة',
      data,
    };
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: "Extend caller's own audit lease by 15 minutes" })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Lease renewed' })
  @ApiResponse({ status: 409, description: 'PAYMENT_LOCK_REQUIRED / _CONFLICT / _EXPIRED' })
  async heartbeatPayment(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminPaymentsService.heartbeatPayment(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تمديد قفل التدقيق',
      data,
    };
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: 'Release the audit lease without deciding' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Lease released' })
  @ApiResponse({ status: 409, description: 'PAYMENT_LOCK_REQUIRED / _CONFLICT / _EXPIRED' })
  async releasePayment(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminPaymentsService.releasePayment(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحرير قفل التدقيق',
      data,
    };
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: 'Confirm payment receipt (CONFIRMED) and release audit lease' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  @ApiResponse({ status: 403, description: 'PAYMENT_SELF_APPROVAL_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'PAYMENT_LOCK_* or PAYMENT_NOT_CLAIMABLE' })
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data =
      expectedVersion !== undefined
        ? await this.adminPaymentsService.confirmPayment(
            id,
            req.admin,
            expectedVersion,
          )
        : await this.adminPaymentsService.confirmPayment(id, req.admin);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تأكيد إثبات الدفع',
      data,
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Payments.Review')
  @ApiOperation({ summary: 'Reject payment receipt with mandatory note (5–500 chars), set deal PAYMENT_REJECTED' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiBody({ type: AdminRejectPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment rejected' })
  @ApiResponse({ status: 400, description: 'PAYMENT_REJECTION_NOTE_REQUIRED' })
  @ApiResponse({ status: 403, description: 'PAYMENT_SELF_APPROVAL_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'PAYMENT_LOCK_* or PAYMENT_NOT_CLAIMABLE' })
  async rejectPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminRejectPaymentBodySchema)) body: AdminRejectPaymentBodyInput,
    @Req() req: any,
    @Headers('if-match') ifMatch?: string,
  ) {
    const expectedVersion = parseIfMatchVersion(ifMatch);
    const data =
      expectedVersion !== undefined
        ? await this.adminPaymentsService.rejectPayment(
            id,
            req.admin,
            body?.reason as string,
            expectedVersion,
          )
        : await this.adminPaymentsService.rejectPayment(
            id,
            req.admin,
            body?.reason as string,
          );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض إثبات الدفع وتسجيل السبب',
      data,
    };
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({ summary: 'Force-unlock another admin\'s audit lease with documented reason (Tasks.ForceUnlock)' })
  @ApiParam({ name: 'id', description: 'Payment id' })
  @ApiBody({ type: ForceUnlockPaymentDto })
  @ApiResponse({ status: 200, description: 'Audit lease force-unlocked' })
  @ApiResponse({ status: 400, description: 'PAYMENT_FORCE_UNLOCK_REASON_REQUIRED' })
  async forceUnlockPayment(
    @Param('id') id: string,
    @Body() body: ForceUnlockPaymentDto,
    @Req() req: any,
  ) {
    const data = await this.adminPaymentsService.forceUnlockPayment(
      id,
      req.admin,
      body?.reason,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء قفل التدقيق وتسجيل السبب',
      data,
    };
  }
}
