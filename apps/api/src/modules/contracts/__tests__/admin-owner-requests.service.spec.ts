import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminOwnerRequestsService } from '../admin-owner-requests.service';
import { ContractTemplatesService } from '../contract-templates.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  AdminRole,
  ListingStatus,
  OwnerListingRequestStatus,
  OwnerContractStatus,
  PropertyType,
  OWNER_REQUEST_LOCK_CONFLICT,
  OWNER_REQUEST_LOCK_REQUIRED,
  OWNER_REQUEST_INVALID_STATE,
  CONTRACT_FEE_OVERRIDE_UNAUTHORIZED,
  CONTRACT_FEE_OVERRIDE_REASON_REQUIRED,
  SEED_OWNER_CONTRACT_TEMPLATE_ID,
} from '@elmasaif/shared';

describe('AdminOwnerRequestsService (Story 7.1 / FR-69, FR-61, FR-51)', () => {
  let service: AdminOwnerRequestsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let templatesService: any;

  const admin = {
    id: 'admin-1',
    username: 'mod.one',
    fullName: 'مشرف العقود الأول',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review', 'Contracts.Manage'],
  };

  const superAdmin = {
    id: 'super-1',
    username: 'superadmin',
    fullName: 'مدير النظام',
    role: AdminRole.SUPER_ADMIN,
    permissions: ['*'],
  };

  const otherAdmin = {
    id: 'admin-2',
    username: 'mod.two',
    fullName: 'مشرف العقود الثاني',
    role: AdminRole.MODERATOR,
    permissions: ['Contracts.Review'],
  };

  const mockNow = new Date('2026-11-11T12:00:00.000Z');
  const requestId = 'req-1';
  const listingId = 'listing-1';
  const ownerProfileId = 'owner-profile-1';

  const mockRequest = (overrides: any = {}) => ({
    id: requestId,
    listingId,
    ownerProfileId,
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'dist-1',
    titleDeedNumber: '1234567890',
    status: OwnerListingRequestStatus.PENDING,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    rejectionReason: null,
    modificationNotes: null,
    createdAt: mockNow,
    updatedAt: mockNow,
    listing: {
      id: listingId,
      title: 'فيلا فاخرة بحي حطين',
      description: 'فيلا مستقلة مودرن',
      propertyType: PropertyType.VILLA,
      askPrice: 2500000,
      areaSquareMeters: 450,
      bedrooms: 5,
      yearBuilt: 2022,
      latitude: 24.7,
      longitude: 46.6,
      payoutIban: 'SA0380000000608010167519',
      city: { id: 'city-1', nameAr: 'الرياض' },
      district: { id: 'dist-1', nameAr: 'حطين' },
      documents: [
        {
          id: 'doc-deed',
          documentType: 'TITLE_DEED',
          fileUrl: 'https://storage/deed.pdf',
          visibility: 'ADMIN_ONLY',
        },
      ],
      ownerContract: null,
    },
    ownerProfile: {
      id: ownerProfileId,
      user: {
        id: 'user-1',
        fullName: 'عبدالله بن محمد المالك',
        mobileNumber: '0551234567',
        nationalId: '1088888888',
      },
      payoutAccounts: [
        {
          ibanMasked: 'SA03 **** **** **** **** 7519',
          ibanLast4: '7519',
        },
      ],
    },
    ...overrides,
  });

  const mockTemplate = {
    id: SEED_OWNER_CONTRACT_TEMPLATE_ID,
    title: 'عقد تسويق ووساطة عقارية إلكتروني قياسي',
    content: 'عقد بين الطرف الأول والمالك {{ownerName}} لبيع {{propertyTitle}} بسعر {{askPrice}} ورسوم {{contractFee}}',
    version: 1,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      ownerListingRequest: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockRequest()]),
        findUnique: jest.fn().mockResolvedValue(mockRequest()),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(mockRequest(data))),
      },
      listing: {
        update: jest.fn().mockResolvedValue({ id: listingId }),
      },
      ownerContract: {
        upsert: jest.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            id: 'contract-1',
            status: OwnerContractStatus.PENDING_SIGNATURE,
            expiresAt: new Date(mockNow.getTime() + 7 * 24 * 3600 * 1000),
            ...create,
          }),
        ),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      adminUser: {
        findMany: jest.fn().mockResolvedValue([admin, otherAdmin]),
      },
      $transaction: jest.fn().mockImplementation(async (callbackOrArr) => {
        if (typeof callbackOrArr === 'function') {
          return callbackOrArr(prisma);
        }
        return Promise.all(callbackOrArr);
      }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(mockNow),
    };

    storageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url/deed.pdf'),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://presigned-url/deed.pdf'),
    };

    templatesService = {
      getTemplateById: jest.fn().mockResolvedValue(mockTemplate),
      compileContractTerms: jest.fn().mockImplementation((content, vars) => {
        let result = content;
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(`{{${k}}}`, String(v));
        }
        return result;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOwnerRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: ContractTemplatesService, useValue: templatesService },
      ],
    }).compile();

    service = module.get<AdminOwnerRequestsService>(AdminOwnerRequestsService);
  });

  describe('getQueue & detail', () => {
    it('returns queue items with computed lock info and masked phone number', async () => {
      const res = await service.getQueue({}, admin.id);
      expect(res.items.length).toBe(1);
      expect(res.items[0]?.propertyTitle).toBe('فيلا فاخرة بحي حطين');
      expect(res.items[0]?.maskedMobileNumber).toBe('+966 5X XXX 4567');
      expect(res.items[0]?.lockInfo.isLocked).toBe(false);
    });

    it('resolves detail with presigned title deed url and owner verification info', async () => {
      const detail = await service.getDetail(requestId, admin.id);
      expect(detail.id).toBe(requestId);
      expect(detail.owner.legalName).toBe('عبدالله بن محمد المالك');
      expect(detail.owner.isPayoutIbanVerified).toBe(true);
      expect(detail.titleDeedDocumentUrl).toBe('https://signed-url/deed.pdf');
    });
  });

  describe('15-minute claim locking', () => {
    it('allows claiming an unlocked request', async () => {
      const lockInfo = await service.claimLock(requestId, admin.id);
      expect(prisma.ownerListingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedByAdminId: admin.id,
          }),
        }),
      );
    });

    it('rejects claim with ConflictException if locked by another admin', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      await expect(service.claimLock(requestId, admin.id)).rejects.toThrow(ConflictException);
    });

    it('heartbeats lock successfully when caller holds it', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
        }),
      );

      const lockInfo = await service.heartbeatLock(requestId, admin.id);
      expect(prisma.ownerListingRequest.update).toHaveBeenCalled();
    });

    it('releases lock when held by caller', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
        }),
      );

      await service.releaseLock(requestId, admin.id);
      expect(prisma.ownerListingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedByAdminId: null,
          }),
        }),
      );
    });

    it('allows Super Admin to force unlock and logs TASK_LOCK_FORCED_RELEASE audit event', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: otherAdmin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
        }),
      );

      const res = await service.forceUnlock(requestId, superAdmin, { reason: 'فحص فوري عاجل' });
      expect(res.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TASK_LOCK_FORCED_RELEASE',
            entityType: 'OwnerListingRequest',
          }),
        }),
      );
    });
  });

  describe('Contract Dispatch', () => {
    it('fails to dispatch if admin does not hold claim lock', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({ lockedByAdminId: null }),
      );

      await expect(
        service.dispatchContract(requestId, admin, {
          templateId: SEED_OWNER_CONTRACT_TEMPLATE_ID,
          contractFee: 1000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('fails to dispatch if request is not in PENDING status', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
          status: OwnerListingRequestStatus.REJECTED,
        }),
      );

      await expect(
        service.dispatchContract(requestId, admin, {
          templateId: SEED_OWNER_CONTRACT_TEMPLATE_ID,
          contractFee: 1000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects fee override if admin lacks Contracts.FeeOverride permission', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      await expect(
        service.dispatchContract(requestId, admin, {
          templateId: SEED_OWNER_CONTRACT_TEMPLATE_ID,
          contractFee: 500,
          feeOverrideReason: 'خصم ترويجي',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully dispatches contract, compiles terms, creates OwnerContract and releases lock', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      const res = await service.dispatchContract(requestId, admin, {
        templateId: SEED_OWNER_CONTRACT_TEMPLATE_ID,
        contractFee: 1000,
      });

      expect(res.success).toBe(true);
      expect(prisma.ownerContract.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            contractFee: 1000,
            status: OwnerContractStatus.PENDING_SIGNATURE,
          }),
        }),
      );
      expect(prisma.ownerListingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE,
            lockedByAdminId: null,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OWNER_CONTRACT_DISPATCHED',
          }),
        }),
      );
    });
  });

  describe('Rejection & Modification', () => {
    it('successfully rejects request and listing and writes audit log', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      const res = await service.rejectRequest(requestId, admin, {
        reason: 'صك الملكية غير واضح ويحتاج إعادة رفع',
      });

      expect(res.success).toBe(true);
      expect(prisma.ownerListingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OwnerListingRequestStatus.REJECTED,
            rejectionReason: 'صك الملكية غير واضح ويحتاج إعادة رفع',
          }),
        }),
      );
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ListingStatus.REJECTED,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OWNER_LISTING_REQUEST_REJECTED',
          }),
        }),
      );
    });

    it('successfully requests modification and writes audit log', async () => {
      prisma.ownerListingRequest.findUnique.mockResolvedValue(
        mockRequest({
          lockedByAdminId: admin.id,
          lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
        }),
      );

      const res = await service.requestModification(requestId, admin, {
        notes: 'يرجى توضيح مساحة البناء الفعلية',
      });

      expect(res.success).toBe(true);
      expect(prisma.ownerListingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OwnerListingRequestStatus.MODIFICATION_REQUESTED,
            modificationNotes: 'يرجى توضيح مساحة البناء الفعلية',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OWNER_LISTING_REQUEST_MODIFICATION_REQUESTED',
          }),
        }),
      );
    });
  });
});

