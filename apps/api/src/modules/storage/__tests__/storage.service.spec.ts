import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StorageService } from '../storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScanStatus } from '@elmasaif/shared';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;
  let mockPrismaService: any;
  let mockS3ClientInstance: { send: jest.Mock };

  const mockConfigValues: Record<string, string> = {
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_REGION: 'us-east-1',
    STORAGE_ACCESS_KEY: 'minioadmin',
    STORAGE_SECRET_KEY: 'miniopassword',
    STORAGE_BUCKET_PRIVATE: 'elmasaif-private-documents',
    STORAGE_FORCE_PATH_STYLE: 'true',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService = {
      fileObject: {
        findUnique: jest.fn(),
      },
      propertyDocument: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              return mockConfigValues[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
    mockS3ClientInstance = (service as any).s3Client;
  });

  it('should be defined and initialized with correct config', () => {
    expect(service).toBeDefined();
    expect(configService).toBeDefined();
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'minioadmin',
          secretAccessKey: 'miniopassword',
        },
      }),
    );
  });

  describe('Configuration Fallback Support', () => {
    it('should fall back to S3_* variables if STORAGE_* variables are absent', async () => {
      const fallbackConfig: Record<string, string> = {
        S3_ENDPOINT: 'http://minio.local:9000',
        S3_REGION: 'me-south-1',
        S3_ACCESS_KEY: 'fallback_access',
        S3_SECRET_KEY: 'fallback_secret',
        S3_BUCKET_PRIVATE: 'fallback-bucket',
      };

      const fallbackModule: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                return fallbackConfig[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const fallbackService = fallbackModule.get<StorageService>(StorageService);
      expect(fallbackService).toBeDefined();
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://minio.local:9000',
          region: 'me-south-1',
          credentials: {
            accessKeyId: 'fallback_access',
            secretAccessKey: 'fallback_secret',
          },
        }),
      );
      expect((fallbackService as any).bucketName).toBe('fallback-bucket');
    });

    it('should use default values when neither STORAGE_* nor S3_* variables are provided', async () => {
      const emptyModule: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((_key: string, defaultValue?: any) => defaultValue),
            },
          },
        ],
      }).compile();

      const defaultService = emptyModule.get<StorageService>(StorageService);
      expect(defaultService).toBeDefined();
      expect((defaultService as any).bucketName).toBe('elmasaif-private-documents');
      expect((defaultService as any).endpoint).toBe('http://localhost:9000');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate a signed download URL and respect requested expiry <= 300s', async () => {
      const mockSignedUrl = 'http://localhost:9000/elmasaif-private-documents/test.pdf?signature=abc';
      (getSignedUrl as jest.Mock).mockResolvedValueOnce(mockSignedUrl);

      const url = await service.getPresignedDownloadUrl('identity/user-1/doc.pdf', 180);

      expect(url).toBe(mockSignedUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 180 },
      );
    });

    it('should enforce hard expiration ceiling <= 300s (clamping 600s to 300s per NFR2/AR7)', async () => {
      const mockSignedUrl = 'http://localhost:9000/elmasaif-private-documents/test.pdf?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValueOnce(mockSignedUrl);

      const url = await service.getPresignedDownloadUrl('contracts/c-1/agreement.pdf', 600);

      expect(url).toBe(mockSignedUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 300 },
      );
    });

    it('should enforce hard expiration ceiling for default expiry', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValueOnce('http://localhost:9000/signed');

      await service.getPresignedDownloadUrl('quarantine/test.png');

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 300 },
      );
    });

    it('should reject empty or invalid object keys', async () => {
      await expect(service.getPresignedDownloadUrl('')).rejects.toThrow(BadRequestException);
      await expect(service.getPresignedDownloadUrl('   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate signed upload URL for valid MIME types (PDF, JPEG, PNG)', async () => {
      const mockSignedUploadUrl = 'http://localhost:9000/upload-signed?signature=upload123';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUploadUrl);

      const validMimes = ['application/pdf', 'image/jpeg', 'image/png'];

      for (const mime of validMimes) {
        const result = await service.getPresignedUploadUrl('quarantine/sample-file', mime, 200);

        expect(result).toEqual({
          uploadUrl: mockSignedUploadUrl,
          key: 'quarantine/sample-file',
        });
      }

      expect(getSignedUrl).toHaveBeenCalledTimes(3);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        { expiresIn: 200 },
      );
    });

    it('should clamp expiry to 300s if requested expiry exceeds 300s', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValueOnce('http://localhost:9000/upload-signed');

      await service.getPresignedUploadUrl('quarantine/sample.pdf', 'application/pdf', 9999);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        { expiresIn: 300 },
      );
    });

    it('should throw BadRequestException for unsupported MIME types', async () => {
      const unsupportedMimes = [
        'application/x-msdownload',
        'text/html',
        'application/javascript',
        'application/zip',
        'image/gif',
        'text/plain',
      ];

      for (const mime of unsupportedMimes) {
        await expect(
          service.getPresignedUploadUrl('quarantine/sample.exe', mime),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should reject empty object key for upload URL', async () => {
      await expect(
        service.getPresignedUploadUrl('', 'application/pdf'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createObjectKey', () => {
    it('should partition quarantine objects with uuid and sanitized filename', () => {
      const key = service.createObjectKey('quarantine', 'My Raw Invoice (2026)!.pdf');
      expect(key).toMatch(/^quarantine\/[0-9a-fA-F-]{36}-My_Raw_Invoice__2026__.pdf$/);
    });

    it('should partition identity objects with userId hierarchy', () => {
      const key = service.createObjectKey('identity', 'national_id.jpg', { userId: 'usr-456' });
      expect(key).toMatch(/^identity\/usr-456\/[0-9a-fA-F-]{36}-national_id.jpg$/);
    });

    it('should partition payments objects with dealId and paymentId hierarchy', () => {
      const key = service.createObjectKey('payments', 'receipt.png', {
        dealId: 'deal-101',
        paymentId: 'pay-202',
      });
      expect(key).toMatch(/^payments\/deal-101\/pay-202\/[0-9a-fA-F-]{36}-receipt.png$/);
    });

    it('should partition contracts objects with contractId hierarchy', () => {
      const key = service.createObjectKey('contracts', 'agreement.pdf', {
        contractId: 'cnt-789',
      });
      expect(key).toMatch(/^contracts\/cnt-789\/[0-9a-fA-F-]{36}-agreement.pdf$/);
    });

    it('should partition licenses objects with userId hierarchy', () => {
      const key = service.createObjectKey('licenses', 'fal_license.pdf', {
        userId: 'broker-77',
      });
      expect(key).toMatch(/^licenses\/broker-77\/[0-9a-fA-F-]{36}-fal_license.pdf$/);
    });

    it('should throw BadRequestException if required context IDs are missing', () => {
      expect(() => service.createObjectKey('identity', 'id.pdf')).toThrow(BadRequestException);
      expect(() =>
        service.createObjectKey('payments', 'receipt.pdf', { dealId: 'deal-1' }),
      ).toThrow(BadRequestException);
      expect(() => service.createObjectKey('contracts', 'c.pdf')).toThrow(BadRequestException);
      expect(() => service.createObjectKey('licenses', 'lic.pdf')).toThrow(BadRequestException);
    });

    it('should sanitize path traversal characters in filename', () => {
      const key = service.createObjectKey('quarantine', '../../../etc/passwd.pdf');
      expect(key).not.toContain('../');
      expect(key).toMatch(/^quarantine\/[0-9a-fA-F-]{36}-______etc_passwd.pdf$/);
    });
  });

  describe('checkObjectExists', () => {
    it('should return true when HeadObjectCommand succeeds', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({ ContentLength: 1024 });

      const exists = await service.checkObjectExists('identity/user-1/id.pdf');
      expect(exists).toBe(true);
      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('should return false when HeadObjectCommand throws NotFound (404)', async () => {
      const notFoundError = new Error('NotFound');
      (notFoundError as any).name = 'NotFound';
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      mockS3ClientInstance.send.mockRejectedValueOnce(notFoundError);

      const exists = await service.checkObjectExists('non-existent.pdf');
      expect(exists).toBe(false);
    });

    it('should rethrow non-404 unexpected S3 client errors', async () => {
      const internalError = new Error('AWS connection timeout');
      (internalError as any).name = 'TimeoutError';
      mockS3ClientInstance.send.mockRejectedValueOnce(internalError);

      await expect(service.checkObjectExists('test.pdf')).rejects.toThrow('AWS connection timeout');
    });
  });

  describe('deleteObject', () => {
    it('should dispatch DeleteObjectCommand with correct bucket and key', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({});

      await service.deleteObject('quarantine/orphan.pdf');

      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'elmasaif-private-documents',
            Key: 'quarantine/orphan.pdf',
          }),
        }),
      );
    });

    it('should reject empty key for delete', async () => {
      await expect(service.deleteObject('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('copyObject', () => {
    it('should dispatch CopyObjectCommand with encoded source and destination', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({});

      await service.copyObject('quarantine/scanned-file.pdf', 'identity/usr-1/scanned-file.pdf');

      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'elmasaif-private-documents',
            CopySource: encodeURIComponent('elmasaif-private-documents/quarantine/scanned-file.pdf'),
            Key: 'identity/usr-1/scanned-file.pdf',
          }),
        }),
      );
    });

    it('should reject empty source or destination keys', async () => {
      await expect(service.copyObject('', 'dest')).rejects.toThrow(BadRequestException);
      await expect(service.copyObject('src', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('ensureBucketExists', () => {
    it('should do nothing if bucket already exists (HeadBucketCommand succeeds)', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({});

      await service.ensureBucketExists();

      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(mockS3ClientInstance.send).not.toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });

    it('should call CreateBucketCommand if HeadBucket throws NotFound (404)', async () => {
      const notFoundError = new Error('NotFound');
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      mockS3ClientInstance.send
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({});

      await service.ensureBucketExists();

      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });
  });

  describe('getObjectBuffer and putObject', () => {
    it('should putObject via PutObjectCommand', async () => {
      mockS3ClientInstance.send.mockResolvedValueOnce({});
      const buffer = Buffer.from('test buffer content');

      await service.putObject('identity/user-1/doc.pdf', buffer, 'application/pdf');

      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'elmasaif-private-documents',
            Key: 'identity/user-1/doc.pdf',
            ContentType: 'application/pdf',
          }),
        }),
      );
    });

    it('should getObjectBuffer via GetObjectCommand and transformToByteArray', async () => {
      const mockByteArray = new Uint8Array([1, 2, 3, 4]);
      mockS3ClientInstance.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(mockByteArray),
        },
      });

      const buffer = await service.getObjectBuffer('identity/user-1/doc.pdf');

      expect(buffer).toEqual(Buffer.from(mockByteArray));
      expect(mockS3ClientInstance.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'elmasaif-private-documents',
            Key: 'identity/user-1/doc.pdf',
          }),
        }),
      );
    });
  });

  describe('getVerifiedDownloadUrl (AC: 6 - Fail-Closed Download Guard)', () => {
    it('should generate signed URL for verified CLEAN file', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-clean-1',
        key: 'identity/user-1/clean.pdf',
        scanStatus: ScanStatus.CLEAN,
      });

      (getSignedUrl as jest.Mock).mockResolvedValueOnce('http://localhost:9000/signed-clean');

      const url = await service.getVerifiedDownloadUrl('fo-clean-1', 120);

      expect(url).toBe('http://localhost:9000/signed-clean');
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 120 },
      );
    });

    it('should refuse PENDING files with ForbiddenException (403)', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-pending-1',
        key: 'quarantine/pending.pdf',
        scanStatus: ScanStatus.PENDING,
      });

      await expect(service.getVerifiedDownloadUrl('fo-pending-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should refuse INFECTED files with ForbiddenException (403)', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-infected-1',
        key: 'quarantine/infected.pdf',
        scanStatus: ScanStatus.INFECTED,
      });

      await expect(service.getVerifiedDownloadUrl('fo-infected-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should refuse SCAN_FAILED files with ForbiddenException (403)', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-failed-1',
        key: 'quarantine/failed.pdf',
        scanStatus: ScanStatus.SCAN_FAILED,
      });

      await expect(service.getVerifiedDownloadUrl('fo-failed-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should refuse files whose key is still in quarantine/ with ForbiddenException', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce({
        id: 'fo-quarantine-1',
        key: 'quarantine/some-doc.pdf',
        scanStatus: ScanStatus.CLEAN, // Even if somehow marked CLEAN, quarantine key is refused
      });

      await expect(service.getVerifiedDownloadUrl('fo-quarantine-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if file does not exist', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.propertyDocument.findUnique.mockResolvedValueOnce(null);

      await expect(service.getVerifiedDownloadUrl('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should support verified download from PropertyDocument if FileObject not found', async () => {
      mockPrismaService.fileObject.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.propertyDocument.findUnique.mockResolvedValueOnce({
        id: 'prop-doc-1',
        fileUrl: 'contracts/c-1/agreement.pdf',
        scanStatus: ScanStatus.CLEAN,
      });

      (getSignedUrl as jest.Mock).mockResolvedValueOnce('http://localhost:9000/signed-prop-doc');

      const url = await service.getVerifiedDownloadUrl('prop-doc-1');
      expect(url).toBe('http://localhost:9000/signed-prop-doc');
    });
  });
});

