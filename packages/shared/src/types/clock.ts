import { z } from 'zod';
import { advanceClockSchema, setClockSchema, clockStatusSchema } from '../schemas/clock.schema';

export type ClockStatus = z.infer<typeof clockStatusSchema>;
export type AdvanceClockDto = z.infer<typeof advanceClockSchema>;
export type SetClockDto = z.infer<typeof setClockSchema>;

export interface IClockService {
  now(): Date;
  nowIso(): string;
  nowTimestamp(): number;
  advanceBy(offsetMs: number): Date;
  advanceHours(hours: number): Date;
  advanceDays(days: number): Date;
  setTime(targetDate: Date | string): Date;
  reset(): Date;
  isMocked(): boolean;
  getOffsetMs(): number;
  getStatus(): ClockStatus;
}
