import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import {
  UserRole,
  ProfileStatus,
  PropertyType,
  ListingStatus,
  DocumentVisibility,
  ScanStatus,
} from '@elmasaif/shared';

describe('ListingsService', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const mockCityId = '11111111-1111-1111-1111-111111111111';
  const mockDistrictId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = 'user-uuid-1';
  const mockProfileId = 'profile-uuid-1';
  const mockIban = 'SA0380000000608010167519';

  const validPhotos = [
    { fileUrl: 'listings/user-1/p1.jpg', mimeType: 'image/jpeg', fileSize: 50000, isPrimary: true },
    { fileUrl: 'listings/user-1/p2.jpg', mimeType: 'image/jpeg', fileSize: 50000, isPrimary: false },
    { fileUrl: 'listings/user-1/p3.jpg', mimeType: 'image/jpeg', fileSize: 50000, isPrimary: false },
  ];

  const baseDto: any = {
    title: 'فيلا فاخرة للبيع في حي النرجس',
    description: 'فيلا مستقلة راقية بموقع ممتاز وتشطيبات سوبر ديلوكس حديثة',
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    streetName: 'شارع رقم 10',
    latitude: 24.7136,
    longitude: 46.6753,
    askPrice: 3500000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2023,
    payoutIban: mockIban,
    photos: validPhotos,
    documents: [],
  };

  beforeEach(async () => {
    prisma = {
      userProfile: {
        findUnique: jest.fn(),
      },
      city: {
        findUnique: jest.fn(),
      },
      district: {
        findUnique: jest.fn(),
      },
      payoutAccount: {
        findFirst: jest.fn(),
      },
      listing: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      propertyDocument: {
        createMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    clockService = {
      now: jest.fn(() => new Date('2026-11-02T12:00:00.000Z')),
      nowIso: jest.fn(() => '2026-11-02T12:00:00.000Z'),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (key: string) => `https://s3.local/${key}?signed=true`),
    };

    quarantineService = {
      stageFileForQuarantine: jest.fn(),
      scanAndProcess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: quarantineService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  describe('createListing', () => {
    it('should successfully create a listing for an Owner with TITLE_DEED and registered payout IBAN', async () => {
      // Setup Owner profile
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE,
      });

      // City & District active and matching composite relation
      prisma.city.findUnique.mockResolvedValue({
        id: mockCityId,
        nameAr: 'الرياض',
        nameEn: 'Riyadh',
        isActive: true,
      });
      prisma.district.findUnique.mockResolvedValue({
        id: mockDistrictId,
        cityId: mockCityId,
        nameAr: 'النرجس',
        nameEn: 'Al-Narjis',
        isActive: true,
      });

      // Payout account verified
      prisma.payoutAccount.findFirst.mockResolvedValue({
        id: 'payout-1',
        profileId: mockProfileId,
        ibanMasked: 'SA0380000000608010167519',
      });

      const ownerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'TITLE_DEED',
            fileUrl: 'listings/user-1/deed.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      const createdListing = {
        id: 'listing-uuid-1',
        ...ownerDto,
        status: ListingStatus.PENDING_REVIEW,
        sellerProfileId: mockProfileId,
        version: 1,
      };

      prisma.listing.create.mockResolvedValue(createdListing);

      const result = await service.createListing(mockUserId, UserRole.OWNER, ownerDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('listing-uuid-1');
      expect(result.status).toBe(ListingStatus.PENDING_REVIEW);
      expect(prisma.listing.create).toHaveBeenCalled();
      expect(prisma.propertyDocument.createMany).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LISTING_CREATED',
          actorId: mockUserId,
          entityId: 'listing-uuid-1',
        }),
      });
    });

    it('should successfully create a listing for a Marketer with OWNER_AUTHORIZATION and approved Fal license', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        falLicense: {
          licenseNumber: '1234567890',
          status: ProfileStatus.ACTIVE,
          expiryDate: new Date('2027-01-01'),
        },
      });

      prisma.city.findUnique.mockResolvedValue({
        id: mockCityId,
        isActive: true,
      });
      prisma.district.findUnique.mockResolvedValue({
        id: mockDistrictId,
        cityId: mockCityId,
        isActive: true,
      });
      prisma.payoutAccount.findFirst.mockResolvedValue({
        id: 'payout-1',
        profileId: mockProfileId,
      });

      const marketerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'OWNER_AUTHORIZATION',
            fileUrl: 'listings/user-1/auth.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      prisma.listing.create.mockResolvedValue({
        id: 'listing-uuid-2',
        ...marketerDto,
        status: ListingStatus.PENDING_REVIEW,
      });

      const result = await service.createListing(mockUserId, UserRole.MARKETER, marketerDto);

      expect(result).toBeDefined();
      expect(prisma.listing.create).toHaveBeenCalled();
    });

    it('should reject Marketer listing if OWNER_AUTHORIZATION document is missing', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        falLicense: {
          status: ProfileStatus.ACTIVE,
          expiryDate: new Date('2027-01-01'),
        },
      });

      const dtoWithoutAuthDoc = {
        ...baseDto,
        documents: [
          {
            documentType: 'FLOOR_PLAN',
            fileUrl: 'listings/user-1/floor.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.PUBLIC,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.MARKETER, dtoWithoutAuthDoc),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject Owner listing if TITLE_DEED document is missing', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE,
      });

      const dtoWithoutDeed = {
        ...baseDto,
        documents: [
          {
            documentType: 'FLOOR_PLAN',
            fileUrl: 'listings/user-1/floor.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.PUBLIC,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.OWNER, dtoWithoutDeed),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject Marketer listing if Fal license is missing or not active', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        falLicense: {
          status: ProfileStatus.UNDER_REVIEW, // not active
          expiryDate: new Date('2027-01-01'),
        },
      });

      const marketerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'OWNER_AUTHORIZATION',
            fileUrl: 'listings/user-1/auth.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.MARKETER, marketerDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject listing if city is inactive (GEO_CITY_INACTIVE)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE,
      });
      prisma.city.findUnique.mockResolvedValue({
        id: mockCityId,
        isActive: false,
      });

      const ownerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'TITLE_DEED',
            fileUrl: 'listings/user-1/deed.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.OWNER, ownerDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject listing if district does not match city or is inactive (GEO_DISTRICT_INACTIVE)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE,
      });
      prisma.city.findUnique.mockResolvedValue({
        id: mockCityId,
        isActive: true,
      });
      prisma.district.findUnique.mockResolvedValue(null); // mismatch or not found

      const ownerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'TITLE_DEED',
            fileUrl: 'listings/user-1/deed.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.OWNER, ownerDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject listing if payoutIban is not registered for user profile (LISTING_INVALID_IBAN)', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        id: mockProfileId,
        userId: mockUserId,
        role: UserRole.OWNER,
        status: ProfileStatus.ACTIVE,
      });
      prisma.city.findUnique.mockResolvedValue({ id: mockCityId, isActive: true });
      prisma.district.findUnique.mockResolvedValue({ id: mockDistrictId, cityId: mockCityId, isActive: true });
      prisma.payoutAccount.findFirst.mockResolvedValue(null); // IBAN not registered

      const ownerDto = {
        ...baseDto,
        documents: [
          {
            documentType: 'TITLE_DEED',
            fileUrl: 'listings/user-1/deed.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024 * 50,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      await expect(
        service.createListing(mockUserId, UserRole.OWNER, ownerDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getListingById & privacy filtering', () => {
    const mockListingData = {
      id: 'listing-1',
      title: 'فيلا فاخرة',
      description: 'وصف مفصل',
      propertyType: PropertyType.VILLA,
      cityId: mockCityId,
      districtId: mockDistrictId,
      city: { nameAr: 'الرياض', nameEn: 'Riyadh' },
      district: { nameAr: 'النرجس', nameEn: 'Al-Narjis' },
      streetName: 'شارع 1',
      latitude: 24.7136,
      longitude: 46.6753,
      askPrice: 3500000,
      areaSquareMeters: 450,
      bedrooms: 5,
      yearBuilt: 2023,
      status: ListingStatus.PENDING_REVIEW,
      sellerProfileId: mockProfileId,
      sellerProfile: {
        id: mockProfileId,
        userId: mockUserId,
        user: {
          fullName: 'فهد السعيد',
          mobileNumber: '+966501234567',
          email: 'fahad@example.com',
        },
      },
      documents: [
        {
          id: 'doc-photo',
          documentType: 'PHOTO',
          fileUrl: 'listings/user-1/photo1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1000,
          visibility: DocumentVisibility.PUBLIC,
          scanStatus: ScanStatus.CLEAN,
          createdAt: new Date(),
        },
        {
          id: 'doc-public-plan',
          documentType: 'FLOOR_PLAN',
          fileUrl: 'listings/user-1/plan.pdf',
          mimeType: 'application/pdf',
          fileSize: 5000,
          visibility: DocumentVisibility.PUBLIC,
          scanStatus: ScanStatus.CLEAN,
          createdAt: new Date(),
        },
        {
          id: 'doc-private-deed',
          documentType: 'TITLE_DEED',
          fileUrl: 'listings/user-1/deed.pdf',
          mimeType: 'application/pdf',
          fileSize: 10000,
          visibility: DocumentVisibility.ADMIN_ONLY,
          scanStatus: ScanStatus.CLEAN,
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    it('should strictly omit ADMIN_ONLY documents and conceal seller contact details for public/buyer users', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', 'other-user-uuid', false);

      expect(result).toBeDefined();
      expect(result.id).toBe('listing-1');
      // ADMIN_ONLY documents must NOT be returned
      const returnedDocs = result.documents;
      expect(returnedDocs.some((d: any) => d.documentType === 'TITLE_DEED')).toBe(false);
      expect(returnedDocs.every((d: any) => d.visibility === DocumentVisibility.PUBLIC)).toBe(true);

      // Seller private info must be concealed
      expect((result as any).sellerProfile?.user?.mobileNumber).toBeUndefined();
      expect((result as any).sellerProfile?.user?.email).toBeUndefined();
    });

    it('should include all documents with pre-signed download URLs for the seller or admin', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', mockUserId, false);

      expect(result).toBeDefined();
      const returnedDocs = result.documents;
      // ADMIN_ONLY documents must be returned for the seller
      expect(returnedDocs.some((d: any) => d.documentType === 'TITLE_DEED')).toBe(true);
      // Pre-signed download URLs must be generated
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalled();
      const deedDoc = returnedDocs.find((d: any) => d.documentType === 'TITLE_DEED');
      expect(deedDoc?.fileUrl).toContain('signed=true');
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.getListingById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should pre-sign PUBLIC photo URLs for buyer/public requesters so the gallery renders', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', 'other-user-uuid', false);

      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].fileUrl).toContain('signed=true');
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'listings/user-1/photo1.jpg',
        300,
      );
    });

    it('should pre-sign PUBLIC photo URLs for anonymous visitors as well', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', undefined, false);

      expect(result.photos[0].fileUrl).toBe(
        'https://s3.local/listings/user-1/photo1.jpg?signed=true',
      );
    });

    it('should leave non-photo PUBLIC documents as stored for buyers', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', 'other-user-uuid', false);

      const plan = result.documents.find((d: any) => d.documentType === 'FLOOR_PLAN');
      expect(plan?.fileUrl).toBe('listings/user-1/plan.pdf');
    });

    it('should fall back to the raw key when pre-signing a public photo fails', async () => {
      storageService.getPresignedDownloadUrl.mockRejectedValueOnce(
        new Error('storage unavailable'),
      );
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', undefined, false);

      expect(result.photos[0].fileUrl).toBe('listings/user-1/photo1.jpg');
    });

    it('should conceal payout IBAN and national ID from buyers while keeping them for the seller', async () => {
      const listingWithPayout = {
        ...mockListingData,
        payoutIban: mockIban,
        sellerProfile: {
          ...mockListingData.sellerProfile,
          role: UserRole.MARKETER,
          user: {
            ...mockListingData.sellerProfile.user,
            username: 'fahad_sa',
            nationalId: '1010101010',
          },
        },
      };
      prisma.listing.findUnique.mockResolvedValue(listingWithPayout);

      const buyerResult = await service.getListingById('listing-1', 'other-user-uuid', false);

      expect(buyerResult.payoutIban).toBeUndefined();
      expect(buyerResult.sellerProfile.user.nationalId).toBeUndefined();
      expect(buyerResult.sellerProfile.user.mobileNumber).toBeUndefined();
      expect(buyerResult.sellerProfile.user.email).toBeUndefined();
      expect(buyerResult.sellerProfile.role).toBe(UserRole.MARKETER);

      const sellerResult = await service.getListingById('listing-1', mockUserId, false);

      expect(sellerResult.payoutIban).toBe(mockIban);
      expect(sellerResult.sellerProfile.user.nationalId).toBe('1010101010');
      expect(sellerResult.sellerProfile.user.mobileNumber).toBe('+966501234567');
    });

    it('should keep the authorized seller/admin branch fully pre-signed and unchanged (regression)', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListingData);

      const result = await service.getListingById('listing-1', mockUserId, false);

      // Every document (including the PUBLIC photo and the ADMIN_ONLY deed) goes through pre-signing
      expect(result.documents).toHaveLength(2);
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].fileUrl).toContain('signed=true');
      expect(result.documents.every((d: any) => d.fileUrl.includes('signed=true'))).toBe(true);
    });
  });

  describe('uploadMediaOrDocument', () => {
    it('should successfully stage, scan, and promote clean file', async () => {
      const mockFile: any = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 200,
        buffer: Buffer.from('test image content'),
      };

      quarantineService.stageFileForQuarantine.mockResolvedValue({
        fileObjectId: 'file-obj-1',
        key: 'quarantine/photo.jpg',
      });

      quarantineService.scanAndProcess.mockResolvedValue({
        isClean: true,
        fileObject: {
          key: 'listings/user-1/clean-photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024 * 200,
          scanStatus: ScanStatus.CLEAN,
        },
      });

      const result = await service.uploadMediaOrDocument(mockFile, mockUserId, 'photo');

      expect(result).toBeDefined();
      expect(result.fileUrl).toBe('listings/user-1/clean-photo.jpg');
      expect(result.scanStatus).toBe(ScanStatus.CLEAN);
      expect(quarantineService.stageFileForQuarantine).toHaveBeenCalled();
      expect(quarantineService.scanAndProcess).toHaveBeenCalledWith(
        'file-obj-1',
        'listings',
        { userId: mockUserId },
        mockUserId,
      );
    });

    it('should reject file upload if malware is detected', async () => {
      const mockFile: any = {
        originalname: 'malware.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 200,
        buffer: Buffer.from('infected content'),
      };

      quarantineService.stageFileForQuarantine.mockResolvedValue({
        fileObjectId: 'file-obj-2',
      });

      quarantineService.scanAndProcess.mockResolvedValue({
        isClean: false,
        threatName: 'EICAR-Test-Signature',
      });

      await expect(
        service.uploadMediaOrDocument(mockFile, mockUserId, 'photo'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublicActiveListings & getMyListings media array enrichment (Story 2.3)', () => {
    it('should enrich public active listings with signed photos[], primaryPhotoUrl, photoCount, sellerRole, and isFalVerified without bathrooms', async () => {
      prisma.listing.findMany.mockResolvedValue([
        {
          id: 'listing-public-1',
          title: 'فيلا مودرن في النرجس',
          description: 'فيلا بتصميم حديث',
          propertyType: PropertyType.VILLA,
          cityId: mockCityId,
          districtId: mockDistrictId,
          city: { nameAr: 'الرياض' },
          district: { nameAr: 'النرجس' },
          askPrice: 3200000,
          areaSquareMeters: 450,
          bedrooms: 5,
          yearBuilt: 2025,
          status: ListingStatus.ACTIVE,
          sellerProfile: {
            id: mockProfileId,
            role: UserRole.MARKETER,
          },
          documents: [
            {
              id: 'p1',
              documentType: 'PHOTO',
              fileUrl: 'listings/u1/p1.jpg',
              visibility: DocumentVisibility.PUBLIC,
            },
            {
              id: 'p2',
              documentType: 'PHOTO',
              fileUrl: 'listings/u1/p2.jpg',
              visibility: DocumentVisibility.PUBLIC,
            },
          ],
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
        },
      ]);

      const response = await service.getPublicActiveListings(12);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ListingStatus.ACTIVE },
          include: expect.objectContaining({
            documents: {
              where: {
                documentType: 'PHOTO',
                visibility: DocumentVisibility.PUBLIC,
              },
            },
          }),
        }),
      );
      expect(response.items).toHaveLength(1);
      const item = response.items[0];
      expect(item.photos).toEqual([
        'https://s3.local/listings/u1/p1.jpg?signed=true',
        'https://s3.local/listings/u1/p2.jpg?signed=true',
      ]);
      expect(item.primaryPhotoUrl).toBe('https://s3.local/listings/u1/p1.jpg?signed=true');
      expect(item.photoCount).toBe(2);
      expect(item.sellerRole).toBe(UserRole.MARKETER);
      expect(item.isFalVerified).toBe(true);
      expect(item.bathrooms).toBeUndefined();
    });

    it('should enrich getMyListings with signed photos[] and isFalVerified = false for OWNER listings', async () => {
      prisma.listing.findMany.mockResolvedValue([
        {
          id: 'listing-owner-1',
          title: 'أرض سكنية بالملقا',
          propertyType: PropertyType.LAND,
          cityId: mockCityId,
          districtId: mockDistrictId,
          city: { nameAr: 'الرياض' },
          district: { nameAr: 'الملقا' },
          askPrice: 4100000,
          areaSquareMeters: 600,
          bedrooms: null,
          yearBuilt: null,
          status: ListingStatus.PENDING_REVIEW,
          sellerProfile: {
            id: mockProfileId,
            role: UserRole.OWNER,
          },
          documents: [
            {
              id: 'p1',
              documentType: 'PHOTO',
              fileUrl: 'listings/u1/land1.jpg',
              visibility: DocumentVisibility.PUBLIC,
            },
            {
              id: 'deed1',
              documentType: 'TITLE_DEED',
              fileUrl: 'listings/u1/deed1.pdf',
              visibility: DocumentVisibility.ADMIN_ONLY,
            },
          ],
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
          updatedAt: new Date('2026-11-01T10:00:00.000Z'),
        },
      ]);

      const response = await service.getMyListings(mockUserId);
      expect(response.items).toHaveLength(1);
      const item = response.items[0];
      expect(item.photos).toEqual(['https://s3.local/listings/u1/land1.jpg?signed=true']);
      expect(item.primaryPhotoUrl).toBe('https://s3.local/listings/u1/land1.jpg?signed=true');
      expect(item.photoCount).toBe(1);
      expect(item.documentCount).toBe(1);
      expect(item.sellerRole).toBe(UserRole.OWNER);
      expect(item.isFalVerified).toBe(false);
      expect(item.bathrooms).toBeUndefined();
    });
  });
});
