import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  registerSchema,
  verifyOtpRegisterSchema,
  resendOtpSchema,
  loginSchema,
  verifyStepUpOtpSchema,
  RegisterInput,
  VerifyOtpRegisterInput,
  ResendOtpInput,
  LoginInput,
  VerifyStepUpOtpInput,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
  SessionUser,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  DEVICE_COOKIE_NAME
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login using Saudi mobile or username with password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful or step-up OTP challenge issued' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked due to brute-force lockout' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const clientDeviceId =
      req.cookies?.[DEVICE_COOKIE_NAME] ||
      (req.headers['x-device-id'] as string) ||
      dto.deviceId ||
      crypto.randomUUID();

    const result = await this.authService.login(dto, ip, userAgent, clientDeviceId);
    const isProduction = process.env.NODE_ENV === 'production';

    // Always ensure device cookie is issued/extended for 1 year
    res.cookie(DEVICE_COOKIE_NAME, clientDeviceId, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    if (result.stepUpRequired === true) {
      return {
        code: 'AUTH_STEP_UP_REQUIRED',
        message: 'تم إرسال رمز التحقق الإضافي لتأكيد جهاز الدخول الجديد',
        data: {
          stepUpRequired: true,
          mobileNumber: result.mobileNumber,
          stepUpToken: result.stepUpToken,
          resendAvailableInSeconds: result.resendAvailableInSeconds
        },
        requestId: req.headers['x-request-id']
      };
    }

    // Set 30-day session cookie
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });

    return {
      code: 'AUTH_LOGIN_SUCCESS',
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: result.user,
        deletionCancelled: result.deletionCancelled
      },
      requestId: req.headers['x-request-id']
    };
  }

  @Post('login/step-up')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify step-up OTP challenge for new device login' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Step-up verified and session established' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid OTP or expired challenge' })
  async loginStepUp(
    @Body(new ZodValidationPipe(verifyStepUpOtpSchema)) dto: VerifyStepUpOtpInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const clientDeviceId =
      req.cookies?.[DEVICE_COOKIE_NAME] ||
      (req.headers['x-device-id'] as string) ||
      dto.deviceId ||
      crypto.randomUUID();

    const result = await this.authService.verifyStepUpOtp(dto, ip, userAgent, clientDeviceId);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie(DEVICE_COOKIE_NAME, clientDeviceId, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });

    return {
      code: 'AUTH_LOGIN_SUCCESS',
      message: 'تم تأكيد الجهاز الجديد وتسجيل الدخول بنجاح',
      data: {
        user: result.user
      },
      requestId: req.headers['x-request-id']
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password recovery with anti-enumeration protection' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Recovery initiated' })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordInput,
    @Req() req: Request
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.authService.forgotPassword(dto, ip, userAgent);

    return {
      ...result,
      requestId: req.headers['x-request-id']
    };
  }

  @Post('reset-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP for password reset and issue reset challenge token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reset challenge token issued' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 423, description: 'OTP attempts locked' })
  async verifyResetOtp(
    @Body(new ZodValidationPipe(verifyResetOtpSchema)) dto: VerifyResetOtpInput,
    @Req() req: Request
  ) {
    const result = await this.authService.verifyResetOtp(dto);

    return {
      ...result,
      requestId: req.headers['x-request-id']
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute password reset with challenge token, revoking all sessions' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset and all sessions revoked' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid challenge token or same password' })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
    @Req() req: Request
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.authService.resetPassword(dto, ip, userAgent);

    return {
      ...result,
      requestId: req.headers['x-request-id']
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Change password while authenticated, preserving current session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed and other sessions revoked' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid current password' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Same password as current' })
  @ApiResponse({ status: 423, description: 'Account locked due to repeated incorrect password' })
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordInput,
    @Req() req: Request
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const currentSessionToken = req.cookies?.[SESSION_COOKIE_NAME] || '';

    const result = await this.authService.changePassword(
      user.id,
      currentSessionToken,
      dto,
      ip,
      userAgent
    );

    return {
      ...result,
      requestId: req.headers['x-request-id']
    };
  }

}
