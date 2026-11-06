import { describe, it, expect } from 'vitest';
import {
  createInquirySchema,
  appendInquiryMessageSchema,
  relayInquirySchema,
  closeInquirySchema,
  inquiryQueueQuerySchema,
  MAX_INQUIRY_ATTACHMENTS,
  INQUIRY_MESSAGE_MAX_LENGTH,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../src';

const LISTING_UUID = '33333333-3333-3333-3333-333333333333';
const ATTACHMENT_UUID = '44444444-4444-4444-4444-444444444444';

const validInquiry = {
  listingId: LISTING_UUID,
  body: 'هل العقار ما زال متاحاً؟',
};

describe('createInquirySchema — buyer inquiry intake (Story 4.4 / AC-1)', () => {
  it('accepts a UUID listing with a non-empty body and no attachments', () => {
    const parsed = createInquirySchema.parse(validInquiry);
    expect(parsed.listingId).toBe(LISTING_UUID);
    expect(parsed.body).toBe('هل العقار ما زال متاحاً؟');
    expect(parsed.attachmentIds).toEqual([]);
  });

  it('accepts an optional subject line within 200 characters', () => {
    const parsed = createInquirySchema.parse({ ...validInquiry, subject: 'استفسار عن السعر' });
    expect(parsed.subject).toBe('استفسار عن السعر');
    expect(
      createInquirySchema.safeParse({ ...validInquiry, subject: 'ا'.repeat(201) }).success,
    ).toBe(false);
  });

  it('rejects a malformed listing UUID', () => {
    const result = createInquirySchema.safeParse({ ...validInquiry, listingId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('معرف العقار غير صالح');
    }
  });

  it('rejects an empty or whitespace-only body', () => {
    expect(createInquirySchema.safeParse({ ...validInquiry, body: '' }).success).toBe(false);
    expect(createInquirySchema.safeParse({ ...validInquiry, body: '   ' }).success).toBe(false);
  });

  it('accepts 2000 characters and rejects 2001', () => {
    expect(
      createInquirySchema.safeParse({ ...validInquiry, body: 'ا'.repeat(INQUIRY_MESSAGE_MAX_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      createInquirySchema.safeParse({
        ...validInquiry,
        body: 'ا'.repeat(INQUIRY_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('accepts up to five attachment ids and rejects a sixth', () => {
    const five = Array.from({ length: MAX_INQUIRY_ATTACHMENTS }, () => ATTACHMENT_UUID);
    expect(
      createInquirySchema.safeParse({ ...validInquiry, attachmentIds: five }).success,
    ).toBe(true);
    expect(
      createInquirySchema.safeParse({
        ...validInquiry,
        attachmentIds: [...five, ATTACHMENT_UUID],
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed attachment id', () => {
    const result = createInquirySchema.safeParse({
      ...validInquiry,
      attachmentIds: ['nope'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('معرف المرفق غير صالح');
    }
  });
});

describe('appendInquiryMessageSchema — follow-up and seller reply (Story 4.4 / AC-4, AC-5)', () => {
  it('accepts a body with no attachments and defaults them to an empty list', () => {
    const parsed = appendInquiryMessageSchema.parse({ body: 'متابعة الاستفسار' });
    expect(parsed.attachmentIds).toEqual([]);
  });

  it('rejects an empty body', () => {
    expect(appendInquiryMessageSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('rejects more than five attachments', () => {
    const six = Array.from({ length: MAX_INQUIRY_ATTACHMENTS + 1 }, () => ATTACHMENT_UUID);
    expect(appendInquiryMessageSchema.safeParse({ body: 'رد', attachmentIds: six }).success).toBe(
      false,
    );
  });
});

describe('relayInquirySchema — admin relay note (Story 4.4 / AC-5, D4)', () => {
  it('treats the note as optional', () => {
    expect(relayInquirySchema.parse({}).note).toBeUndefined();
    expect(relayInquirySchema.parse({ note: null }).note).toBeNull();
  });

  it('accepts a note inside the message bound and rejects one beyond it', () => {
    expect(relayInquirySchema.safeParse({ note: 'تمت الإحالة' }).success).toBe(true);
    expect(
      relayInquirySchema.safeParse({ note: 'ا'.repeat(INQUIRY_MESSAGE_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('closeInquirySchema — documented closure reason (Story 4.4 / AC-5)', () => {
  it('requires a reason of at least five characters', () => {
    expect(closeInquirySchema.safeParse({ reason: 'أغلق' }).success).toBe(false);
    expect(closeInquirySchema.safeParse({ reason: 'تم الاتفاق مع الطرفين' }).success).toBe(true);
  });

  it('rejects a reason beyond 500 characters', () => {
    expect(closeInquirySchema.safeParse({ reason: 'ا'.repeat(501) }).success).toBe(false);
  });
});

describe('inquiryQueueQuerySchema — admin conversation queue (Story 4.4 / AC-3)', () => {
  it('defaults to the shared page size', () => {
    const parsed = inquiryQueueQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it('coerces string query values', () => {
    const parsed = inquiryQueueQuerySchema.parse({ page: '2', limit: '10' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it('rejects a page below 1 and a limit above MAX_PAGE_SIZE', () => {
    expect(inquiryQueueQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(inquiryQueueQuerySchema.safeParse({ limit: String(MAX_PAGE_SIZE + 1) }).success).toBe(
      false,
    );
  });
});
