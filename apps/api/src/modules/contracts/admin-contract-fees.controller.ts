import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  contractFeeQueueQuerySchema,
  rejectContractFeeBodySchema,
  forceUnlockContractFeeSchema,
  type ContractFeeQueueQuery,
  type RejectContractFeeInput,
  type ForceUnlockContractFeeInput,
} from '@elmasaif/shared';
import { AdminContractFeesService } from './admin-contract-fees.service';

@ApiTags('Admin Contract Fee Verification Queue')
@ApiBearerAuth()
@Controller('admin/contract-fees')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminContractFeesController {
  constructor(private readonly adminContractFeesService: AdminContractFeesService) {}

  @Get()
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Get paginated queue of contract fee payments' })
  @ApiResponse({ status: 200, description: 'Paginated queue returned successfully' })
  async getQueue(
    @Req() req: any,
    @Query(new ZodValidationPipe(contractFeeQueueQuerySchema))
    query: ContractFeeQueueQuery,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.getQueue(query, adminId);
  }

  @Get(':id')
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Get full review dossier for a contract fee payment' })
  @ApiResponse({ status: 200, description: 'Dossier returned successfully' })
  @ApiResponse({ status: 404, description: 'Contract fee payment not found' })
  async getDetail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.getDetail(id, adminId);
  }

  @Get(':id/proof-url')
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Get 300s presigned download URL for contract fee proof receipt' })
  @ApiResponse({ status: 200, description: 'Presigned download URL returned successfully' })
  @ApiResponse({ status: 404, description: 'Contract fee or receipt not found' })
  async getProofDownloadUrl(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.getProofDownloadUrl(id, adminId);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Acquire 15-minute exclusive lease lock on contract fee payment' })
  @ApiResponse({ status: 200, description: 'Lease acquired successfully' })
  @ApiResponse({ status: 409, description: 'Lease held by another admin' })
  async claimLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.claimLock(id, adminId);
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Heartbeat renew lease lock for another 15 minutes' })
  @ApiResponse({ status: 200, description: 'Lease renewed successfully' })
  @ApiResponse({ status: 409, description: 'Lease not held or expired' })
  async heartbeatLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.heartbeatLock(id, adminId);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Release lease lock without deciding' })
  @ApiResponse({ status: 200, description: 'Lease released successfully' })
  async releaseLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminContractFeesService.releaseLock(id, adminId);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Confirm fee payment, activate contract, and publish listing (BR-15)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed and listing published successfully' })
  @ApiResponse({ status: 409, description: 'Lock required or payment conflict' })
  async confirmPayment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const admin = req.admin;
    return this.adminContractFeesService.confirmPayment(id, admin);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Reject payment proof with mandatory reason' })
  @ApiResponse({ status: 200, description: 'Payment rejected successfully' })
  @ApiResponse({ status: 409, description: 'Lock required or payment conflict' })
  async rejectPayment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectContractFeeBodySchema))
    body: RejectContractFeeInput,
  ) {
    const admin = req.admin;
    return this.adminContractFeesService.rejectPayment(id, admin, body);
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({ summary: 'Force-unlock lease lock on contract fee payment' })
  @ApiResponse({ status: 200, description: 'Lock forcibly released' })
  async forceUnlock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(forceUnlockContractFeeSchema))
    body: ForceUnlockContractFeeInput,
  ) {
    const admin = req.admin;
    return this.adminContractFeesService.forceUnlock(id, admin, body);
  }
}

