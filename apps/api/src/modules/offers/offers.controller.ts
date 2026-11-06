import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  offerListQuerySchema,
  submitOfferSchema,
  OfferListQuery,
  SubmitOfferInput,
} from '@elmasaif/shared';

@ApiTags('Buyer Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // Static routes MUST be declared before any ':id' route (NestJS route order).

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "The caller's own purchase offers, newest first (FR-25)" })
  @ApiQuery({ name: 'listingId', required: false, description: 'Narrow to one listing UUID' })
  @ApiResponse({ status: 200, description: 'Offers returned' })
  async listMyOffers(
    @Req() req: any,
    @Query(new ZodValidationPipe(offerListQuerySchema)) query: OfferListQuery,
  ) {
    const data = await this.offersService.listMyOffers(
      req.user.id,
      req.user.activeRole || req.user.role,
      query,
    );
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a binding purchase offer with price guardrails (FR-25)' })
  @ApiBody({ type: CreateOfferDto })
  @ApiResponse({ status: 201, description: 'Offer created in PENDING_ADMIN_REVIEW' })
  @ApiResponse({ status: 400, description: 'Listing not offerable / price out of range / confirmation missing' })
  @ApiResponse({ status: 409, description: 'An active offer already exists for this buyer and listing' })
  async submitOffer(
    @Req() req: any,
    @Body(new ZodValidationPipe(submitOfferSchema)) dto: SubmitOfferInput,
  ) {
    const data = await this.offersService.submitOffer(
      req.user.id,
      req.user.activeRole || req.user.role,
      dto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم تسجيل عرض الشراء وهو قيد المراجعة الإدارية',
      data,
    };
  }
}
