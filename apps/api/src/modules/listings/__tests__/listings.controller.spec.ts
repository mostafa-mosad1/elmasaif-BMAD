import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ListingsController } from '../listings.controller';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { ActiveRoleGuard } from '../../users/guards/active-role.guard';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ROLES_KEY } from '../../users/decorators/require-role.decorator';
import { UserRole, PropertyType, ListingStatus, DocumentVisibility } from '@elmasaif/shared';

describe('ListingsController', () => {
  let controller: ListingsController;
  let service: jest.Mocked<Partial<ListingsService>>;
  let prisma: any;
  let clockService: any;
  let reflector: Reflector;

  const mockCityId = '11111111-1111-1111-1111-111111111111';
  const mockDistrictId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = 'user-uuid-1';
  const mockListingId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    service = {
      createListing: jest.fn(),
      uploadMediaOrDocument: jest.fn(),
      getListingById: jest.fn(),
    };

    prisma = {
      session: {
        findUnique: jest.fn(),
      },
      adminSession: {
        findUnique: jest.fn(),
      },
    };

    clockService = {
      now: jest.fn(() => new Date('2026-11-02T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        { provide: ListingsService, useValue: service },
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        Reflector,
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ActiveRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ListingsController>(ListingsController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Endpoint Security & RBAC Decorators', () => {
    it('should configure createListing with MARKETER and OWNER required roles', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.createListing);
      expect(roles).toEqual([UserRole.MARKETER, UserRole.OWNER]);
    });

    it('should configure uploadMedia with MARKETER and OWNER required roles', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.uploadMedia);
      expect(roles).toEqual([UserRole.MARKETER, UserRole.OWNER]);
    });
  });

  describe('POST /listings', () => {
    it('should delegate listing creation to listingsService with user id and active role', async () => {
      const req = {
        user: {
          id: mockUserId,
          role: UserRole.MARKETER,
          activeRole: UserRole.MARKETER,
        },
      };

      const dto: any = {
        title: 'فيلا فاخرة للبيع',
        description: 'وصف فيلا حديثة راقية',
        propertyType: PropertyType.VILLA,
        cityId: mockCityId,
        districtId: mockDistrictId,
        latitude: 24.7136,
        longitude: 46.6753,
        askPrice: 2500000,
        areaSquareMeters: 300,
        payoutIban: 'SA0380000000608010167519',
        photos: [
          { fileUrl: 'p1.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: true },
          { fileUrl: 'p2.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false },
          { fileUrl: 'p3.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false },
        ],
        documents: [
          {
            documentType: 'OWNER_AUTHORIZATION',
            fileUrl: 'auth.pdf',
            mimeType: 'application/pdf',
            fileSize: 2000,
            visibility: DocumentVisibility.ADMIN_ONLY,
          },
        ],
      };

      const mockResponse = {
        id: mockListingId,
        ...dto,
        status: ListingStatus.PENDING_REVIEW,
      };

      (service.createListing as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.createListing(req, dto);

      expect(result).toEqual(mockResponse);
      expect(service.createListing).toHaveBeenCalledWith(mockUserId, UserRole.MARKETER, dto);
    });
  });

  describe('POST /listings/upload', () => {
    it('should delegate file upload and scanning to listingsService', async () => {
      const req = { user: { id: mockUserId } };
      const file: any = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 50000,
        buffer: Buffer.from('test'),
      };

      const mockUploadResult = {
        fileUrl: 'listings/user-1/photo.jpg',
        key: 'listings/user-1/photo.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 50000,
        scanStatus: 'CLEAN',
      };

      (service.uploadMediaOrDocument as jest.Mock).mockResolvedValue(mockUploadResult);

      const result = await controller.uploadMedia(req, file, 'photo');

      expect(result).toEqual(mockUploadResult);
      expect(service.uploadMediaOrDocument).toHaveBeenCalledWith(file, mockUserId, 'photo');
    });
  });

  describe('GET /listings/:id', () => {
    it('should delegate to listingsService with public requester when unauthenticated', async () => {
      const req = { cookies: {}, headers: {} };
      const mockListing = { id: mockListingId, title: 'فيلا فاخرة' };

      (service.getListingById as jest.Mock).mockResolvedValue(mockListing);

      const result = await controller.getListingById(mockListingId, req);

      expect(result).toEqual(mockListing);
      expect(service.getListingById).toHaveBeenCalledWith(mockListingId, undefined, false);
    });

    it('should extract user session and pass userId to getListingById when authenticated', async () => {
      const req = {
        cookies: { elmasaif_session: 'valid-session-token' },
        headers: {},
      };

      prisma.session.findUnique.mockResolvedValue({
        userId: mockUserId,
        expiresAt: new Date('2026-11-02T14:00:00.000Z'), // valid in future
      });

      const mockListing = { id: mockListingId, title: 'فيلا فاخرة' };
      (service.getListingById as jest.Mock).mockResolvedValue(mockListing);

      const result = await controller.getListingById(mockListingId, req);

      expect(result).toEqual(mockListing);
      expect(service.getListingById).toHaveBeenCalledWith(mockListingId, mockUserId, false);
    });

    it('should extract admin session and set requesterIsAdmin = true', async () => {
      const req = {
        cookies: { elmasaif_admin_session: 'valid-admin-token' },
        headers: {},
      };

      prisma.adminSession.findUnique.mockResolvedValue({
        id: 'admin-sess-1',
        admin: { id: 'admin-1', isActive: true },
        expiresAt: new Date('2026-11-02T14:00:00.000Z'),
      });

      const mockListing = { id: mockListingId, title: 'فيلا فاخرة' };
      (service.getListingById as jest.Mock).mockResolvedValue(mockListing);

      const result = await controller.getListingById(mockListingId, req);

      expect(result).toEqual(mockListing);
      expect(service.getListingById).toHaveBeenCalledWith(mockListingId, undefined, true);
    });
  });
});

