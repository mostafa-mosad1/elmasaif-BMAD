import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CounterOfferDto, RejectOfferDto } from './dto/respond-to-offer.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UserRole,
  offerListQuerySchema,
  submitOfferSchema,
  counterOfferSchema,
  rejectOfferSchema,
  OfferListQuery,
  SubmitOfferInput,
  CounterOfferInput,
  RejectOfferInput,
} from '@elmasaif/shared';

@ApiTags('Buyer Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // Static routes MUST be declared before any ':id' route (NestJS route order):
  // a ':id' route declared first swallows both 'my' and 'received'.

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

  @Get('received')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "The offers on the caller's own listings, newest first (FR-55 seller surface)",
  })
  @ApiResponse({ status: 200, description: 'Received offers returned' })
  @ApiResponse({ status: 403, description: 'No ACTIVE MARKETER/OWNER profile in this workspace' })
  async listReceivedOffers(@Req() req: any) {
    const data = await this.offersService.listReceivedOffers(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER, UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'The full mediated negotiation thread, visible to either party only (FR-26)',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Thread returned' })
  @ApiResponse({ status: 403, description: 'OFFER_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'OFFER_NOT_FOUND' })
  async getOfferThread(@Param('id') id: string, @Req() req: any) {
    const data = await this.offersService.getOfferThread(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
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

  @Post(':id/accept-by-seller')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Seller accepts the mediated offer → mutual agreement (FR-55)',
  })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Offer moved to SELECTED_PENDING_FINAL_ADMIN_APPROVAL' })
  @ApiResponse({ status: 409, description: 'OFFER_INVALID_STATE_TRANSITION / OFFER_ALREADY_EXPIRED' })
  async acceptBySeller(@Param('id') id: string, @Req() req: any) {
    const data = await this.offersService.acceptBySeller(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم قبول العرض واعتماده مبدئياً بانتظار الموافقة النهائية',
      data,
    };
  }

  @Post(':id/reject-by-seller')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller rejects the mediated offer with a structured reason (FR-55)' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiBody({ type: RejectOfferDto })
  @ApiResponse({ status: 200, description: 'Offer moved to REJECTED_BY_SELLER' })
  async rejectBySeller(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectOfferSchema)) dto: RejectOfferInput,
    @Req() req: any,
  ) {
    const data = await this.offersService.rejectBySeller(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      dto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم رفض العرض وتسجيل السبب',
      data,
    };
  }

  @Post(':id/counter-by-seller')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller submits a counter-offer back through admin mediation (FR-26)' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiBody({ type: CounterOfferDto })
  @ApiResponse({ status: 200, description: 'Offer moved to COUNTER_OFFERED with round + 1' })
  @ApiResponse({ status: 409, description: 'OFFER_MAX_ROUNDS_REACHED / OFFER_ALREADY_EXPIRED' })
  async counterBySeller(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(counterOfferSchema)) dto: CounterOfferInput,
    @Req() req: any,
  ) {
    const data = await this.offersService.counterBySeller(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      dto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تسجيل عرض مقابل من البائع وإحالته للمراجعة الإدارية',
      data,
    };
  }

  @Post(':id/accept-by-buyer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer accepts the relayed counter-offer → mutual agreement (FR-26)' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiResponse({ status: 200, description: 'Offer moved to SELECTED_PENDING_FINAL_ADMIN_APPROVAL' })
  async acceptByBuyer(@Param('id') id: string, @Req() req: any) {
    const data = await this.offersService.acceptByBuyer(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم قبول العرض المضاد واعتماده مبدئياً بانتظار الموافقة النهائية',
      data,
    };
  }

  @Post(':id/counter-by-buyer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer submits the next counter round back through mediation (FR-26)' })
  @ApiParam({ name: 'id', description: 'Offer id' })
  @ApiBody({ type: CounterOfferDto })
  @ApiResponse({ status: 200, description: 'Offer moved to COUNTER_OFFERED with round + 1' })
  @ApiResponse({ status: 409, description: 'OFFER_MAX_ROUNDS_REACHED / OFFER_ALREADY_EXPIRED' })
  async counterByBuyer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(counterOfferSchema)) dto: CounterOfferInput,
    @Req() req: any,
  ) {
    const data = await this.offersService.counterByBuyer(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      dto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تسجيل عرض مقابل من المشتري وإحالته للمراجعة الإدارية',
      data,
    };
  }
}
