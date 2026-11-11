import {
  Controller,
  Get,
  Post,
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
  signOwnerContractSchema,
  type SignOwnerContractInput,
} from '@elmasaif/shared';
import { OwnerContractsService } from './owner-contracts.service';

@ApiTags('Owner Contracts')
@ApiBearerAuth()
@Controller('api/v1/owner/contracts')
@UseGuards(SessionAuthGuard, ActiveRoleGuard)
@RequireRole(UserRole.OWNER)
export class OwnerContractsController {
  constructor(private readonly ownerContractsService: OwnerContractsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get owner contract details by ID or listing request ID' })
  @ApiResponse({ status: 200, description: 'Owner contract details returned successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this contract' })
  @ApiResponse({ status: 404, description: 'Owner contract not found' })
  async getContractDetail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user.id;
    return this.ownerContractsService.getContractDetail(userId, id);
  }

  @Post(':id/request-signature-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request 6-digit OTP for contract signature' })
  @ApiResponse({ status: 200, description: 'OTP dispatched successfully' })
  @ApiResponse({ status: 400, description: 'Contract expired or invalid mobile number' })
  @ApiResponse({ status: 409, description: 'Contract not in pending signature state or already signed' })
  async requestSignatureOtp(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user.id;
    return this.ownerContractsService.requestSignatureOtp(userId, id);
  }

  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit signature and 6-digit OTP to execute contract' })
  @ApiResponse({ status: 200, description: 'Contract signed and stamped successfully' })
  @ApiResponse({ status: 400, description: 'Invalid/expired OTP or expired contract' })
  @ApiResponse({ status: 409, description: 'Contract not in pending signature state or already signed' })
  @ApiResponse({ status: 423, description: 'OTP locked due to maximum failed attempts' })
  async signContract(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(signOwnerContractSchema))
    body: SignOwnerContractInput,
  ) {
    const userId = req.user.id;
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) || req.socket?.remoteAddress || req.ip;
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

    return this.ownerContractsService.signContract(userId, id, body, ipAddress, userAgent);
  }
}

