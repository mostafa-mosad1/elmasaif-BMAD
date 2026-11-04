import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  createProposalSchema,
  CreateProposalInput,
} from '@elmasaif/shared';

@ApiTags('Provider Proposals')
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  // Static routes MUST be declared before any ':id' route (NestJS route order).

  @Get('matching-demands')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Provider alert surface: buyer demands matching the caller's own listings (FR-22)",
  })
  @ApiResponse({ status: 200, description: 'Matching demands returned' })
  async getMatchingDemands(@Req() req: any) {
    const data = await this.proposalsService.getMatchingDemands(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get('demand/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buyer review: APPROVED_FOR_BUYER proposals on the caller’s own demand (FR-24)',
  })
  @ApiParam({ name: 'id', description: 'Demand UUID' })
  @ApiResponse({ status: 200, description: 'Approved proposals returned' })
  @ApiResponse({ status: 404, description: 'Demand not found for this buyer' })
  async getApprovedProposalsForDemand(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    const data = await this.proposalsService.getApprovedProposalsForDemand(
      req.user.id,
      id,
    );
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a binding proposal on a matching demand (FR-23)' })
  @ApiBody({ type: CreateProposalDto })
  @ApiResponse({ status: 201, description: 'Proposal created in PENDING_ADMIN_REVIEW' })
  @ApiResponse({ status: 403, description: 'Provider does not own the listing' })
  @ApiResponse({ status: 409, description: 'A proposal already exists for this pair' })
  async createProposal(
    @Req() req: any,
    @Body(new ZodValidationPipe(createProposalSchema)) dto: CreateProposalInput,
  ) {
    const data = await this.proposalsService.createProposal(
      req.user.id,
      req.user.activeRole || req.user.role,
      dto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      data,
    };
  }

  @Post(':id/select')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buyer selects an approved proposal; siblings close (FR-24, UJ-4)',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({ status: 200, description: 'Proposal selected; other open proposals closed' })
  @ApiResponse({ status: 404, description: 'Proposal not found for this buyer’s demand' })
  @ApiResponse({ status: 409, description: 'Proposal is not selectable in its current state' })
  async selectProposal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    const data = await this.proposalsService.selectProposal(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم اختيار العرض',
      data,
    };
  }
}
