import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IClockService, ClockStatus } from '@elmasaif/shared';

@Injectable()
export class ClockService implements IClockService, OnModuleInit {
  private readonly logger = new Logger(ClockService.name);
  private virtualOffsetMs = 0;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      this.logger.log('ClockService initialized in PRODUCTION mode (virtual time manipulation locked)');
    } else {
      this.logger.log(`ClockService initialized in ${nodeEnv || 'development'} mode (virtual time manipulation enabled)`);
    }
  }

  now(): Date {
    return new Date(Date.now() + this.virtualOffsetMs);
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  nowTimestamp(): number {
    return this.now().getTime();
  }

  advanceBy(offsetMs: number): Date {
    this.assertNotProduction('Time advancement is strictly forbidden in production');
    if (offsetMs < 0) {
      throw new BadRequestException('Offset must be a non-negative number');
    }
    this.virtualOffsetMs += offsetMs;
    this.logger.warn(`[Clock] Advanced virtual clock by ${offsetMs}ms. New time: ${this.nowIso()}`);
    return this.now();
  }

  advanceHours(hours: number): Date {
    if (hours < 0) {
      throw new BadRequestException('Hours must be non-negative');
    }
    return this.advanceBy(hours * 3600000);
  }

  advanceDays(days: number): Date {
    if (days < 0) {
      throw new BadRequestException('Days must be non-negative');
    }
    return this.advanceBy(days * 86400000);
  }

  setTime(targetDate: Date | string): Date {
    this.assertNotProduction('Time manipulation is strictly forbidden in production');
    const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
    if (isNaN(target.getTime())) {
      throw new BadRequestException('Invalid target date');
    }
    this.virtualOffsetMs = target.getTime() - Date.now();
    this.logger.warn(`[Clock] Set virtual clock to ${target.toISOString()}. Offset: ${this.virtualOffsetMs}ms`);
    return this.now();
  }

  reset(): Date {
    this.assertNotProduction('Time manipulation is strictly forbidden in production');
    this.virtualOffsetMs = 0;
    this.logger.log(`[Clock] Reset virtual clock to real system time: ${this.nowIso()}`);
    return this.now();
  }

  isMocked(): boolean {
    return this.virtualOffsetMs !== 0;
  }

  getOffsetMs(): number {
    return this.virtualOffsetMs;
  }

  getStatus(): ClockStatus {
    return {
      now: this.nowIso(),
      realSystemTime: new Date().toISOString(),
      isMocked: this.isMocked(),
      offsetMs: this.virtualOffsetMs
    };
  }

  private assertNotProduction(actionDescription: string): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      throw new ForbiddenException(actionDescription);
    }
  }
}
