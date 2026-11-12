import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('Public Platform Settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get('public')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public platform business parameters for consumer calculators and property cards (unauthenticated)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current public platform settings',
  })
  async getPublicSettings(@Req() req: any) {
    const data = await this.platformSettingsService.getPublicSettings();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع إعدادات المنصة العامة بنجاح',
      data,
      requestId: req.headers?.['x-request-id'],
    };
  }
}

