import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  switchRoleSchema,
  SwitchRoleInput
} from '@elmasaif/shared';

@ApiTags('User Profiles & Workspaces')
@Controller('users/profiles')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all role profiles and active role for current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User role profiles retrieved' })
  async getProfiles(@Req() req: any) {
    const result = await this.usersService.getUserProfiles(
      req.user.id,
      req.user.sessionToken
    );

    return {
      code: 'SUCCESS',
      message: 'تم استرجاع ملفات المستخدم بنجاح',
      data: result,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active workspace role in current session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role switched successfully' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Marketer role requires active Fal license' })
  async switchRole(
    @Body(new ZodValidationPipe(switchRoleSchema)) body: SwitchRoleInput,
    @Req() req: any
  ) {
    const user = await this.usersService.switchActiveRole(
      req.user.id,
      req.user.sessionToken,
      body.role
    );

    if (req.user) {
      req.user.activeRole = body.role;
      req.user.role = body.role;
    }

    return {
      code: 'SUCCESS',
      message: 'تم تبديل مساحة العمل بنجاح',
      data: {
        user
      },
      requestId: req.headers?.['x-request-id']
    };
  }

  @Post('attach-owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Instantaneously attach Owner role profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Owner profile attached' })
  async attachOwner(@Req() req: any) {
    const profile = await this.usersService.attachOwnerProfile(req.user.id);

    return {
      code: 'SUCCESS',
      message: 'تم تفعيل حساب المالك بنجاح',
      data: profile,
      requestId: req.headers?.['x-request-id']
    };
  }
}
