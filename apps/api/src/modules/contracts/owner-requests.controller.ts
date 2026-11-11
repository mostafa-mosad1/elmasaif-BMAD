import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  createOwnerListingRequestSchema,
  type CreateOwnerListingRequestInput,
} from '@elmasaif/shared';
import { OwnerRequestsService } from './owner-requests.service';

@ApiTags('Owner Listing Requests')
@ApiBearerAuth()
@Controller('owner/listing-requests')
@UseGuards(SessionAuthGuard, ActiveRoleGuard)
@RequireRole(UserRole.OWNER)
export class OwnerRequestsController {
  constructor(private readonly ownerRequestsService: OwnerRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new direct owner listing request' })
  @ApiResponse({ status: 201, description: 'Owner listing request created successfully' })
  async createListingRequest(
    @Req() req: any,
    @Body(new ZodValidationPipe(createOwnerListingRequestSchema))
    body: CreateOwnerListingRequestInput,
  ) {
    const userId = req.user.id;
    return this.ownerRequestsService.createListingRequest(userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all listing requests for current owner' })
  @ApiResponse({ status: 200, description: 'List of owner listing requests' })
  async getMyListingRequests(@Req() req: any) {
    const userId = req.user.id;
    return this.ownerRequestsService.getMyListingRequests(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detail of a specific owner listing request' })
  @ApiResponse({ status: 200, description: 'Owner listing request details' })
  async getListingRequestDetail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user.id;
    return this.ownerRequestsService.getListingRequestDetail(userId, id);
  }
}

