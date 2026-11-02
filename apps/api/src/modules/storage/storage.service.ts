import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanStatus } from '@elmasaif/shared';

export type StoragePartition = 'quarantine' | 'identity' | 'payments' | 'contracts' | 'licenses' | 'listings' | 'listing';

export interface StorageContext {
  userId?: string;
  dealId?: string;
  paymentId?: string;
  contractId?: string;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = typeof ALLOWED_DOCUMENT_MIME_TYPES[number];

export const MAX_EXPIRATION_SECONDS = 300; // 5 minutes hard ceiling per NFR2/AR7
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit per NFR2

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly bucketName: string;
  private readonly forcePathStyle: boolean;
  private readonly storageDriver: 's3' | 'local';
  private readonly localBasePath: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const configuredDriver = this.configService.get<string>('STORAGE_DRIVER')?.toLowerCase();
    this.storageDriver = configuredDriver === 'local' ? 'local' : 's3';

    this.endpoint =
      this.configService.get<string>('STORAGE_ENDPOINT') ??
      this.configService.get<string>('S3_ENDPOINT') ??
      'http://localhost:9000';

    this.region =
      this.configService.get<string>('STORAGE_REGION') ??
      this.configService.get<string>('S3_REGION') ??
      'us-east-1';

    const accessKeyId =
      this.configService.get<string>('STORAGE_ACCESS_KEY') ??
      this.configService.get<string>('S3_ACCESS_KEY') ??
      'minioadmin';

    const secretAccessKey =
      this.configService.get<string>('STORAGE_SECRET_KEY') ??
      this.configService.get<string>('S3_SECRET_KEY') ??
      'miniopassword';

    this.bucketName =
      this.configService.get<string>('STORAGE_BUCKET_PRIVATE') ??
      this.configService.get<string>('S3_BUCKET_PRIVATE') ??
      'elmasaif-private-documents';

    const rawPathStyle =
      this.configService.get<string | boolean>('STORAGE_FORCE_PATH_STYLE') ?? true;
    this.forcePathStyle =
      typeof rawPathStyle === 'string' ? rawPathStyle.toLowerCase() === 'true' : Boolean(rawPathStyle);

