import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCityInput,
  UpdateCityInput,
  CreateDistrictInput,
  UpdateDistrictInput,
  AdminCityListItem,
  GEO_CITY_DUPLICATE_NAME,
  GEO_DISTRICT_DUPLICATE_NAME,
  GEO_CITY_NOT_FOUND,
  GEO_DISTRICT_NOT_FOUND
} from '@elmasaif/shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all cities ordered by Arabic name.
   * By default, returns only active cities unless includeInactive is true.
   */
  async getCities(includeInactive = false) {
    return this.prisma.city.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { nameAr: 'asc' }
    });
  }

  /**
   * Retrieves all districts for a given city ID ordered by Arabic name.
   * Throws NotFoundException if city does not exist or is inactive (when includeInactive=false).
   */
  async getDistrictsByCity(cityId: string, includeInactive = false) {
    if (!cityId || !UUID_REGEX.test(cityId)) {
      throw new NotFoundException({
        code: 'CITY_NOT_FOUND',
        message: 'المدينة المحددة غير موجودة',
        details: { cityId }
      });
    }

    const city = await this.prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city || (!includeInactive && !city.isActive)) {
      throw new NotFoundException({
        code: 'CITY_NOT_FOUND',
        message: 'المدينة المحددة غير موجودة',
        details: { cityId }
      });
    }

    return this.prisma.district.findMany({
      where: {
        cityId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { nameAr: 'asc' }
    });
  }

  /**
   * Retrieves full hierarchical cascading tree of cities with nested districts.
   * By default, returns only active cities and active districts.
   */
  async getGeoTree(includeInactive = false) {
    return this.prisma.city.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        districts: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: { nameAr: 'asc' }
        }
      },
      orderBy: { nameAr: 'asc' }
    });
  }

  /**
   * Administrative method: Retrieves all cities with total, active, and inactive district breakdown.
   */
  async adminGetCities(): Promise<AdminCityListItem[]> {
    const cities = await this.prisma.city.findMany({
      orderBy: { nameAr: 'asc' },
      include: {
        districts: {
          select: { id: true, isActive: true }
        }
      }
    });

    return cities.map((city) => {
      const activeDistrictsCount = city.districts.filter((d) => d.isActive).length;
      const inactiveDistrictsCount = city.districts.filter((d) => !d.isActive).length;

      return {
        id: city.id,
        nameAr: city.nameAr,
        nameEn: city.nameEn,
        isActive: city.isActive,
        createdAt: city.createdAt,
        _count: {
          districts: city.districts.length
        },
        activeDistrictsCount,
        inactiveDistrictsCount
      };
    });
  }

  /**
   * Administrative method: Creates a new City and logs the action to AuditLog.
   */
  async adminCreateCity(dto: CreateCityInput, adminId: string, ip?: string) {
    const existing = await this.prisma.city.findFirst({
      where: {
        OR: [
          { nameAr: dto.nameAr },
          { nameEn: dto.nameEn }
        ]
      }
    });

    if (existing) {
      throw new ConflictException({
        code: GEO_CITY_DUPLICATE_NAME,
        message: 'اسم المدينة بالعربية أو بالإنجليزية مسجل مسبقاً في النظام'
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const city = await tx.city.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          isActive: dto.isActive !== undefined ? dto.isActive : true
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'GEO_CITY_CREATED',
          actorId: adminId,
          actorType: 'ADMIN',
          entityType: 'City',
          entityId: city.id,
          ipAddress: ip || '127.0.0.1',
          payload: {
            nameAr: city.nameAr,
            nameEn: city.nameEn,
            isActive: city.isActive
          }
        }
      });

      return city;
    });
  }

  /**
   * Administrative method: Updates a City and logs the action to AuditLog.
   */
  async adminUpdateCity(id: string, dto: UpdateCityInput, adminId: string, ip?: string) {
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة المحددة غير موجودة',
        details: { cityId: id }
      });
    }

    const city = await this.prisma.city.findUnique({
      where: { id }
    });

    if (!city) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة المحددة غير موجودة',
        details: { cityId: id }
      });
    }

    if (dto.nameAr || dto.nameEn) {
      const conflict = await this.prisma.city.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.nameAr ? [{ nameAr: dto.nameAr }] : []),
            ...(dto.nameEn ? [{ nameEn: dto.nameEn }] : [])
          ]
        }
      });

      if (conflict) {
        throw new ConflictException({
          code: GEO_CITY_DUPLICATE_NAME,
          message: 'اسم المدينة بالعربية أو بالإنجليزية مسجل مسبقاً لمدينة أخرى'
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.city.update({
        where: { id },
        data: {
          ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
          ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'GEO_CITY_UPDATED',
          actorId: adminId,
          actorType: 'ADMIN',
          entityType: 'City',
          entityId: id,
          ipAddress: ip || '127.0.0.1',
          payload: {
            oldValues: {
              nameAr: city.nameAr,
              nameEn: city.nameEn,
              isActive: city.isActive
            },
            newValues: dto
          }
        }
      });

      return updated;
    });
  }

  /**
   * Administrative method: Retrieves all districts for a city (including inactive).
   */
  async adminGetDistrictsByCity(cityId: string) {
    if (!cityId || !UUID_REGEX.test(cityId)) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة المحددة غير موجودة',
        details: { cityId }
      });
    }

    const city = await this.prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة المحددة غير موجودة',
        details: { cityId }
      });
    }

    return this.prisma.district.findMany({
      where: { cityId },
      orderBy: { nameAr: 'asc' }
    });
  }

  /**
   * Administrative method: Creates a District under a City and logs to AuditLog.
   */
  async adminCreateDistrict(dto: CreateDistrictInput, adminId: string, ip?: string) {
    if (!dto.cityId || !UUID_REGEX.test(dto.cityId)) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة التابع لها الحي غير موجودة',
        details: { cityId: dto.cityId }
      });
    }

    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId }
    });

    if (!city) {
      throw new NotFoundException({
        code: GEO_CITY_NOT_FOUND,
        message: 'المدينة التابع لها الحي غير موجودة',
        details: { cityId: dto.cityId }
      });
    }

    const existing = await this.prisma.district.findFirst({
      where: {
        cityId: dto.cityId,
        OR: [
          { nameAr: dto.nameAr },
          { nameEn: dto.nameEn }
        ]
      }
    });

    if (existing) {
      throw new ConflictException({
        code: GEO_DISTRICT_DUPLICATE_NAME,
        message: 'اسم الحي مسجل مسبقاً في هذه المدينة'
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const district = await tx.district.create({
        data: {
          cityId: dto.cityId,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          isActive: dto.isActive !== undefined ? dto.isActive : true
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'GEO_DISTRICT_CREATED',
          actorId: adminId,
          actorType: 'ADMIN',
          entityType: 'District',
          entityId: district.id,
          ipAddress: ip || '127.0.0.1',
          payload: {
            cityId: dto.cityId,
            nameAr: district.nameAr,
            nameEn: district.nameEn,
            isActive: district.isActive
          }
        }
      });

      return district;
    });
  }

  /**
   * Administrative method: Updates a District and logs to AuditLog.
   */
  async adminUpdateDistrict(id: string, dto: UpdateDistrictInput, adminId: string, ip?: string) {
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException({
        code: GEO_DISTRICT_NOT_FOUND,
        message: 'الحي المحدد غير موجود',
        details: { districtId: id }
      });
    }

    const district = await this.prisma.district.findUnique({
      where: { id }
    });

    if (!district) {
      throw new NotFoundException({
        code: GEO_DISTRICT_NOT_FOUND,
        message: 'الحي المحدد غير موجود',
        details: { districtId: id }
      });
    }

    if (dto.nameAr || dto.nameEn) {
      const conflict = await this.prisma.district.findFirst({
        where: {
          cityId: district.cityId,
          id: { not: id },
          OR: [
            ...(dto.nameAr ? [{ nameAr: dto.nameAr }] : []),
            ...(dto.nameEn ? [{ nameEn: dto.nameEn }] : [])
          ]
        }
      });

      if (conflict) {
        throw new ConflictException({
          code: GEO_DISTRICT_DUPLICATE_NAME,
          message: 'اسم الحي مسجل مسبقاً لحي آخر في هذه المدينة'
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.district.update({
        where: { id },
        data: {
          ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
          ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'GEO_DISTRICT_UPDATED',
          actorId: adminId,
          actorType: 'ADMIN',
          entityType: 'District',
          entityId: id,
          ipAddress: ip || '127.0.0.1',
          payload: {
            oldValues: {
              nameAr: district.nameAr,
              nameEn: district.nameEn,
              isActive: district.isActive
            },
            newValues: dto
          }
        }
      });

      return updated;
    });
  }
}
