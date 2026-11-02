import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGeoController, AdminGeoGuard } from '../admin-geo.controller';
import { GeoService } from '../geo.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { AdminRole, AUTH_NOT_AUTHORIZED } from '@elmasaif/shared';

describe('AdminGeoController', () => {
  let controller: AdminGeoController;
  let guard: AdminGeoGuard;
  let service: {
    adminGetCities: jest.Mock;
    adminCreateCity: jest.Mock;
    adminUpdateCity: jest.Mock;
    adminGetDistrictsByCity: jest.Mock;
    adminCreateDistrict: jest.Mock;
    adminUpdateDistrict: jest.Mock;
  };

  const mockAdmin = {
    id: 'admin-super-id',
    username: 'superadmin',
    email: 'admin@elmasaif.sa',
    fullName: 'المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    isActive: true
  };

  const mockReq = {
    admin: mockAdmin,
    ip: '192.168.1.1'
  };

  const mockCityId = '11111111-0000-4000-8000-000000000001';
  const mockDistrictId = '22222222-0001-4000-8000-000000000001';

  beforeEach(async () => {
    service = {
      adminGetCities: jest.fn(),
      adminCreateCity: jest.fn(),
      adminUpdateCity: jest.fn(),
      adminGetDistrictsByCity: jest.fn(),
      adminCreateDistrict: jest.fn(),
      adminUpdateDistrict: jest.fn()
    };

    guard = new AdminGeoGuard();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGeoController],
      providers: [
        { provide: GeoService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: ClockService, useValue: {} },
        AdminSessionAuthGuard,
        AdminGeoGuard
      ]
    }).compile();

    controller = module.get<AdminGeoController>(AdminGeoController);
  });

  describe('AdminGeoGuard (Geo.Manage RBAC)', () => {
    const makeContext = (admin: any) =>
      ({
        getHandler: () => {},
        getClass: () => AdminGeoController,
        switchToHttp: () => ({
          getRequest: () => ({ admin })
        })
      }) as unknown as ExecutionContext;

    it('allows access to active SUPER_ADMIN', () => {
      expect(guard.canActivate(makeContext(mockAdmin))).toBe(true);
    });

    it('denies access if admin role is not SUPER_ADMIN', () => {
      expect(() =>
        guard.canActivate(makeContext({ ...mockAdmin, role: AdminRole.MODERATOR }))
      ).toThrow(ForbiddenException);

      try {
        guard.canActivate(makeContext({ ...mockAdmin, role: AdminRole.MODERATOR }));
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AUTH_NOT_AUTHORIZED
        });
      }
    });

    it('denies access if admin is inactive or missing', () => {
      expect(() =>
        guard.canActivate(makeContext({ ...mockAdmin, isActive: false }))
      ).toThrow(ForbiddenException);

      expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
    });
  });

  describe('GET /admin/geo/cities', () => {
    it('delegates to geoService.adminGetCities', async () => {
      const mockResult = [{ id: mockCityId, nameAr: 'الرياض', nameEn: 'Riyadh' }];
      service.adminGetCities.mockResolvedValue(mockResult);

      const result = await controller.getCities();
      expect(result).toBe(mockResult);
      expect(service.adminGetCities).toHaveBeenCalled();
    });
  });

  describe('POST /admin/geo/cities', () => {
    it('delegates to geoService.adminCreateCity with admin id and ip', async () => {
      const input = { nameAr: 'الرياض', nameEn: 'Riyadh', isActive: true };
      const created = { id: mockCityId, ...input };
      service.adminCreateCity.mockResolvedValue(created);

      const result = await controller.createCity(input, mockReq);
      expect(result).toBe(created);
      expect(service.adminCreateCity).toHaveBeenCalledWith(input, mockAdmin.id, mockReq.ip);
    });
  });

  describe('PATCH /admin/geo/cities/:id', () => {
    it('delegates to geoService.adminUpdateCity', async () => {
      const input = { isActive: false };
      const updated = { id: mockCityId, nameAr: 'الرياض', nameEn: 'Riyadh', isActive: false };
      service.adminUpdateCity.mockResolvedValue(updated);

      const result = await controller.updateCity(mockCityId, input, mockReq);
      expect(result).toBe(updated);
      expect(service.adminUpdateCity).toHaveBeenCalledWith(mockCityId, input, mockAdmin.id, mockReq.ip);
    });
  });

  describe('GET /admin/geo/cities/:cityId/districts', () => {
    it('delegates to geoService.adminGetDistrictsByCity', async () => {
      const districts = [{ id: mockDistrictId, nameAr: 'النرجس' }];
      service.adminGetDistrictsByCity.mockResolvedValue(districts);

      const result = await controller.getDistrictsByCity(mockCityId);
      expect(result).toBe(districts);
      expect(service.adminGetDistrictsByCity).toHaveBeenCalledWith(mockCityId);
    });
  });

  describe('POST /admin/geo/districts', () => {
    it('delegates to geoService.adminCreateDistrict with admin id and ip', async () => {
      const input = { cityId: mockCityId, nameAr: 'النرجس', nameEn: 'Al-Narjis', isActive: true };
      const created = { id: mockDistrictId, ...input };
      service.adminCreateDistrict.mockResolvedValue(created);

      const result = await controller.createDistrict(input, mockReq);
      expect(result).toBe(created);
      expect(service.adminCreateDistrict).toHaveBeenCalledWith(input, mockAdmin.id, mockReq.ip);
    });
  });

  describe('PATCH /admin/geo/districts/:id', () => {
    it('delegates to geoService.adminUpdateDistrict', async () => {
      const input = { isActive: false };
      const updated = { id: mockDistrictId, isActive: false };
      service.adminUpdateDistrict.mockResolvedValue(updated);

      const result = await controller.updateDistrict(mockDistrictId, input, mockReq);
      expect(result).toBe(updated);
      expect(service.adminUpdateDistrict).toHaveBeenCalledWith(mockDistrictId, input, mockAdmin.id, mockReq.ip);
    });
  });
});

