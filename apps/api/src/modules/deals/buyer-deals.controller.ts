import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CancelDealByBuyerInput,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  FileDisputeInput,
  SellerCancelRequestInput,
  SubmitDealRatingInput,
  UserRole,
  cancelDealByBuyerSchema,
  fileDisputeSchema,
  sellerCancelRequestSchema,
  submitDealRatingSchema,
} from '@elmasaif/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BuyerDealsService } from './buyer-deals.service';
import { DealsCancellationService } from './deals-cancellation.service';
import { DisputesService } from './disputes.service';
import { DealProofUploadFile } from './dto/upload-payment-proof.dto';

/** `multer` rejects the upload before the handler runs, so this filter is the only place that
 *  can turn its `PayloadTooLargeException` into a code the web can render (T-12). */
@Catch(PayloadTooLargeException)
export class DealProofTooLargeFilter implements ExceptionFilter<PayloadTooLargeException> {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      code: DEAL_PAYMENT_PROOF_TOO_LARGE,
      message: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت',
      requestId: request.headers?.['x-request-id'],
    });
  }
}

/**
 * Story 5.2 / AC-1, AC-2, AC-7, AC-12: the buyer's deal payment endpoints.
 *
 * Route order is load-bearing (trap T-6): `Get('my')` is declared before `Get(':id')`, otherwise
 * `/deals/my` resolves as `:id = 'my'` and returns a 404 that looks like a routing bug for an hour.
 * The envelope follows `OffersController` (`{ statusCode, message?, data }`), not the identity
 * controller's `{ code, data, requestId }` shape.
 */
