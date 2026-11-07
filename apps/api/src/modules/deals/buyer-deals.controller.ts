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
import { DEAL_PAYMENT_PROOF_TOO_LARGE, UserRole } from '@elmasaif/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage.service';
import { BuyerDealsService } from './buyer-deals.service';
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
  constructor(private readonly buyerDealsService: BuyerDealsService) {}

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
}
