'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  INQUIRY_ATTACHMENT_LIMIT_EXCEEDED,
  INQUIRY_ATTACHMENT_NOT_CLEAN,
  INQUIRY_ATTACHMENT_NOT_FOUND,
  INQUIRY_BUYER_PROFILE_REQUIRED,
  INQUIRY_LISTING_NOT_FOUND,
  INQUIRY_LISTING_NOT_INQUIRABLE,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_SELF_SUBMISSION_FORBIDDEN,
  INQUIRY_SUBJECT_MAX_LENGTH,
  MAX_INQUIRY_ATTACHMENTS,
  InquiryAttachmentDraft,
  InquiryThreadItem,
  createInquirySchema,
  maskContactDetails,
} from '@elmasaif/shared';
import { MessageSquareText, Paperclip, ShieldCheck, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { apiClient, describeApiError } from '../../lib/api-client';

/** Shown the moment a contact detail is redacted — the same wording the API audits (AC-1). */
export const INQUIRY_MASK_NOTICE_AR =
  'تم حجب بيانات التواصل تلقائياً لحماية الطرفين، ولن تصل بياناتك إلى البائع مباشرة.';

/** UX-DR-13 mediation transparency copy, reused verbatim from the offer negotiation screen. */
export const INQUIRY_MEDIATION_NOTICE_AR =
  'كل استفسار يمر عبر وسيط المنصة: لا يتم إرسال رسالتك إلى البائع إلا بعد مراجعتها وإحالتها.';

/** Each stable server code (AD-8) gets a buyer-actionable Arabic hint. */
const CODE_HINTS_AR: Record<string, string> = {
  [INQUIRY_LISTING_NOT_INQUIRABLE]: 'لم يعد هذا العقار متاحاً لاستقبال الاستفسارات في حالته الحالية.',
  [INQUIRY_LISTING_NOT_FOUND]: 'تعذر العثور على العقار المطلوب.',
  [INQUIRY_SELF_SUBMISSION_FORBIDDEN]: 'لا يمكنك إرسال استفسار على عقار تعلنه بنفسك.',
  [INQUIRY_BUYER_PROFILE_REQUIRED]: 'يلزم تسجيل الدخول بملف مشتري نشط لإرسال استفسار.',
  [INQUIRY_ATTACHMENT_LIMIT_EXCEEDED]: `لا يمكن إرفاق أكثر من ${MAX_INQUIRY_ATTACHMENTS} ملفات بالاستفسار.`,
  [INQUIRY_ATTACHMENT_NOT_CLEAN]: 'لم يجتز أحد الملفات فحص السلامة ولم يتم إرفاقه.',
  [INQUIRY_ATTACHMENT_NOT_FOUND]: 'أحد المرفقات لم يعد متاحاً، أعد رفعه ثم حاول مجدداً.',
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary';

const labelClass =
  'block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5';

export interface InquirySubmitFormProps {
  listingId: string;
  onSubmitted?: (thread: InquiryThreadItem) => void;
  onCancel?: () => void;
}

/**
 * Mediated inquiry intake on the property detail screen (Story 4.4 / AC-1, AC-2, D4, D10).
 *
 * The masking engine runs on every keystroke for the live preview **and** on submit, so the
 * payload carries the redacted text — never the original. The API re-runs the very same engine
 * before persisting (NFR1: the client is a convenience, never the authority).
 *
 * Attachments are uploaded one by one through `POST /inquiries/attachments` (quarantined and
 * scanned server-side); only the resulting draft ids travel with the message.
 */
export function InquirySubmitForm({ listingId, onSubmitted, onCancel }: InquirySubmitFormProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<InquiryAttachmentDraft[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // One engine, two gates: this preview is the client gate (D4).
  const preview = useMemo(() => maskContactDetails(body), [body]);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;

    if (attachments.length + picked.length > MAX_INQUIRY_ATTACHMENTS) {
      setServerError(CODE_HINTS_AR[INQUIRY_ATTACHMENT_LIMIT_EXCEEDED]);
      setServerHint(null);
      return;
    }

    setUploading(true);
    setServerError(null);
    setServerHint(null);

    for (const file of picked) {
      const form = new FormData();
      form.append('file', file);
      try {
        const response = await apiClient<{ statusCode: number; data: InquiryAttachmentDraft }>(
          '/inquiries/attachments',
          { method: 'POST', body: form },
        );
        const draft = response?.data;
        if (draft?.id) {
          setAttachments((current) => [...current, draft]);
        }
      } catch (err) {
        const failure = describeApiError(err);
        setServerError(failure.message || 'تعذر رفع الملف.');
        setServerHint(CODE_HINTS_AR[failure.code ?? ''] ?? null);
      }
    }

    setUploading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    setServerHint(null);

    const payload = {
      listingId,
      subject: subject.trim() ? subject.trim() : null,
      // The masked text is what is submitted — the raw body never leaves this component.
      body: preview.maskedText,
      attachmentIds: attachments.map((attachment) => attachment.id),
    };

    const parsed = createInquirySchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await apiClient.post<{ statusCode: number; data: InquiryThreadItem }>(
        '/inquiries',
        parsed.data,
      );
      const created = (response?.data ?? (response as unknown as InquiryThreadItem)) as InquiryThreadItem;
      setSubmitted(true);
      onSubmitted?.(created);
    } catch (err) {
      const failure = describeApiError(err);
      setServerError(failure.message || 'تعذر إرسال الاستفسار.');
      setServerHint(CODE_HINTS_AR[failure.code ?? ''] ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card data-testid="inquiry-submit-success">
        <CardContent className="space-y-2 p-5 sm:p-6" dir="rtl">
          <div className="flex items-center gap-2 text-status-verified font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>تم إرسال استفسارك إلى فريق الوساطة</span>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            سيراجع فريق المنصة استفسارك ويحيله إلى البائع. ستصلك الإجابة عبر صفحة «استفساراتي».
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6" data-testid="inquiry-submit-form">
      <CardHeader className="mb-5 border-b border-surface-border pb-4 dark:border-dark-surface-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <span>الاستفسار عن العقار</span>
        </CardTitle>
        <p className="text-xs leading-relaxed text-ink-muted dark:text-dark-ink-muted">
          {INQUIRY_MEDIATION_NOTICE_AR}
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} dir="rtl">
          <div>
            <label htmlFor="inquiry-subject" className={labelClass}>
              عنوان الاستفسار (اختياري)
            </label>
            <input
              id="inquiry-subject"
              type="text"
              maxLength={INQUIRY_SUBJECT_MAX_LENGTH}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثال: استفسار عن إمكانية التفاوض"
              className={inputClass}
              data-testid="inquiry-subject"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.subject}</span>
              <span>{`${subject.length}/${INQUIRY_SUBJECT_MAX_LENGTH}`}</span>
            </div>
          </div>

          <div>
            <label htmlFor="inquiry-body" className={labelClass}>
              نص الاستفسار <span className="text-red-500">*</span>
            </label>
            <textarea
              id="inquiry-body"
              rows={5}
              maxLength={INQUIRY_MESSAGE_MAX_LENGTH}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="اكتب سؤالك عن العقار هنا"
              className={`${inputClass} resize-none`}
              data-testid="inquiry-body"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.body}</span>
              <span>{`${body.length}/${INQUIRY_MESSAGE_MAX_LENGTH}`}</span>
            </div>
          </div>

          {preview.wasMasked ? (
            <div
              className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2"
              data-testid="inquiry-mask-notice"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#D97706]">
                <ShieldCheck className="w-4 h-4" />
                <span>{INQUIRY_MASK_NOTICE_AR}</span>
              </div>
              <p
                className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed whitespace-pre-wrap"
                dir="rtl"
                data-testid="inquiry-mask-preview"
              >
                {preview.maskedText}
              </p>
            </div>
          ) : null}

          <div>
            <label className={labelClass}>المرفقات (اختياري)</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFiles}
                className="hidden"
                data-testid="inquiry-file-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || attachments.length >= MAX_INQUIRY_ATTACHMENTS}
                data-testid="inquiry-add-attachment"
              >
                <Paperclip className="w-4 h-4" />
                <span>{uploading ? 'جاري الفحص...' : 'إضافة ملف'}</span>
              </Button>
              <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
                {`PDF أو صورة، حتى 10 ميجابايت، بحد أقصى ${MAX_INQUIRY_ATTACHMENTS} ملفات`}
              </span>
            </div>

            {attachments.length > 0 ? (
              <ul className="mt-2 space-y-1.5" data-testid="inquiry-attachment-list">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken px-3 py-1.5 text-xs"
                  >
                    <span className="truncate">{attachment.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id),
                        )
                      }
                      className="text-ink-muted hover:text-status-rejected"
                      aria-label={`إزالة ${attachment.fileName}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected"
              data-testid="inquiry-submit-error"
            >
              <p>{serverError}</p>
              {serverHint ? <p className="mt-1 text-xs">{serverHint}</p> : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4 dark:border-dark-surface-border">
            {onCancel ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                إلغاء
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || uploading}
              data-testid="inquiry-submit-btn"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال الاستفسار'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
