'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BUYER_FOLLOW_UP_STATUSES,
  INQUIRY_AUTHOR_LABELS_AR,
  INQUIRY_AWAITING_PARTY_LABELS_AR,
  INQUIRY_CLOSED,
  INQUIRY_INVALID_STATE_TRANSITION,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_NOT_FOUND,
  INQUIRY_NOT_PARTY,
  InquiryAuthorRole,
  InquiryMessageItem,
  InquiryStatus,
  InquiryThreadItem,
  PROPERTY_TYPE_LABELS_AR,
  appendInquiryMessageSchema,
  maskContactDetails,
} from '@elmasaif/shared';
import {
  ArrowRight,
  Download,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Button, EmptyState } from '../ui';
import { apiClient, describeApiError } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { InquiryStatusBadge } from './inquiry-status-badge';
import { INQUIRY_MASK_NOTICE_AR, INQUIRY_MEDIATION_NOTICE_AR } from './inquiry-submit-form';

export const INQUIRY_THREAD_POLL_INTERVAL_MS = 20_000;

export type InquiryViewer = 'BUYER' | 'SELLER';

const ERROR_HINTS_AR: Record<string, string> = {
  [INQUIRY_NOT_FOUND]: 'لم يتم العثور على هذا الاستفسار.',
  [INQUIRY_NOT_PARTY]: 'هذا الاستفسار غير مرتبط بحسابك الحالي.',
  [INQUIRY_INVALID_STATE_TRANSITION]: 'تغيّرت حالة المحادثة قبل تنفيذ الإجراء. حدّث الصفحة ثم أعد المحاولة.',
  [INQUIRY_CLOSED]: 'المحادثة مغلقة ولا تقبل رسائل جديدة.',
};

/** Tolerates the enveloped `{ statusCode, data }` body, a bare thread, and junk. */
export function unwrapInquiryThreadPayload(payload: unknown): InquiryThreadItem | null {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as { data?: unknown };
  const candidate =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as InquiryThreadItem)
      : (payload as InquiryThreadItem);
  if (typeof candidate?.id !== 'string' || !Array.isArray(candidate.messages)) return null;
  return candidate;
}

/**
 * Server rules mirrored for the UI only (NFR1): the composer is an affordance, the API is the
 * authority. A buyer may follow up from `PENDING_ADMIN_REVIEW` / `RELAYED_TO_BUYER`; a seller
 * only while the thread is `RELAYED_TO_SELLER`; a closed thread accepts nothing.
 */
export function resolveInquiryComposer(
  thread: Pick<InquiryThreadItem, 'status'> | null | undefined,
  viewer: InquiryViewer,
): { canSend: boolean; hint: string | null } {
  const status = thread?.status;

  if (!status) {
    return { canSend: false, hint: null };
  }
  if (status === InquiryStatus.CLOSED) {
    return { canSend: false, hint: 'المحادثة مغلقة نهائياً بقرار الإدارة.' };
  }
  if (viewer === 'BUYER') {
    return BUYER_FOLLOW_UP_STATUSES.includes(status as InquiryStatus)
      ? { canSend: true, hint: null }
      : { canSend: false, hint: 'بانتظار إحالة رد البائع إليك من فريق الوساطة.' };
  }
  return status === InquiryStatus.RELAYED_TO_SELLER
    ? { canSend: true, hint: null }
    : { canSend: false, hint: 'لا يمكن الرد إلا بعد إحالة الاستفسار إليك من الإدارة.' };
}

export interface InquiryThreadViewProps {
  inquiryId: string;
  viewer: InquiryViewer;
  backHref?: string;
}

/**
 * Mediated inquiry thread (Story 4.4 / AC-4, AC-5, D10).
 *
 * Renders only what the API chose to project: an unrelayed counterparty message never reaches
 * this component, so the screen cannot leak a direct contact channel by rendering it. The
 * composer mirrors the server's state machine for affordance and re-masks the body client-side
 * before sending; the API masks it again on receipt.
 */
