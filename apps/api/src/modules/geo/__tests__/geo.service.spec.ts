import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GeoService } from '../geo.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('GeoService', () => {
  let service: GeoService;
  let prisma: {
    city: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    district: {
      findMany: jest.Mock;
    };
  };

  const mockValidCityId = '11111111-0000-4000-8000-000000000001';
  const mockValidDistrictId = '22222222-0001-4000-8000-000000000001';

  const mockCity = {
    id: mockValidCityId,
    nameAr: 'الرياض',
    nameEn: 'Riyadh',
    isActive: true,
    createdAt: new Date()
  };

  const mockDistrict = {
    id: mockValidDistrictId,
    cityId: mockValidCityId,
    nameAr: 'الملقا',
    nameEn: 'Al-Malqa',
    isActive: true,
    createdAt: new Date()
  };

  beforeEach(async () => {
    prisma = {
      city: {
        findMany: jest.fn(),
        findUnique: jest.fn()
      },
      district: {
        findMany: jest.fn()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    service = module.get<GeoService>(GeoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCities', () => {
    it('should query only active cities sorted by nameAr by default', async () => {
      prisma.city.findMany.mockResolvedValue([mockCity]);

      const result = await service.getCities(false);

      expect(prisma.city.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { nameAr: 'asc' }
      });
      expect(result).toEqual([mockCity]);
    });

    it('should query all cities when includeInactive is true', async () => {
      prisma.city.findMany.mockResolvedValue([mockCity]);

      const result = await service.getCities(true);

      expect(prisma.city.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { nameAr: 'asc' }
      });
      expect(result).toEqual([mockCity]);
    });
  });

  describe('getDistrictsByCity', () => {
    it('should return active districts for a valid existing city', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.district.findMany.mockResolvedValue([mockDistrict]);

      const result = await service.getDistrictsByCity(mockValidCityId, false);

      expect(prisma.city.findUnique).toHaveBeenCalledWith({
        where: { id: mockValidCityId }
      });
      expect(prisma.district.findMany).toHaveBeenCalledWith({
        where: {
          cityId: mockValidCityId,
          isActive: true
        },
        orderBy: { nameAr: 'asc' }
      });
      expect(result).toEqual([mockDistrict]);
    });

    it('should throw NotFoundException with CITY_NOT_FOUND code when city does not exist', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(service.getDistrictsByCity(mockValidCityId, false)).rejects.toThrow(
        NotFoundException
      );

      try {
        await service.getDistrictsByCity(mockValidCityId, false);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'CITY_NOT_FOUND',
          message: 'المدينة المحددة غير موجودة',
          details: { cityId: mockValidCityId }
        });
      }
    });

    it('should throw NotFoundException when cityId is not a valid UUID', async () => {
      const invalidId = 'not-a-valid-uuid';

      await expect(service.getDistrictsByCity(invalidId, false)).rejects.toThrow(
        NotFoundException
      );

      try {
        await service.getDistrictsByCity(invalidId, false);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'CITY_NOT_FOUND',
          details: { cityId: invalidId }
        });
      }

      // Should not query the database for malformed UUID
      expect(prisma.city.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when city is inactive and includeInactive is false', async () => {
      prisma.city.findUnique.mockResolvedValue({
        ...mockCity,
        isActive: false
      });

      await expect(service.getDistrictsByCity(mockValidCityId, false)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return districts when city is inactive if includeInactive is true', async () => {
      prisma.city.findUnique.mockResolvedValue({
        ...mockCity,
        isActive: false
      });
      prisma.district.findMany.mockResolvedValue([mockDistrict]);

      const result = await service.getDistrictsByCity(mockValidCityId, true);

      expect(result).toEqual([mockDistrict]);
      expect(prisma.district.findMany).toHaveBeenCalledWith({
        where: {
          cityId: mockValidCityId
        },
        orderBy: { nameAr: 'asc' }
      });
    });
  });

  describe('getGeoTree', () => {
    it('should return hierarchical tree with active cities and nested active districts', async () => {
      const mockTree = [
        {
          ...mockCity,
          districts: [mockDistrict]
        }
      ];

      prisma.city.findMany.mockResolvedValue(mockTree);

      const result = await service.getGeoTree(false);

      expect(prisma.city.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          districts: {
            where: { isActive: true },
            orderBy: { nameAr: 'asc' }
          }
        },
        orderBy: { nameAr: 'asc' }
      });
      expect(result).toEqual(mockTree);
    });

    it('should include inactive entities when includeInactive is true', async () => {
      const mockTree = [
        {
          ...mockCity,
          districts: [mockDistrict]
        }
      ];

      prisma.city.findMany.mockResolvedValue(mockTree);

      const result = await service.getGeoTree(true);

      expect(prisma.city.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          districts: {
            where: undefined,
            orderBy: { nameAr: 'asc' }
          }
        },
        orderBy: { nameAr: 'asc' }
      });
      expect(result).toEqual(mockTree);
    });
  });
});
