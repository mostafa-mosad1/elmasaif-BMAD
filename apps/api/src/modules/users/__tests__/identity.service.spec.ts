import {
  ForbiddenException
} from '@nestjs/common';
import { IdentityDocumentType, ScanStatus, VerificationStatus } from '@elmasaif/shared';
import { IdentityService, IdentityUploadFile } from '../identity.service';

describe('IdentityService', () => {
  let service: IdentityService;
  let prisma: any;
  let clock: any;
  let storage: any;
  let quarantine: any;
  let config: any;
  const now = new Date('2026-10-29T13:00:00.000Z');

  const cleanFileObject = {
    id: 'file-1',
    key: 'identity/user-1/document.pdf',
    bucket: 'elmasaif-private-documents',
    mimeType: 'application/pdf',
    fileSize: 10,
    scanStatus: ScanStatus.CLEAN,
    scannedAt: now
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', nationalId: '1234567890' }) },
      fileObject: { findUnique: jest.fn() },
      identityDocument: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(prisma))
    };
    clock = { now: jest.fn().mockReturnValue(now) };
    storage = { getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://private.example/file') };
    quarantine = {
      stageFileForQuarantine: jest.fn().mockResolvedValue({ fileObjectId: 'file-1' }),
      scanAndProcess: jest.fn().mockResolvedValue({ fileObject: cleanFileObject, isClean: true })
    };
    config = { get: jest.fn().mockReturnValue('false') };
    service = new IdentityService(prisma, clock, storage, quarantine, config);
  });

  function file(overrides: Partial<IdentityUploadFile> = {}): IdentityUploadFile {
    return {
      originalname: 'national-id.pdf',
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('1234567890'),
      ...overrides
    };
  }

  it('rejects missing, empty, oversized, and unsupported files with identity error codes', async () => {
    await expect(service.uploadIdentityDocument('user-1', undefined as never, IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID_DOCUMENT' } });
    await expect(service.uploadIdentityDocument('user-1', file({ buffer: Buffer.alloc(0), size: 0 }), IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID_DOCUMENT' } });
    await expect(service.uploadIdentityDocument('user-1', file({ size: 10_485_761 }), IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ response: { code: 'IDENTITY_FILE_TOO_LARGE' } });
    await expect(service.uploadIdentityDocument('user-1', file({ mimetype: 'text/plain' }), IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ response: { code: 'IDENTITY_UNSUPPORTED_TYPE' } });
    expect(quarantine.stageFileForQuarantine).not.toHaveBeenCalled();
  });

  it('accepts a file exactly at the 10 MiB limit', async () => {
    prisma.identityDocument.create.mockResolvedValue({
      id: 'identity-1',
      idNumber: '1234567890',
      documentType: IdentityDocumentType.NATIONAL_ID,
      status: VerificationStatus.PENDING_REVIEW,
      verifiedAt: null,
      createdAt: now,
      rejectionReason: null
    });

    await expect(service.uploadIdentityDocument(
      'user-1',
      file({ size: 10_485_760, buffer: Buffer.alloc(10_485_760) }),
      IdentityDocumentType.NATIONAL_ID
    )).resolves.toMatchObject({ status: VerificationStatus.PENDING_REVIEW });
    expect(quarantine.stageFileForQuarantine).toHaveBeenCalledWith(
      expect.objectContaining({ fileSize: 10_485_760 })
    );
  });

  it('validates the submitted ID and binds a clean document to the registered ID', async () => {
    prisma.identityDocument.create.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-1',
      fileObjectId: 'file-1',
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '1234567890',
      status: VerificationStatus.PENDING_REVIEW
    });

    const result = await service.uploadIdentityDocument(
      'user-1',
      file(),
      IdentityDocumentType.NATIONAL_ID,
      '1234567890'
    );

    expect(result).not.toHaveProperty('idNumber');
    expect(result).not.toHaveProperty('fileObject');
    expect(result.maskedIdNumber).toBe('123****890');
    expect(quarantine.stageFileForQuarantine).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'national-id.pdf',
      mimeType: 'application/pdf',
      fileSize: 10,
      buffer: expect.any(Buffer),
      userId: 'user-1'
    }));
    expect(quarantine.scanAndProcess).toHaveBeenCalledWith('file-1', 'identity', { userId: 'user-1' }, 'user-1');
    expect(prisma.identityDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idNumber: '1234567890', status: VerificationStatus.PENDING_REVIEW })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects an ID that does not match the registered user', async () => {
    await expect(service.uploadIdentityDocument(
      'user-1',
      file(),
      IdentityDocumentType.NATIONAL_ID,
      '1234567891'
    )).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID_ID_NUMBER' } });
    expect(quarantine.stageFileForQuarantine).not.toHaveBeenCalled();
  });

  it('rejects a document type that conflicts with the registered ID prefix', async () => {
    await expect(service.uploadIdentityDocument(
      'user-1',
      file(),
      IdentityDocumentType.IQAMA
    )).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID_ID_NUMBER' } });
    expect(quarantine.stageFileForQuarantine).not.toHaveBeenCalled();
  });

  it('contains infected files and fails closed when scanning is unavailable', async () => {
    quarantine.scanAndProcess.mockResolvedValueOnce({
      fileObject: { ...cleanFileObject, scanStatus: ScanStatus.INFECTED },
      isClean: false,
      threatName: 'Eicar-Test'
    });
    await expect(service.uploadIdentityDocument('user-1', file(), IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ response: { code: 'IDENTITY_MALWARE_DETECTED' } });
    expect(prisma.identityDocument.create).not.toHaveBeenCalled();

    quarantine.scanAndProcess.mockRejectedValueOnce(new ForbiddenException('scanner unavailable'));
    prisma.fileObject.findUnique.mockResolvedValue({ scanStatus: ScanStatus.SCAN_FAILED });
    await expect(service.uploadIdentityDocument('user-1', file(), IdentityDocumentType.NATIONAL_ID))
      .rejects.toMatchObject({ status: 503, response: { code: 'SCAN_FAILED' } });
    expect(prisma.identityDocument.create).not.toHaveBeenCalled();
  });

  it('returns a masked status and only permits payment proofs for clean non-rejected documents', async () => {
    prisma.identityDocument.findFirst.mockResolvedValue({
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '1234567890',
      status: VerificationStatus.PENDING_REVIEW,
      createdAt: now,
      rejectionReason: null,
      fileObject: { scanStatus: ScanStatus.CLEAN }
    });

    await expect(service.getIdentityStatus('user-1')).resolves.toEqual({
      isUploaded: true,
      status: VerificationStatus.PENDING_REVIEW,
      documentType: IdentityDocumentType.NATIONAL_ID,
      maskedIdNumber: '123****890',
      uploadedAt: now.toISOString(),
      rejectionReason: null,
      canUploadDealPaymentProof: true
    });

    prisma.identityDocument.findFirst.mockResolvedValue(null);
    await expect(service.getIdentityStatus('user-1')).resolves.toMatchObject({
      isUploaded: false,
      status: VerificationStatus.NOT_UPLOADED,
      canUploadDealPaymentProof: false
    });

    prisma.identityDocument.findFirst.mockResolvedValue({
      documentType: IdentityDocumentType.NATIONAL_ID,
      idNumber: '1234567890',
      status: VerificationStatus.REJECTED,
      rejectionReason: 'الصورة غير واضحة',
      createdAt: now,
      fileObject: { scanStatus: ScanStatus.CLEAN }
    });
    await expect(service.getIdentityStatus('user-1')).resolves.toMatchObject({
      isUploaded: true,
      status: VerificationStatus.REJECTED,
      rejectionReason: 'الصورة غير واضحة',
      canUploadDealPaymentProof: false
    });
  });

  it('requires ownership and a clean scan before returning a 300-second signed URL', async () => {
    await expect(service.getIdentityDocumentDownloadUrl('user-2', 'user-1'))
      .rejects.toMatchObject({ response: { code: 'AUTH_NOT_AUTHORIZED' } });

    prisma.identityDocument.findFirst.mockResolvedValue({
      userId: 'user-1',
      fileObject: { ...cleanFileObject }
    });
    await expect(service.getIdentityDocumentDownloadUrl('user-1', 'user-1')).resolves.toEqual({
      downloadUrl: 'https://private.example/file',
      expiresIn: 300
    });
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(cleanFileObject.key, 300);

    prisma.identityDocument.findFirst.mockResolvedValue({
      userId: 'user-1',
      fileObject: { ...cleanFileObject, scanStatus: ScanStatus.PENDING }
    });
    await expect(service.getIdentityDocumentDownloadUrl('user-1', 'user-1'))
      .rejects.toMatchObject({ response: { code: 'FILE_QUARANTINED' } });
  });

  it('allows payment proofs only when a clean, non-rejected identity document exists', async () => {
    prisma.identityDocument.findFirst.mockResolvedValue({ id: 'identity-1' });
    await expect(service.verifyBuyerIdentityPrerequisite('user-1')).resolves.toBe(true);

    prisma.identityDocument.findFirst.mockResolvedValue(null);
    await expect(service.verifyBuyerIdentityPrerequisite('user-1')).resolves.toBe(false);
    expect(prisma.identityDocument.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', status: { in: [VerificationStatus.PENDING_REVIEW, VerificationStatus.VERIFIED] } })
    }));
  });

  it('verifies and rejects documents with immutable audit records', async () => {
    const pending = {
      id: 'identity-1',
      status: VerificationStatus.PENDING_REVIEW,
      fileObject: { scanStatus: ScanStatus.CLEAN }
    };
    prisma.identityDocument.findUnique.mockResolvedValue(pending);
    prisma.identityDocument.update.mockResolvedValue({ ...pending, status: VerificationStatus.VERIFIED });

    await service.verifyIdentityDocument('identity-1', 'admin-1');
    expect(prisma.identityDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: VerificationStatus.VERIFIED,
        verifiedAt: now,
        verifiedByAdminId: 'admin-1'
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'IDENTITY_DOCUMENT_VERIFIED', actorId: 'admin-1' })
    }));

    prisma.identityDocument.update.mockResolvedValue({ ...pending, status: VerificationStatus.REJECTED });
    await service.rejectIdentityDocument('identity-1', 'admin-1', 'الصورة غير واضحة');
    expect(prisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'IDENTITY_DOCUMENT_REJECTED',
        payload: { reason: 'الصورة غير واضحة' }
      })
    }));
  });

  it('returns a paginated, clean-only administrative review queue', async () => {
    prisma.identityDocument.findMany.mockResolvedValue([]);
    prisma.identityDocument.count.mockResolvedValue(0);

    await expect(service.getPendingIdentityDocuments(2, 15)).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 2, limit: 15, totalPages: 0 }
    });
    expect(prisma.identityDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: VerificationStatus.PENDING_REVIEW,
        fileObject: { scanStatus: ScanStatus.CLEAN }
      },
      skip: 15,
      take: 15
    }));
  });
});
