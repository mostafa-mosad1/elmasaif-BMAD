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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminProposalsService } from './admin-proposals.service';
import { RejectProposalDto } from './dto/create-proposal.dto';
import {
  ProposalQueueQuery,
  proposalQueueQuerySchema,
  RejectProposalInput,
  rejectProposalSchema,
} from '@elmasaif/shared';

@ApiTags('Admin Proposal Review Queue')
@ApiBearerAuth()
@Controller('admin/proposals')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
export class AdminProposalsController {
  constructor(private readonly adminProposalsService: AdminProposalsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'List provider proposals in the review queue (pending first)',
    description:
      'Returns a paginated queue ordered oldest-first. No task-claim lock (AD-10: Proposal is not a locked queue).',
  })
  @ApiResponse({ status: 200, description: 'Proposal queue retrieved successfully' })
  async getQueue(
    @Query(new ZodValidationPipe(proposalQueueQuerySchema)) query: ProposalQueueQuery,
  ) {
    const data = await this.adminProposalsService.getQueue(query);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  // Static route declared before any ':id' route (NestJS route order).

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'Approve a PENDING_ADMIN_REVIEW proposal → visible to the buyer (FR-23)',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({ status: 200, description: 'Proposal approved for buyer' })
  @ApiResponse({ status: 409, description: 'Proposal is not in an approvable state' })
  async approveProposal(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminProposalsService.approve(req.admin.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اعتماد العرض وإتاحته للمشترى',
      data,
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'Reject a PENDING_ADMIN_REVIEW proposal with a mandatory reason (FR-23)',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiBody({ type: RejectProposalDto })
  @ApiResponse({ status: 200, description: 'Proposal rejected and audited' })
  @ApiResponse({ status: 409, description: 'Proposal is not in a rejectable state' })
  async rejectProposal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectProposalSchema)) body: RejectProposalInput,
    @Req() req: any,
  ) {
    const data = await this.adminProposalsService.reject(req.admin.id, id, body.reason);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض العرض وتسجيل السبب',
      data,
    };
  }

  @Post(':id/final-approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('Offers.Review')
  @ApiOperation({
    summary: 'Final approve a SELECTED_PENDING_FINAL_ADMIN_APPROVAL proposal → creates a Deal and reserves listing',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({ status: 200, description: 'Proposal converted to Deal' })
  @ApiResponse({ status: 409, description: 'Proposal is not in a final-approvable state' })
  async finalApproveProposal(@Param('id') id: string, @Req() req: any) {
    const data = await this.adminProposalsService.finalApprove(req.admin.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اعتماد العرض نهائياً وإنشاء الصفقة بنجاح وحجز العقار',
      data,
    };
  }
}
