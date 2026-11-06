import type { ContactMaskType } from '../masking/contact-mask';

/**
 * Story 4.4 / FR-35: the detection categories the masking engine can report. Persisted as the
 * comma-joined `InquiryMessage.maskedTypes` string, so the wire format stays a plain `String`.
 */
export const MASKED_CONTACT_TYPES: readonly ContactMaskType[] = ['PHONE', 'EMAIL', 'HANDLE'];

/** The Arabic wording of the client-side masking notice, keyed by detection type. */
export const MASKED_CONTACT_TYPE_LABELS_AR: Record<ContactMaskType, string> = {
  PHONE: 'رقم جوال',
  EMAIL: 'بريد إلكتروني',
  HANDLE: 'حساب أو رابط تواصل خارجي',
};

/** UX-DR-10: the masking notice shown in the inquiry form and thread once an edit is masked. */
export const INQUIRY_MASKING_NOTICE_AR =
  'تم حجب بيانات التواصل تلقائياً لحماية الطرفين — لا يمكن مشاركة أرقام الجوال أو البريد أو حسابات التواصل خارج المنصة.';
