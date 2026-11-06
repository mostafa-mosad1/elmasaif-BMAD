import { z } from 'zod';

/**
 * Story 5.1 / AC-1, AD-2: final approval is an explicit action endpoint whose subject is the
 * *offer* — no deal id exists before approval, so the offer id travels in the body rather than in
 * the path.
 */
export const finalApproveDealSchema = z.object({
  offerId: z.string().uuid('معرف العرض يجب أن يكون بصيغة UUID صالحة'),
});
