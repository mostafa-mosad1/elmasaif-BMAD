import { Test, TestingModule } from '@nestjs/testing';
import { GeoController } from '../geo.controller';
import { GeoService } from '../geo.service';

describe('GeoController', () => {
  let controller: GeoController;
  let service: {
    getCities: jest.Mock;
    getDistrictsByCity: jest.Mock;
    getGeoTree: jest.Mock;
  };

  const mockCityId = '11111111-0000-4000-8000-000000000001';
  const mockCities = [
    {
      id: mockCityId,
      nameAr: 'الرياض',
      nameEn: 'Riyadh',
      isActive: true
    }
  ];

  const mockDistricts = [
    {
      id: '22222222-0001-4000-8000-000000000001',
      cityId: mockCityId,
      nameAr: 'الملقا',
      nameEn: 'Al-Malqa',
      isActive: true
    }
  ];

  const mockTree = [
    {
      ...mockCities[0],
      districts: mockDistricts
    }
  ];

  beforeEach(async () => {
    service = {
      getCities: jest.fn(),
      getDistrictsByCity: jest.fn(),
      getGeoTree: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoController],
      providers: [
        {
          provide: GeoService,
          useValue: service
        }
      ]
    }).compile();

    controller = module.get<GeoController>(GeoController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCities', () => {
    it('should delegate to service with includeInactive=false by default', async () => {
      service.getCities.mockResolvedValue(mockCities);

      const result = await controller.getCities();

      expect(service.getCities).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockCities);
    });

    it('should parse includeInactive query param correctly', async () => {
      service.getCities.mockResolvedValue(mockCities);

      await controller.getCities('true');
      expect(service.getCities).toHaveBeenCalledWith(true);

      await controller.getCities('1');
      expect(service.getCities).toHaveBeenCalledWith(true);

      await controller.getCities('false');
      expect(service.getCities).toHaveBeenCalledWith(false);
    });
  });

  describe('getDistrictsByCity', () => {
    it('should delegate to service with cityId and includeInactive=false', async () => {
      service.getDistrictsByCity.mockResolvedValue(mockDistricts);

      const result = await controller.getDistrictsByCity(mockCityId);

      expect(service.getDistrictsByCity).toHaveBeenCalledWith(mockCityId, false);
      expect(result).toEqual(mockDistricts);
    });

    it('should pass includeInactive=true when specified', async () => {
      service.getDistrictsByCity.mockResolvedValue(mockDistricts);

      const result = await controller.getDistrictsByCity(mockCityId, 'true');

      expect(service.getDistrictsByCity).toHaveBeenCalledWith(mockCityId, true);
      expect(result).toEqual(mockDistricts);
    });
  });

  describe('getGeoTree', () => {
    it('should delegate to service and return hierarchical tree', async () => {
      service.getGeoTree.mockResolvedValue(mockTree);

      const result = await controller.getGeoTree();

      expect(service.getGeoTree).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockTree);
    });

    it('should pass includeInactive=true to getGeoTree when specified', async () => {
      service.getGeoTree.mockResolvedValue(mockTree);

      const result = await controller.getGeoTree('true');

      expect(service.getGeoTree).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockTree);
    });
  });
});
