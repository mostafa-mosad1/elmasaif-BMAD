import { z } from 'zod';
import { FraudEventType, FraudSeverity, FraudStatus } from '../enums/fraud';

export const createFraudLogSchema = z.object({
  targetUserId: z.string().uuid('معرف المستخدم غير صحيح').optional().nullable(),
  targetListingId: z.string().uuid('معرف العقار غير صحيح').optional().nullable(),
  targetDealId: z.string().uuid('معرف الصفقة غير صحيح').optional().nullable(),
  eventType: z.nativeEnum(FraudEventType),
  severity: z.nativeEnum(FraudSeverity),
  detectedReasons: z.array(z.string().min(1)).min(1, 'يجب تحديد سبب واحد على الأقل'),
  description: z.string().min(10, 'الوصف يجب ألا يقل عن 10 أحرف'),
  penaltySar: z
    .union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)])
    .pipe(z.coerce.number().positive('مبلغ الغرامة يجب أن يكون أكبر من صفر'))
    .optional()
    .nullable(),
  penaltyReason: z.string().optional().nullable(),
  suspendMarketer: z.boolean().optional(),
});

export const resolveFraudLogSchema = z.object({
  status: z.enum([FraudStatus.RESOLVED, FraudStatus.DISMISSED]),
  resolutionNotes: z.string().min(5, 'ملاحظات المعالجة يجب ألا تقل عن 5 أحرف'),
  penaltySar: z
    .union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)])
    .pipe(z.coerce.number().positive('مبلغ الغرامة يجب أن يكون أكبر من صفر'))
    .optional()
    .nullable(),
  penaltyReason: z.string().optional().nullable(),
  suspendMarketer: z.boolean().optional(),
});

