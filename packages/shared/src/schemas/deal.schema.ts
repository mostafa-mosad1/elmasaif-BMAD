import { z } from 'zod';
import { PaymentType } from '../enums';

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
