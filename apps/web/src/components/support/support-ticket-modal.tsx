'use client';

import React, { useState, useRef } from 'react';
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
  FileCheck,
  Headphones,
  LifeBuoy,
  Paperclip,
  UploadCloud,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) {
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = SUPPORT_TICKET_MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`تم الوصول للحد الأقصى المسموح به (${SUPPORT_TICKET_MAX_ATTACHMENTS} ملفات)`);
      return;
    }

    const newFiles = Array.from(files).slice(0, remainingSlots);
    const addedNames: string[] = [];

    for (const file of newFiles) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(`الملف "${file.name}" يتجاوز الحجم المسموح به (10 ميجابايت)`);
        continue;
      }
      addedNames.push(file.name);
    }

    if (addedNames.length > 0) {
      setAttachments((prev) => [...prev, ...addedNames]);
      setErrorMessage(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      <div className="relative w-full max-w-xl rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-4 dark:border-dark-surface-border">
          <div className="flex items-center gap-2.5 text-accent dark:text-accent">
            <LifeBuoy className="h-6 w-6 text-accent" />
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
              طلب دعم فني ومساعدة
            </h2>
          </div>
          <button
            onClick={handleResetAndClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink-primary dark:hover:bg-dark-surface-raised dark:hover:text-dark-ink-primary"
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
              <h3 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                تم فتح تذكرة الدعم بنجاح
              </h3>
              <p className="text-base font-bold text-accent bg-accent/10 dark:bg-accent/20 py-1.5 px-4 rounded-full inline-block border border-accent/20">
                رقم التذكرة: {successTicketNumber}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-ink-secondary dark:text-dark-ink-secondary pt-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span>
                  وقت الاستجابة المتوقع: <strong>خلال 4 ساعات عمل</strong> (SLA)
                </span>
              </div>
              <p className="text-xs text-ink-muted dark:text-dark-ink-muted max-w-md mx-auto">
                سيقوم فريق الدعم الفني بمراجعة طلبك والتواصل معك عبر البريد
                الإلكتروني المسجل ({contactEmail}).
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors shadow-sm"
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
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                  تصنيف المشكلة *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                >
                  {TICKET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {TICKET_CATEGORY_LABELS_AR[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                  درجة الأهمية
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
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
              <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                عنوان التذكرة *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: تعذر سداد رسوم العقد، مشكلة في تسجيل الدخول..."
                maxLength={150}
                required
                className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary focus:border-accent focus:ring-1 focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
                  شرح المشكلة بالتفصيل *
                </label>
                <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
                  {description.length} / 3000 حرف
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وضح الخطوات التي قمت بها، ورسائل الخطأ التي ظهرت لك..."
                className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary focus:border-accent focus:ring-1 focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                required
              />
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
                  صور الشاشة والمرفقات (PDF أو صور - حتى 10 ميجابايت)
                </label>
                <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
                  {attachments.length} / {SUPPORT_TICKET_MAX_ATTACHMENTS} ملفات
                </span>
              </div>

              {/* Native File Upload Trigger Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="ticket-file-upload"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  attachments.length >= SUPPORT_TICKET_MAX_ATTACHMENTS
                    ? 'border-surface-border bg-surface-sunken/50 opacity-60 pointer-events-none'
                    : 'border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent dark:border-accent/30 dark:bg-accent/10 dark:hover:bg-accent/15'
                }`}
              >
                <UploadCloud className="h-7 w-7 mx-auto text-accent mb-1.5" />
                <p className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                  اضغط هنا لاختيار صور الشاشة أو الملفات من جهازك
                </p>
                <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-0.5">
                  يدعم صور JPG, PNG, WEBP ومستندات PDF بحد أقصى {SUPPORT_TICKET_MAX_ATTACHMENTS} ملفات
                </p>
              </div>

              {/* Uploaded Files List */}
              {attachments.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-primary dark:bg-dark-surface-raised dark:text-dark-ink-primary border border-surface-border dark:border-dark-surface-border"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate font-mono text-[11px] font-medium">{file}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Contact Details */}
            <div className="border-t border-surface-border pt-3 dark:border-dark-surface-border">
              <span className="block text-xs font-semibold uppercase text-ink-muted dark:text-dark-ink-muted mb-2">
                بيانات التواصل والمتابعة *
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="الاسم الكريم *"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  className="rounded-lg border border-surface-border bg-surface-sunken p-2 text-xs text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني *"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="rounded-lg border border-surface-border bg-surface-sunken p-2 text-xs text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال (05...)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface-sunken p-2 text-xs text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-sunken dark:text-dark-ink-secondary dark:hover:bg-dark-surface-raised"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
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

