import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  AdminRole,
  adminLoginSchema,
  adminInitiatePasswordResetSchema,
  adminCompletePasswordResetSchema,
  AdminLoginInput,
  AdminInitiatePasswordResetInput,
  AdminCompletePasswordResetInput,
  ADMIN_LOGIN_SUCCESS,
  ADMIN_LOGOUT_SUCCESS,
  ADMIN_PASSWORD_RESET_SUCCESS,
  ADMIN_RESET_DISPATCHED,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_INACTIVITY_HOURS,
  ADMIN_SESSION_INACTIVITY_MS,
  ADMIN_SESSION_PROFILE,
} from '@elmasaif/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthService } from './admin-auth.service';
import { AdminSessionAuthGuard } from './guards/admin-session-auth.guard';

export interface AuthenticatedAdminRequest extends Request {
  admin: {
    id: string;
    role: AdminRole;
    username?: string;
    email?: string;
    fullName?: string;
    isActive?: boolean;
    permissions?: string[];
  };
  adminSessionToken?: string;
}

@ApiTags('Admin Authentication')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminSessionAuthGuard: AdminSessionAuthGuard
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate administrative staff in isolated admin realm' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Admin authenticated and isolated session cookie issued' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid admin credentials' })
  @ApiResponse({ status: 423, description: 'Admin account locked for 15 minutes after 5 failed attempts' })
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema)) dto: AdminLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await this.adminAuthService.login(dto, ip, userAgent);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(ADMIN_SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_INACTIVITY_MS,
    });

    return {
      code: ADMIN_LOGIN_SUCCESS,
      message: 'تم تسجيل الدخول إلى بوابة الإدارة بنجاح',
      data: {
        admin: result.admin,
        sessionExpiresAt: result.expiresAt,
        inactivityTimeoutHours: ADMIN_SESSION_INACTIVITY_HOURS,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate administrative session and clear isolated cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const token =
      req.cookies?.[ADMIN_SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    await this.adminAuthService.logout(token, ip);
    res.clearCookie(ADMIN_SESSION_COOKIE_NAME, { path: '/' });

    return {
      code: ADMIN_LOGOUT_SUCCESS,
      message: 'تم تسجيل الخروج من بوابة الإدارة بنجاح',
      requestId: req.headers['x-request-id'],
    };
  }

  @Get('me')
  @UseGuards(AdminSessionAuthGuard)
  @ApiOperation({ summary: 'Get authenticated administrator profile and permissions' })
  async getMe(
    @Req() req: AuthenticatedAdminRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const admin = await this.adminAuthService.getMe(req.admin.id);

    if (req.adminSessionToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(ADMIN_SESSION_COOKIE_NAME, req.adminSessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_INACTIVITY_MS,
      });
    }

    return {
      code: ADMIN_SESSION_PROFILE,
      message: 'تم استرجاع بيانات جلسة المشرف بنجاح',
      data: {
        admin,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Get('staff')
  @UseGuards(AdminSessionAuthGuard)
  @ApiOperation({ summary: 'List administrative staff accounts for Super Admin management' })
  async listStaff(@Req() req: AuthenticatedAdminRequest) {
    const staff = await this.adminAuthService.listAdminsForSuperAdmin(req.admin.role);

    return {
      code: 'ADMIN_STAFF_LIST',
      message: 'تم استرجاع قائمة المشرفين بنجاح',
      data: {
        staff,
      },
      requestId: req.headers['x-request-id'],
    };
  }

  @Post(':adminId/reset-password/initiate')
  @UseGuards(AdminSessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Super Admin (Rbac.Manage) initiates a 15-minute single-use password reset link for an admin account',
  })
  async initiatePasswordReset(
    @Param('adminId') targetAdminId: string,
    @Body(new ZodValidationPipe(adminInitiatePasswordResetSchema))
    dto: AdminInitiatePasswordResetInput,
    @Req() req: AuthenticatedAdminRequest
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    const result = await this.adminAuthService.initiatePasswordReset(
      req.admin.id,
      req.admin.role,
      targetAdminId,
      dto,
      ip
    );

    return {
      code: ADMIN_RESET_DISPATCHED,
      message:
        'تم إرسال رابط إعادة تعيين كلمة المرور الصالح لمدة 15 دقيقة وللمرة الواحدة إلى البريد الإلكتروني للمشرف، وإلغاء جلساته النشطة فوراً',
      data: result,
      requestId: req.headers['x-request-id'],
    };
  }

  @Post('reset-password/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete single-use administrative password reset within 15-minute window',
  })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(adminCompletePasswordResetSchema))
    dto: AdminCompletePasswordResetInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    await this.adminAuthService.completePasswordReset(dto, ip, userAgent);
    res.clearCookie(ADMIN_SESSION_COOKIE_NAME, { path: '/' });

    return {
      code: ADMIN_PASSWORD_RESET_SUCCESS,
      message: 'تم تعيين كلمة المرور الإدارية الجديدة بنجاح، يرجى تسجيل الدخول',
      requestId: req.headers['x-request-id'],
    };
  }
}
