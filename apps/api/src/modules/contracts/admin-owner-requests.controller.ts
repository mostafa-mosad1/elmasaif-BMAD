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
  ownerRequestsQueueQuerySchema,
  dispatchOwnerContractSchema,
  rejectOwnerListingRequestSchema,
  requestModificationSchema,
  forceUnlockOwnerRequestSchema,
  type OwnerRequestsQueueQuery,
  type DispatchOwnerContractInput,
  type RejectOwnerListingRequestInput,
  type RequestModificationInput,
  type ForceUnlockOwnerRequestInput,
} from '@elmasaif/shared';
import { AdminOwnerRequestsService } from './admin-owner-requests.service';

@ApiTags('Admin Owner Listing Requests Queue')
@ApiBearerAuth()
@Controller('api/v1/admin/owner-requests')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminOwnerRequestsController {
  constructor(private readonly adminOwnerRequestsService: AdminOwnerRequestsService) {}

  @Get()
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Get paginated queue of owner listing requests' })
  @ApiResponse({ status: 200, description: 'Paginated queue of owner listing requests' })
  async getQueue(
    @Req() req: any,
    @Query(new ZodValidationPipe(ownerRequestsQueueQuerySchema))
    query: OwnerRequestsQueueQuery,
  ) {
    const adminId = req.admin.id;
    return this.adminOwnerRequestsService.getQueue(query, adminId);
  }

  @Get(':id')
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Get owner listing request review details and presigned documents' })
  @ApiResponse({ status: 200, description: 'Owner listing request detail' })
  async getDetail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminOwnerRequestsService.getDetail(id, adminId);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Claim a 15-minute lease lock on an owner listing request' })
  @ApiResponse({ status: 200, description: 'Claim lock status' })
  async claimLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminOwnerRequestsService.claimLock(id, adminId);
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Renew 15-minute lease lock on an owner listing request' })
  @ApiResponse({ status: 200, description: 'Renewed claim lock status' })
  async heartbeatLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminOwnerRequestsService.heartbeatLock(id, adminId);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Release lease lock on an owner listing request' })
  @ApiResponse({ status: 200, description: 'Released claim lock status' })
  async releaseLock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin.id;
    return this.adminOwnerRequestsService.releaseLock(id, adminId);
  }

  @Post(':id/force-unlock')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Tasks.ForceUnlock')
  @ApiOperation({ summary: 'Forcefully unlock an owner listing request (Super Admin / ForceUnlock)' })
  @ApiResponse({ status: 200, description: 'Force unlock result' })
  async forceUnlock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(forceUnlockOwnerRequestSchema))
    body: ForceUnlockOwnerRequestInput,
  ) {
    return this.adminOwnerRequestsService.forceUnlock(id, req.admin, body);
  }

  @Post(':id/dispatch-contract')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Dispatch official contract to owner' })
  @ApiResponse({ status: 200, description: 'Contract dispatched successfully' })
  async dispatchContract(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(dispatchOwnerContractSchema))
    body: DispatchOwnerContractInput,
  ) {
    return this.adminOwnerRequestsService.dispatchContract(id, req.admin, body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Reject an owner listing request' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully' })
  async rejectRequest(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectOwnerListingRequestSchema))
    body: RejectOwnerListingRequestInput,
  ) {
    return this.adminOwnerRequestsService.rejectRequest(id, req.admin, body);
  }

  @Post(':id/request-modification')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Contracts.Review', 'Contracts.Manage')
  @ApiOperation({ summary: 'Request modifications from owner' })
  @ApiResponse({ status: 200, description: 'Modification requested successfully' })
  async requestModification(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(requestModificationSchema))
    body: RequestModificationInput,
  ) {
    return this.adminOwnerRequestsService.requestModification(id, req.admin, body);
  }
}

