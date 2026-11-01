import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PhoneChangeService } from './phone-change.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  initiatePhoneChangeSchema,
  verifyPhoneChangeOtpSchema,
  resendPhoneChangeOtpSchema,
  InitiatePhoneChangeInput,
  VerifyPhoneChangeOtpInput,
  ResendPhoneChangeOtpInput,
  InitiatePhoneChangeResponse,
  VerifyPhoneChangeOtpResponse,
  PhoneChangeCompletionResponse
} from '@elmasaif/shared';

@ApiTags('User Mobile Number Update')
@ApiBearerAuth()
@Controller('users/phone-change')
@UseGuards(SessionAuthGuard)
export class PhoneChangeController {
  constructor(private readonly phoneChangeService: PhoneChangeService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate dual-OTP phone change process' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dual OTP dispatched successfully' })
  async initiatePhoneChange(
    @Body(new ZodValidationPipe(initiatePhoneChangeSchema)) body: InitiatePhoneChangeInput,
    @Req() req: any
  ): Promise<InitiatePhoneChangeResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || 'unknown';
    const result = await this.phoneChangeService.initiatePhoneChange(
      req.user.id,
      body,
      ip,
      userAgent
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('verify-old')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code sent to current (old) mobile number' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Old mobile number verified' })
  async verifyOldPhoneOtp(
    @Body(new ZodValidationPipe(verifyPhoneChangeOtpSchema)) body: VerifyPhoneChangeOtpInput,
    @Req() req: any
  ): Promise<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.phoneChangeService.verifyOldPhoneOtp(
      req.user.id,
      body,
      ip
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('verify-new')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code sent to proposed (new) mobile number' })
  @ApiResponse({ status: HttpStatus.OK, description: 'New mobile number verified' })
  async verifyNewPhoneOtp(
    @Body(new ZodValidationPipe(verifyPhoneChangeOtpSchema)) body: VerifyPhoneChangeOtpInput,
    @Req() req: any
  ): Promise<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.phoneChangeService.verifyNewPhoneOtp(
      req.user.id,
      body,
      ip
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend fresh OTP to specified target (OLD or NEW)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Fresh OTP dispatched successfully' })
  async resendPhoneChangeOtp(
    @Body(new ZodValidationPipe(resendPhoneChangeOtpSchema)) body: ResendPhoneChangeOtpInput,
    @Req() req: any
  ) {
    const result = await this.phoneChangeService.resendPhoneChangeOtp(
      req.user.id,
      body
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }
}

