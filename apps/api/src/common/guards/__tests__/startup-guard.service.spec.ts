import { ConfigService } from '@nestjs/config';
import { ClockService } from '../../clock/clock.service';
import { StartupGuardService } from '../startup-guard.service';

describe('StartupGuardService', () => {
  let mockExit: jest.SpyInstance;
  let mockError: jest.SpyInstance;
  let mockWarn: jest.SpyInstance;
  let mockLog: jest.SpyInstance;

  beforeEach(() => {
    // Intercept process.exit to prevent test runner from exiting
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new Error(`process.exit called with ${code}`);
    });
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockWarn.mockRestore();
    mockLog.mockRestore();
  });

  function createService(envConfig: Record<string, string>, isMocked = false): StartupGuardService {
    const configService = {
      get: jest.fn((key: string) => envConfig[key])
    } as unknown as ConfigService;

    const clockService = {
      isMocked: jest.fn(() => isMocked)
    } as unknown as ClockService;

    return new StartupGuardService(configService, clockService);
  }

  describe('Production Environment Guard (NODE_ENV=production)', () => {
    const validProdConfig: Record<string, string> = {
      NODE_ENV: 'production',
      ENABLE_MOCK_CLOCK: 'false',
      OTP_PROVIDER: 'unifonic',
      ENABLE_STATIC_OTP: 'false',
      JWT_SECRET: 'production-super-secret-key-32chars',
      SESSION_SECRET: 'production-super-session-secret-32chars'
    };

    it('should pass cleanly when all production safety checks are met', () => {
      const service = createService(validProdConfig, false);
      expect(() => service.assertProductionSafety()).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should abort process with exit(1) if ENABLE_MOCK_CLOCK is true', () => {
      const service = createService({ ...validProdConfig, ENABLE_MOCK_CLOCK: 'true' }, false);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should abort process with exit(1) if ClockService is mocked', () => {
      const service = createService(validProdConfig, true);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should abort process with exit(1) if OTP_PROVIDER is static', () => {
      const service = createService({ ...validProdConfig, OTP_PROVIDER: 'static' }, false);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should abort process with exit(1) if ENABLE_STATIC_OTP is true', () => {
      const service = createService({ ...validProdConfig, ENABLE_STATIC_OTP: 'true' }, false);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should abort process with exit(1) if JWT_SECRET is dev-secret placeholder', () => {
      const service = createService({ ...validProdConfig, JWT_SECRET: 'dev-secret' }, false);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should abort process with exit(1) if SESSION_SECRET is dev-session-secret placeholder', () => {
      const service = createService({ ...validProdConfig, SESSION_SECRET: 'dev-session-secret' }, false);
      expect(() => service.assertProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Non-Production Environment (Development / Testing)', () => {
    it('should allow dev OTP and mock clock in development mode without exiting', () => {
      const devConfig: Record<string, string> = {
        NODE_ENV: 'development',
        ENABLE_MOCK_CLOCK: 'true',
        OTP_PROVIDER: 'static',
        ENABLE_STATIC_OTP: 'true',
        JWT_SECRET: 'dev-secret',
        SESSION_SECRET: 'dev-session-secret'
      };

      const service = createService(devConfig, true);
      expect(() => service.assertProductionSafety()).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });
});
