import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuarantineService } from '../quarantine.service';
import { StorageService } from '../storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { MalwareScannerService } from '../malware-scanner.service';
import { ConfigService } from '@nestjs/config';
import { ScanStatus, ACTION_SECURITY_MALWARE_DETECTED } from '@elmasaif/shared';

describe('QuarantineService & Lifecycle Pipeline (AC: 1, 3, 4, 5)', () => {
  let service: QuarantineService;
  let mockStorageService: jest.Mocked<Partial<StorageService>>;
  let mockPrismaService: any;
  let mockClockService: jest.Mocked<Partial<ClockService>>;
  let mockMalwareScannerService: jest.Mocked<Partial<MalwareScannerService>>;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  const fixedDate = new Date('2026-10-28T12:00:00.000Z');

  beforeEach(() => {
    mockStorageService = {
      createObjectKey: jest.fn((partition, filename, context) => {
        if (partition === 'quarantine') return `quarantine/uuid-1234-${filename}`;
        if (partition === 'identity') return `identity/${context?.userId}/uuid-1234-${filename}`;
        return `${partition}/uuid-1234-${filename}`;
      }),
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 sample content')),
      getPresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'http://s3.local/upload-presigned',
        key: 'quarantine/uuid-1234-test.pdf',
      }),
      copyObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      checkObjectExists: jest.fn().mockResolvedValue(true),
    };

    mockClockService = {
      now: jest.fn().mockReturnValue(fixedDate),
      nowIso: jest.fn().mockReturnValue(fixedDate.toISOString()),
    };

    mockMalwareScannerService = {
      scan: jest.fn().mockResolvedValue({
        isClean: true,
        isInfected: false,
        engineName: 'MockMalwareScanner',
      }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('mock'),
    };

    const mockFileObjectDb: Record<string, any> = {};
    const mockAuditLogDb: any[] = [];

    mockPrismaService = {
      fileObject: {
        create: jest.fn().mockImplementation(({ data }) => {
          const record = { id: 'fo-123', ...data, createdAt: fixedDate, updatedAt: fixedDate };
          mockFileObjectDb[record.id] = record;
          return Promise.resolve(record);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockFileObjectDb[where.id] || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (!mockFileObjectDb[where.id]) throw new Error('Record not found');
          mockFileObjectDb[where.id] = { ...mockFileObjectDb[where.id], ...data };
          return Promise.resolve(mockFileObjectDb[where.id]);
        }),
      },
      propertyDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          const log = { id: 'audit-1', ...data, createdAt: fixedDate };
          mockAuditLogDb.push(log);
          return Promise.resolve(log);
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      }),
    };

    service = new QuarantineService(
      mockStorageService as unknown as StorageService,
      mockPrismaService as unknown as PrismaService,
      mockClockService as unknown as ClockService,
      mockMalwareScannerService as unknown as MalwareScannerService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('stageFileForQuarantine (AC: 1)', () => {
    it('should validate allowed MIME types and reject unsupported formats', async () => {
      await expect(
        service.stageFileForQuarantine({
          filename: 'payload.exe',
          mimeType: 'application/x-msdownload',
          fileSize: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate file size <= 10MB and reject oversized files', async () => {
      await expect(
        service.stageFileForQuarantine({
          filename: 'large.pdf',
          mimeType: 'application/pdf',
          fileSize: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero-byte or negative file sizes', async () => {
      await expect(
        service.stageFileForQuarantine({
          filename: 'empty.pdf',
          mimeType: 'application/pdf',
          fileSize: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should stage binary with presigned upload URL when buffer is not provided', async () => {
      const result = await service.stageFileForQuarantine({
        filename: 'national_id.pdf',
        mimeType: 'application/pdf',
        fileSize: 50000,
      });

      expect(result.fileObjectId).toBe('fo-123');
      expect(result.scanStatus).toBe(ScanStatus.PENDING);
      expect(result.key).toContain('quarantine/');
      expect(result.uploadUrl).toBe('http://s3.local/upload-presigned');
      expect(mockStorageService.putObject).not.toHaveBeenCalled();
    });

    it('should directly upload binary buffer to quarantine when provided', async () => {
      const buffer = Buffer.from('%PDF-1.4 test binary');
      const result = await service.stageFileForQuarantine({
        filename: 'deed.pdf',
        mimeType: 'application/pdf',
        fileSize: buffer.length,
        buffer,
      });

      expect(result.fileObjectId).toBe('fo-123');
      expect(mockStorageService.putObject).toHaveBeenCalledWith(
        expect.stringContaining('quarantine/'),
        buffer,
        'application/pdf',
      );
    });
  });

  describe('scanAndProcess (AC: 3, 4, 5)', () => {
    it('should promote CLEAN files to target partition and update FileObject', async () => {
      // Stage file first
      const staged = await service.stageFileForQuarantine({
        filename: 'id_front.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048,
        buffer: Buffer.from('jpeg image data'),
      });

      mockMalwareScannerService.scan!.mockResolvedValueOnce({
        isClean: true,
        isInfected: false,
        engineName: 'MockMalwareScanner',
      });

      const outcome = await service.scanAndProcess(
        staged.fileObjectId,
        'identity',
        { userId: 'user-999' },
      );

      expect(outcome.isClean).toBe(true);
      expect(outcome.fileObject.scanStatus).toBe(ScanStatus.CLEAN);
      expect(outcome.fileObject.scannedAt).toEqual(fixedDate);
      expect(outcome.fileObject.key).toContain('identity/user-999/');

      // Verify S3 copy from quarantine to operational, then deletion of quarantine key
      expect(mockStorageService.copyObject).toHaveBeenCalledWith(
        staged.key,
        outcome.fileObject.key,
      );
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(staged.key);
    });

    it('should isolate INFECTED files, record immutable AuditLog, and log alert', async () => {
      const staged = await service.stageFileForQuarantine({
        filename: 'eicar.com.txt',
        mimeType: 'application/pdf',
        fileSize: 128,
        buffer: Buffer.from('infected binary'),
      });

      mockMalwareScannerService.scan!.mockResolvedValueOnce({
        isClean: false,
        isInfected: true,
        threatName: 'EICAR-Test-Signature',
        engineName: 'MockMalwareScanner',
      });

      const outcome = await service.scanAndProcess(
        staged.fileObjectId,
        'identity',
        { userId: 'user-999' },
        'user-999',
      );

      expect(outcome.isClean).toBe(false);
      expect(outcome.threatName).toBe('EICAR-Test-Signature');
      expect(outcome.fileObject.scanStatus).toBe(ScanStatus.INFECTED);

      // Verify file is NOT moved or deleted from quarantine
      expect(mockStorageService.copyObject).not.toHaveBeenCalled();
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();

      // Verify AuditLog creation
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: ACTION_SECURITY_MALWARE_DETECTED,
          entityType: 'FileObject',
          entityId: staged.fileObjectId,
          actorId: 'user-999',
          payload: expect.objectContaining({
            threatName: 'EICAR-Test-Signature',
          }),
        }),
      });
    });

    it('should fail closed when scanner engine encounters error (transition to SCAN_FAILED)', async () => {
      const staged = await service.stageFileForQuarantine({
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        buffer: Buffer.from('pdf data'),
      });

      mockMalwareScannerService.scan!.mockRejectedValueOnce(
        new Error('ClamAV connection timeout'),
      );

      await expect(
        service.scanAndProcess(staged.fileObjectId, 'identity', { userId: 'usr-1' }),
      ).rejects.toThrow(ForbiddenException);

      const record = await mockPrismaService.fileObject.findUnique({
        where: { id: staged.fileObjectId },
      });
      expect(record.scanStatus).toBe(ScanStatus.SCAN_FAILED);
      expect(record.scannedAt).toEqual(fixedDate);
      expect(mockStorageService.copyObject).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if fileObject does not exist', async () => {
      await expect(
        service.scanAndProcess('non-existent-id', 'identity'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
