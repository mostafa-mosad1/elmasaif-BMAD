import { z } from 'zod';
import { validateSaudiIban } from './index';

/**
 * Optional Saudi IBAN validator:
 * Allows null, undefined, empty string (clears IBAN), or a valid mod-97 Saudi IBAN.
 */
const optionalSaudiIbanSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine(
    (val) => {
      if (val === null) return true;
      return validateSaudiIban(val);
    },
    {
      message: 'رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)',
    },
  );

/**
 * Administrative update schema for platform settings (Story 8.6 / AC1).
 */
export const updatePlatformSettingsSchema = z
  .object({
    commissionRatePercentage: z
      .number({ invalid_type_error: 'نسبة عمولة المنصة يجب أن تكون رقماً' })
      .min(0.0, 'نسبة العمولة يجب ألا تقل عن 0.00%')
      .max(25.0, 'نسبة العمولة يجب ألا تتجاوز 25.00%')
      .optional(),
    fixedFeeAmountSar: z
      .number({ invalid_type_error: 'المبلغ الثابت يجب أن يكون رقماً' })
      .min(0.0, 'المبلغ الثابت يجب ألا يقل عن 0.00 ريال')
      .max(50000.0, 'المبلغ الثابت يجب ألا يتجاوز 50,000 ريال')
      .optional(),
    ownerContractFeeSar: z
      .number({ invalid_type_error: 'رسوم عقد المالك يجب أن تكون رقماً' })
      .min(0.0, 'رسوم العقد يجب ألا تقل عن 0.00 ريال')
      .max(20000.0, 'رسوم العقد يجب ألا تتجاوز 20,000 ريال')
      .optional(),
    vatRatePercentage: z
      .number({ invalid_type_error: 'نسبة ضريبة القيمة المضافة يجب أن تكون رقماً' })
      .min(0.0, 'نسبة الضريبة يجب ألا تقل عن 0.00%')
      .max(50.0, 'نسبة الضريبة يجب ألا تتجاوز 50.00%')
      .optional(),
    paymentWindowHours: z
      .number({ invalid_type_error: 'مهلة السداد يجب أن تكون رقماً صحيحاً' })
      .int('مهلة السداد يجب أن تكون بالساعات الصحيحة')
      .min(1, 'مهلة السداد يجب ألا تقل عن ساعة واحدة')
      .max(168, 'مهلة السداد يجب ألا تتجاوز 168 ساعة (7 أيام)')
      .optional(),
    paymentCorrectionHours: z
      .number({ invalid_type_error: 'مهلة تصحيح السداد يجب أن تكون رقماً صحيحاً' })
      .int('مهلة تصحيح السداد يجب أن تكون بالساعات الصحيحة')
      .min(1, 'مهلة تصحيح السداد يجب ألا تقل عن ساعة واحدة')
      .max(72, 'مهلة تصحيح السداد يجب ألا تتجاوز 72 ساعة (3 أيام)')
      .optional(),
    contractFeeDeadlineDays: z
      .number({ invalid_type_error: 'مهلة سداد رسوم العقد يجب أن تكون رقماً صحيحاً' })
      .int('مهلة سداد رسوم العقد يجب أن تكون بالأيام الصحيحة')
      .min(1, 'مهلة سداد رسوم العقد يجب ألا تقل عن يوم واحد')
      .max(30, 'مهلة سداد رسوم العقد يجب ألا تتجاوز 30 يوماً')
      .optional(),
    coolingOffPeriodDays: z
      .number({ invalid_type_error: 'فترة التهدئة لحذف الحساب يجب أن تكون رقماً صحيحاً' })
      .int('فترة التهدئة يجب أن تكون بالأيام الصحيحة')
      .min(1, 'فترة التهدئة يجب ألا تقل عن يوم واحد')
      .max(90, 'فترة التهدئة يجب ألا تتجاوز 90 يوماً')
      .optional(),
    dealReviewSlaAlertHours: z
      .number()
      .int()
      .min(1, 'مهلة تنبيه مراجعة الصفقات يجب ألا تقل عن ساعة')
      .max(24, 'مهلة تنبيه مراجعة الصفقات يجب ألا تتجاوز 24 ساعة')
      .optional(),
    dealReviewSlaEscalationHours: z
      .number()
      .int()
      .min(2, 'مهلة تصعيد مراجعة الصفقات يجب ألا تقل عن ساعتين')
      .max(48, 'مهلة تصعيد مراجعة الصفقات يجب ألا تتجاوز 48 ساعة')
      .optional(),
    dealReviewSlaSuperAdminHours: z
      .number()
      .int()
      .min(4, 'المهلة القصوى لقرار الإدارة العليا يجب ألا تقل عن 4 ساعات')
      .max(96, 'المهلة القصوى لقرار الإدارة العليا يجب ألا تتجاوز 96 ساعة')
      .optional(),
    ticketSlaFirstResponseHours: z
      .number()
      .int()
      .min(1, 'مهلة الاستجابة الأولى للتذاكر يجب ألا تقل عن ساعة')
      .max(24, 'مهلة الاستجابة الأولى للتذاكر يجب ألا تتجاوز 24 ساعة')
      .optional(),
    ticketSlaResolutionHours: z
      .number()
      .int()
      .min(4, 'مهلة حل التذاكر يجب ألا تقل عن 4 ساعات')
      .max(168, 'مهلة حل التذاكر يجب ألا تتجاوز 168 ساعة')
      .optional(),
    taskClaimLeaseMinutes: z
      .number()
      .int()
      .min(5, 'مدة قفل حجز المهام يجب ألا تقل عن 5 دقائق')
      .max(60, 'مدة قفل حجز المهام يجب ألا تتجاوز 60 دقيقة')
      .optional(),
    taskClaimHeartbeatMinutes: z
      .number()
      .int()
      .min(1, 'فترة نبضات التجديد يجب ألا تقل عن دقيقة')
      .max(15, 'فترة نبضات التجديد يجب ألا تتجاوز 15 دقيقة')
      .optional(),
    fraudRejectedProofThreshold: z
      .number()
      .int()
      .min(1, 'الحد الأدنى لمؤشر الاحتيال يجب ألا يقل عن 1')
      .max(10, 'الحد الأقصى لمؤشر الاحتيال يجب ألا يتجاوز 10')
      .optional(),
    fraudWindowHours: z
      .number()
      .int()
      .min(12, 'نافذة رصد الاحتيال يجب ألا تقل عن 12 ساعة')
      .max(336, 'نافذة رصد الاحتيال يجب ألا تتجاوز 336 ساعة (14 يوماً)')
      .optional(),
    platformCollectionIban: optionalSaudiIbanSchema,
    platformAccountHolderName: z
      .string()
      .trim()
      .min(3, 'اسم صاحب الحساب يجب ألا يقل عن 3 أحرف')
      .max(100, 'اسم صاحب الحساب يجب ألا يتجاوز 100 حرف')
      .optional()
      .nullable(),
    platformBankName: z.string().trim().max(100).optional().nullable(),
    justificationReason: z
      .string({ required_error: 'سبب التعديل إلزامي لأغراض التدقيق الرقابي' })
      .trim()
      .min(5, 'سبب التعديل يجب ألا يقل عن 5 أحرف')
      .max(1000, 'سبب التعديل يجب ألا يتجاوز 1000 حرف'),
  })
  .refine(
    (data) => {
      if (
        data.dealReviewSlaAlertHours !== undefined &&
        data.dealReviewSlaEscalationHours !== undefined
      ) {
        return data.dealReviewSlaAlertHours < data.dealReviewSlaEscalationHours;
      }
      return true;
    },
    {
      message: 'مهلة تنبيه مراجعة الصفقات يجب أن تكون أقل من مهلة التصعيد',
      path: ['dealReviewSlaAlertHours'],
    },
  )
  .refine(
    (data) => {
      if (
        data.dealReviewSlaEscalationHours !== undefined &&
        data.dealReviewSlaSuperAdminHours !== undefined
      ) {
        return data.dealReviewSlaEscalationHours < data.dealReviewSlaSuperAdminHours;
      }
      return true;
    },
    {
      message: 'مهلة تصعيد مراجعة الصفقات يجب أن تكون أقل من المهلة القصوى لقرار الإدارة العليا',
      path: ['dealReviewSlaEscalationHours'],
    },
  )
  .refine(
    (data) => {
      if (
        data.taskClaimHeartbeatMinutes !== undefined &&
        data.taskClaimLeaseMinutes !== undefined
      ) {
        return data.taskClaimHeartbeatMinutes < data.taskClaimLeaseMinutes;
      }
      return true;
    },
    {
      message: 'فترة نبضات التجديد يجب أن تكون أقل من مدة قفل حجز المهام',
      path: ['taskClaimHeartbeatMinutes'],
    },
  );

/**
 * Public platform settings schema for consumer-facing widgets (calculator, property cards).
 */
export const publicPlatformSettingsSchema = z.object({
  commissionRate: z.number().min(0).max(0.25),
  commissionRatePercentage: z.number().min(0).max(25),
  fixedFeeAmountSar: z.number().min(0),
  ownerContractFeeSar: z.number().min(0),
  vatRatePercentage: z.number().min(0).max(50),
  paymentWindowHours: z.number().int().min(1),
});

