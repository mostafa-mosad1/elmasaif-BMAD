import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateUserProfileSchema,
  verifyEmailSchema,
  UpdateUserProfileInput,
  VerifyEmailInput,
  UpdateUserProfileResponse,
  VerifyEmailResponse,
  ResendEmailVerificationResponse,
  CancelPendingEmailResponse
} from '@elmasaif/shared';

@ApiTags('User Profile & Email Verification')
@Controller('users')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and pending email verification status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: any) {
    const result = await this.profileService.getProfile(req.user.id);
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Patch('profile')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update profile full name and/or initiate contact email change' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated or email verification initiated' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed or email matches current' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already assigned to another user' })
  async updateProfile(
    @Body(new ZodValidationPipe(updateUserProfileSchema)) body: UpdateUserProfileInput,
    @Req() req: any
  ): Promise<UpdateUserProfileResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || 'unknown';

    const result = await this.profileService.updateProfile(
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

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public endpoint to confirm email verification token from email link' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email confirmed and updated on user account' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Token invalid, expired, or stale' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email occupied by another user' })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Req() req: any
  ): Promise<VerifyEmailResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = await this.profileService.verifyEmail(body, ip);

    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('email/resend')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link with 60s cooldown throttle' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification link resent' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Throttled (cooldown active)' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No pending email exists' })
  async resendVerificationEmail(@Req() req: any): Promise<ResendEmailVerificationResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = await this.profileService.resendVerificationEmail(req.user.id, ip);

    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Delete('email/pending')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel pending email update request' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pending email cancelled' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No pending email to cancel' })
  async cancelPendingEmail(@Req() req: any): Promise<CancelPendingEmailResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = await this.profileService.cancelPendingEmail(req.user.id, ip);

    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }
}

