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
  UseInterceptors,
  UploadedFile,
  UseFilters,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  signOwnerContractSchema,
  uploadContractFeeProofBodySchema,
  CONTRACT_FEE_PROOF_TOO_LARGE,
  type SignOwnerContractInput,
  type UploadContractFeeProofInput,
} from '@elmasaif/shared';
import { OwnerContractsService, type ContractFeeProofUploadFile } from './owner-contracts.service';

@Catch(PayloadTooLargeException)
export class ContractFeeProofTooLargeFilter implements ExceptionFilter<PayloadTooLargeException> {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      code: CONTRACT_FEE_PROOF_TOO_LARGE,
      message: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت',
      requestId: request.headers?.['x-request-id'],
    });
  }
}

@ApiTags('Owner Contracts')
@ApiBearerAuth()
@Controller('owner/contracts')
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

  @Post(':id/fee-proof')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @UseFilters(ContractFeeProofTooLargeFilter)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload wire transfer receipt for owner contract listing fee' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bankReferenceCode: { type: 'string', maxLength: 64 },
        senderBankName: { type: 'string', maxLength: 100 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Fee proof uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or contract expired' })
  @ApiResponse({ status: 409, description: 'Contract not in PENDING_FEE status' })
  async uploadFeeProof(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: ContractFeeProofUploadFile,
    @Body(new ZodValidationPipe(uploadContractFeeProofBodySchema))
    body: UploadContractFeeProofInput,
  ) {
    const userId = req.user.id;
    return this.ownerContractsService.uploadFeeProof(userId, id, file, body);
  }

  @Get(':id/fee-status')
  @ApiOperation({ summary: 'Get owner contract fee payment status' })
  @ApiResponse({ status: 200, description: 'Contract fee status returned successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this contract' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async getFeePayment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user.id;
    return this.ownerContractsService.getFeePayment(userId, id);
  }
}


