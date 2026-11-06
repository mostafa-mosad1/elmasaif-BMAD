import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import {
  MAX_INQUIRY_ATTACHMENTS,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_MESSAGE_MIN_LENGTH,
  INQUIRY_SUBJECT_MAX_LENGTH,
} from '../constants/inquiry';

/**
 * Draft attachment ids picked up from `POST /inquiries/attachments` (Story 4.4 / AC-2).
 *
 * Structure only: ownership (`uploadedByProfileId = caller`), the `messageId = null` draft state
 * and the `CLEAN` scan verdict all need database rows, so they are enforced in the service.
 */
const inquiryAttachmentIdsSchema = z
  .array(z.string().uuid('معرف المرفق غير صالح'))
  .max(MAX_INQUIRY_ATTACHMENTS, `لا يمكن إرفاق أكثر من ${MAX_INQUIRY_ATTACHMENTS} ملفات`)
  .optional()
  .default([]);

const inquiryBodySchema = z
  .string()
  .trim()
  .min(INQUIRY_MESSAGE_MIN_LENGTH, 'نص الاستفسار مطلوب')
  .max(
    INQUIRY_MESSAGE_MAX_LENGTH,
    `نص الاستفسار يجب ألا يتجاوز ${INQUIRY_MESSAGE_MAX_LENGTH} حرف`,
  );

/**
 * Buyer inquiry submission (Story 4.4 / AC-1).
 *
 * Deliberately **not** a `.transform()` on `body`: masking happens in the service, which still
 * needs the raw text in order to record the detection types and counts (D4). The length bounds
 * are re-checked by the service as well (NFR1 — the schema is the first gate, never the only one).
 */
export const createInquirySchema = z.object({
  listingId: z.string().uuid('معرف العقار غير صالح'),
  subject: z
    .string()
    .trim()
    .max(INQUIRY_SUBJECT_MAX_LENGTH, `عنوان الاستفسار يجب ألا يتجاوز ${INQUIRY_SUBJECT_MAX_LENGTH} حرف`)
    .optional()
    .nullable(),
  body: inquiryBodySchema,
  attachmentIds: inquiryAttachmentIdsSchema,
});

/**
 * A follow-up message on an existing thread (Story 4.4 / AC-4, AC-5). The same body contract as
 * the opening message and the same attachment cap; the allowed status depends on the author role
 * and is checked in the service, because a schema cannot see the thread.
 */
export const appendInquiryMessageSchema = z.object({
  body: inquiryBodySchema,
  attachmentIds: inquiryAttachmentIdsSchema,
});

/**
 * Admin relay note (Story 4.4 / AC-5). Optional — the administrator relays the party's own text —
 * and masked in the service like every other persisted body (D4: an admin is not an exemption).
 */
export const relayInquirySchema = z.object({
  note: z
    .string()
    .trim()
    .max(
      INQUIRY_MESSAGE_MAX_LENGTH,
      `ملاحظة الإحالة يجب ألا تتجاوز ${INQUIRY_MESSAGE_MAX_LENGTH} حرف`,
    )
    .optional()
    .nullable(),
});

/**
 * Closing a thread (Story 4.4 / AC-5): a documented reason of at least five characters, mirroring
 * `adminRejectOfferSchema`, so the closure is actionable for both parties afterwards.
 */
export const closeInquirySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'سبب الإغلاق يجب ألا يقل عن 5 أحرف')
    .max(500, 'سبب الإغلاق يجب ألا يتجاوز 500 حرف'),
});

/**
 * Admin conversation queue query (Story 4.4 / AC-3). Mirrors `backupOfferQueueQuerySchema`: queue
 * membership is fixed by `INQUIRY_QUEUE_STATUSES`, not by an operator choice, so there is no
 * `status` filter — only the shared page-size bounds.
 */
export const inquiryQueueQuerySchema = z.object({
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
