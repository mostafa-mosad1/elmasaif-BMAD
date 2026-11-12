'use client';

import React, { useState } from 'react';
import {
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS_AR,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS_AR,
  TicketCategory,
  TicketPriority,
} from '@elmasaif/shared';
import {
  CheckCircle2,
  Clock,
  Headphones,
  LifeBuoy,
  Paperclip,
  X,
} from 'lucide-react';

export interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: TicketCategory;
  defaultContactName?: string;
  defaultContactEmail?: string;
  defaultContactPhone?: string;
  onSubmitted?: (ticketNumber: string) => void;
}

export function SupportTicketModal({
  isOpen,
  onClose,
  initialCategory = 'TECHNICAL_ISSUE',
  defaultContactName = '',
  defaultContactEmail = '',
  defaultContactPhone = '',
  onSubmitted,
}: SupportTicketModalProps) {
  const [category, setCategory] = useState<TicketCategory>(initialCategory);
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState(defaultContactName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [contactPhone, setContactPhone] = useState(defaultContactPhone);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successTicketNumber, setSuccessTicketNumber] = useState<string | null>(
    null,
  );

  if (!isOpen) {
    return null;
  }

  const handleAddAttachment = () => {
    if (
      newAttachmentUrl.trim() &&
      attachments.length < SUPPORT_TICKET_MAX_ATTACHMENTS
    ) {
      setAttachments([...attachments, newAttachmentUrl.trim()]);
      setNewAttachmentUrl('');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (subject.trim().length < 3) {
      setErrorMessage('يجب أن يكون عنوان التذكرة 3 أحرف على الأقل');
      return;
    }

    if (description.trim().length < 10) {
      setErrorMessage('يجب أن يكون وصف المشكلة 10 أحرف على الأقل');
      return;
    }

    if (!contactName.trim() || !contactEmail.trim()) {
      setErrorMessage('يرجى ملء بيانات الاسم والبريد الإلكتروني للتواصل');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || null,
          attachments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'تعذر فتح تذكرة الدعم الفني');
      }

      const ticketNumber =
        data.data?.ticketNumber || data.ticketNumber || 'TIK-2026';
      setSuccessTicketNumber(ticketNumber);
      if (onSubmitted) {
        onSubmitted(ticketNumber);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء إرسال التذكرة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessTicketNumber(null);
    setSubject('');
    setDescription('');
    setAttachments([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 text-primary-600 dark:text-primary-400">
            <LifeBuoy className="h-6 w-6 text-primary-600" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              طلب دعم فني ومساعدة
            </h2>
          </div>
          <button
            onClick={handleResetAndClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="إغلاق النافذة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success Confirmation Modal (Submit-Only per FR-38) */}
        {successTicketNumber ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                تم فتح تذكرة الدعم بنجاح
              </h3>
              <p className="text-base font-bold text-primary-600 dark:text-primary-400 bg-neutral-100 dark:bg-neutral-800 py-1.5 px-4 rounded-full inline-block">
                رقم التذكرة: {successTicketNumber}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 pt-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span>
                  وقت الاستجابة المتوقع: <strong>خلال 4 ساعات عمل</strong> (SLA)
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                سيقوم فريق الدعم الفني بمراجعة طلبك والتواصل معك عبر البريد
                الإلكتروني المسجل ({contactEmail}).
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
              >
                تم
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900">
                {errorMessage}
              </div>
            )}

            {/* SLA Commitment banner */}
            <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                نلتزم بالرد الأول على تذكرتك خلال <strong>4 ساعات</strong> وحل
                المشكلة خلال <strong>48 ساعة</strong> كحد أقصى.
              </span>
            </div>

            {/* Category & Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  تصنيف المشكلة *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                >
                  {TICKET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {TICKET_CATEGORY_LABELS_AR[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  درجة الأهمية
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                >
                  {TICKET_PRIORITIES.map((pri) => (
                    <option key={pri} value={pri}>
                      {TICKET_PRIORITY_LABELS_AR[pri]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                عنوان التذكرة *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: تعذر سداد رسوم العقد، مشكلة في تسجيل الدخول..."
                maxLength={150}
                required
                className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  شرح المشكلة بالتفصيل *
                </label>
                <span className="text-xs text-neutral-500">
                  {description.length} / 3000 حرف
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وضح الخطوات التي قمت بها، ورسائل الخطأ التي ظهرت لك..."
                className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                required
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                صور الشاشة والمرفقات (بحد أقصى {SUPPORT_TICKET_MAX_ATTACHMENTS}{' '}
                ملفات)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="رابط أو مسار ملف الخطأ..."
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  disabled={
                    !newAttachmentUrl.trim() ||
                    attachments.length >= SUPPORT_TICKET_MAX_ATTACHMENTS
                  }
                  className="rounded-lg bg-neutral-100 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  إضافة
                </button>
              </div>

              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded bg-neutral-50 p-2 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="truncate">{file}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Contact Details */}
            <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <span className="block text-xs font-semibold uppercase text-neutral-500 mb-2">
                بيانات التواصل والمتابعة *
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="الاسم الكريم *"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  className="rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني *"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال (05...)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSubmitting ? 'جاري الفتح...' : 'فتح التذكرة'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

