import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOCK_MOCK_DISALLOWED_IN_PRODUCTION } from '@elmasaif/shared';
import { ClockDevController } from '../clock-dev.controller';
import { ClockService } from '../clock.service';

describe('ClockDevController', () => {
  let devController: ClockDevController;
  let prodController: ClockDevController;
  let mockClockService: jest.Mocked<ClockService>;
  let mockDevConfig: Partial<ConfigService>;
  let mockProdConfig: Partial<ConfigService>;

  const dummyStatus = {
    now: '2026-10-28T14:50:00.000Z',
    realSystemTime: '2026-10-28T14:50:00.000Z',
    isMocked: false,
    offsetMs: 0
  };

  beforeEach(() => {
    mockClockService = {
      getStatus: jest.fn().mockReturnValue(dummyStatus),
      advanceBy: jest.fn().mockReturnValue(new Date()),
      setTime: jest.fn().mockReturnValue(new Date()),
      reset: jest.fn().mockReturnValue(new Date())
    } as unknown as jest.Mocked<ClockService>;

    mockDevConfig = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'development' : undefined))
    };

    mockProdConfig = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : undefined))
    };

    devController = new ClockDevController(mockClockService, mockDevConfig as ConfigService);
    prodController = new ClockDevController(mockClockService, mockProdConfig as ConfigService);
  });

  describe('Non-Production Operations', () => {
    it('GET /dev/clock should return current clock status', async () => {
      const result = await devController.getClockStatus();
      expect(result).toEqual(dummyStatus);
      expect(mockClockService.getStatus).toHaveBeenCalled();
    });

    it('POST /dev/clock/advance should advance clock and return status', async () => {
      const result = await devController.advanceClock({ hours: 1, minutes: 30 });
      // 1 hour (3600000) + 30 min (1800000) = 5400000 ms
      expect(mockClockService.advanceBy).toHaveBeenCalledWith(5400000);
      expect(result).toEqual(dummyStatus);
    });

    it('POST /dev/clock/set should set virtual time and return status', async () => {
      const iso = '2026-10-30T10:00:00.000Z';
      const result = await devController.setClock({ isoDate: iso });
      expect(mockClockService.setTime).toHaveBeenCalledWith(iso);
      expect(result).toEqual(dummyStatus);
    });

    it('POST /dev/clock/reset should reset virtual clock and return status', async () => {
      const result = await devController.resetClock();
      expect(mockClockService.reset).toHaveBeenCalled();
      expect(result).toEqual(dummyStatus);
    });
  });

  describe('Production Guard', () => {
    it('GET /dev/clock in production should throw 403 Forbidden with CLOCK_MOCK_DISALLOWED_IN_PRODUCTION', async () => {
      try {
        await prodController.getClockStatus();
        fail('Should have thrown ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as any;
        expect(res.code).toBe(CLOCK_MOCK_DISALLOWED_IN_PRODUCTION);
      }
    });

    it('POST /dev/clock/advance in production should throw 403 Forbidden', async () => {
      try {
        await prodController.advanceClock({ hours: 1 });
        fail('Should have thrown ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as any;
        expect(res.code).toBe(CLOCK_MOCK_DISALLOWED_IN_PRODUCTION);
      }
    });

    it('POST /dev/clock/set in production should throw 403 Forbidden', async () => {
      try {
        await prodController.setClock({ isoDate: '2026-10-30T10:00:00.000Z' });
        fail('Should have thrown ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as any;
        expect(res.code).toBe(CLOCK_MOCK_DISALLOWED_IN_PRODUCTION);
      }
    });

    it('POST /dev/clock/reset in production should throw 403 Forbidden', async () => {
      try {
        await prodController.resetClock();
        fail('Should have thrown ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as any;
        expect(res.code).toBe(CLOCK_MOCK_DISALLOWED_IN_PRODUCTION);
      }
    });
  });
});
