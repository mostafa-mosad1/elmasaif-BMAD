import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { PrismaService } from '../../../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    mockPrismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check (/api/v1/health)', () => {
    it('should return status ok and service identifier', async () => {
      const result = await controller.check();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('elmasaif-api');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('ready (/api/v1/health/ready)', () => {
    it('should return ready and connected when database query succeeds', async () => {
      const result = await controller.ready();
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result.status).toBe('ready');
      expect(result.database).toBe('connected');
      expect(result.timestamp).toBeDefined();
    });

    it('should return not_ready and disconnected when database query fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      const result = await controller.ready();
      expect(result.status).toBe('not_ready');
      expect(result.database).toBe('disconnected');
      expect(result.error).toBe('Connection refused');
      expect(result.timestamp).toBeDefined();
    });
  });
});
