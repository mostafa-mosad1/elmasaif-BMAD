import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { RequireAdminPermission } from '../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  upsertCmsPageSchema,
  upsertBannerSchema,
  upsertFaqItemSchema,
  UpsertCmsPageInput,
  UpsertBannerInput,
  UpsertFaqItemInput,
} from '@elmasaif/shared';

@ApiTags('Admin Content Management (CMS)')
@Controller('admin/cms')
@UseGuards(AdminSessionAuthGuard, AdminPermissionGuard)
@RequireAdminPermission('CMS.Manage', 'Content.Manage')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  // Pages
  @Get('pages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all CMS pages (published and drafts)' })
  @ApiResponse({ status: 200, description: 'All CMS pages retrieved' })
  async getAllPages() {
    const data = await this.cmsService.getAllPages();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع صفحات المحتوى بنجاح',
      data,
    };
  }

  @Post('pages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update CMS page' })
  @ApiResponse({ status: 200, description: 'CMS page saved' })
  async upsertPage(
    @Body(new ZodValidationPipe(upsertCmsPageSchema)) body: UpsertCmsPageInput,
    @Req() req: any,
  ) {
    const data = await this.cmsService.upsertCmsPage(req.admin.id, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حفظ صفحة المحتوى بنجاح',
      data,
    };
  }

  // Banners
  @Get('banners')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all announcement banners' })
  @ApiResponse({ status: 200, description: 'All banners retrieved' })
  async getAllBanners() {
    const data = await this.cmsService.getAllBanners();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع أشرطة الإعلانات والتنبيهات بنجاح',
      data,
    };
  }

  @Post('banners')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update announcement banner' })
  @ApiResponse({ status: 200, description: 'Banner saved' })
  async createOrUpdateBanner(
    @Body(new ZodValidationPipe(upsertBannerSchema)) body: UpsertBannerInput,
    @Req() req: any,
  ) {
    const data = await this.cmsService.createOrUpdateBanner(req.admin.id, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حفظ شريط التنبيهات بنجاح',
      data,
    };
  }

  @Post('banners/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update existing announcement banner by ID' })
  @ApiResponse({ status: 200, description: 'Banner updated' })
  async updateBanner(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertBannerSchema)) body: UpsertBannerInput,
    @Req() req: any,
  ) {
    const data = await this.cmsService.createOrUpdateBanner(req.admin.id, body, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحديث شريط التنبيهات بنجاح',
      data,
    };
  }

  @Delete('banners/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete announcement banner' })
  @ApiResponse({ status: 200, description: 'Banner deleted' })
  async deleteBanner(@Param('id') id: string, @Req() req: any) {
    await this.cmsService.deleteBanner(req.admin.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حذف شريط التنبيهات بنجاح',
    };
  }

  // FAQ
  @Get('faq')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all FAQ items' })
  @ApiResponse({ status: 200, description: 'All FAQ items retrieved' })
  async getAllFaq() {
    const data = await this.cmsService.getAllFaq();
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استرجاع كافة الأسئلة الشائعة بنجاح',
      data,
    };
  }

  @Post('faq')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create new FAQ item' })
  @ApiResponse({ status: 200, description: 'FAQ item saved' })
  async createFaq(
    @Body(new ZodValidationPipe(upsertFaqItemSchema)) body: UpsertFaqItemInput,
    @Req() req: any,
  ) {
    const data = await this.cmsService.createOrUpdateFaq(req.admin.id, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حفظ السؤال الشائع بنجاح',
      data,
    };
  }

  @Post('faq/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update existing FAQ item by ID' })
  @ApiResponse({ status: 200, description: 'FAQ item updated' })
  async updateFaq(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertFaqItemSchema)) body: UpsertFaqItemInput,
    @Req() req: any,
  ) {
    const data = await this.cmsService.createOrUpdateFaq(req.admin.id, body, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تحديث السؤال الشائع بنجاح',
      data,
    };
  }

  @Delete('faq/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete FAQ item' })
  @ApiResponse({ status: 200, description: 'FAQ item deleted' })
  async deleteFaq(@Param('id') id: string, @Req() req: any) {
    await this.cmsService.deleteFaq(req.admin.id, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم حذف السؤال الشائع بنجاح',
    };
  }
}

