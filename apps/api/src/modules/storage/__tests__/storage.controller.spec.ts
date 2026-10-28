import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StorageController } from '../storage.controller';
import { StorageService } from '../storage.service';
import { QuarantineService } from '../quarantine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScanStatus } from '@elmasaif/shared';

describe('StorageController (AC: 1, 3, 6)', () => {
  let controller: StorageController;
  let mockStorageService: any;
  let mockQuarantineService: any;
  let mockPrismaService: any;

  const fixedDate = new Date('2026-10-28T12:00:00.000Z');

  beforeEach(async () => {
    mockStorageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('http://s3.local/download-presigned?token=123'),
    };

    mockQuarantineService = {
      stageFileForQuarantine: jest.fn().mockResolvedValue({
        fileObjectId: 'fo-test-1',
        uploadUrl: 'http://s3.local/upload-presigned?token=abc',
        key: 'quarantine/uuid-1-test.pdf',
        bucket: 'elmasaif-private-documents',
        scanStatus: ScanStatus.PENDING,
        mimeType: 'application/pdf',
        fileSize: 1024,
      }),
      scanAndProcess: jest.fn().mockResolvedValue({
        fileObject: {
          id: 'fo-test-1',
          key: 'identity/user-1/uuid-1-test.pdf',
          scanStatus: ScanStatus.CLEAN,
          scannedAt: fixedDate,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        },
        isClean: true,
      }),
    };

    mockPrismaService = {
      fileObject: {
        findUnique: jest.fn(),
      },
      propertyDocument: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
        { provide: QuarantineService, useValue: mockQuarantineService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

  describe('requestUploadUrl (POST /api/v1/storage/upload-request)', () => {
    it('should stage file and return presigned PUT URL and pending status', async () => {
      const response = await controller.requestUploadUrl({
        filename: 'national_id.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        userId: 'user-1',
      });

      expect(response).toEqual({
        fileObjectId: 'fo-test-1',
        uploadUrl: 'http://s3.local/upload-presigned?token=abc',
        key: 'quarantine/uuid-1-test.pdf',
        bucket: 'elmasaif-private-documents',
        scanStatus: ScanStatus.PENDING,
        mimeType: 'application/pdf',
        fileSize: 1024,
      });

      expect(mockQuarantineService.stageFileForQuarantine).toHaveBeenCalledWith({
        filename: 'national_id.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        userId: 'user-1',
      });
    });
  });

  describe('scanFile (POST /api/v1/storage/scan/:id)', () => {
    it('should trigger scan and return clean promotion status', async () => {
      const response = await controller.scanFile('fo-test-1', {
        targetPartition: 'identity',
        userId: 'user-1',
      });

      expect(response).toEqual({
        fileObjectId: 'fo-test-1',
        isClean: true,
        scanStatus: ScanStatus.CLEAN,
        key: 'identity/user-1/uuid-1-test.pdf',
        threatName: undefined,
        scannedAt: fixedDate.toISOString(),
      });

      expect(mockQuarantineService.scanAndProcess).toHaveBeenCalledWith(
        'fo-test-1',
        'identity',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should report infected threat status when malware is detected', async () => {
      mockQuarantineService.scanAndProcess.mockResolvedValueOnce({
        fileObject: {
          id: 'fo-infected',
          key: 'quarantine/uuid-eicar.txt',
          scanStatus: ScanStatus.INFECTED,
          scannedAt: fixedDate,
        },
        isClean: false,
        threatName: 'EICAR-Test-Signature',
      });

      const response = await controller.scanFile('fo-infected', {});

      expect(response.isClean).toBe(false);
      expect(response.scanStatus).toBe(ScanStatus.INFECTED);
      expect(response.threatName).toBe('EICAR-Test-Signature');
    });
  });

  describe('directUpload (POST /api/v1/storage/upload)', () => {
    it('should reject direct upload if file is missing', async () => {
      await expect(controller.directUpload(null as any, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should stage with buffer and synchronously process scan', async () => {
      const mockFile = {
        originalname: 'deed.pdf',
        mimetype: 'application/pdf',
        size: 4096,
        buffer: Buffer.from('%PDF-1.4 sample deed'),
      };

      const response = await controller.directUpload(mockFile, {
        targetPartition: 'contracts',
        contractId: 'cnt-10',
      });

      expect(response.isClean).toBe(true);
      expect(response.scanStatus).toBe(ScanStatus.CLEAN);
      expect(mockQuarantineService.stageFileForQuarantine).toHaveBeenCalledWith({
        filename: 'deed.pdf',
        mimeType: 'application/pdf',
        fileSize: 4096,
        buffer: mockFile.buffer,
        userId: undefined,
      });
    });
  });

  describe('getDownloadUrl (GET /api/v1/storage/files/:id/download)', () => {
    it('should return clamped presigned download URL for clean file', async () => {
      const result = await controller.getDownloadUrl('fo-test-1', '250');

      expect(result).toEqual({
        downloadUrl: 'http://s3.local/download-presigned?token=123',
        expiresInSeconds: 250,
      });

      expect(mockStorageService.getVerifiedDownloadUrl).toHaveBeenCalledWith('fo-test-1', 250);
    });

    it('should clamp requested expiration to 300s maximum', async () => {
      const result = await controller.getDownloadUrl('fo-test-1', '999');

      expect(result.expiresInSeconds).toBe(300);
      expect(mockStorageService.getVerifiedDownloadUrl).toHaveBeenCalledWith('fo-test-1', 300);
    });

    it('should propagate ForbiddenException if file is not clean', async () => {
      mockStorageService.getVerifiedDownloadUrl.mockRejectedValueOnce(
        new ForbiddenException('File is quarantined or has not passed malware scan verification'),
      );

      await expect(controller.getDownloadUrl('fo-pending')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFileStatus (GET /api/v1/storage/files/:id/status)', () => {
    it('should return metadata from FileObject', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-1',
        scanStatus: ScanStatus.CLEAN,
        mimeType: 'application/pdf',
        fileSize: 5000,
        key: 'identity/user-1/doc.pdf',
        scannedAt: fixedDate,
        createdAt: fixedDate,
      });

      const status = await controller.getFileStatus('fo-1');

      expect(status).toEqual({
        fileObjectId: 'fo-1',
        scanStatus: ScanStatus.CLEAN,
        mimeType: 'application/pdf',
        fileSize: 5000,
        key: 'identity/user-1/doc.pdf',
        scannedAt: fixedDate.toISOString(),
        createdAt: fixedDate.toISOString(),
      });
    });

    it('should return metadata from PropertyDocument if not in FileObject', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.propertyDocument.findUnique.mockResolvedValueOnce({
        id: 'pd-1',
        scanStatus: ScanStatus.PENDING,
        mimeType: 'image/jpeg',
        fileSize: 1500,
        fileUrl: 'quarantine/image.jpg',
        scannedAt: null,
        createdAt: fixedDate,
      });

      const status = await controller.getFileStatus('pd-1');

      expect(status.scanStatus).toBe(ScanStatus.PENDING);
      expect(status.key).toBe('quarantine/image.jpg');
    });

    it('should throw NotFoundException if neither FileObject nor PropertyDocument exist', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.propertyDocument.findUnique.mockResolvedValueOnce(null);

      await expect(controller.getFileStatus('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });
});
