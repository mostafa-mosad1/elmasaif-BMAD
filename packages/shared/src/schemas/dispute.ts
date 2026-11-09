import { z } from 'zod';
import { DISPUTE_RESOLUTION_ACTION } from '../constants/deal';

export const cancelDealByBuyerSchema = z.object({
  reason: z.string().trim().max(500, 'سبب الإلغاء يجب ألا يتجاوز 500 حرف').optional(),
});

export type CancelDealByBuyerInput = z.infer<typeof cancelDealByBuyerSchema>;

export const sellerCancelRequestSchema = z.object({
  reason: z
    .string({ required_error: 'سبب طلب الإلغاء مطلوب' })
    .trim()
    .min(10, 'سبب طلب الإلغاء يجب ألا يقل عن 10 أحرف')
    .max(500, 'سبب طلب الإلغاء يجب ألا يتجاوز 500 حرف'),
});

export type SellerCancelRequestInput = z.infer<typeof sellerCancelRequestSchema>;

export const rejectSellerCancelSchema = z.object({
  note: z
    .string({ required_error: 'ملاحظة رفض طلب الإلغاء مطلوبة' })
    .trim()
    .min(5, 'ملاحظة الرفض يجب ألا تقل عن 5 أحرف')
    .max(1000, 'ملاحظة الرفض يجب ألا تتجاوز 1000 حرف'),
});

export type RejectSellerCancelInput = z.infer<typeof rejectSellerCancelSchema>;

export const fileDisputeSchema = z.object({
  reason: z
    .string({ required_error: 'سبب النزاع مطلوب' })
    .trim()
    .min(10, 'سبب النزاع يجب ألا يقل عن 10 أحرف')
    .max(1000, 'سبب النزاع يجب ألا يتجاوز 1000 حرف'),
});

export type FileDisputeInput = z.infer<typeof fileDisputeSchema>;

export const adjudicateDisputeSchema = z
  .object({
    action: z.enum(
      [
        DISPUTE_RESOLUTION_ACTION.COMPLETE,
        DISPUTE_RESOLUTION_ACTION.CANCEL,
        DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW,
      ],
      {
        required_error: 'إجراء البت في النزاع مطلوب',
      },
    ),
    notes: z
      .string({ required_error: 'الملاحظات الإدارية لقرار النزاع مطلوبة' })
      .trim()
      .min(5, 'الملاحظات الإدارية يجب ألا تقل عن 5 أحرف')
      .max(2000, 'الملاحظات الإدارية يجب ألا تتجاوز 2000 حرف'),
    newDeadlineHours: z
      .number()
      .int('ساعات المهلة يجب أن تكون عدداً صحيحاً')
      .min(1, 'ساعات المهلة يجب ألا تقل عن ساعة واحدة')
      .max(168, 'ساعات المهلة يجب ألا تتجاوز 168 ساعة (أسبوع)')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.action === DISPUTE_RESOLUTION_ACTION.RETURN_TO_REVIEW) {
        return typeof data.newDeadlineHours === 'number' && data.newDeadlineHours > 0;
      }
      return true;
    },
    {
      message: 'يلزم تحديد ساعات تمديد المهلة عند إعادة الصفقة للتدقيق',
      path: ['newDeadlineHours'],
    },
  );

export type AdjudicateDisputeInput = z.infer<typeof adjudicateDisputeSchema>;

export const forceUnlockDisputeSchema = z.object({
  reason: z
    .string({ required_error: 'سبب فك الحجز الإجباري مطلوب' })
    .trim()
    .min(5, 'سبب فك الحجز يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب فك الحجز يجب ألا يتجاوز 500 حرف'),
});

export type ForceUnlockDisputeInput = z.infer<typeof forceUnlockDisputeSchema>;

