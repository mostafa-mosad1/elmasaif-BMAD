import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  INQUIRY_ATTACHMENT_LIMIT_EXCEEDED,
  INQUIRY_ATTACHMENT_NOT_FOUND,
  INQUIRY_ATTACHMENT_NOT_OWNED,
  INQUIRY_AUDIT_ACTIONS,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_MESSAGE_TOO_LONG,
  InquiryAuthorRole,
  MAX_INQUIRY_ATTACHMENTS,
} from '@elmasaif/shared';

/**
 * The single writer for `InquiryMessage` rows (Story 4.4 / AC-1, AC-2, D9).
 *
 * Buyer messages, seller replies and admin relay notes all persist through here, so the
 * attachment-linking rules and the `INQUIRY_CONTACT_MASKED` audit row can never drift between
 * the party surface (`InquiriesService`) and the mediation surface (`AdminInquiriesService`).
 * Callers own the surrounding transaction.
 */
export interface InquiryMessageWriteInput {
  inquiryId: string;
  authorRole: InquiryAuthorRole;
  /** The authoring party's profile — always `null` for an admin note. */
  authorProfileId: string | null;
  authorAdminId?: string | null;
  body: string;
  maskingApplied: boolean;
  maskedTypes: string | null;
  createdAt: Date;
  attachmentIds?: string[];
  /** The profile allowed to link the drafts; `null` for admin notes (which carry no files). */
  uploaderProfileId?: string | null;
  /** Audit actor — falls back to the authoring profile, then to `SYSTEM`. */
  auditActorId?: string | null;
  auditActorType?: 'USER' | 'ADMIN' | 'SYSTEM';
}

export async function createInquiryMessage(
  tx: any,
  input: InquiryMessageWriteInput,
): Promise<string> {
  if (input.body.length > INQUIRY_MESSAGE_MAX_LENGTH) {
    throw new BadRequestException({
      code: INQUIRY_MESSAGE_TOO_LONG,
      message: `نص الاستفسار يجب ألا يتجاوز ${INQUIRY_MESSAGE_MAX_LENGTH} حرف`,
    });
  }

  const message = await tx.inquiryMessage.create({
    data: {
      inquiryId: input.inquiryId,
      authorRole: input.authorRole,
      authorProfileId: input.authorProfileId,
      authorAdminId: input.authorAdminId ?? null,
      body: input.body,
      maskingApplied: input.maskingApplied,
      maskedTypes: input.maskedTypes,
      createdAt: input.createdAt,
    },
  });

  await linkInquiryAttachments(
    tx,
    input.attachmentIds ?? [],
    input.uploaderProfileId ?? null,
    message.id,
  );

  if (input.maskingApplied) {
    const types = input.maskedTypes ? input.maskedTypes.split(',') : [];
    await tx.auditLog.create({
      data: {
        actorId: input.auditActorId ?? input.authorProfileId ?? 'SYSTEM',
        actorType: input.auditActorType ?? 'USER',
        action: INQUIRY_AUDIT_ACTIONS.CONTACT_MASKED,
        entityType: 'InquiryMessage',
        entityId: message.id,
        // Types and counts only — the detected values never leave the masking engine.
        payload: {
          messageId: message.id,
          inquiryId: input.inquiryId,
          types,
          counts: { total: types.length },
        },
      },
    });
  }

  return message.id;
}

/**
 * Links draft attachments to a freshly created message (AC-2, D7). A row must belong to the
 * authoring profile and still be a draft; anything else is refused before the message becomes
 * visible to anybody.
 */
export async function linkInquiryAttachments(
  tx: any,
  attachmentIds: string[],
  uploaderProfileId: string | null,
  messageId: string,
): Promise<void> {
  if (attachmentIds.length === 0) return;
  if (attachmentIds.length > MAX_INQUIRY_ATTACHMENTS) {
    throw new BadRequestException({
      code: INQUIRY_ATTACHMENT_LIMIT_EXCEEDED,
      message: `لا يمكن إرفاق أكثر من ${MAX_INQUIRY_ATTACHMENTS} ملفات بالاستفسار`,
    });
  }

  const uniqueIds = Array.from(new Set(attachmentIds));
  const attachments = await tx.inquiryAttachment.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, uploadedByProfileId: true, messageId: true },
  });

  if (attachments.length !== uniqueIds.length || attachments.some((row: any) => row.messageId)) {
    throw new NotFoundException({
      code: INQUIRY_ATTACHMENT_NOT_FOUND,
      message: 'أحد المرفقات غير موجود أو تم استخدامه مسبقاً',
    });
  }

  if (
    uploaderProfileId === null ||
    attachments.some((row: any) => row.uploadedByProfileId !== uploaderProfileId)
  ) {
    throw new ForbiddenException({
      code: INQUIRY_ATTACHMENT_NOT_OWNED,
      message: 'لا يمكنك إرفاق ملف لم تقم برفعه',
    });
  }

  await tx.inquiryAttachment.updateMany({
    where: { id: { in: uniqueIds } },
    data: { messageId },
  });
}
