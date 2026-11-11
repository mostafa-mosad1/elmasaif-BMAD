import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminContractFeesService } from '../admin-contract-fees.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  AdminRole,
  ListingStatus,
  OwnerContractStatus,
  PropertyType,
  CONTRACT_FEE_PAYMENT_STATUS,
  CONTRACT_FEE_LOCK_CONFLICT,
  CONTRACT_FEE_LOCK_REQUIRED,
} from '@elmasaif/shared';

describe('AdminContractFeesService (Story 7.3)', () => {
  let service: AdminContractFeesService;
  let prisma: any;
  let clockService: any;
  let storageService: any;

  const admin = {
    id: 'admin-1',
    username: 'mod.one',
    fullName: 'مشرف العقود الأول',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review', 'Contracts.Manage'],
  };

  const otherAdmin = {
    id: 'admin-2',
    username: 'mod.two',
    fullName: 'مشرف العقود الثاني',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review'],
  };

  const mockNow = new Date('2026-11-11T12:00:00.000Z');
  const paymentId = 'pay-uuid-001';
  const contractId = 'contract-uuid-001';
  const listingId = 'listing-uuid-001';
  const ownerProfileId = 'owner-profile-1';

  const mockPayment = (overrides: any = {}) => ({
    id: paymentId,
    ownerContractId: contractId,
    amount: 1000.0,
    status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
    proofFileUrl: 'staged-file-123',
    bankReferenceCode: 'TXN-99887766',
    senderBankName: 'مصرف الراجحي',
    uploadedAt: mockNow,
    verifiedByAdminId: null,
    verifiedAt: null,
    rejectionReason: null,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    createdAt: mockNow,
    updatedAt: mockNow,
    ownerContract: {
      id: contractId,
      listingId,
      ownerProfileId,
      contractFee: 1000.0,
      feeOverrideReason: null,
      contractTerms: 'شروط العقد...',
      status: OwnerContractStatus.PENDING_FEE,
      expiresAt: new Date('2026-11-18T12:00:00.000Z'),
      signedAt: mockNow,
      signatureData: 'data:image/png;base64,mock',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      listing: {
        id: listingId,
        title: 'فيلا فاخرة بحي النرجس',
        propertyType: PropertyType.VILLA,
        askPrice: 2800000,
        areaSquareMeters: 400,
        payoutIban: 'SA0380000000608010167519',
        city: { nameAr: 'الرياض' },
        district: { nameAr: 'النرجس' },
        documents: [
          {
            id: 'doc-photo-1',
            documentType: 'PHOTO',
            fileUrl: 'https://storage/photo1.jpg',
            visibility: 'PUBLIC',
          },
        ],
        ownerListingRequest: {
          id: 'req-1',
          titleDeedNumber: '1234567890',
        },
      },
      ownerProfile: {
        id: ownerProfileId,
        userId: 'user-owner-1',
        user: {
          id: 'user-owner-1',
          fullName: 'عبدالله بن محمد المطيري',
          mobileNumber: '0551234567',
          nationalId: '1098765432',
        },
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    let currentPayment = mockPayment();

    prisma = {
      contractFeePayment: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([currentPayment])),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === paymentId) return Promise.resolve(currentPayment);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          if (where.ownerContractId === contractId) return Promise.resolve(currentPayment);
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }: any) => {
          currentPayment = { ...currentPayment, ...data };
          return Promise.resolve(currentPayment);
        }),
      },
      ownerContract: {
        update: jest.fn().mockResolvedValue({ id: contractId, status: OwnerContractStatus.ACTIVE }),
      },
      listing: {
        update: jest.fn().mockResolvedValue({ id: listingId, status: ListingStatus.ACTIVE }),
      },
      ownerListingRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      invoiceRecord: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'inv-1', ...data }),
        ),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([
          { id: admin.id, fullName: admin.fullName },
          { id: otherAdmin.id, fullName: otherAdmin.fullName },
        ]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    storageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/verified.pdf'),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/presigned.pdf'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminContractFeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<AdminContractFeesService>(AdminContractFeesService);
  });

  describe('getQueue (AC: 3)', () => {
    it('returns paginated items with claim lock info', async () => {
      const res = await service.getQueue({}, admin.id);

      expect(res.total).toBe(1);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.id).toBe(paymentId);
      expect(res.items[0]?.amount).toBe(1000);
      expect(res.items[0]?.propertyTitle).toBe('فيلا فاخرة بحي النرجس');
      expect(res.items[0]?.lockInfo.isLocked).toBe(false);
    });

    it('filters by status when provided', async () => {
      await service.getQueue({ status: 'PROOF_UPLOADED' }, admin.id);
      expect(prisma.contractFeePayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PROOF_UPLOADED' }),
        }),
      );
    });
  });

  describe('getDetail (AC: 3)', () => {
    it('returns full dossier for payment', async () => {
      const res = await service.getDetail(paymentId, admin.id);

      expect(res.payment.id).toBe(paymentId);
      expect(res.payment.amount).toBe(1000);
      expect(res.payment.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED);
      expect(res.contract.id).toBe(contractId);
      expect(res.listing?.title).toBe('فيلا فاخرة بحي النرجس');
      expect(res.owner.legalName).toBe('عبدالله بن محمد المطيري');
      expect(res.lockInfo.isLocked).toBe(false);
    });

    it('throws NotFoundException when payment does not exist', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(null);
      prisma.contractFeePayment.findFirst.mockResolvedValue(null);

      await expect(service.getDetail('non-existent', admin.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Claim Locking & Lease Management (AC: 4)', () => {
    it('acquires 15-minute lease and advances status to UNDER_REVIEW', async () => {
      const lockInfo = await service.claimLock(paymentId, admin.id);

      expect(lockInfo.isLocked).toBe(true);
      expect(lockInfo.isLockedByCurrentAdmin).toBe(true);
      expect(prisma.contractFeePayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: expect.objectContaining({
          lockedByAdminId: admin.id,
          status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CONTRACT_FEE_CLAIMED',
          entityId: paymentId,
        }),
      });
    });

    it('throws ConflictException CONTRACT_FEE_LOCK_CONFLICT when held by another admin', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      await expect(service.claimLock(paymentId, admin.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('heartbeats to renew active lease for another 15 minutes', async () => {
      const lockedPayment = mockPayment({
        lockedByAdminId: admin.id,
        lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
      });
      prisma.contractFeePayment.findUnique.mockResolvedValue(lockedPayment);
      prisma.contractFeePayment.update.mockResolvedValue({
        ...lockedPayment,
        lockExpiresAt: new Date(mockNow.getTime() + 15 * 60 * 1000),
      });

      const lockInfo = await service.heartbeatLock(paymentId, admin.id);

      expect(lockInfo.isLocked).toBe(true);
      expect(prisma.contractFeePayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: {
          lockExpiresAt: new Date(mockNow.getTime() + 15 * 60 * 1000),
        },
      });
    });

    it('releases lock and resets UNDER_REVIEW to PROOF_UPLOADED', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
        }),
      );

      await service.releaseLock(paymentId, admin.id);

      expect(prisma.contractFeePayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          status: CONTRACT_FEE_PAYMENT_STATUS.PROOF_UPLOADED,
        },
      });
    });

    it('forces unlock and writes audit log', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      const res = await service.forceUnlock(paymentId, admin, {
        reason: 'المشرف في إجازة وتجاوز مهلة SLA',
      });

      expect(res.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CONTRACT_FEE_FORCE_UNLOCKED',
          entityId: paymentId,
        }),
      });
    });
  });

  describe('confirmPayment & Auto-Publishing (AC: 5)', () => {
    it('atomically confirms fee, activates contract, publishes listing to ACTIVE, generates invoice', async () => {
      // Setup active lock by caller
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
        }),
      );

      const res = await service.confirmPayment(paymentId, admin);

      expect(res.success).toBe(true);
      expect(res.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED);
      expect(res.contractId).toBe(contractId);
      expect(res.listingId).toBe(listingId);
      expect(res.invoiceNumber).toContain('INV-FEES-2026-');

      // Verify contract updated to ACTIVE
      expect(prisma.ownerContract.update).toHaveBeenCalledWith({
        where: { id: contractId },
        data: { status: OwnerContractStatus.ACTIVE },
      });

      // Verify listing updated to ACTIVE (BR-15 auto-publishing)
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: { status: ListingStatus.ACTIVE },
      });

      // Verify owner listing request completed
      expect(prisma.ownerListingRequest.updateMany).toHaveBeenCalledWith({
        where: { listingId },
        data: { status: 'COMPLETED' },
      });

      // Verify invoice generated with 15% VAT breakdown
      expect(prisma.invoiceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractFeePaymentId: paymentId,
          subtotalAmount: '869.57',
          vatAmount: '130.43',
          totalAmount: '1000.00',
          vatRate: 0.15,
          vatTreatment: 'STANDARD_15_PERCENT',
        }),
      });

      // Verify audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CONTRACT_FEE_CONFIRMED',
          actorId: admin.id,
          entityId: paymentId,
        }),
      });
    });

    it('throws ConflictException if lock is not held by caller', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({ lockedByAdminId: null }),
      );

      await expect(service.confirmPayment(paymentId, admin)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('rejectPayment (AC: 6)', () => {
    it('atomically rejects fee with reason and leaves contract in PENDING_FEE', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          status: CONTRACT_FEE_PAYMENT_STATUS.UNDER_REVIEW,
        }),
      );

      const reason = 'صورة الإشعار البنكي غير واضحة ورقم الحساب غير مطابق';
      const res = await service.rejectPayment(paymentId, admin, { reason });

      expect(res.success).toBe(true);
      expect(res.status).toBe(CONTRACT_FEE_PAYMENT_STATUS.REJECTED);
      expect(res.rejectionReason).toBe(reason);

      expect(prisma.contractFeePayment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: expect.objectContaining({
          status: CONTRACT_FEE_PAYMENT_STATUS.REJECTED,
          rejectionReason: reason,
          lockedByAdminId: null,
        }),
      });

      expect(prisma.ownerContract.update).not.toHaveBeenCalled();
      expect(prisma.listing.update).not.toHaveBeenCalled();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CONTRACT_FEE_REJECTED',
          actorId: admin.id,
          entityId: paymentId,
        }),
      });
    });
  });

  describe('getProofDownloadUrl (AC: 7)', () => {
    it('returns presigned download URL for proof file', async () => {
      const res = await service.getProofDownloadUrl(paymentId, admin.id);

      expect(res.downloadUrl).toBe('https://storage.example.com/verified.pdf');
      expect(res.expiresInSeconds).toBe(300);
    });

    it('throws NotFoundException when no proof is uploaded', async () => {
      prisma.contractFeePayment.findUnique.mockResolvedValue(
        mockPayment({ proofFileUrl: null }),
      );

      await expect(
        service.getProofDownloadUrl(paymentId, admin.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
