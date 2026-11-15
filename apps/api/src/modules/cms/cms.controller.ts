import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CmsService } from './cms.service';

@ApiTags('Public CMS & Content')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get published CMS page by slug' })
  @ApiResponse({ status: 200, description: 'CMS page retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Page not found or unpublished' })
  async getPage(@Param('slug') slug: string) {
    const data = await this.cmsService.getPublishedPageBySlug(slug);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع الصفحة بنجاح',
      data,
    };
  }

  @Get('banners/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get currently active announcement banners' })
  @ApiResponse({ status: 200, description: 'Active banners retrieved successfully' })
  async getActiveBanners() {
    const data = await this.cmsService.getActiveBanners();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع الإعلانات والتنبيهات النشطة بنجاح',
      data,
    };
  }

  @Get('faq')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get published FAQ items' })
  @ApiResponse({ status: 200, description: 'FAQ items retrieved successfully' })
  async getFaq() {
    const data = await this.cmsService.getPublishedFaq();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع الأسئلة الشائعة بنجاح',
      data,
    };
  }
}

