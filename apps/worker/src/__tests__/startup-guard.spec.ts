import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertWorkerProductionSafety } from '../startup-guard';
import { workerClock } from '../clock';

describe('Worker Startup Guard & Clock', () => {
  const originalEnv = { ...process.env };
  let mockExit: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit called with ${code}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('assertWorkerProductionSafety', () => {
    it('should exit with 1 if NODE_ENV=production and ENABLE_MOCK_CLOCK=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_MOCK_CLOCK = 'true';

      expect(() => assertWorkerProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with 1 if NODE_ENV=production and OTP_PROVIDER=static', () => {
      process.env.NODE_ENV = 'production';
      process.env.OTP_PROVIDER = 'static';

      expect(() => assertWorkerProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with 1 if NODE_ENV=production and ENABLE_STATIC_OTP=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_STATIC_OTP = 'true';

      expect(() => assertWorkerProductionSafety()).toThrow('process.exit called with 1');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass cleanly in production with secure configurations', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_MOCK_CLOCK = 'false';
      process.env.OTP_PROVIDER = 'unifonic';
      process.env.ENABLE_STATIC_OTP = 'false';

      expect(() => assertWorkerProductionSafety()).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should allow dev configurations when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_MOCK_CLOCK = 'true';
      process.env.OTP_PROVIDER = 'static';
      process.env.ENABLE_STATIC_OTP = 'true';

      expect(() => assertWorkerProductionSafety()).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('workerClock', () => {
    it('should provide now() returning Date instance', () => {
      const now = workerClock.now();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeCloseTo(Date.now(), -3);
    });

    it('should provide nowIso() returning ISO 8601 string', () => {
      const iso = workerClock.nowIso();
      expect(typeof iso).toBe('string');
      expect(new Date(iso).getTime()).toBeCloseTo(Date.now(), -3);
    });
  });
});
