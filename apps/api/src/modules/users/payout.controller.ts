import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutService } from './payout.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPayoutAccountSchema,
  updatePayoutAccountSchema,
  CreatePayoutAccountInput,
  UpdatePayoutAccountInput
} from '@elmasaif/shared';

@ApiTags('Seller Payout Accounts')
@ApiBearerAuth()
@Controller('users/payout-accounts')
@UseGuards(SessionAuthGuard)
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get()
  @ApiOperation({ summary: 'Get all payout accounts for current seller profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout accounts retrieved successfully' })
  async getPayoutAccounts(@Req() req: any) {
    const data = await this.payoutService.getPayoutAccounts(req.user.id, req.user.activeRole);
    return {
      code: 'SUCCESS',
      message: 'تم استرجاع حسابات التحويل البنكي بنجاح',
      data,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request step-up OTP for payout account operations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OTP dispatched successfully' })
  async requestPayoutOtp(@Req() req: any) {
    const data = await this.payoutService.requestPayoutOtp(req.user.id);
    return {
      code: 'SUCCESS',
      message: 'تم إرسال رمز التحقق إلى جوالك المسجل',
      data,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new verified Saudi payout account with step-up OTP' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payout account registered successfully' })
  async createPayoutAccount(
    @Body(new ZodValidationPipe(createPayoutAccountSchema)) body: CreatePayoutAccountInput,
    @Req() req: any
  ) {
    const result = await this.payoutService.createPayoutAccount(
      req.user.id,
      req.user.activeRole,
      body
    );

    return {
      code: 'SUCCESS',
      message: 'تم إضافة الحساب البنكي بنجاح',
      data: result.account,
      warning: result.warning,
      warningMessage: result.warningMessage,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing payout account with step-up OTP' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout account updated successfully' })
  async updatePayoutAccount(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePayoutAccountSchema)) body: UpdatePayoutAccountInput,
    @Req() req: any
  ) {
    const data = await this.payoutService.updatePayoutAccount(
      req.user.id,
      req.user.activeRole,
      id,
      body
    );

    return {
      code: 'SUCCESS',
      message: 'تم تحديث الحساب البنكي بنجاح',
      data,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a payout account with step-up OTP' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout account deleted successfully' })
  async deletePayoutAccount(
    @Param('id') id: string,
    @Body() body: any,
    @Query() query: any,
    @Req() req: any
  ) {
    const otpCode = body?.otpCode || query?.otpCode;
    if (!otpCode || typeof otpCode !== 'string' || otpCode.trim().length !== 6) {
      throw new BadRequestException('رمز التحقق المكون من 6 أرقام مطلوب لتأكيد حذف الحساب البنكي');
    }

    const data = await this.payoutService.deletePayoutAccount(
      req.user.id,
      req.user.activeRole,
      id,
      otpCode.trim()
    );

    return {
      code: 'SUCCESS',
      message: data.message,
      data,
      requestId: req.headers?.['x-request-id']
    };
  }
}