    this.localBasePath = path.resolve(process.cwd(), '.storage', this.bucketName);
    try {
      if (!fs.existsSync(this.localBasePath)) {
        fs.mkdirSync(this.localBasePath, { recursive: true });
      }
    } catch {
      // ignore
    }

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `StorageService initialized (driver: ${this.storageDriver}) targeting sovereign bucket '${this.bucketName}' on endpoint '${this.endpoint}' (region: ${this.region}, forcePathStyle: ${this.forcePathStyle})`,
    );
  }

  private isNetworkOrDevError(err: any): boolean {
    const isDev = (this.configService.get<string>('NODE_ENV') || 'development') !== 'production';
    if (!isDev) return false;
    const msg = (err?.message || '').toLowerCase();
    const code = (err?.code || '').toLowerCase();
    const name = (err?.name || '').toLowerCase();
    return (
      code === 'econnreset' ||
      code === 'econnrefused' ||
      code === 'etimedout' ||
      name === 'timeouterror' ||
      msg.includes('socket hang up') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('connection timeout') ||
      msg.includes('failed to fetch')
    );
  }

  /**
   * Generates a signed GET URL for downloading private documents.
   * Strictly clamps expiration to a maximum of 300 seconds (5 minutes) per NFR2 / AR7.
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds = MAX_EXPIRATION_SECONDS): Promise<string> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    const clampedExpiry = Math.min(Math.max(1, expiresInSeconds), MAX_EXPIRATION_SECONDS);

    if (this.storageDriver === 'local') {
      const apiBase = this.configService.get<string>('API_URL') || 'http://localhost:4000';
      return `${apiBase}/api/v1/storage/raw?key=${encodeURIComponent(key.trim())}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key.trim(),
    });

    try {
      return await getSignedUrl(this.s3Client, command, { expiresIn: clampedExpiry });
    } catch (err: any) {
      if (this.isNetworkOrDevError(err)) {
        const apiBase = this.configService.get<string>('API_URL') || 'http://localhost:4000';
        return `${apiBase}/api/v1/storage/raw?key=${encodeURIComponent(key.trim())}`;
      }
      throw err;
    }
  }

  /**
   * Generates a signed PUT URL for uploading private documents.
   * Validates MIME type against allowed types and clamps expiration to 300 seconds.
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = MAX_EXPIRATION_SECONDS,
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      throw new BadRequestException(
        `Unsupported file type '${contentType}'. Allowed types: ${ALLOWED_DOCUMENT_MIME_TYPES.join(', ')}`,
      );
    }

    const clampedExpiry = Math.min(Math.max(1, expiresInSeconds), MAX_EXPIRATION_SECONDS);

    if (this.storageDriver === 'local') {
      const apiBase = this.configService.get<string>('API_URL') || 'http://localhost:4000';
      return {
        uploadUrl: `${apiBase}/api/v1/storage/raw-upload?key=${encodeURIComponent(key.trim())}`,
        key: key.trim(),
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key.trim(),
      ContentType: contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: clampedExpiry });
      return {
        uploadUrl,
        key: key.trim(),
      };
    } catch (err: any) {
      if (this.isNetworkOrDevError(err)) {
        const apiBase = this.configService.get<string>('API_URL') || 'http://localhost:4000';
        return {
          uploadUrl: `${apiBase}/api/v1/storage/raw-upload?key=${encodeURIComponent(key.trim())}`,
          key: key.trim(),
        };
      }
      throw err;
    }
  }

  /**
   * Constructs hierarchical, collision-resistant object keys partitioned by domain context.
   */
  createObjectKey(
    partition: StoragePartition,
    filename: string,
    context?: StorageContext,
  ): string {
    const sanitizedFilename = filename
      .replace(/\.\.\//g, '__')
      .replace(/\.\./g, '__')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const fileUuid = randomUUID();
    const leafFilename = `${fileUuid}-${sanitizedFilename}`;

    switch (partition) {
      case 'quarantine':
        return `quarantine/${leafFilename}`;

      case 'identity':
        if (!context?.userId) {
          throw new BadRequestException('userId is required in context for identity partition');
        }
        return `identity/${context.userId}/${leafFilename}`;

      case 'payments':
        if (!context?.dealId || !context?.paymentId) {
          throw new BadRequestException('dealId and paymentId are required in context for payments partition');
        }
        return `payments/${context.dealId}/${context.paymentId}/${leafFilename}`;

      case 'contracts':
        if (!context?.contractId) {
          throw new BadRequestException('contractId is required in context for contracts partition');
        }
        return `contracts/${context.contractId}/${leafFilename}`;

      case 'licenses':
        if (!context?.userId) {
          throw new BadRequestException('userId is required in context for licenses partition');
        }
        return `licenses/${context.userId}/${leafFilename}`;

      case 'listings':
      case 'listing':
        if (!context?.userId) {
          throw new BadRequestException('userId is required in context for listings partition');
        }
        return `listings/${context.userId}/${leafFilename}`;

      default:
        throw new BadRequestException(`Unsupported storage partition: ${partition}`);
    }
  }

  /**
   * Checks if an object exists in the target private bucket.
   */
  async checkObjectExists(key: string): Promise<boolean> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    const localPath = path.join(this.localBasePath, key.trim());
    if (fs.existsSync(localPath)) {
      return true;
    }

    if (this.storageDriver === 'local') {
      return false;
    }

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key.trim(),
        }),
      );
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      if (fs.existsSync(localPath)) {
        return true;
      }
      this.logger.error(`Error checking object existence for key '${key}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes an object from the target private bucket.
   */
  async deleteObject(key: string): Promise<void> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    const localPath = path.join(this.localBasePath, key.trim());
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        // ignore
      }
    }

    if (this.storageDriver === 'local') {
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key.trim(),
        }),
      );
    } catch (err: any) {
      if (this.isNetworkOrDevError(err)) {
        return;
      }
      throw err;
    }
  }

  /**
   * Copies an object within the private bucket (e.g., promoting quarantined files to identity or payments).
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    if (!sourceKey || !sourceKey.trim() || !destinationKey || !destinationKey.trim()) {
      throw new BadRequestException('Source and destination keys are required');
    }

    const sourceLocal = path.join(this.localBasePath, sourceKey.trim());
    const destLocal = path.join(this.localBasePath, destinationKey.trim());

    if (fs.existsSync(sourceLocal)) {
      try {
        fs.mkdirSync(path.dirname(destLocal), { recursive: true });
        fs.copyFileSync(sourceLocal, destLocal);
      } catch (err: any) {
        this.logger.warn(`Local copy failed from '${sourceLocal}' to '${destLocal}': ${err.message}`);
      }
    }

    if (this.storageDriver === 'local') {
      return;
    }

    try {
      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.bucketName,
          CopySource: encodeURIComponent(`${this.bucketName}/${sourceKey.trim()}`),
          Key: destinationKey.trim(),
        }),
      );
    } catch (err: any) {
      if (fs.existsSync(destLocal)) {
        return;
      }
      throw err;
    }
  }

  /**
   * Ensures the private bucket exists (primarily for non-production environments and automated testing).
   */
  async ensureBucketExists(bucketName?: string): Promise<void> {
    if (this.storageDriver === 'local') {
      try {
        fs.mkdirSync(this.localBasePath, { recursive: true });
      } catch {
        // ignore
      }
      return;
    }

    const targetBucket = bucketName || this.bucketName;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: targetBucket }));
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket '${targetBucket}' does not exist. Creating...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: targetBucket }));
        this.logger.log(`Bucket '${targetBucket}' created successfully.`);
      } else if (
        error.name !== 'BucketAlreadyOwnedByYou' &&
        error.name !== 'BucketAlreadyExists'
      ) {
        if (this.isNetworkOrDevError(error)) {
          this.logger.warn(`S3 connection unreachable in ensureBucketExists, using local disk directory`);
          try {
            fs.mkdirSync(this.localBasePath, { recursive: true });
          } catch {
            // ignore
          }
          return;
        }
        this.logger.error(`Failed to verify or create bucket '${targetBucket}': ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Retrieves an object's binary buffer from the private S3 bucket.
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    if (this.storageDriver === 'local') {
      const localPath = path.join(this.localBasePath, key.trim());
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
      throw new NotFoundException(`File not found in local storage: ${key}`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key.trim(),
    });

    try {
      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new BadRequestException(`Object body is empty for key: ${key}`);
      }
      const byteArray = await (response.Body as any).transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: any) {
      const localPath = path.join(this.localBasePath, key.trim());
      if (this.isNetworkOrDevError(err) && fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
      throw err;
    }
  }

  /**
   * Puts an object buffer directly into the private S3 bucket.
   */
  async putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    if (!key || !key.trim()) {
      throw new BadRequestException('Object key is required');
    }

    if (this.storageDriver === 'local') {
      const fullPath = path.join(this.localBasePath, key.trim());
      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, buffer);
      } catch (err: any) {
        this.logger.warn(`Failed writing to local storage fallback: ${err.message}`);
      }
      return;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key.trim(),
      Body: buffer,
      ContentType: contentType,
    });

    try {
      await this.s3Client.send(command);
    } catch (err: any) {
      if (this.isNetworkOrDevError(err)) {
        const fullPath = path.join(this.localBasePath, key.trim());
        try {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, buffer);
        } catch (fsErr: any) {
          this.logger.warn(`Failed writing to local storage fallback: ${fsErr.message}`);
        }
        this.logger.warn(
          `S3 putObject unreachable (${err.message}). Stored file '${key}' in local storage fallback.`,
        );
        return;
      }
      throw err;
    }
  }

  /**
   * Generates a verified, short-lived presigned download URL for a scanned document or image.
   * Strictly enforces that the file has scanStatus === ScanStatus.CLEAN.
   * Fails closed with 403 Forbidden for PENDING, INFECTED, SCAN_FAILED, or quarantine-partitioned keys.
   */
  async getVerifiedDownloadUrl(fileObjectId: string, expiresInSeconds = MAX_EXPIRATION_SECONDS): Promise<string> {
    if (!fileObjectId || !fileObjectId.trim()) {
      throw new BadRequestException('File object ID is required');
    }

    if (!this.prisma) {
      throw new Error('PrismaService is required for getVerifiedDownloadUrl');
    }

    // Check FileObject first
    const fileObject = await this.prisma.fileObject.findUnique({
      where: { id: fileObjectId.trim() },
    });

    if (fileObject) {
      if (fileObject.scanStatus !== ScanStatus.CLEAN || fileObject.key.startsWith('quarantine/')) {
        throw new ForbiddenException('File is quarantined or has not passed malware scan verification');
      }
      return this.getPresignedDownloadUrl(fileObject.key, expiresInSeconds);
    }

    // Check PropertyDocument if not found in FileObject
    const propertyDoc = await this.prisma.propertyDocument.findUnique({
      where: { id: fileObjectId.trim() },
    });

    if (propertyDoc) {
      if (propertyDoc.scanStatus !== ScanStatus.CLEAN || propertyDoc.fileUrl.startsWith('quarantine/')) {
        throw new ForbiddenException('File is quarantined or has not passed malware scan verification');
      }
      return this.getPresignedDownloadUrl(propertyDoc.fileUrl, expiresInSeconds);
    }

    throw new NotFoundException(`File record not found for ID '${fileObjectId}'`);
  }
}
