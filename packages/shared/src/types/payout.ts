import { z } from 'zod';
import {
  createPayoutAccountSchema,
  updatePayoutAccountSchema,
  payoutAccountResponseSchema
} from '../schemas/payout.schema';

export type CreatePayoutAccountInput = z.infer<typeof createPayoutAccountSchema>;
export type UpdatePayoutAccountInput = z.infer<typeof updatePayoutAccountSchema>;
export type PayoutAccountResponse = z.infer<typeof payoutAccountResponseSchema>;

