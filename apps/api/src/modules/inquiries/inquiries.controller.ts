import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
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
import { InquiriesService } from './inquiries.service';
import {
  AppendInquiryMessageDto,
  CreateInquiryDto,
} from './dto/inquiry.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { RequireRole } from '../users/decorators/require-role.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage.service';
import {
  AppendInquiryMessageInput,
  CreateInquiryInput,
  UserRole,
  appendInquiryMessageSchema,
  createInquirySchema,
} from '@elmasaif/shared';

@ApiTags('Listing Inquiries')
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  // Static routes MUST be declared before any ':id' route (NestJS route order): a ':id' route
  // declared first swallows 'my', 'received' and 'attachments'.

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "The caller's own mediated inquiries, most recently active first" })
  @ApiResponse({ status: 200, description: 'Inquiries returned' })
  @ApiResponse({ status: 403, description: 'INQUIRY_BUYER_PROFILE_REQUIRED' })
  async listMyInquiries(@Req() req: any) {
    const data = await this.inquiriesService.listMyInquiries(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Get('received')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Inquiries opened on the caller's own listings" })
  @ApiResponse({ status: 200, description: 'Inquiries returned' })
  @ApiResponse({ status: 403, description: 'INQUIRY_SELLER_PROFILE_REQUIRED' })
  async listReceivedInquiries(@Req() req: any) {
    const data = await this.inquiriesService.listReceivedInquiries(
      req.user.id,
      req.user.activeRole || req.user.role,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Post('attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload, quarantine and scan an inquiry attachment (max 5 per message)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Draft attachment created' })
  @ApiResponse({ status: 400, description: 'Size/MIME rejected or malware detected' })
  async uploadAttachment(@Req() req: any, @UploadedFile() file: any) {
    const data = await this.inquiriesService.uploadAttachment(
      req.user.id,
      req.user.activeRole || req.user.role,
      file,
    );
    return { statusCode: HttpStatus.CREATED, data };
  }

  @Get('attachments/:id/download')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER, UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'A 5-minute presigned URL for a CLEAN attachment (NFR2)' })
  @ApiParam({ name: 'id', description: 'Attachment id' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned' })
  @ApiResponse({ status: 403, description: 'INQUIRY_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'INQUIRY_ATTACHMENT_NOT_FOUND' })
  async getAttachmentDownloadUrl(@Req() req: any, @Param('id') id: string) {
    const data = await this.inquiriesService.getAttachmentDownloadUrl(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a mediated inquiry on a listing (contact details masked)' })
  @ApiBody({ type: CreateInquiryDto })
  @ApiResponse({ status: 201, description: 'Thread opened in PENDING_ADMIN_REVIEW' })
  @ApiResponse({ status: 400, description: 'INQUIRY_LISTING_NOT_INQUIRABLE / SELF_SUBMISSION' })
  @ApiResponse({ status: 404, description: 'INQUIRY_LISTING_NOT_FOUND' })
  async createInquiry(
    @Req() req: any,
    @Body(new ZodValidationPipe(createInquirySchema)) dto: CreateInquiryInput,
  ) {
    const data = await this.inquiriesService.createInquiry(
      req.user.id,
      req.user.activeRole || req.user.role,
      dto,
    );
    return { statusCode: HttpStatus.CREATED, data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER, UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The mediated thread, filtered for the requesting side (AC-4)' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiResponse({ status: 200, description: 'Thread returned' })
  @ApiResponse({ status: 403, description: 'INQUIRY_NOT_PARTY' })
  @ApiResponse({ status: 404, description: 'INQUIRY_NOT_FOUND' })
  async getThread(@Req() req: any, @Param('id') id: string) {
    const data = await this.inquiriesService.getThread(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
    );
    return { statusCode: HttpStatus.OK, data };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionAuthGuard, ActiveRoleGuard)
  @RequireRole(UserRole.BUYER, UserRole.MARKETER, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Append a follow-up (buyer) or a reply (seller, RELAYED_TO_SELLER only)' })
  @ApiParam({ name: 'id', description: 'Inquiry id' })
  @ApiBody({ type: AppendInquiryMessageDto })
  @ApiResponse({ status: 201, description: 'Message stored; thread re-projected' })
  @ApiResponse({ status: 409, description: 'INQUIRY_CLOSED / INQUIRY_INVALID_STATE_TRANSITION' })
  async appendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(appendInquiryMessageSchema)) dto: AppendInquiryMessageInput,
  ) {
    const data = await this.inquiriesService.appendMessage(
      req.user.id,
      req.user.activeRole || req.user.role,
      id,
      dto,
    );
    return { statusCode: HttpStatus.CREATED, data };
  }
}
