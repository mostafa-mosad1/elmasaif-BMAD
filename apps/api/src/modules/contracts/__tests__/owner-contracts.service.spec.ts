import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { OwnerContractsService } from '../owner-contracts.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { OtpService } from '../../auth/otp/otp.service';
import { QuarantineService } from '../../storage/quarantine.service';
import { StorageService } from '../../storage/storage.service';
import {
  UserRole,
  OwnerContractStatus,
  PropertyType,
  AUTH_NOT_AUTHORIZED,
  OWNER_CONTRACT_NOT_FOUND,
  OWNER_CONTRACT_INVALID_STATE,
  OWNER_CONTRACT_EXPIRED,
  OWNER_CONTRACT_ALREADY_SIGNED,
  CONTRACT_FEE_PROOF_REQUIRED,
  CONTRACT_FEE_PROOF_UNSUPPORTED_TYPE,
  CONTRACT_FEE_PROOF_TOO_LARGE,
  CONTRACT_FEE_PAYMENT_STATUS,
  AUTH_OTP_INVALID,
  AUTH_OTP_LOCKED,
  AUTH_OTP_EXPIRED,
} from '@elmasaif/shared';

describe('OwnerContractsService (Story 7.2 & 7.3)', () => {
  let service: OwnerContractsService;
  let prisma: any;
  let clockService: any;
  let otpService: any;
  let quarantineService: any;
  let storageService: any;

  const userId = 'user-owner-123';
  const otherUserId = 'user-other-456';
  const ownerProfileId = 'profile-owner-123';
  const otherProfileId = 'profile-other-456';
  const contractId = 'contract-uuid-001';
  const listingRequestId = 'req-uuid-001';
  const listingId = 'listing-uuid-001';
  const mockNow = new Date('2026-11-11T12:00:00.000Z');
  const validFutureExpiry = new Date('2026-11-18T12:00:00.000Z');
  const pastExpiry = new Date('2026-11-04T12:00:00.000Z');

  const mockOwnerProfile = {
    id: ownerProfileId,
    userId,
    role: UserRole.OWNER,
    status: 'ACTIVE',
  };

  const mockContract = (overrides: any = {}) => ({
    id: contractId,
    listingId,
    ownerProfileId,
    templateId: 'template-uuid-001',
    contractFee: 1000.0,
    feeOverrideReason: null,
    contractTerms: 'شروط وبنود عقد تسويق عقاري إلكتروني...',
    signatureData: null,
    signedAt: null,
    otpCode: null,
    ipAddress: null,
    userAgent: null,
    status: OwnerContractStatus.PENDING_SIGNATURE,
    expiresAt: validFutureExpiry,
    createdAt: new Date('2026-11-11T10:00:00.000Z'),
    updatedAt: new Date('2026-11-11T10:00:00.000Z'),
    listing: {
      id: listingId,
      title: 'فيلا فاخرة بحي النرجس',
      propertyType: PropertyType.VILLA,
      askPrice: 2800000,
      areaSquareMeters: 400,
      city: { nameAr: 'الرياض' },
      district: { nameAr: 'النرجس' },
    },
    ownerProfile: {
      id: ownerProfileId,
      user: {
        id: userId,
        fullName: 'عبدالله بن محمد المطيري',
        mobileNumber: '0551234567',
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      userProfile: {
        findFirst: jest.fn().mockResolvedValue(mockOwnerProfile),
      },
      ownerContract: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === contractId) {
            return Promise.resolve(mockContract());
          }
          if (where.listingId === listingId) {
            return Promise.resolve(mockContract());
          }
          return Promise.resolve(null);
        }),
        update: jest.fn(),
      },
      ownerListingRequest: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === listingRequestId) {
            return Promise.resolve({
              id: listingRequestId,
              listingId,
              ownerProfileId,
            });
          }
          return Promise.resolve(null);
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
      contractFeePayment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'fee-pay-1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'fee-pay-1', ...data })),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(prisma);
      }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    otpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60,
      }),
      verifyOtp: jest.fn().mockResolvedValue({
        id: 'otp-record-1',
        mobileNumber: '0551234567',
        otpCode: '123456',
      }),
      cleanupOtp: jest.fn().mockResolvedValue(undefined),
    };

    quarantineService = {
      stageFileForQuarantine: jest.fn().mockResolvedValue({
        fileObjectId: 'staged-file-123',
        key: 'quarantine/staged-file-123.pdf',
      }),
      scanAndProcess: jest.fn().mockResolvedValue({
        fileObject: {
          id: 'staged-file-123',
          key: 'contracts/contract-uuid-001/receipt.pdf',
        },
        isClean: true,
      }),
    };

    storageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/receipt.pdf'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerContractsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: OtpService, useValue: otpService },
        { provide: QuarantineService, useValue: quarantineService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<OwnerContractsService>(OwnerContractsService);
  });

  describe('getContractDetail (AC 1)', () => {
    it('throws ForbiddenException AUTH_NOT_AUTHORIZED if user has no active owner profile', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(null);

      await expect(service.getContractDetail(userId, contractId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException OWNER_CONTRACT_NOT_FOUND when contract does not exist', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(null);
      prisma.ownerListingRequest.findUnique.mockResolvedValue(null);

      await expect(service.getContractDetail(userId, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException AUTH_NOT_AUTHORIZED if contract belongs to another owner', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ ownerProfileId: otherProfileId }),
      );

      await expect(service.getContractDetail(userId, contractId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns full contract details when resolved directly by contract ID', async () => {
      const res = await service.getContractDetail(userId, contractId);

      expect(res.id).toBe(contractId);
      expect(res.listingId).toBe(listingId);
      expect(res.propertyTitle).toBe('فيلا فاخرة بحي النرجس');
      expect(res.cityName).toBe('الرياض');
      expect(res.districtName).toBe('النرجس');
      expect(res.askPrice).toBe(2800000);
      expect(res.areaSquareMeters).toBe(400);
      expect(res.contractFee).toBe(1000);
      expect(res.status).toBe(OwnerContractStatus.PENDING_SIGNATURE);
      expect(res.ownerName).toBe('عبدالله بن محمد المطيري');
      expect(res.ownerMobile).toBe('+966 5X XXX 4567');
      expect(res.signedAt).toBeNull();
    });

    it('resolves associated contract via OwnerListingRequest ID fallback', async () => {
      // First lookup by ID fails, fallback through listingRequestId succeeds
      prisma.ownerContract.findUnique
        .mockResolvedValueOnce(null) // where: { id: listingRequestId }
        .mockResolvedValueOnce(mockContract()); // where: { listingId: listingId }

      const res = await service.getContractDetail(userId, listingRequestId);

      expect(res.id).toBe(contractId);
      expect(res.listingId).toBe(listingId);
    });
  });

  describe('requestSignatureOtp (AC 3, 6)', () => {
    it('throws ConflictException OWNER_CONTRACT_ALREADY_SIGNED if contract is already signed', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_FEE }),
      );

      await expect(service.requestSignatureOtp(userId, contractId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException OWNER_CONTRACT_INVALID_STATE if contract is not PENDING_SIGNATURE', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.DRAFT }),
      );

      await expect(service.requestSignatureOtp(userId, contractId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException OWNER_CONTRACT_EXPIRED if contract has expired', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ expiresAt: pastExpiry }),
      );

      await expect(service.requestSignatureOtp(userId, contractId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('dispatches OTP using OtpService and returns resend cooldown', async () => {
      const result = await service.requestSignatureOtp(userId, contractId);

      expect(otpService.generateAndSendOtp).toHaveBeenCalledWith(
        '0551234567',
        'CONTRACT_SIGNATURE',
        { contractId },
      );
      expect(result.success).toBe(true);
      expect(result.resendAvailableInSeconds).toBe(60);
    });
  });

  describe('signContract (AC 4, 6)', () => {
    const validDto = {
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      otpCode: '123456',
    };
    const ipAddress = '192.168.1.100';
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

    it('throws ConflictException if contract is already signed', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.ACTIVE }),
      );

      await expect(service.signContract(userId, contractId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException if contract has expired', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ expiresAt: pastExpiry }),
      );

      await expect(service.signContract(userId, contractId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates OtpService failure when OTP is invalid', async () => {
      otpService.verifyOtp.mockRejectedValue(
        new HttpException(
          { code: AUTH_OTP_INVALID, message: 'رمز التحقق غير صحيح' },
          400,
        ),
      );

      await expect(service.signContract(userId, contractId, validDto)).rejects.toThrow(
        HttpException,
      );
      expect(prisma.ownerContract.update).not.toHaveBeenCalled();
    });

    it('propagates OtpService failure when OTP is locked (423)', async () => {
      otpService.verifyOtp.mockRejectedValue(
        new HttpException(
          { code: AUTH_OTP_LOCKED, message: 'تم قفل التحقق' },
          423,
        ),
      );

      await expect(service.signContract(userId, contractId, validDto)).rejects.toThrow(
        HttpException,
      );
    });

    it('executes atomic update with IP and userAgent, audit log, OTP cleanup on valid signing', async () => {
      const expectedFeeExpiresAt = new Date(mockNow.getTime() + 7 * 24 * 60 * 60 * 1000);

      prisma.ownerContract.update.mockResolvedValue({
        ...mockContract(),
        signatureData: validDto.signatureData,
        signedAt: mockNow,
        otpCode: '***56',
        ipAddress,
        userAgent,
        status: OwnerContractStatus.PENDING_FEE,
        expiresAt: expectedFeeExpiresAt,
      });

      const res = await service.signContract(
        userId,
        contractId,
        validDto,
        ipAddress,
        userAgent,
      );

      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        '0551234567',
        'CONTRACT_SIGNATURE',
        '123456',
      );

      expect(prisma.ownerContract.update).toHaveBeenCalledWith({
        where: { id: contractId },
        data: {
          signatureData: validDto.signatureData,
          signedAt: mockNow,
          otpCode: '***56',
          ipAddress,
          userAgent,
          status: OwnerContractStatus.PENDING_FEE,
          expiresAt: expectedFeeExpiresAt,
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'OWNER_CONTRACT_SIGNED',
          entityType: 'OwnerContract',
          entityId: contractId,
          ipAddress,
          payload: {
            listingId,
            ownerProfileId,
            signedAt: mockNow.toISOString(),
            ipAddress,
            userAgent,
          },
        },
      });

      expect(otpService.cleanupOtp).toHaveBeenCalledWith('otp-record-1');

      expect(res.success).toBe(true);
      expect(res.contractId).toBe(contractId);
      expect(res.status).toBe(OwnerContractStatus.PENDING_FEE);
      expect(res.signedAt).toBe(mockNow.toISOString());
      expect(res.expiresAt).toBe(expectedFeeExpiresAt.toISOString());
    });
  });

  describe('Story 7.3: uploadFeeProof', () => {
    const validFile = {
      fieldname: 'file',
      originalname: 'transfer-proof.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024 * 500,
      buffer: Buffer.from('mock-pdf-content'),
    };

    const validBody = {
      bankReferenceCode: 'TXN-12345678',
      senderBankName: 'مصرف الراجحي',
    };

    it('throws BadRequestException if file is missing', async () => {
      await expect(
        service.uploadFeeProof(userId, contractId, undefined as any, validBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if file type is unsupported', async () => {
      const badFile = { ...validFile, mimetype: 'application/exe' };
      await expect(
        service.uploadFeeProof(userId, contractId, badFile, validBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if file exceeds 10MB', async () => {
      const largeFile = { ...validFile, size: 11 * 1024 * 1024 };
      await expect(
        service.uploadFeeProof(userId, contractId, largeFile, validBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException OWNER_CONTRACT_INVALID_STATE if contract not in PENDING_FEE status', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_SIGNATURE }),
      );

      await expect(
        service.uploadFeeProof(userId, contractId, validFile, validBody),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException OWNER_CONTRACT_EXPIRED if payment window expired', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({
          status: OwnerContractStatus.PENDING_FEE,
          expiresAt: pastExpiry,
        }),
      );

      await expect(
        service.uploadFeeProof(userId, contractId, validFile, validBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if malware is detected by scanner', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_FEE }),
      );
      quarantineService.scanAndProcess.mockResolvedValue({
        isClean: false,
        threatName: 'Eicar-Test-Signature',
      });

      await expect(
        service.uploadFeeProof(userId, contractId, validFile, validBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully uploads fee proof, creates payment record and writes audit log', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_FEE }),
      );
      quarantineService.scanAndProcess.mockResolvedValue({
        isClean: true,
        fileObject: { id: 'staged-file-123', key: 'contracts/contract-uuid-001/receipt.pdf' },
      });

      const res = await service.uploadFeeProof(userId, contractId, validFile, validBody);

      expect(quarantineService.stageFileForQuarantine).toHaveBeenCalledWith({
        filename: validFile.originalname,
        mimeType: validFile.mimetype,
        fileSize: validFile.size,
        buffer: validFile.buffer,
        userId,
      });

      expect(quarantineService.scanAndProcess).toHaveBeenCalledWith(
        'staged-file-123',
        'contracts',
        { contractId },
        userId,
      );

      expect(prisma.contractFeePayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerContractId: contractId,
          amount: 1000,
          status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
          proofFileUrl: 'staged-file-123',
          bankReferenceCode: 'TXN-12345678',
          senderBankName: 'مصرف الراجحي',
          uploadedAt: mockNow,
          rejectionReason: null,
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: userId,
          actorType: 'USER',
          action: 'CONTRACT_FEE_PROOF_UPLOADED',
          entityType: 'ContractFeePayment',
        }),
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED);
      expect(res.uploadedAt).toBe(mockNow.toISOString());
    });
  });

  describe('Story 7.3: getFeePayment', () => {
    it('returns fee payment status with presigned URL when payment exists', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_FEE }),
      );
      prisma.contractFeePayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        ownerContractId: contractId,
        amount: 1000,
        status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
        proofFileUrl: 'staged-file-123',
        bankReferenceCode: 'TXN-123',
        senderBankName: 'الراجحي',
        uploadedAt: mockNow,
        rejectionReason: null,
        verifiedAt: null,
      });

      const res = await service.getFeePayment(userId, contractId);

      expect(res.id).toBe('payment-1');
      expect(res.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED);
      expect(res.proofFileUrl).toBe('https://storage.example.com/receipt.pdf');
      expect(res.amount).toBe(1000);
      expect(res.isContractActive).toBe(false);
    });

    it('returns pending fee state when owner has not uploaded proof yet', async () => {
      prisma.ownerContract.findUnique.mockResolvedValue(
        mockContract({ status: OwnerContractStatus.PENDING_FEE }),
      );
      prisma.contractFeePayment.findFirst.mockResolvedValue(null);

      const res = await service.getFeePayment(userId, contractId);

      expect(res.id).toBe('');
      expect(res.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.PENDING);
      expect(res.proofFileUrl).toBeNull();
      expect(res.amount).toBe(1000);
    });
  });
});


