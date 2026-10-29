import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  IDENTITY_FILE_TOO_LARGE,
  IDENTITY_INVALID_DOCUMENT,
  IDENTITY_INVALID_ID_NUMBER,
  uploadIdentityDocumentSchema
} from '@elmasaif/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { IdentityService, IdentityUploadFile } from './identity.service';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage.service';

@Catch(PayloadTooLargeException)
export class IdentityFileTooLargeFilter implements ExceptionFilter<PayloadTooLargeException> {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      code: IDENTITY_FILE_TOO_LARGE,
      message: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت',
      requestId: request.headers?.['x-request-id']
    });
  }
}

@ApiTags('User Identity Verification')
@Controller('users/identity')
@UseGuards(SessionAuthGuard)
export class IdentityController {
  constructor(
    private readonly identityService: Pick<
      IdentityService,
      'uploadIdentityDocument' | 'getIdentityStatus' | 'getIdentityDocumentDownloadUrl'
    >
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @UseFilters(IdentityFileTooLargeFilter)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a private identity document for verification' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['NATIONAL_ID', 'IQAMA'] },
        idNumber: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Document scanned and accepted for review' })
  async upload(
    @UploadedFile() file: IdentityUploadFile,
    @Body() body: unknown,
    @Req() req: any
  ) {
    const parsed = uploadIdentityDocumentSchema.safeParse(body);
    if (!parsed.success) {
      const invalidId = parsed.error.issues.some((issue) => issue.path[0] === 'idNumber');
      throw new BadRequestException({
        code: invalidId ? IDENTITY_INVALID_ID_NUMBER : IDENTITY_INVALID_DOCUMENT,
        message: invalidId ? 'رقم الهوية غير صالح' : 'بيانات وثيقة الهوية غير صالحة',
        details: parsed.error.format()
      });
    }

    const document = await this.identityService.uploadIdentityDocument(
      req.user.id,
      file,
      parsed.data.documentType,
      parsed.data.idNumber
    );
    return {
      code: 'SUCCESS',
      message: 'تم استلام وثيقة الهوية',
      data: document,
      requestId: req.headers?.['x-request-id']
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get the current user identity verification status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Identity status retrieved' })
  async getStatus(@Req() req: any) {
    return {
      code: 'SUCCESS',
      data: await this.identityService.getIdentityStatus(req.user.id),
      requestId: req.headers?.['x-request-id']
    };
  }

  @Get('document-url')
  @ApiOperation({ summary: 'Get a short-lived URL for the current user identity document' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Private document URL generated' })
  async getDocumentUrl(@Req() req: any) {
    return {
      code: 'SUCCESS',
      data: await this.identityService.getIdentityDocumentDownloadUrl(req.user.id, req.user.id),
      requestId: req.headers?.['x-request-id']
    };
  }
}
