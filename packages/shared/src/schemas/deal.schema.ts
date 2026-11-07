import { z } from 'zod';
import { PaymentType } from '../enums';
import { DEAL_PAYMENT_STATUS } from '../constants/deal';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/index';

/**
 * Story 5.1 / AC-1, AD-2: final approval is an explicit action endpoint whose subject is the
 * *offer* — no deal id exists before approval, so the offer id travels in the body rather than in
 * the path.
 */
export const finalApproveDealSchema = z.object({
  offerId: z.string().uuid('معرف العرض يجب أن يكون بصيغة UUID صالحة'),
});

/** Story 5.2 / AC-1: the `:id` of every buyer deal route. */
export const dealIdParamSchema = z.object({
  id: z.string().uuid('معرف الصفقة يجب أن يكون بصيغة UUID صالحة'),
});

/**
 * Story 5.2 / AC-7: the `:paymentType` segment. Restricted to the two legs of the dual wire
 * transfer — `OWNER_CONTRACT_FEE` belongs to Story 7.3 and is refused with
 * `DEAL_PAYMENT_TYPE_INVALID`. The members are listed from `PaymentType` rather than from
 * `DEAL_PAYMENT_TYPES` so this schema never participates in the `constants` ↔ `schemas` cycle.
 */
export const dealPaymentTypeSchema = z.enum(
  [PaymentType.PLATFORM_COMMISSION, PaymentType.SELLER_PURCHASE_PRICE],
  { errorMap: () => ({ message: 'نوع دفعة الصفقة غير صالح' }) },
);

/**
 * Story 5.2 / AC-7: the multipart text fields of a receipt upload. `paymentType` travels in the
 * path but is validated here too, so one schema describes the whole request; the two free-text
 * fields are optional (a buyer may not know their bank's reference yet — the admin reads the
 * receipt itself).
 */
export const uploadDealProofSchema = z.object({
  paymentType: dealPaymentTypeSchema,
  bankReferenceCode: z
    .string()
    .trim()
    .max(64, 'رمز المرجع البنكي لا يتجاوز 64 حرفاً')
    .optional(),
  senderBankName: z
    .string()
    .trim()
    .max(100, 'اسم البنك المحوِّل لا يتجاوز 100 حرف')
    .optional(),
});

/*
 * Story 5.3 — the administrative proof-review queue (FR-31, AD-10).
 */

/** AC-1: the `:id` of every admin payment route. */
export const paymentIdParamSchema = z.object({
  id: z.string().uuid('معرف الدفعة يجب أن يكون بصيغة UUID صالحة'),
});

/**
 * AC-1: admin proof-audit queue query. Mirrors `offerQueueQuerySchema`: coerced `page`/`limit`
 * with the shared page-size constants and an optional status filter, restricted to the two
 * queue statuses — filtering for anything else would empty a queue that only ever holds them.
 */
export const paymentQueueQuerySchema = z.object({
  status: z
    .enum([DEAL_PAYMENT_STATUS.PROOF_UPLOADED, DEAL_PAYMENT_STATUS.UNDER_REVIEW], {
      errorMap: () => ({ message: 'حالة التدقيق على الدفعة غير صالحة' }),
    })
    .optional(),
  page: z.coerce
    .number()
    .int('رقم الصفحة يجب أن يكون 1 أو أكثر')
    .min(1, 'رقم الصفحة يجب أن يكون 1 أو أكثر')
    .optional()
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE, `الحد الأقصى لعدد العناصر هو ${MAX_PAGE_SIZE}`)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
});

/**
 * AC-3: a rejection without a documented note is not a decision. Full 5–500 contract, shared
 * so the service and the specs assert against one source (mirrors `adminRejectOfferSchema`).
 */
export const adminRejectPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب الرفض يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب الرفض يجب ألا يتجاوز 500 حرف'),
});

/**
 * Body contract as the route accepts it: a *missing* short reason must surface as
 * `PAYMENT_REJECTION_NOTE_REQUIRED` from the service, not as a generic `VALIDATION_ERROR` from
 * the pipe — so the route pipe stays permissive and the service re-checks the full contract.
 */
export const adminRejectPaymentBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/** AC-7: force-unlocking someone else's audit lease always carries a documented reason. */
export const paymentForceUnlockSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'يجب إدخال سبب معتمد لإلغاء قفل التدقيق (5 أحرف على الأقل)')
    .max(500, 'سبب إلغاء القفل يجب ألا يتجاوز 500 حرف'),
});

/**
 * Story 5.4 / FR-54, UC-30: Buyer rating submission schema.
 * Score must be integer 1..5. Comment is optional, max 500 characters.
 */
export const submitDealRatingSchema = z.object({
  score: z
    .number({ required_error: 'التقييم مطلوب', invalid_type_error: 'التقييم يجب أن يكون رقماً' })
    .int('التقييم يجب أن يكون رقماً صحيحاً')
    .min(1, 'التقييم يجب أن يكون بين 1 و 5 نجوم')
    .max(5, 'التقييم يجب أن يكون بين 1 و 5 نجوم'),
  comment: z
    .string()
    .trim()
    .max(500, 'التعليق يجب ألا يتجاوز 500 حرف')
    .optional(),
});


