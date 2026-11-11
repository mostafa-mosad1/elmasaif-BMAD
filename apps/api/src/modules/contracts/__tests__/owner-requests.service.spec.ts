import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { OwnerRequestsService } from '../owner-requests.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  UserRole,
  ListingStatus,
  OwnerListingRequestStatus,
  PropertyType,
  DocumentVisibility,
  AUTH_NOT_AUTHORIZED,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
  OWNER_REQUEST_PAYOUT_IBAN_NOT_OWNED,
  OWNER_REQUEST_NOT_FOUND,
} from '@elmasaif/shared';

describe('OwnerRequestsService (Story 7.1 / FR-69, UC-50, UJ-3)', () => {
  let service: OwnerRequestsService;
  let prisma: any;

  const userId = 'user-owner-1';
  const ownerProfileId = 'profile-owner-1';
  const cityId = 'city-1';
  const districtId = 'district-1';
  const validIban = 'SA0380000000608010167519';

  const mockOwnerProfile = {
    id: ownerProfileId,
    userId,
    role: UserRole.OWNER,
    status: 'ACTIVE',
  };

  const validDto = {
    title: 'فيلا فاخرة بحي حطين',
    description: 'فيلا مستقلة مودرن واسعة جداً للبيع',
    propertyType: PropertyType.VILLA,
    cityId,
    districtId,
    streetName: 'شارع الأمير تركي',
    latitude: 24.77,
    longitude: 46.63,
    askPrice: 3000000,
    areaSquareMeters: 500,
    bedrooms: 6,
    yearBuilt: 2023,
    payoutIban: validIban,
    titleDeedNumber: '1122334455',
    photos: [
      {
        fileUrl: 'https://storage/photo1.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024 * 500,
        isPrimary: true,
      },
      {
        fileUrl: 'https://storage/photo2.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024 * 500,
        isPrimary: false,
      },
      {
        fileUrl: 'https://storage/photo3.jpg',
        mimeType: 'image/jpeg' as const,
        fileSize: 1024 * 500,
        isPrimary: false,
      },
    ],
    documents: [
      {
        documentType: 'TITLE_DEED' as const,
        fileUrl: 'https://storage/deed.pdf',
        mimeType: 'application/pdf' as const,
        fileSize: 1024 * 800,
        visibility: DocumentVisibility.ADMIN_ONLY,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      userProfile: {
        findFirst: jest.fn().mockResolvedValue(mockOwnerProfile),
      },
      payoutAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payout-1',
          ibanMasked: 'SA03 **** **** **** **** 7519',
          ibanLast4: '7519',
        }),
      },
      city: {
        findFirst: jest.fn().mockResolvedValue({ id: cityId, nameAr: 'الرياض', isActive: true }),
      },
      district: {
        findFirst: jest.fn().mockResolvedValue({ id: districtId, nameAr: 'حطين', isActive: true }),
      },
      listing: {
        create: jest.fn().mockResolvedValue({
          id: 'listing-1',
          title: validDto.title,
          propertyType: validDto.propertyType,
          cityId,
          districtId,
          askPrice: validDto.askPrice,
          sellerProfileId: ownerProfileId,
        }),
      },
      propertyDocument: {
        createMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      ownerListingRequest: {
        create: jest.fn().mockResolvedValue({
          id: 'req-1',
          ownerProfileId,
          listingId: 'listing-1',
          propertyType: validDto.propertyType,
          cityId,
          districtId,
          titleDeedNumber: validDto.titleDeedNumber,
          status: OwnerListingRequestStatus.PENDING,
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OwnerRequestsService>(OwnerRequestsService);
  });

  describe('createListingRequest', () => {
    it('throws ForbiddenException if user lacks active OWNER profile', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(null);

      await expect(service.createListingRequest(userId, validDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if payout IBAN does not match registered payout account', async () => {
      prisma.payoutAccount.findFirst.mockResolvedValue(null);

      await expect(service.createListingRequest(userId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if city is not found or inactive', async () => {
      prisma.city.findFirst.mockResolvedValue(null);

      await expect(service.createListingRequest(userId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if district is not found or inactive', async () => {
      prisma.district.findFirst.mockResolvedValue(null);

      await expect(service.createListingRequest(userId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully creates Listing in PENDING_REVIEW and OwnerListingRequest in PENDING with AuditLog', async () => {
      const result = await service.createListingRequest(userId, validDto);

      expect(result.id).toBe('req-1');
      expect(result.listingId).toBe('listing-1');
      expect(result.status).toBe(OwnerListingRequestStatus.PENDING);
      expect(prisma.listing.create).toHaveBeenCalled();
      expect(prisma.propertyDocument.createMany).toHaveBeenCalled();
      expect(prisma.ownerListingRequest.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OWNER_LISTING_REQUEST_CREATED',
            entityType: 'OwnerListingRequest',
          }),
        }),
      );
    });
  });

  describe('getMyListingRequests & getListingRequestDetail', () => {
    it('returns empty array if user has no owner profile', async () => {
      prisma.userProfile.findFirst.mockResolvedValue(null);
      const res = await service.getMyListingRequests(userId);
      expect(res).toEqual([]);
    });

    it('throws NotFoundException if detail is not found', async () => {
      prisma.ownerListingRequest.findFirst.mockResolvedValue(null);
      await expect(service.getListingRequestDetail(userId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

