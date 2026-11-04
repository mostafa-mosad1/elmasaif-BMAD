import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingResponseDto } from './dto/listing-response.dto';
import { UploadListingMediaResponse } from './dto/upload-listing-media.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  createListingSchema,
  CreateListingInput,
  respondPriceSuggestionSchema,
  RespondPriceSuggestionInput,
  archiveListingSchema,
  ArchiveListingInput,
  batchListingEngagementSchema,
  BatchListingEngagementInput,
  listingAnalyticsQuerySchema,
  ListingAnalyticsQuery,
  listingSearchQuerySchema,
  ListingSearchQuery,
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';

@ApiTags('Property Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new property sale listing' })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({ status: 201, description: 'Listing successfully created', type: ListingResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or missing mandatory legal documents' })
  @ApiResponse({ status: 403, description: 'Role unauthorized or invalid Fal license' })
  async createListing(
    @Req() req: any,
    @Body(new ZodValidationPipe(createListingSchema)) dto: CreateListingInput,
  ) {
    const userId = req.user.id;
    const activeRole = req.user.activeRole || req.user.role;
    return this.listingsService.createListing(userId, activeRole, dto);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload and quarantine-scan listing media or legal documents' })
  @ApiResponse({ status: 201, description: 'File staged, scanned, and promoted' })
  @ApiResponse({ status: 400, description: 'File size exceeded, invalid MIME type, or malware detected' })
  async uploadMedia(
    @Req() req: any,
    @UploadedFile() file: any,
    @Query('purpose') purpose?: 'photo' | 'document',
  ): Promise<UploadListingMediaResponse> {
    const userId = req.user.id;
    return this.listingsService.uploadMediaOrDocument(file, userId, purpose || 'photo');
  }

  @Post('analytics/events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Asynchronously ingest batched listing engagement events (impressions and detail views)',
  })
  async recordAnalyticsEvents(
    @Body(new ZodValidationPipe(batchListingEngagementSchema))
    dto: BatchListingEngagementInput,
  ) {
    return this.listingsService.recordBatchEngagement(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List public ACTIVE property listings' })
  async getPublicListings(@Req() req: any, @Query('limit') limit?: string) {
    let requesterUserId: string | undefined;
    const userToken =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (userToken) {
      const session = await this.prisma.session.findUnique({
        where: { token: userToken },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt > this.clockService.now()) {
        requesterUserId = session.userId;
      }
    }

    const result = await this.listingsService.getPublicActiveListings(
      limit ? Number(limit) : 24,
      requesterUserId,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search ACTIVE/RESERVED sale listings by multi-criteria filters with pagination and sorting',
  })
  async searchListings(@Req() req: any, @Query(new ZodValidationPipe(listingSearchQuerySchema)) query: ListingSearchQuery) {
    let requesterUserId: string | undefined;
    const userToken =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (userToken) {
      const session = await this.prisma.session.findUnique({
        where: { token: userToken },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt > this.clockService.now()) {
        requesterUserId = session.userId;
      }
    }

    const result = await this.listingsService.searchListings(query, requesterUserId);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List current authenticated seller (Owner/Marketer) listings with moderation status' })
  async getMyListings(@Req() req: any) {
    const result = await this.listingsService.getMyListings(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve property listing details by ID' })
  @ApiResponse({ status: 200, description: 'Listing details retrieved', type: ListingResponseDto })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getListingById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    let requesterUserId: string | undefined;
    let requesterIsAdmin = false;

    // Optional user session extraction
    const userToken =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (userToken) {
      const session = await this.prisma.session.findUnique({
        where: { token: userToken },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt > this.clockService.now()) {
        requesterUserId = session.userId;
      }
    }

    // Optional admin session extraction
    const adminToken = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];
    if (adminToken) {
      const adminSession = await this.prisma.adminSession.findUnique({
        where: { token: adminToken },
        include: { admin: true },
      });
      if (
        adminSession &&
        adminSession.expiresAt > this.clockService.now() &&
        adminSession.admin.isActive
      ) {
        requesterIsAdmin = true;
      }
    }

    return this.listingsService.getListingById(id, requesterUserId, requesterIsAdmin);
  }

  @Post(':id/price-suggestions/:suggestionId/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accept an administrative price suggestion on a listing (FR-57, BR-13)',
  })
  async acceptPriceSuggestion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('suggestionId', new ParseUUIDPipe()) suggestionId: string,
    @Body(new ZodValidationPipe(respondPriceSuggestionSchema))
    body: RespondPriceSuggestionInput,
    @Req() req: any,
  ) {
    const result = await this.listingsService.acceptPriceSuggestion(
      id,
      suggestionId,
      req.user.id,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم قبول السعر الاسترشادي المقترح وتحديث السعر المطلوب للإعلان بنجاح',
      data: result,
    };
  }

  @Post(':id/price-suggestions/:suggestionId/decline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Decline an administrative price suggestion and keep original askPrice (FR-57)',
  })
  async declinePriceSuggestion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('suggestionId', new ParseUUIDPipe()) suggestionId: string,
    @Body(new ZodValidationPipe(respondPriceSuggestionSchema))
    body: RespondPriceSuggestionInput,
    @Req() req: any,
  ) {
    const result = await this.listingsService.declinePriceSuggestion(
      id,
      suggestionId,
      req.user.id,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض مقترح تعديل السعر والاحتفاظ بالسعر المطلوب الحالي دون تغيير',
      data: result,
    };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Archive an authored property listing (FR-14, UC-38, BR-16)',
  })
  async archiveListing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(archiveListingSchema)) body: ArchiveListingInput,
    @Req() req: any,
  ) {
    const result = await this.listingsService.archiveListing(id, req.user.id, body);
    return {
      statusCode: HttpStatus.OK,
      message: 'تمت أرشفة الإعلان بنجاح وإلغاء العروض المعلقة المرتبطة به',
      data: result,
    };
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unarchive / reactivate an authored property listing (UC-38, BR-13)',
  })
  async unarchiveListing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    const result = await this.listingsService.unarchiveListing(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء أرشفة الإعلان وإعادة تنشيطه بنجاح',
      data: result,
    };
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle favorite bookmark for an authenticated user on a listing',
  })
  async toggleFavorite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: any,
  ) {
    const result = await this.listingsService.toggleFavorite(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      message: result.isFavorited
        ? 'تمت إضافة العقار إلى المفضلة'
        : 'تمت إزالة العقار من المفضلة',
      data: result,
    };
  }

  @Get(':id/analytics')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Retrieve engagement metrics and conversion trend for an authored listing',
  })
  async getListingAnalytics(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(listingAnalyticsQuerySchema))
    query: ListingAnalyticsQuery,
    @Req() req: any,
  ) {
    const isAdmin = Boolean(req.user?.isAdmin);
    const result = await this.listingsService.getListingAnalytics(
      id,
      req.user.id,
      query.days ?? 30,
      isAdmin,
    );
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}

