import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_NOT_AUTHORIZED,
  ERROR_FILE_QUARANTINED,
  IDENTITY_ALREADY_VERIFIED,
  IDENTITY_FILE_TOO_LARGE,
  IDENTITY_INVALID_DOCUMENT,
  IDENTITY_INVALID_ID_NUMBER,
  IDENTITY_MALWARE_DETECTED,
  IDENTITY_NOT_FOUND,
  IDENTITY_UNSUPPORTED_TYPE,
  IdentityDocumentType,
  ScanStatus,
  VerificationStatus,
  saudiNationalIdSchema
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { QuarantineService, ScanOutcomeResult } from '../storage/quarantine.service';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  StorageService
} from '../storage/storage.service';

export interface IdentityUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const IDENTITY_MASK_VISIBLE_DIGITS = 3;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly storageService: StorageService,
    private readonly quarantineService: QuarantineService,
    private readonly configService: ConfigService
  ) {}

  async uploadIdentityDocument(
    userId: string,
    file: IdentityUploadFile,
    documentType: IdentityDocumentType,
    idNumber?: string
  ) {
    if (!file?.buffer?.length || !file.originalname?.trim()) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_DOCUMENT,
        message: 'يجب إرفاق ملف هوية صالح'
      });
    }

    const fileSize = file.buffer.length;
    if (fileSize > MAX_FILE_SIZE_BYTES || file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: IDENTITY_FILE_TOO_LARGE,
        message: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت'
      });
    }

    if (fileSize <= 0 || !ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_DOCUMENT_MIME_TYPES[number])) {
      throw new BadRequestException({
        code: fileSize <= 0 ? IDENTITY_INVALID_DOCUMENT : IDENTITY_UNSUPPORTED_TYPE,
        message: fileSize <= 0 ? 'ملف الهوية فارغ' : 'نوع الملف غير مدعوم'
      });
    }

    const parsedId = idNumber ? saudiNationalIdSchema.safeParse(idNumber) : undefined;
    if (
      (parsedId && !parsedId.success) ||
      (idNumber &&
        ((documentType === IdentityDocumentType.NATIONAL_ID && !idNumber.startsWith('1')) ||
          (documentType === IdentityDocumentType.IQAMA && !idNumber.startsWith('2'))))
    ) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_ID_NUMBER,
        message: 'رقم الهوية لا يتوافق مع نوع الوثيقة'
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nationalId: true }
    });
    if (!user) {
      throw new NotFoundException({
        code: IDENTITY_NOT_FOUND,
        message: 'المستخدم غير موجود'
      });
    }
    if (
      (documentType === IdentityDocumentType.NATIONAL_ID && !user.nationalId.startsWith('1')) ||
      (documentType === IdentityDocumentType.IQAMA && !user.nationalId.startsWith('2'))
    ) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_ID_NUMBER,
        message: 'نوع الوثيقة لا يتوافق مع رقم الهوية المسجل'
      });
    }
    if (idNumber && idNumber !== user.nationalId) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_ID_NUMBER,
        message: 'رقم الهوية لا يطابق الرقم المسجل في الحساب'
      });
    }

    const latestDocument = await this.prisma.identityDocument.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true }
    });
    if (latestDocument?.status === VerificationStatus.VERIFIED) {
      throw new ConflictException({
        code: IDENTITY_ALREADY_VERIFIED,
        message: 'تم توثيق الهوية مسبقاً'
      });
    }

    const staged = await this.quarantineService.stageFileForQuarantine({
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize,
      buffer: file.buffer,
      userId
    });

    let outcome: ScanOutcomeResult;
    try {
      outcome = await this.quarantineService.scanAndProcess(
        staged.fileObjectId,
        'identity',
        { userId },
        userId
      );
    } catch (error) {
      const fileObject = await this.prisma.fileObject.findUnique({
        where: { id: staged.fileObjectId },
        select: { scanStatus: true }
      });
      if (fileObject?.scanStatus === ScanStatus.SCAN_FAILED) {
        throw new ServiceUnavailableException({
          code: 'SCAN_FAILED',
          message: 'تعذر فحص الملف أمنياً؛ لم يتم اعتماد الوثيقة'
        });
      }
      throw error;
    }

    if (!outcome.isClean || outcome.fileObject.scanStatus !== ScanStatus.CLEAN) {
      if (outcome.fileObject.scanStatus === ScanStatus.INFECTED) {
        throw new BadRequestException({
          code: IDENTITY_MALWARE_DETECTED,
          message: 'تم اكتشاف تهديد أمني في الملف المرفوع. تم حظر الملف وإشعار الفريق الأمني'
        });
      }
      throw new ServiceUnavailableException({
        code: 'SCAN_FAILED',
        message: 'تعذر التحقق من سلامة الملف؛ لم يتم اعتماد الوثيقة'
      });
    }

    const autoVerify = this.configService.get<string | boolean>('IDENTITY_AUTO_VERIFY') === true ||
      this.configService.get<string>('IDENTITY_AUTO_VERIFY')?.toLowerCase() === 'true';
    const now = this.clockService.now();
    const status = autoVerify ? VerificationStatus.VERIFIED : VerificationStatus.PENDING_REVIEW;

    const document = await this.prisma.$transaction(async (tx) => {
      const document = await tx.identityDocument.create({
        data: {
          userId,
          fileObjectId: staged.fileObjectId,
          documentType,
          idNumber: user.nationalId,
          status,
          verifiedAt: autoVerify ? now : null,
          rejectionReason: null
        },
        include: { fileObject: true }
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'IDENTITY_DOCUMENT_UPLOADED',
          entityType: 'IdentityDocument',
          entityId: document.id,
          payload: { fileObjectId: staged.fileObjectId, documentType }
        }
      });

      return document;
    });
    return {
      id: document.id,
      documentType: document.documentType,
      status: document.status,
      maskedIdNumber: this.maskIdNumber(document.idNumber),
      verifiedAt: document.verifiedAt,
      createdAt: document.createdAt,
      rejectionReason: document.rejectionReason
    };
  }

  async getIdentityStatus(userId: string) {
    const document = await this.prisma.identityDocument.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { fileObject: true }
    });

    if (!document) {
      return {
        isUploaded: false,
        status: VerificationStatus.NOT_UPLOADED,
        documentType: null,
        maskedIdNumber: null,
        uploadedAt: null,
        rejectionReason: null,
        canUploadDealPaymentProof: false
      };
    }

    const isClean = document.fileObject.scanStatus === ScanStatus.CLEAN;
    return {
      isUploaded: isClean,
      status: document.status,
      documentType: document.documentType,
      maskedIdNumber: this.maskIdNumber(document.idNumber),
      uploadedAt: document.createdAt.toISOString(),
      rejectionReason: document.status === VerificationStatus.REJECTED
        ? document.rejectionReason
        : null,
      canUploadDealPaymentProof: isClean && document.status !== VerificationStatus.REJECTED
    };
  }

  async getIdentityDocumentDownloadUrl(userId: string, requestingUserId: string, isAdmin = false) {
    if (!isAdmin && userId !== requestingUserId) {
      throw new ForbiddenException({
        code: AUTH_NOT_AUTHORIZED,
        message: 'لا تملك صلاحية الوصول إلى وثيقة الهوية'
      });
    }

    const document = await this.prisma.identityDocument.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { fileObject: true }
    });
    if (!document) {
      throw new NotFoundException({
        code: IDENTITY_NOT_FOUND,
        message: 'وثيقة الهوية غير موجودة'
      });
    }

    return this.createDownloadUrl(document.fileObject);
  }

  async getAdminIdentityDocumentDownloadUrl(documentId: string) {
    const document = await this.prisma.identityDocument.findUnique({
      where: { id: documentId },
      include: { fileObject: true }
    });
    if (!document) {
      throw new NotFoundException({
        code: IDENTITY_NOT_FOUND,
        message: 'وثيقة الهوية غير موجودة'
      });
    }
    return this.createDownloadUrl(document.fileObject);
  }

  async getPendingIdentityDocuments(page = 1, limit = 20) {
    const where = {
      status: VerificationStatus.PENDING_REVIEW,
      fileObject: { scanStatus: ScanStatus.CLEAN }
    };
    const [documents, total] = await Promise.all([
      this.prisma.identityDocument.findMany({
        where,
        include: {
          user: { select: { fullName: true, mobileNumber: true } }
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.identityDocument.count({ where })
    ]);

    return {
      data: documents.map((document) => ({
        id: document.id,
        userId: document.userId,
        fullName: document.user.fullName,
        mobileNumber: document.user.mobileNumber,
        idNumber: document.idNumber,
        documentType: document.documentType,
        status: document.status,
        submittedAt: document.createdAt
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async verifyIdentityDocument(documentId: string, adminId: string) {
    const document = await this.getReviewableDocument(documentId);
    const verifiedAt = this.clockService.now();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.identityDocument.update({
        where: { id: document.id },
        data: {
          status: VerificationStatus.VERIFIED,
          verifiedAt,
          verifiedByAdminId: adminId,
          rejectionReason: null
        },
        include: { fileObject: true }
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'IDENTITY_DOCUMENT_VERIFIED',
          entityType: 'IdentityDocument',
          entityId: document.id
        }
      });
      return updated;
    });
  }

  async rejectIdentityDocument(documentId: string, adminId: string, reason: string) {
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
      throw new BadRequestException({
        code: IDENTITY_INVALID_DOCUMENT,
        message: 'سبب الرفض يجب أن يتراوح بين 5 و500 حرف'
      });
    }
    const document = await this.getReviewableDocument(documentId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.identityDocument.update({
        where: { id: document.id },
        data: {
          status: VerificationStatus.REJECTED,
          rejectionReason: reason.trim(),
          verifiedAt: null,
          verifiedByAdminId: null
        },
        include: { fileObject: true }
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'IDENTITY_DOCUMENT_REJECTED',
          entityType: 'IdentityDocument',
          entityId: document.id,
          payload: { reason: reason.trim() }
        }
      });
      return updated;
    });
  }

  async verifyBuyerIdentityPrerequisite(userId: string): Promise<boolean> {
    const document = await this.prisma.identityDocument.findFirst({
      where: {
        userId,
        status: { in: [VerificationStatus.PENDING_REVIEW, VerificationStatus.VERIFIED] },
        fileObject: { scanStatus: ScanStatus.CLEAN }
      },
      select: { id: true }
    });
    return Boolean(document);
  }

  private async getReviewableDocument(documentId: string) {
    const document = await this.prisma.identityDocument.findUnique({
      where: { id: documentId },
      include: { fileObject: true }
    });
    if (!document) {
      throw new NotFoundException({
        code: IDENTITY_NOT_FOUND,
        message: 'وثيقة الهوية غير موجودة'
      });
    }
    if (
      document.status !== VerificationStatus.PENDING_REVIEW ||
      document.fileObject.scanStatus !== ScanStatus.CLEAN
    ) {
      throw new ConflictException({
        code: ERROR_FILE_QUARANTINED,
        message: 'لا يمكن مراجعة وثيقة غير نظيفة أو سبق البت فيها'
      });
    }
    return document;
  }

  private async createDownloadUrl(fileObject: { key: string; scanStatus: string }) {
    if (fileObject.scanStatus !== ScanStatus.CLEAN) {
      throw new ForbiddenException({
        code: ERROR_FILE_QUARANTINED,
        message: 'لا يمكن الوصول إلى ملف لم يجتز الفحص الأمني'
      });
    }
    return {
      downloadUrl: await this.storageService.getPresignedDownloadUrl(fileObject.key, 300),
      expiresIn: 300
    };
  }

  private maskIdNumber(idNumber: string): string {
    return `${idNumber.slice(0, IDENTITY_MASK_VISIBLE_DIGITS)}****${idNumber.slice(-IDENTITY_MASK_VISIBLE_DIGITS)}`;
  }
}
