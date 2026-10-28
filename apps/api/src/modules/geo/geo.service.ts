import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}