@ApiTags('Buyer Deals')
@Controller('deals')
@UseGuards(SessionAuthGuard, ActiveRoleGuard)
@RequireRole(UserRole.BUYER)
export class BuyerDealsController {
  constructor(
    private readonly buyerDealsService: BuyerDealsService,
    private readonly dealsCancellationService: DealsCancellationService,
    private readonly disputesService: DisputesService,
  ) {}

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "The caller's own deals, newest first (AC-2, FR-29)" })
  @ApiResponse({ status: 200, description: 'Deals returned' })
  @ApiResponse({ status: 403, description: 'DEAL_BUYER_PROFILE_REQUIRED' })
  async listMyDeals(@Req() req: any) {
    const data = await this.buyerDealsService.listMyDeals(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Get('seller/summary')
  @HttpCode(HttpStatus.OK)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller deals pipeline summary & metrics (Story 6.4 / AC-3)' })
  @ApiResponse({ status: 200, description: 'Summary returned' })
  @ApiResponse({ status: 403, description: 'AUTH_ROLE_NOT_AUTHORIZED' })
  async getSellerDealsSummary(@Req() req: any) {
    const data = await this.buyerDealsService.getSellerDealsSummary(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Get('seller')
  @HttpCode(HttpStatus.OK)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller deals list, newest first (Story 6.4 / AC-3)' })
  @ApiResponse({ status: 200, description: 'Seller deals returned' })
  @ApiResponse({ status: 403, description: 'AUTH_ROLE_NOT_AUTHORIZED' })
  async listSellerDeals(@Req() req: any) {
    const data = await this.buyerDealsService.listSellerDeals(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Get(':id/payments/:paymentType/proof-url')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'A 5-minute download link for the uploaded receipt (AC-12)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiParam({
    name: 'paymentType',
    enum: ['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE'],
  })
  @ApiResponse({ status: 200, description: '`{ downloadUrl, expiresInSeconds }`' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND / DEAL_PAYMENT_PROOF_NOT_FOUND' })
  @ApiResponse({ status: 403, description: 'DEAL_NOT_PARTY / FILE_QUARANTINED' })
  @ApiResponse({ status: 400, description: 'DEAL_PAYMENT_TYPE_INVALID' })
  async getProofDownloadUrl(
    @Param('id') id: string,
    @Param('paymentType') paymentType: string,
    @Req() req: any,
  ) {
    const data = await this.buyerDealsService.getProofDownloadUrl(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      paymentType,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'The dual wire transfer payment screen: frozen amounts, both slots, server clock',
  })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiResponse({ status: 200, description: 'Deal payment view returned' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 403, description: 'DEAL_NOT_PARTY / DEAL_BUYER_PROFILE_REQUIRED' })
  @ApiResponse({ status: 503, description: 'DEAL_PLATFORM_ACCOUNT_UNAVAILABLE' })
  async getDealPayment(@Param('id') id: string, @Req() req: any) {
    const data = await this.buyerDealsService.getDealPayment(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Post(':id/payments/:paymentType/proof')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @UseFilters(DealProofTooLargeFilter)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace one leg of the dual wire transfer receipt (AC-7)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiParam({
    name: 'paymentType',
    enum: ['PLATFORM_COMMISSION', 'SELLER_PURCHASE_PRICE'],
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bankReferenceCode: { type: 'string', maxLength: 64 },
        senderBankName: { type: 'string', maxLength: 100 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'The updated slot' })
  @ApiResponse({ status: 400, description: 'DEAL_PAYMENT_TYPE_INVALID / proof file refusals' })
  @ApiResponse({
    status: 409,
    description:
      'DEAL_TERMINAL / DEAL_PAYMENT_DEADLINE_PASSED / DEAL_PAYMENT_REVIEW_COMPLETE / DEAL_IDENTITY_REQUIRED',
  })
  @ApiResponse({ status: 503, description: 'DEAL_PAYMENT_PROOF_SCAN_FAILED' })
  async uploadProof(
    @Param('id') id: string,
    @Param('paymentType') paymentType: string,
    @UploadedFile() file: DealProofUploadFile,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const data = await this.buyerDealsService.uploadProof(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      paymentType,
      file,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم استلام إيصال التحويل وهو قيد المراجعة الإدارية',
      data,
    };
  }

  @Get(':id/invoice')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Platform commission tax invoice view (AC-5, FR-68)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiResponse({ status: 200, description: 'Invoice summary returned' })
  @ApiResponse({ status: 404, description: 'INVOICE_NOT_FOUND' })
  @ApiResponse({ status: 403, description: 'DEAL_NOT_PARTY' })
  async getInvoice(@Param('id') id: string, @Req() req: any) {
    const data = await this.buyerDealsService.getDealInvoice(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Post(':id/rating')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit buyer rating on a completed deal (AC-4, FR-54)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['score'],
      properties: {
        score: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Rating recorded' })
  @ApiResponse({
    status: 400,
    description: 'DEAL_RATING_SCORE_INVALID / DEAL_RATING_COMMENT_TOO_LONG',
  })
  @ApiResponse({ status: 403, description: 'DEAL_NOT_PARTY / DEAL_RATING_NOT_PARTY' })
  @ApiResponse({ status: 409, description: 'DEAL_NOT_COMPLETED / DEAL_ALREADY_RATED' })
  async submitRating(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitDealRatingSchema)) body: SubmitDealRatingInput,
    @Req() req: any,
  ) {
    const data = await this.buyerDealsService.submitDealRating(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      body,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم تسجيل تقييمك بنجاح',
      data,
    };
  }

  @Post(':id/cancel-by-buyer')
  @HttpCode(HttpStatus.OK)
  @RequireRole(UserRole.BUYER)
  @ApiOperation({ summary: 'Pre-payment Buyer cancellation (AC-1, FR-34, BR-07)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiResponse({ status: 200, description: 'Deal cancelled' })
  @ApiResponse({ status: 403, description: 'DEAL_CANCEL_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEAL_CANCEL_INVALID_STATE / DEAL_CANCEL_PROOF_EXISTS' })
  async cancelByBuyer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelDealByBuyerSchema)) body: CancelDealByBuyerInput,
    @Req() req: any,
  ) {
    const data = await this.dealsCancellationService.cancelByBuyer(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم إلغاء الصفقة بنجاح',
      data,
    };
  }

  @Post(':id/seller-cancel-request')
  @HttpCode(HttpStatus.OK)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiOperation({ summary: 'Pre-payment Seller cancellation request (AC-2, UC-46)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiResponse({ status: 200, description: 'Seller cancellation request submitted' })
  @ApiResponse({ status: 403, description: 'DEAL_CANCEL_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEAL_CANCEL_INVALID_STATE / DEAL_CANCEL_PROOF_EXISTS / SELLER_CANCEL_REQUEST_PENDING' })
  async requestSellerCancellation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sellerCancelRequestSchema)) body: SellerCancelRequestInput,
    @Req() req: any,
  ) {
    const data = await this.dealsCancellationService.requestSellerCancellation(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'تم تقديم طلب إلغاء الصفقة بنجاح وجارٍ مراجعته إدارياً',
      data,
    };
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole(UserRole.BUYER, UserRole.MARKETER, UserRole.OWNER)
  @ApiOperation({ summary: 'Formal Deal Dispute Filing by Counterparties (AC-4, FR-36, UC-29C)' })
  @ApiParam({ name: 'id', description: 'Deal id' })
  @ApiResponse({ status: 201, description: 'Dispute filed successfully' })
  @ApiResponse({ status: 403, description: 'DEAL_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'DEAL_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DEAL_TERMINAL / DISPUTE_PROOF_REQUIRED / DISPUTE_ALREADY_OPEN' })
  async fileDispute(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fileDisputeSchema)) body: FileDisputeInput,
    @Req() req: any,
  ) {
    const data = await this.disputesService.fileDispute(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      body,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'تم تقديم النزاع بنجاح وجارٍ التدقيق الإداري',
      data,
    };
  }
}
