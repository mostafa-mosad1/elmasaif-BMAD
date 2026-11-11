import { z } from 'zod';

/**
 * Story 6.5 / FR-52, UC-69, AC-8: Administrative review moderation schema.
 * Allows an authorized administrator to toggle visibility (`isHidden`) with a mandatory justification.
 */
export const moderateReviewSchema = z.object({
  isHidden: z.boolean({
    required_error: 'حالة الحجب مطلوبة',
    invalid_type_error: 'حالة الحجب يجب أن تكون قيمة منطقية',
  }),
  reason: z
    .string({
      required_error: 'سبب الإجراء الإداري مطلوب',
      invalid_type_error: 'سبب الإجراء الإداري يجب أن يكون نصاً',
    })
    .trim()
    .min(3, 'سبب الإجراء يجب ألا يقل عن 3 أحرف')
    .max(500, 'سبب الإجراء يجب ألا يتجاوز 500 حرف'),
});

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

