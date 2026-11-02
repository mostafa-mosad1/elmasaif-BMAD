import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GeoService } from '../geo.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  GEO_CITY_DUPLICATE_NAME,
  GEO_DISTRICT_DUPLICATE_NAME,
  GEO_CITY_NOT_FOUND,
  GEO_DISTRICT_NOT_FOUND
} from '@elmasaif/shared';

describe('GeoService', () => {
  let service: GeoService;
  let prisma: {
    city: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    district: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockValidCityId = '11111111-0000-4000-8000-000000000001';
  const mockValidDistrictId = '22222222-0001-4000-8000-000000000001';
  const mockAdminId = '99999999-0000-4000-8000-000000000001';

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
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      district: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      })
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

  describe('adminGetCities', () => {
    it('should return all cities with total, active, and inactive district counts', async () => {
      const citiesWithDistricts = [
        {
          ...mockCity,
          districts: [
            { id: 'd1', isActive: true },
            { id: 'd2', isActive: false }
          ]
        }
      ];
      prisma.city.findMany.mockResolvedValue(citiesWithDistricts);

      const result = await service.adminGetCities();

      expect(prisma.city.findMany).toHaveBeenCalledWith({
        orderBy: { nameAr: 'asc' },
        include: {
          districts: {
            select: { id: true, isActive: true }
          }
        }
      });
      expect(result).toEqual([
        {
          id: mockCity.id,
          nameAr: mockCity.nameAr,
          nameEn: mockCity.nameEn,
          isActive: mockCity.isActive,
          createdAt: mockCity.createdAt,
          _count: { districts: 2 },
          activeDistrictsCount: 1,
          inactiveDistrictsCount: 1
        }
      ]);
    });
  });

  describe('adminCreateCity', () => {
    it('should successfully create city and create AuditLog entry', async () => {
      prisma.city.findFirst.mockResolvedValue(null);
      prisma.city.create.mockResolvedValue(mockCity);

      const result = await service.adminCreateCity(
        { nameAr: 'الرياض', nameEn: 'Riyadh', isActive: true },
        mockAdminId,
        '10.0.0.1'
      );

      expect(result).toEqual(mockCity);
      expect(prisma.city.create).toHaveBeenCalledWith({
        data: {
          nameAr: 'الرياض',
          nameEn: 'Riyadh',
          isActive: true
        }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GEO_CITY_CREATED',
          actorId: mockAdminId,
          actorType: 'ADMIN',
          entityType: 'City',
          entityId: mockCity.id,
          ipAddress: '10.0.0.1',
          payload: {
            nameAr: 'الرياض',
            nameEn: 'Riyadh',
            isActive: true
          }
        }
      });
    });

    it('should throw ConflictException if city nameAr or nameEn already exists', async () => {
      prisma.city.findFirst.mockResolvedValue(mockCity);

      await expect(
        service.adminCreateCity(
          { nameAr: 'الرياض', nameEn: 'Riyadh', isActive: true },
          mockAdminId
        )
      ).rejects.toThrow(ConflictException);

      try {
        await service.adminCreateCity(
          { nameAr: 'الرياض', nameEn: 'Riyadh', isActive: true },
          mockAdminId
        );
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: GEO_CITY_DUPLICATE_NAME
        });
      }
    });
  });

  describe('adminUpdateCity', () => {
    it('should update city and create AuditLog entry', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.city.findFirst.mockResolvedValue(null);
      const updatedCity = { ...mockCity, isActive: false };
      prisma.city.update.mockResolvedValue(updatedCity);

      const result = await service.adminUpdateCity(
        mockValidCityId,
        { isActive: false },
        mockAdminId,
        '127.0.0.1'
      );

      expect(result).toEqual(updatedCity);
      expect(prisma.city.update).toHaveBeenCalledWith({
        where: { id: mockValidCityId },
        data: { isActive: false }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GEO_CITY_UPDATED',
          actorId: mockAdminId,
          actorType: 'ADMIN',
          entityType: 'City',
          entityId: mockValidCityId,
          ipAddress: '127.0.0.1',
          payload: {
            oldValues: {
              nameAr: mockCity.nameAr,
              nameEn: mockCity.nameEn,
              isActive: mockCity.isActive
            },
            newValues: {
              isActive: false
            }
          }
        }
      });
    });

    it('should throw NotFoundException if city does not exist or invalid UUID', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(
        service.adminUpdateCity(mockValidCityId, { nameAr: 'جدة' }, mockAdminId)
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.adminUpdateCity('invalid-uuid', { nameAr: 'جدة' }, mockAdminId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated name conflicts with another city', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.city.findFirst.mockResolvedValue({ id: 'other-city-id', nameAr: 'جدة' });

      await expect(
        service.adminUpdateCity(mockValidCityId, { nameAr: 'جدة' }, mockAdminId)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('adminGetDistrictsByCity', () => {
    it('should return all districts under a city regardless of active status', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.district.findMany.mockResolvedValue([mockDistrict, { ...mockDistrict, id: 'd2', isActive: false }]);

      const result = await service.adminGetDistrictsByCity(mockValidCityId);

      expect(result).toHaveLength(2);
      expect(prisma.district.findMany).toHaveBeenCalledWith({
        where: { cityId: mockValidCityId },
        orderBy: { nameAr: 'asc' }
      });
    });

    it('should throw NotFoundException if city not found', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(service.adminGetDistrictsByCity(mockValidCityId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminCreateDistrict', () => {
    it('should successfully create district and create AuditLog entry', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.district.findFirst.mockResolvedValue(null);
      prisma.district.create.mockResolvedValue(mockDistrict);

      const result = await service.adminCreateDistrict(
        {
          cityId: mockValidCityId,
          nameAr: 'الملقا',
          nameEn: 'Al-Malqa',
          isActive: true
        },
        mockAdminId,
        '10.0.0.2'
      );

      expect(result).toEqual(mockDistrict);
      expect(prisma.district.create).toHaveBeenCalledWith({
        data: {
          cityId: mockValidCityId,
          nameAr: 'الملقا',
          nameEn: 'Al-Malqa',
          isActive: true
        }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GEO_DISTRICT_CREATED',
          actorId: mockAdminId,
          actorType: 'ADMIN',
          entityType: 'District',
          entityId: mockDistrict.id,
          ipAddress: '10.0.0.2',
          payload: {
            cityId: mockValidCityId,
            nameAr: 'الملقا',
            nameEn: 'Al-Malqa',
            isActive: true
          }
        }
      });
    });

    it('should throw NotFoundException if parent city does not exist', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(
        service.adminCreateDistrict(
          { cityId: mockValidCityId, nameAr: 'الملقا', nameEn: 'Al-Malqa', isActive: true },
          mockAdminId
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if district nameAr already exists in city', async () => {
      prisma.city.findUnique.mockResolvedValue(mockCity);
      prisma.district.findFirst.mockResolvedValue(mockDistrict);

      await expect(
        service.adminCreateDistrict(
          { cityId: mockValidCityId, nameAr: 'الملقا', nameEn: 'Al-Malqa', isActive: true },
          mockAdminId
        )
      ).rejects.toThrow(ConflictException);

      try {
        await service.adminCreateDistrict(
          { cityId: mockValidCityId, nameAr: 'الملقا', nameEn: 'Al-Malqa', isActive: true },
          mockAdminId
        );
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: GEO_DISTRICT_DUPLICATE_NAME
        });
      }
    });
  });

  describe('adminUpdateDistrict', () => {
    it('should update district and create AuditLog entry', async () => {
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.district.findFirst.mockResolvedValue(null);
      const updatedDistrict = { ...mockDistrict, isActive: false };
      prisma.district.update.mockResolvedValue(updatedDistrict);

      const result = await service.adminUpdateDistrict(
        mockValidDistrictId,
        { isActive: false },
        mockAdminId,
        '10.0.0.3'
      );

      expect(result).toEqual(updatedDistrict);
      expect(prisma.district.update).toHaveBeenCalledWith({
        where: { id: mockValidDistrictId },
        data: { isActive: false }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'GEO_DISTRICT_UPDATED',
          actorId: mockAdminId,
          actorType: 'ADMIN',
          entityType: 'District',
          entityId: mockValidDistrictId,
          ipAddress: '10.0.0.3',
          payload: {
            oldValues: {
              nameAr: mockDistrict.nameAr,
              nameEn: mockDistrict.nameEn,
              isActive: mockDistrict.isActive
            },
            newValues: {
              isActive: false
            }
          }
        }
      });
    });

    it('should throw NotFoundException if district does not exist or invalid UUID', async () => {
      prisma.district.findUnique.mockResolvedValue(null);

      await expect(
        service.adminUpdateDistrict(mockValidDistrictId, { nameAr: 'الياسمين' }, mockAdminId)
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.adminUpdateDistrict('invalid-uuid', { nameAr: 'الياسمين' }, mockAdminId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated name conflicts with another district in the same city', async () => {
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.district.findFirst.mockResolvedValue({ id: 'other-district-id', nameAr: 'الياسمين' });

      await expect(
        service.adminUpdateDistrict(mockValidDistrictId, { nameAr: 'الياسمين' }, mockAdminId)
      ).rejects.toThrow(ConflictException);
    });
  });
});
