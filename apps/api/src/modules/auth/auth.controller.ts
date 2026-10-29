import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  RegisterInput,
  VerifyOtpRegisterInput,
  ResendOtpInput,
  SessionUser,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS
} from '@elmasaif/shared';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with Saudi mobile and initiate OTP verification' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OTP verification dispatched' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Phone, National ID, or Username already exists' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: Request
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.authService.register(dto, ip, userAgent);

    return {
      code: 'AUTH_OTP_SENT',
      message: 'تم إرسال رمز التحقق إلى رقم الجوال',
      data: result,
      requestId: req.headers['x-request-id']
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Verify OTP and finalize account registration with PDPL consent' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Account established and session cookie set' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid or expired OTP code' })
  @ApiResponse({ status: 423, description: 'Verification locked due to 3 failed attempts' })
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpRegisterSchema)) dto: VerifyOtpRegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.authService.verifyRegistrationOtp(dto, ip, userAgent);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });

    return {
      code: 'AUTH_REGISTRATION_SUCCESS',
      message: 'تم إنشاء الحساب وتأكيد رقم الجوال بنجاح',
      data: {
        user: result.user
      },
      requestId: req.headers['x-request-id']
    };
  }

  @Post('otp/resend')
  @ApiOperation({ summary: 'Resend OTP verification code' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OTP re-dispatched' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit or 60s throttle exceeded' })
  async resendOtp(
    @Body(new ZodValidationPipe(resendOtpSchema)) dto: ResendOtpInput
  ) {
    const result = await this.authService.resendOtp(dto);

    return {
      code: 'AUTH_OTP_RESENT',
      message: 'تمت إعادة إرسال رمز التحقق بنجاح',
      data: result
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Inspect currently authenticated user session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Session profile' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthenticated session' })
  async me(@CurrentUser() user: SessionUser) {
    return {
      code: 'AUTH_USER_PROFILE',
      data: {
        user
      }
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke session and clear authentication cookie' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');

    res.clearCookie(SESSION_COOKIE_NAME, {
      path: '/'
    });

    if (token) {
      await this.authService.logout(token);
    }

    return {
      code: 'AUTH_LOGOUT_SUCCESS',
      message: 'تم تسجيل الخروج بنجاح'
    };
  }
}

