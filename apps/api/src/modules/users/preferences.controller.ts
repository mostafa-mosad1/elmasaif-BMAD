import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateUserPreferencesSchema,
  UpdateUserPreferencesInput,
  UserPreferencesResponse,
  USER_PREFERENCES_RETRIEVED,
  USER_PREFERENCES_UPDATED
} from '@elmasaif/shared';

@ApiTags('User Preferences')
@Controller('users/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user preferences and visual theme settings' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences retrieved successfully' })
  async getPreferences(@Req() req: any): Promise<UserPreferencesResponse> {
    const preferences = await this.preferencesService.getPreferences(req.user.id);
    return {
      code: USER_PREFERENCES_RETRIEVED,
      message: 'تم استرجاع تفضيلات المستخدم بنجاح',
      data: preferences,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Patch()
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user UI language, theme, and optional notification preferences' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed or critical alerts altered' })
  async updatePreferences(
    @Body(new ZodValidationPipe(updateUserPreferencesSchema)) body: UpdateUserPreferencesInput,
    @Req() req: any
  ): Promise<UserPreferencesResponse> {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || 'unknown';

    const updated = await this.preferencesService.updatePreferences(
      req.user.id,
      body,
      ip,
      userAgent
    );

    return {
      code: USER_PREFERENCES_UPDATED,
      message: 'تم تحديث تفضيلات المستخدم بنجاح',
      data: updated,
      requestId: req.headers?.['x-request-id']
    };
  }
}

