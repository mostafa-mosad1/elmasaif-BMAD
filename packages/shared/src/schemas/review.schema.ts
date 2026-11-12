import { z } from 'zod';

/**
 * Story 6.5 & Story 8.4 / FR-19, FR-52, AD-6, AD-8:
 * Canonical review moderation constants, status codes, and Zod schemas.
 */
export const REVIEW_MODERATION_MIN_REASON_LENGTH = 3;
export const REVIEW_MODERATION_MAX_REASON_LENGTH = 500;
export const REVIEW_VISIBILITY_FILTERS = ['ALL', 'VISIBLE', 'HIDDEN'] as const;

export const REVIEW_NOT_FOUND = 'REVIEW_NOT_FOUND';
export const REVIEW_HIDDEN = 'REVIEW_HIDDEN';
export const REVIEW_UNHIDDEN = 'REVIEW_UNHIDDEN';
export const REVIEWS_MODERATION_QUEUE_RETRIEVED = 'REVIEWS_MODERATION_QUEUE_RETRIEVED';
export const REVIEW_MODERATION_DETAIL_RETRIEVED = 'REVIEW_MODERATION_DETAIL_RETRIEVED';

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
    .min(
      REVIEW_MODERATION_MIN_REASON_LENGTH,
      'سبب الإجراء يجب ألا يقل عن 3 أحرف',
    )
    .max(
      REVIEW_MODERATION_MAX_REASON_LENGTH,
      'سبب الإجراء يجب ألا يتجاوز 500 حرف',
    ),
});

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

/**
 * Story 8.4 / AD-2, AD-8: Explicit semantic action payload for `POST .../hide` and `POST .../restore`.
 */
export const reviewModerationReasonSchema = z.object({
  reason: z
    .string({
      required_error: 'سبب الإجراء الإداري مطلوب',
      invalid_type_error: 'سبب الإجراء الإداري يجب أن يكون نصاً',
    })
    .trim()
    .min(
      REVIEW_MODERATION_MIN_REASON_LENGTH,
      'سبب الإجراء يجب ألا يقل عن 3 أحرف',
    )
    .max(
      REVIEW_MODERATION_MAX_REASON_LENGTH,
      'سبب الإجراء يجب ألا يتجاوز 500 حرف',
    ),
});

export type ReviewModerationReasonInput = z.infer<
  typeof reviewModerationReasonSchema
>;

/**
 * Story 8.4 / AC-1, AC-2: Query filter schema for `GET /api/v1/admin/reviews`.
 */
export const adminReviewQueueQuerySchema = z.object({
  visibility: z
    .enum(REVIEW_VISIBILITY_FILTERS, {
      errorMap: () => ({ message: 'فلتر حالة الظهور غير صالح' }),
    })
    .optional()
    .default('ALL'),
  score: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return Number(val);
    })
    .refine(
      (val) =>
        val === undefined || (Number.isInteger(val) && val >= 1 && val <= 5),
      { message: 'درجة التقييم يجب أن تكون رقماً صحيحاً بين 1 و 5' },
    ),
  lowScoreOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return val;
      return val === 'true';
    }),
  targetUserId: z.string().trim().min(1).optional(),
  search: z
    .string()
    .trim()
    .max(120, 'نص البحث يجب ألا يتجاوز 120 حرفاً')
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type AdminReviewQueueQueryInput = z.infer<
  typeof adminReviewQueueQuerySchema
>;
