import { z } from 'zod';
import { MIN_LISTING_PRICE_SAR, MAX_LISTING_PRICE_SAR } from '../constants/listing';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { OFFER_REJECTION_REASONS } from '../constants/offer';
import { OfferStatus } from '../enums';

/**
 * Buyer offer submission (Story 4.1 / FR-25). Money mirrors the
 * `createProposalSchema.proposedPrice` union + coercion idiom so a binding SAR price accepts
 * numeric or 2-decimal string input, and is guarded to the platform [MIN, MAX] price envelope
 * server-side as well (NFR1 — the schema is the first gate, never the only one).
 *
 * `lowPriceConfirmation` is the buyer's explicit acknowledgement of a sub-50 % bid (BR-11).
 * The threshold comparison needs the listing's ask price, so it is enforced in the service.
 */
export const submitOfferSchema = z.object({
  listingId: z.string().uuid('معرف العقار غير صالح'),
  offerPrice: z
    .union([
      z.number(),
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'قيمة العرض غير صحيحة (أرقام عشرية صحيحة)'),
    ])
    .pipe(z.coerce.number())
    .refine(
      (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
      {
        message: `قيمة العرض يجب أن تكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
      },
    ),
  note: z.string().trim().max(500, 'ملاحظات العرض يجب ألا تتجاوز 500 حرف').optional().nullable(),
  lowPriceConfirmation: z.boolean().optional().default(false),
});

/**
 * Buyer offer list filter (Story 4.1 / FR-25): the property detail screen narrows the
 * caller's offers to one listing to detect an existing active offer.
 */
export const offerListQuerySchema = z.object({
  listingId: z.string().uuid('معرف العقار غير صالح').optional(),
});

/**
 * Mediated counter-offer (Story 4.2 / FR-26, FR-55). Relocated here from `schemas/index.ts` and
 * expanded to the full contract: `counterPrice` mirrors the `submitOfferSchema.offerPrice`
 * union + coercion idiom and the `[MIN, MAX]` SAR envelope, `note` is an optional round note.
 * The round cap and the price re-validation against the live offer are enforced in the service
 * (a schema cannot see the offer row) — this is the first gate, never the only one (NFR1).
 */
export const counterOfferSchema = z.object({
  counterPrice: z
    .union([
      z.number(),
      z.string().regex(/^\d+(\.\d{1,2})?$/, 'قيمة العرض المقابل غير صحيحة (أرقام عشرية صحيحة)'),
    ])
    .pipe(z.coerce.number())
    .refine(
      (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
      {
        message: `قيمة العرض المقابل يجب أن تكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
      },
    ),
  note: z
    .string()
    .trim()
    .max(500, 'ملاحظات العرض المقابل يجب ألا تتجاوز 500 حرف')
    .optional()
    .nullable(),
});

/**
 * Seller rejection of a mediated offer (Story 4.2 / FR-55). The structured reason is mandatory
 * and `OTHER` additionally requires a free-text note of at least 10 characters, otherwise the
 * refusal would be unactionable for the platform's mediation team.
 */
export const rejectOfferSchema = z
  .object({
    reason: z.enum(OFFER_REJECTION_REASONS, {
      errorMap: () => ({ message: 'سبب الرفض غير صالح' }),
    }),
    note: z
      .string()
      .trim()
      .max(500, 'ملاحظات الرفض يجب ألا تتجاوز 500 حرف')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === 'OTHER' && (!data.note || data.note.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'يجب كتابة سبب الرفض بالتفصيل (10 أحرف على الأقل) عند اختيار «سبب آخر»',
      });
    }
  });

/**
 * Admin rejection of the mediated terms (Story 4.2 / AC#6): a mandatory reason mirroring
 * `rejectProposalSchema` bounds. The queue decision carries no other body.
 */
export const adminRejectOfferSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب الرفض يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب الرفض يجب ألا يتجاوز 500 حرف'),
});

/**
 * Admin mediation queue query (Story 4.2 / AC#9). Mirrors `proposalQueueQuerySchema` exactly:
 * coerced `page`/`limit` with the shared page-size constants and an optional `status` filter.
 */
export const offerQueueQuerySchema = z.object({
  status: z
    .nativeEnum(OfferStatus, {
      errorMap: () => ({ message: 'حالة العرض غير صالحة' }),
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
 * Admin backup queue query (Story 4.3 / AC#1). Mirrors `offerQueueQuerySchema` exactly minus the
 * `status` filter: queue membership is fixed by the FR-27 predicate, not by an operator choice.
 */
export const backupOfferQueueQuerySchema = z.object({
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
