import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Res,
  Req,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService, MAX_EXPIRATION_SECONDS } from './storage.service';
import { QuarantineService } from './quarantine.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UploadRequestDto,
  ScanRequestDto,
  StorageUploadResponseDto,
  ScanResultResponseDto,
  FileStatusResponseDto,
  DownloadUrlResponseDto,
} from './dto';
import { ScanStatus } from '@elmasaif/shared';

@ApiTags('Storage & Quarantine Security')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly quarantineService: QuarantineService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload-request')
  @ApiOperation({
    summary: 'Request quarantine upload URL',
    description:
      'Stages a file for upload in the isolated quarantine/ partition. Enforces maximum 10MB limit and allowed MIME types. Returns a short-lived presigned PUT URL for client-direct S3 upload.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File successfully staged in quarantine partition',
    type: StorageUploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid MIME type, missing filename, or file size exceeds 10MB',
  })
  async requestUploadUrl(@Body() dto: UploadRequestDto): Promise<StorageUploadResponseDto> {
    const result = await this.quarantineService.stageFileForQuarantine({
      filename: dto.filename,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      userId: dto.userId,
    });

    return {
      fileObjectId: result.fileObjectId,
      uploadUrl: result.uploadUrl,
      key: result.key,
      bucket: result.bucket,
      scanStatus: result.scanStatus,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
    };
  }

  @Post('scan/:id')
  @ApiOperation({
    summary: 'Trigger malware scanning hook and promotion',
    description:
      'Initiates malware scanning on a staged quarantine file. Clean files are promoted to the target operational partition and quarantine copies are deleted. Infected files are contained with immutable AuditLog records. Scanner downtime triggers fail-closed SCAN_FAILED state.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the staged FileObject',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scan evaluated successfully',
    type: ScanResultResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Malware scan failed or file was quarantined and flagged as infected',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'FileObject not found',
  })
  async scanFile(
    @Param('id') id: string,
    @Body() dto: ScanRequestDto,
  ): Promise<ScanResultResponseDto> {
    const outcome = await this.quarantineService.scanAndProcess(
      id,
      dto.targetPartition || 'identity',
      {
        userId: dto.userId,
        dealId: dto.dealId,
        paymentId: dto.paymentId,
        contractId: dto.contractId,
      },
    );

    return {
      fileObjectId: outcome.fileObject.id,
      isClean: outcome.isClean,
      scanStatus: outcome.fileObject.scanStatus as ScanStatus,
      key: outcome.fileObject.key,
      threatName: outcome.threatName,
      scannedAt: outcome.fileObject.scannedAt?.toISOString() || null,
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Multipart direct file upload and synchronous scan',
    description:
      'Server-mediated upload that receives the binary, stages it in quarantine, and synchronously executes the malware scanning hook before returning promotion status.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        targetPartition: {
          type: 'string',
          enum: ['identity', 'payments', 'contracts', 'licenses'],
          default: 'identity',
        },
        userId: { type: 'string' },
        dealId: { type: 'string' },
        paymentId: { type: 'string' },
        contractId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File staged, scanned, and promoted if clean',
    type: ScanResultResponseDto,
  })
  async directUpload(
    @UploadedFile() file: any,
    @Body() dto: ScanRequestDto,
  ): Promise<ScanResultResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Binary file payload is required in multipart form data under "file"');
    }

    // Stage in quarantine with buffer
    const staged = await this.quarantineService.stageFileForQuarantine({
      filename: file.originalname || 'upload.bin',
      mimeType: file.mimetype,
      fileSize: file.size,
      buffer: file.buffer,
      userId: dto.userId,
    });

    // Execute scan hook
    const outcome = await this.quarantineService.scanAndProcess(
      staged.fileObjectId,
      dto.targetPartition || 'identity',
      {
        userId: dto.userId,
        dealId: dto.dealId,
        paymentId: dto.paymentId,
        contractId: dto.contractId,
      },
    );

    return {
      fileObjectId: outcome.fileObject.id,
      isClean: outcome.isClean,
      scanStatus: outcome.fileObject.scanStatus as ScanStatus,
      key: outcome.fileObject.key,
      threatName: outcome.threatName,
      scannedAt: outcome.fileObject.scannedAt?.toISOString() || null,
    };
  }

  @Get('files/:id/download')
  @ApiOperation({
    summary: 'Download verified clean file',
    description:
      'Generates a short-lived presigned GET download URL clamped to <= 300 seconds. Strictly enforces that the file has passed malware scanning (scanStatus === CLEAN). Returns HTTP 403 Forbidden for quarantined, infected, or unscanned files.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the FileObject or PropertyDocument',
  })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    type: Number,
    description: 'Expiration in seconds (clamped to maximum 300 seconds)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Short-lived presigned download URL generated successfully',
    type: DownloadUrlResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'File is quarantined, infected, or has not passed malware scan verification',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File record not found',
  })
  async getDownloadUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<DownloadUrlResponseDto> {
    const expiryRequested = expiresIn ? parseInt(expiresIn, 10) : MAX_EXPIRATION_SECONDS;
    const clampedExpiry = Math.min(
      Math.max(1, isNaN(expiryRequested) ? MAX_EXPIRATION_SECONDS : expiryRequested),
      MAX_EXPIRATION_SECONDS,
    );

    const downloadUrl = await this.storageService.getVerifiedDownloadUrl(id, clampedExpiry);

    return {
      downloadUrl,
      expiresInSeconds: clampedExpiry,
    };
  }

  @Get('files/:id/status')
  @ApiOperation({
    summary: 'Check file malware scan status',
    description: 'Retrieves current scanStatus (PENDING, CLEAN, INFECTED, SCAN_FAILED) and metadata.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the FileObject or PropertyDocument',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File status retrieved successfully',
    type: FileStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File record not found',
  })
  async getFileStatus(@Param('id') id: string): Promise<FileStatusResponseDto> {
    const fileObject = await this.prisma.fileObject.findUnique({
      where: { id: id.trim() },
    });

    if (fileObject) {
      return {
        fileObjectId: fileObject.id,
        scanStatus: fileObject.scanStatus as ScanStatus,
        mimeType: fileObject.mimeType,
        fileSize: fileObject.fileSize,
        key: fileObject.key,
        scannedAt: fileObject.scannedAt?.toISOString() || null,
        createdAt: fileObject.createdAt.toISOString(),
      };
    }

    const propertyDoc = await this.prisma.propertyDocument.findUnique({
      where: { id: id.trim() },
    });

    if (propertyDoc) {
      return {
        fileObjectId: propertyDoc.id,
        scanStatus: propertyDoc.scanStatus as ScanStatus,
        mimeType: propertyDoc.mimeType,
        fileSize: propertyDoc.fileSize,
        key: propertyDoc.fileUrl,
        scannedAt: propertyDoc.scannedAt?.toISOString() || null,
        createdAt: propertyDoc.createdAt.toISOString(),
      };
    }

    throw new NotFoundException(`File record not found for ID '${id}'`);
  }
  @Get('raw')
  @ApiOperation({ summary: 'Stream raw file in development when local fallback is used' })
  async getRawFile(
    @Query('key') key: string,
    @Res() res: any,
  ) {
    if (!key || !key.trim()) {
      throw new BadRequestException('Key is required');
    }
    const exists = await this.storageService.checkObjectExists(key);
    if (!exists) {
      throw new NotFoundException('File not found');
    }
    const buffer = await this.storageService.getObjectBuffer(key);
    const cleanKey = key.toLowerCase();
    const mime = cleanKey.endsWith('.pdf')
      ? 'application/pdf'
      : cleanKey.endsWith('.png')
      ? 'image/png'
      : cleanKey.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }

  @Put('raw-upload')
  @ApiOperation({ summary: 'Receive raw file upload in development when local fallback is used' })
  async putRawFile(
    @Query('key') key: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    if (!key || !key.trim()) {
      throw new BadRequestException('Key is required');
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const mime = req.headers['content-type'] || 'application/octet-stream';
      await this.storageService.putObject(key, buffer, mime);
      res.status(HttpStatus.OK).send();
    });
  }
}
