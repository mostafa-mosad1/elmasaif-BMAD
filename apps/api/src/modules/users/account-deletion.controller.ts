import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth
} from '@nestjs/swagger';
import { AccountDeletionService } from './account-deletion.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  initiateAccountDeletionSchema,
  confirmAccountDeletionSchema,
  InitiateAccountDeletionInput,
  ConfirmAccountDeletionInput,
  AccountDeletionEligibilityResponse,
  InitiateAccountDeletionResponse,
  ConfirmAccountDeletionResponse,
  CancelAccountDeletionResponse,
  SESSION_COOKIE_NAME
} from '@elmasaif/shared';

@ApiTags('Account Deletion & PDPL Compliance')
@ApiBearerAuth()
@Controller('users/delete-account')
@UseGuards(SessionAuthGuard)
export class AccountDeletionController {
  constructor(
    private readonly accountDeletionService: AccountDeletionService
  ) {}

  @Get('eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pre-flight account deletion eligibility check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Eligibility evaluated successfully'
  })
  async getEligibility(
    @Req() req: any
  ): Promise<AccountDeletionEligibilityResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.accountDeletionService.getEligibility(
      req.user.id,
      ip
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Initiate account deletion with password verification and OTP dispatch'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deletion challenge OTP dispatched successfully'
  })
  async initiateDeletion(
    @Body(new ZodValidationPipe(initiateAccountDeletionSchema))
    body: InitiateAccountDeletionInput,
    @Req() req: any
  ): Promise<InitiateAccountDeletionResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.accountDeletionService.initiateDeletion(
      req.user.id,
      body,
      ip
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm account deletion with OTP and challenge token'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Account scheduled for deletion or deactivated per statutory retention'
  })
  async confirmDeletion(
    @Body(new ZodValidationPipe(confirmAccountDeletionSchema))
    body: ConfirmAccountDeletionInput,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response
  ): Promise<ConfirmAccountDeletionResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.accountDeletionService.confirmDeletion(
      req.user.id,
      body,
      ip
    );

    // Clear session cookie upon deletion / deactivation
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel pending account deletion during 14-day cooling-off period'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Deletion request cancelled successfully'
  })
  async cancelDeletion(@Req() req: any): Promise<CancelAccountDeletionResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await this.accountDeletionService.cancelDeletion(
      req.user.id,
      ip
    );
    return {
      ...result,
      requestId: req.headers?.['x-request-id']
    };
  }
}

