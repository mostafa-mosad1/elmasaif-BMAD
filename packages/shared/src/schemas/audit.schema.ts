import { z } from 'zod';
import { AUDIT_ACTOR_TYPE } from '../constants/audit';

const optionalTrimmedString = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen, `Cannot exceed ${maxLen} characters`)
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === null ? undefined : val));

const isoDateString = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      const parsed = Date.parse(val);
      return !isNaN(parsed);
    },
    { message: 'Invalid ISO 8601 date format' },
  )
  .optional()
  .nullable()
  .transform((val) => (val === '' || val === null ? undefined : val));

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  entityType: optionalTrimmedString(100),
  entityId: optionalTrimmedString(100),
  action: optionalTrimmedString(100),
  actorType: z
    .enum([AUDIT_ACTOR_TYPE.ADMIN, AUDIT_ACTOR_TYPE.USER, AUDIT_ACTOR_TYPE.SYSTEM])
    .or(z.literal(''))
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === null ? undefined : val)),
  actorId: optionalTrimmedString(100),
  startDate: isoDateString,
  endDate: isoDateString,
  search: optionalTrimmedString(200),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

