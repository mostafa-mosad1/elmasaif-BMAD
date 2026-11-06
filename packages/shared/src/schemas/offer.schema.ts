import { z } from 'zod';
import { MIN_LISTING_PRICE_SAR, MAX_LISTING_PRICE_SAR } from '../constants/listing';

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
