import { z } from 'zod';

export const advanceClockSchema = z.object({
  hours: z.number().nonnegative('الساعات يجب ألا تكون قيمة سالبة').optional(),
  minutes: z.number().nonnegative('الدقائق يجب ألا تكون قيمة سالبة').optional(),
  seconds: z.number().nonnegative('الثواني يجب ألا تكون قيمة سالبة').optional(),
  ms: z.number().nonnegative('الأجزاء من الثانية يجب ألا تكون قيمة سالبة').optional()
}).refine(
  (data) => {
    const totalMs = (data.hours ?? 0) * 3600000 +
                    (data.minutes ?? 0) * 60000 +
                    (data.seconds ?? 0) * 1000 +
                    (data.ms ?? 0);
    return totalMs > 0;
  },
  {
    message: 'يجب تحديد فارق زمني إيجابي واحد على الأقل لتقديم الساعة'
  }
);

export const setClockSchema = z.object({
  isoDate: z.string().datetime({ message: 'Must be a valid ISO 8601 date string' })
});

export const clockStatusSchema = z.object({
  now: z.string(),
  realSystemTime: z.string(),
  isMocked: z.boolean(),
  offsetMs: z.number()
});
