import { z } from 'zod';
import { ProposalStatus } from '../enums';
import {
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
} from '../constants/listing';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

/**
 * Provider proposal submission (Story 3.7 / FR-23). Money mirrors the `createListingSchema`
 * `askPrice` union + coercion idiom so a binding SAR price accepts numeric or 2-decimal
 * string input, and is guarded to the platform [MIN, MAX] listing price envelope. The buyer's
 * `maxBudget` ceiling and the match re-validation are enforced server-side in the service
 * (a schema cannot see the demand row), so they are intentionally NOT asserted here.
 */
export const createProposalSchema = z
  .object({
    demandId: z.string().uuid('معرف طلب الشراء يجب أن يكون بصيغة UUID صالحة'),
    listingId: z.string().uuid('معرف العقار يجب أن يكون بصيغة UUID صالحة'),
    proposedPrice: z
      .union([
        z.number(),
        z.string().regex(/^\d+(\.\d{1,2})?$/, 'السعر المقترح غير صحيح (أرقام عشرية صحيحة)'),
      ])
      .pipe(z.coerce.number())
      .refine(
        (val) => val >= MIN_LISTING_PRICE_SAR && val <= MAX_LISTING_PRICE_SAR,
        {
          message: `السعر المقترح يجب أن يكون بين ${MIN_LISTING_PRICE_SAR} و ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
        },
      ),
    note: z.string().trim().max(1000, 'ملاحظة العرض يجب ألا تتجاوز 1000 حرف').optional().nullable(),
  })
  .refine((data) => data.proposedPrice <= MAX_LISTING_PRICE_SAR, {
    message: `السعر المقترح يجب ألا يتجاوز ${MAX_LISTING_PRICE_SAR.toLocaleString()} ريال سعودي`,
    path: ['proposedPrice'],
  });

/**
 * Admin proposal rejection (Story 3.7 / FR-23): a mandatory non-empty structured reason,
 * mirroring `cancelDemandSchema` bounds. Approve carries no body.
 */
export const rejectProposalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب الرفض يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب الرفض يجب ألا يتجاوز 500 حرف'),
});

/**
 * Admin proposal review queue query (Story 3.7 / FR-23). Mirrors
 * `listingModerationQueueQuerySchema` exactly: coerced `page`/`limit` with the shared
 * page-size constants and an optional `status` filter over `ProposalStatus`.
 */
export const proposalQueueQuerySchema = z.object({
  status: z
    .nativeEnum(ProposalStatus, {
      errorMap: () => ({ message: 'حالة العرض غير صالحة' }),
    })
    .optional(),
  page: z.coerce.number().int('رقم الصفحة يجب أن يكون 1 أو أكثر').min(1, 'رقم الصفحة يجب أن يكون 1 أو أكثر').optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE, `الحد الأقصى لعدد العناصر هو ${MAX_PAGE_SIZE}`)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
});
