import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock.service';

describe('ClockService', () => {
  let devClockService: ClockService;
  let prodClockService: ClockService;
  let mockDevConfigService: Partial<ConfigService>;
  let mockProdConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockDevConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      })
    };

    mockProdConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      })
    };

    devClockService = new ClockService(mockDevConfigService as ConfigService);
    prodClockService = new ClockService(mockProdConfigService as ConfigService);
  });

  describe('Default State & Real Time Identity', () => {
    it('should return system time within 100ms by default', () => {
      const realBefore = Date.now();
      const clockNow = devClockService.now().getTime();
      const realAfter = Date.now();

      expect(clockNow).toBeGreaterThanOrEqual(realBefore);
      expect(clockNow).toBeLessThanOrEqual(realAfter);
      expect(devClockService.isMocked()).toBe(false);
      expect(devClockService.getOffsetMs()).toBe(0);
    });

    it('should return valid ISO string and timestamp', () => {
      const iso = devClockService.nowIso();
      const timestamp = devClockService.nowTimestamp();

      expect(new Date(iso).getTime()).toBeCloseTo(timestamp, -2);
      expect(typeof timestamp).toBe('number');
    });

    it('should return status object reflecting current real system time', () => {
      const status = devClockService.getStatus();
      expect(status.isMocked).toBe(false);
      expect(status.offsetMs).toBe(0);
      expect(typeof status.now).toBe('string');
      expect(typeof status.realSystemTime).toBe('string');
    });
  });

  describe('Virtual Time Advancement (Non-Production)', () => {
    it('should advance time by milliseconds with advanceBy', () => {
      const initial = devClockService.nowTimestamp();
      devClockService.advanceBy(5000);

      expect(devClockService.isMocked()).toBe(true);
      expect(devClockService.getOffsetMs()).toBe(5000);
      expect(devClockService.nowTimestamp() - initial).toBeGreaterThanOrEqual(5000);
    });

    it('should advance time by hours with advanceHours', () => {
      devClockService.advanceHours(2);
      expect(devClockService.getOffsetMs()).toBe(2 * 3600 * 1000);
      expect(devClockService.isMocked()).toBe(true);
    });

    it('should advance time by days with advanceDays', () => {
      devClockService.advanceDays(3);
      expect(devClockService.getOffsetMs()).toBe(3 * 24 * 3600 * 1000);
      expect(devClockService.isMocked()).toBe(true);
    });

    it('should reject negative numbers with BadRequestException', () => {
      expect(() => devClockService.advanceBy(-100)).toThrow(BadRequestException);
      expect(() => devClockService.advanceHours(-1)).toThrow(BadRequestException);
      expect(() => devClockService.advanceDays(-2)).toThrow(BadRequestException);
    });

    it('should set clock to explicit date with setTime', () => {
      const target = '2026-12-01T12:00:00.000Z';
      const targetTime = new Date(target).getTime();

      devClockService.setTime(target);
      expect(devClockService.isMocked()).toBe(true);
      expect(devClockService.nowTimestamp()).toBeCloseTo(targetTime, -2);
    });

    it('should reject invalid dates with BadRequestException in setTime', () => {
      expect(() => devClockService.setTime('invalid-date-string')).toThrow(BadRequestException);
    });

    it('should reset virtual offset back to 0 with reset', () => {
      devClockService.advanceDays(5);
      expect(devClockService.isMocked()).toBe(true);

      devClockService.reset();
      expect(devClockService.isMocked()).toBe(false);
      expect(devClockService.getOffsetMs()).toBe(0);
    });
  });

  describe('Production Guardrails', () => {
    it('should forbid advanceBy in production', () => {
      expect(() => prodClockService.advanceBy(1000)).toThrow(ForbiddenException);
    });

    it('should forbid advanceHours in production', () => {
      expect(() => prodClockService.advanceHours(1)).toThrow(ForbiddenException);
    });

    it('should forbid advanceDays in production', () => {
      expect(() => prodClockService.advanceDays(1)).toThrow(ForbiddenException);
    });

    it('should forbid setTime in production', () => {
      expect(() => prodClockService.setTime('2026-12-01T12:00:00.000Z')).toThrow(ForbiddenException);
    });

    it('should forbid reset in production if mocked', () => {
      expect(() => prodClockService.reset()).toThrow(ForbiddenException);
    });
  });
});
