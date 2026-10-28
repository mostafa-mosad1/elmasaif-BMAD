import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { StorageService, StoragePartition, StorageContext, MAX_FILE_SIZE_BYTES } from './storage.service';
import { MalwareScannerService } from './malware-scanner.service';
import {
  ScanStatus,
  ACTION_SECURITY_MALWARE_DETECTED,
  ALLOWED_UPLOAD_MIME_TYPES,
  QuarantineUploadResult,
  AllowedUploadMimeType,
} from '@elmasaif/shared';
import { FileObject } from '@prisma/client';

export interface StageFileParams {
  filename: string;
  mimeType: string;
  fileSize: number;
  buffer?: Buffer;
  userId?: string;
}

export interface ScanOutcomeResult {
  fileObject: FileObject;
  isClean: boolean;
  threatName?: string;
}

@Injectable()
export class QuarantineService {
  private readonly logger = new Logger(QuarantineService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly malwareScannerService: MalwareScannerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Stages an incoming file into the quarantine partition.
   * Enforces 10MB size ceiling and approved MIME types (PDF, JPEG, PNG, WEBP).
   * Generates a pending FileObject record and either stores the provided buffer
   * or returns a presigned PUT URL for direct client upload.
   */
  async stageFileForQuarantine(params: StageFileParams): Promise<QuarantineUploadResult> {
    const { filename, mimeType, fileSize, buffer } = params;

    if (!filename || !filename.trim()) {
      throw new BadRequestException('Filename is required');
    }

    if (!fileSize || fileSize <= 0) {
      throw new BadRequestException('File size must be greater than zero bytes');
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size (${fileSize} bytes) exceeds maximum permitted limit of ${MAX_FILE_SIZE_BYTES} bytes (10MB)`,
      );
    }

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as AllowedUploadMimeType)) {
      throw new BadRequestException(
        `Unsupported file MIME type '${mimeType}'. Permitted types: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}`,
      );
    }

    const quarantineKey = this.storageService.createObjectKey('quarantine', filename.trim());
    let uploadUrl: string | undefined;

    if (buffer) {
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException('Buffer exceeds maximum permitted limit of 10MB');
      }
      await this.storageService.putObject(quarantineKey, buffer, mimeType);
    } else {
      const presigned = await this.storageService.getPresignedUploadUrl(quarantineKey, mimeType, 300);
      uploadUrl = presigned.uploadUrl;
    }

    const fileObject = await this.prisma.fileObject.create({
      data: {
        bucket: (this.storageService as any).bucketName || 'elmasaif-private-documents',
        key: quarantineKey,
        mimeType,
        fileSize,
        scanStatus: ScanStatus.PENDING,
        scannedAt: null,
      },
    });

    this.logger.log(
      `Staged file '${filename}' for quarantine as FileObject '${fileObject.id}' (Key: ${quarantineKey})`,
    );

    return {
      fileObjectId: fileObject.id,
      uploadUrl,
      key: fileObject.key,
      bucket: fileObject.bucket,
      scanStatus: fileObject.scanStatus as ScanStatus,
      mimeType: fileObject.mimeType,
      fileSize: fileObject.fileSize,
    };
  }

  /**
   * Scans a quarantined file and processes promotion (if CLEAN) or containment & audit (if INFECTED).
   * Follows fail-closed semantics: any scanner downtime or error transitions file to SCAN_FAILED.
   */
  async scanAndProcess(
    fileObjectId: string,
    targetPartition: StoragePartition = 'identity',
    targetContext?: StorageContext,
    actorId?: string,
  ): Promise<ScanOutcomeResult> {
    if (!fileObjectId || !fileObjectId.trim()) {
      throw new BadRequestException('File object ID is required');
    }

    const fileObject = await this.prisma.fileObject.findUnique({
      where: { id: fileObjectId.trim() },
    });

    if (!fileObject) {
      throw new NotFoundException(`FileObject with ID '${fileObjectId}' not found`);
    }

    if (fileObject.scanStatus === ScanStatus.CLEAN) {
      return { fileObject, isClean: true };
    }

    if (fileObject.scanStatus === ScanStatus.INFECTED) {
      return { fileObject, isClean: false, threatName: 'Previously detected threat' };
    }

    const exists = await this.storageService.checkObjectExists(fileObject.key);
    if (!exists) {
      throw new BadRequestException(`Quarantined object '${fileObject.key}' does not exist in storage`);
    }

    const buffer = await this.storageService.getObjectBuffer(fileObject.key);

    let scanResult;
    try {
      scanResult = await this.malwareScannerService.scan(buffer, fileObject.key);
    } catch (err: any) {
      const now = this.clockService.now();
      this.logger.error(
        `Malware scanning execution failed for FileObject '${fileObjectId}': ${err.message}. Marking SCAN_FAILED.`,
      );

      await this.prisma.fileObject.update({
        where: { id: fileObjectId },
        data: {
          scanStatus: ScanStatus.SCAN_FAILED,
          scannedAt: now,
        },
      });

      await this.prisma.propertyDocument.updateMany({
        where: { fileUrl: fileObject.key },
        data: {
          scanStatus: ScanStatus.SCAN_FAILED,
          scannedAt: now,
        },
      });

      throw new ForbiddenException(`Malware scan failed or scanner service unavailable: ${err.message}`);
    }

    const now = this.clockService.now();

    if (scanResult.isInfected || !scanResult.isClean) {
      // Containment and immutable audit log entry
      const updated = await this.prisma.$transaction(async (tx) => {
        const fo = await tx.fileObject.update({
          where: { id: fileObjectId },
          data: {
            scanStatus: ScanStatus.INFECTED,
            scannedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actorId || 'SYSTEM',
            actorType: actorId ? 'USER' : 'SYSTEM',
            action: ACTION_SECURITY_MALWARE_DETECTED,
            entityType: 'FileObject',
            entityId: fileObjectId,
            payload: {
              key: fileObject.key,
              mimeType: fileObject.mimeType,
              threatName: scanResult.threatName || 'Unknown Threat',
              detectedAt: this.clockService.nowIso(),
            },
          },
        });

        await tx.propertyDocument.updateMany({
          where: { fileUrl: fileObject.key },
          data: {
            scanStatus: ScanStatus.INFECTED,
            scannedAt: now,
          },
        });

        return fo;
      });

      this.logger.error(
        `[SECURITY ALERT] Malware detected in file upload for FileObject '${fileObjectId}' (${fileObject.key}). Threat: '${scanResult.threatName || 'Malware detected'}'. File strictly contained in quarantine.`,
      );

      return {
        fileObject: updated,
        isClean: false,
        threatName: scanResult.threatName,
      };
    }

    // CLEAN file: Promote to domain partition
    const filename = fileObject.key.split('/').pop() || 'file';
    const operationalKey = this.storageService.createObjectKey(
      targetPartition,
      filename,
      targetContext,
    );

    // S3 atomic move: copy then delete quarantine object
    await this.storageService.copyObject(fileObject.key, operationalKey);
    await this.storageService.deleteObject(fileObject.key);

    const promoted = await this.prisma.$transaction(async (tx) => {
      const fo = await tx.fileObject.update({
        where: { id: fileObjectId },
        data: {
          key: operationalKey,
          scanStatus: ScanStatus.CLEAN,
          scannedAt: now,
        },
      });

      await tx.propertyDocument.updateMany({
        where: { fileUrl: fileObject.key },
        data: {
          fileUrl: operationalKey,
          scanStatus: ScanStatus.CLEAN,
          scannedAt: now,
        },
      });

      return fo;
    });

    this.logger.log(
      `Promoted clean file '${fileObjectId}' from '${fileObject.key}' to operational key '${operationalKey}'`,
    );

    return {
      fileObject: promoted,
      isClean: true,
    };
  }
}