export function InquiryThreadView({ inquiryId, viewer, backHref }: InquiryThreadViewProps) {
  const [thread, setThread] = useState<InquiryThreadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendHint, setSendHint] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);

    apiClient
      .get<unknown>(`/inquiries/${inquiryId}`)
      .then((payload) => {
        setThread(unwrapInquiryThreadPayload(payload));
        setLoading(false);
      })
      .catch((err: unknown) => {
        const failure = describeApiError(err);
        setError(failure.message || 'تعذر تحميل المحادثة.');
        setLoading(false);
      });
  }, [inquiryId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setSendError(null);
    setSendHint(null);

    const masked = maskContactDetails(body);
    const parsed = appendInquiryMessageSchema.safeParse({
      body: masked.maskedText,
      attachmentIds: [],
    });
    if (!parsed.success) {
      setSendError(parsed.error.issues[0]?.message ?? 'نص الرسالة غير صالح.');
      return;
    }

    setSending(true);
    try {
      const response = await apiClient.post<unknown>(`/inquiries/${inquiryId}/messages`, parsed.data);
      const updated = unwrapInquiryThreadPayload(response);
      if (updated) setThread(updated);
      else load();
      setBody('');
    } catch (err) {
      const failure = describeApiError(err);
      setSendError(failure.message || 'تعذر إرسال الرسالة.');
      setSendHint(ERROR_HINTS_AR[failure.code ?? ''] ?? null);
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const response = await apiClient.get<{ data?: { downloadUrl?: string | null } }>(
        `/inquiries/attachments/${attachmentId}/download`,
      );
      const url = response?.data?.downloadUrl;
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setSendError('تعذر تحميل المرفق. أعد المحاولة بعد قليل.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" dir="rtl">
        <div className="h-24 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse" />
        <div className="h-64 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <EmptyState
        icon={<MessageSquareText className="w-7 h-7" />}
        title={error || 'لم يتم العثور على المحادثة'}
        description="تأكد من الرابط أو عد إلى قائمة استفساراتك."
        actionLabel="إعادة المحاولة"
        onAction={load}
      />
    );
  }

  const composer = resolveInquiryComposer(thread, viewer);
  const preview = maskContactDetails(body);

  return (
    <div className="space-y-5" dir="rtl" data-testid="inquiry-thread-view">
      <div className="flex items-center justify-between gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            <span>عودة إلى الاستفسارات</span>
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <InquiryStatusBadge status={thread.status} />
          <Button type="button" variant="ghost" size="sm" onClick={load} data-testid="inquiry-refresh">
            <RefreshCw className="w-4 h-4" />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-2">
        <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
          {thread.listing?.title || 'عقار'}
        </div>
        <p className="flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {[
              PROPERTY_TYPE_LABELS_AR[
                thread.listing?.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR
              ] || thread.listing?.propertyType,
              thread.listing?.areaSquareMeters ? `م² ${thread.listing.areaSquareMeters}` : null,
              thread.listing?.cityName,
              thread.listing?.districtName,
            ]
              .filter(Boolean)
              .join(' — ')}
          </span>
        </p>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-secondary dark:text-dark-ink-secondary">
            سعر الطلب:{' '}
            <span dir="ltr" className="font-mono">
              {formatSar(Number(thread.listing?.askPrice ?? 0))}
            </span>
          </span>
          {thread.awaitingParty ? (
            <span
              className="inline-flex items-center rounded-pill bg-status-pendingBg px-2 py-0.5 text-[11px] font-bold text-status-pending border border-status-pendingBorder"
              data-testid="inquiry-awaiting-party"
            >
              {INQUIRY_AWAITING_PARTY_LABELS_AR[thread.awaitingParty]}
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted leading-relaxed">
        {INQUIRY_MEDIATION_NOTICE_AR}
      </p>

      <ol className="space-y-3" data-testid="inquiry-timeline">
        {thread.messages.map((message) => (
          <InquiryMessageRow key={message.id} message={message} onDownload={handleDownload} />
        ))}
      </ol>

      {composer.canSend ? (
        <form className="space-y-3" onSubmit={handleSend}>
          <textarea
            rows={3}
            value={body}
            maxLength={INQUIRY_MESSAGE_MAX_LENGTH}
            onChange={(event) => setBody(event.target.value)}
            placeholder={viewer === 'BUYER' ? 'اكتب متابعتك للاستفسار' : 'اكتب ردك على الاستفسار'}
            className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="inquiry-composer-body"
          />
          {preview.wasMasked ? (
            <p className="text-[11px] font-bold text-[#D97706]" data-testid="inquiry-composer-mask-notice">
              {INQUIRY_MASK_NOTICE_AR}
            </p>
          ) : null}
          {sendError ? (
            <div
              role="alert"
              className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected"
              data-testid="inquiry-send-error"
            >
              <p>{sendError}</p>
              {sendHint ? <p className="mt-1 text-xs">{sendHint}</p> : null}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={sending || body.trim().length === 0}
              data-testid="inquiry-send-btn"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'جاري الإرسال...' : 'إرسال'}</span>
            </Button>
          </div>
        </form>
      ) : (
        <p
          className="rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken p-3 text-xs text-ink-secondary dark:text-dark-ink-secondary"
          data-testid="inquiry-composer-hint"
        >
          {composer.hint}
        </p>
      )}
    </div>
  );
}

function InquiryMessageRow({
  message,
  onDownload,
}: {
  message: InquiryMessageItem;
  onDownload: (attachmentId: string) => void;
}) {
  const isAdmin = message.authorRole === InquiryAuthorRole.ADMIN;

  return (
    <li
      className={`rounded-xl border p-3 space-y-2 ${
        isAdmin
          ? 'border-primary/20 bg-primary/5'
          : 'border-surface-border dark:border-dark-surface-border'
      }`}
      data-testid={`inquiry-message-${message.id}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-muted dark:text-dark-ink-muted">
        <span className="font-bold text-ink-secondary dark:text-dark-ink-secondary">
          {INQUIRY_AUTHOR_LABELS_AR[message.authorRole] ?? message.authorRole}
          {message.authorName && !isAdmin ? ` — ${message.authorName}` : ''}
        </span>
        <span dir="ltr">{new Date(message.createdAt).toLocaleString('ar-SA')}</span>
      </div>

      <p className="text-sm text-ink-primary dark:text-dark-ink-primary whitespace-pre-wrap leading-relaxed">
        {message.body}
      </p>

      {message.maskingApplied ? (
        <p className="flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>تم حجب بيانات التواصل في هذه الرسالة</span>
        </p>
      ) : null}

      {message.attachments.length > 0 ? (
        <ul className="space-y-1">
          {message.attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate">{attachment.fileName}</span>
              <button
                type="button"
                onClick={() => onDownload(attachment.id)}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
