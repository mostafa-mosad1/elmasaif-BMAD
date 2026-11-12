import { z } from 'zod';
import {
  OPERATIONAL_QUEUE_TYPES,
  TASK_FORCE_UNLOCK_MAX_REASON_LENGTH,
  TASK_FORCE_UNLOCK_MIN_REASON_LENGTH,
} from '../constants/queues';
import type { OperationalQueueType } from '../types/locks';

export const forceUnlockTaskSchema = z.object({
  reason: z
    .string({
      required_error: 'سبب فك القفل القسري مطلوب للتوثيق في سجل التدقيق',
      invalid_type_error: 'سبب فك القفل القسري يجب أن يكون نصاً',
    })
    .trim()
    .min(
      TASK_FORCE_UNLOCK_MIN_REASON_LENGTH,
      `سبب فك القفل القسري يجب ألا يقل عن ${TASK_FORCE_UNLOCK_MIN_REASON_LENGTH} أحرف`,
    )
    .max(
      TASK_FORCE_UNLOCK_MAX_REASON_LENGTH,
      `سبب فك القفل القسري يجب ألا يتجاوز ${TASK_FORCE_UNLOCK_MAX_REASON_LENGTH} حرف`,
    ),
});

export type ForceUnlockTaskInput = z.infer<typeof forceUnlockTaskSchema>;

export const operationalQueueLockStateSchema = z.enum([
  'ALL',
  'LOCKED',
  'UNLOCKED',
  'MY_CLAIMS',
  'LOCKED_BY_ME',
  'LOCKED_BY_OTHER',
]);

export const operationalQueueTypeSchema = z.enum(
  OPERATIONAL_QUEUE_TYPES as unknown as [OperationalQueueType, ...OperationalQueueType[]],
);

export const operationalQueueFilterSchema = z.object({
  queue: operationalQueueTypeSchema.optional(),
  queueType: operationalQueueTypeSchema.optional(),
  lockState: operationalQueueLockStateSchema.default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OperationalQueueFilterInput = z.infer<typeof operationalQueueFilterSchema>;

/**
 * Parses an HTTP `If-Match` header value (e.g., `"3"`, `W/"3"`, `3`) or falls back to
 * a request body `version` integer. Returns `undefined` when no valid positive integer is found.
 */
export function parseIfMatchVersion(
  ifMatchHeader?: string | string[] | number | null,
  bodyVersion?: number | null,
): number | undefined {
  const raw = Array.isArray(ifMatchHeader) ? ifMatchHeader[0] : ifMatchHeader;

  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }

  if (typeof raw === 'string') {
    let cleaned = raw.trim();
    if (cleaned.startsWith('W/') || cleaned.startsWith('w/')) {
      cleaned = cleaned.slice(2).trim();
    }
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    if (/^[1-9]\d*$/.test(cleaned)) {
      const parsed = Number.parseInt(cleaned, 10);
      if (Number.isSafeInteger(parsed) && parsed >= 1) {
        return parsed;
      }
    }
    return undefined;
  }

  if (typeof bodyVersion === 'number' && Number.isInteger(bodyVersion) && bodyVersion >= 1) {
    return bodyVersion;
  }

  return undefined;
}

export const ifMatchVersionSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const parsed = parseIfMatchVersion(val);
    if (parsed === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'قيمة ترويسة If-Match أو رقم الإصدار (version) غير صالحة',
      });
      return z.NEVER;
    }
    return parsed;
  });
