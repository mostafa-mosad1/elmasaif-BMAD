'use client';

import React, { useState, useRef } from 'react';
import {
  VIOLATION_CATEGORIES,
  VIOLATION_CATEGORY_LABELS_AR,
  VIOLATION_REPORT_MAX_ATTACHMENTS,
  VIOLATION_TARGET_TYPES,
  VIOLATION_TARGET_TYPE_LABELS_AR,
  ViolationCategory,
  ViolationTargetType,
} from '@elmasaif/shared';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  FileText,
  Paperclip,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';

export interface ViolationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType?: ViolationTargetType;
  targetListingId?: string;
  targetListingTitle?: string;
  targetUserId?: string;
  targetBrokerName?: string;
  onSubmitted?: (reportNumber: string) => void;
}

export function ViolationReportModal({
  isOpen,
  onClose,
  targetType = 'LISTING',
  targetListingId,
  targetListingTitle,
  targetUserId,
  targetBrokerName,
  onSubmitted,
}: ViolationReportModalProps) {
  const [selectedTargetType, setSelectedTargetType] =
    useState<ViolationTargetType>(targetType);
  const [category, setCategory] = useState<ViolationCategory>(
    'FRAUDULENT_LISTING',
  );
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReportNumber, setSuccessReportNumber] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) {
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = VIOLATION_REPORT_MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`تم الوصول للحد الأقصى المسموح به (${VIOLATION_REPORT_MAX_ATTACHMENTS} ملفات)`);
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
      attachments.length < VIOLATION_REPORT_MAX_ATTACHMENTS
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

    if (description.trim().length < 10) {
      setErrorMessage('يجب أن يكون وصف المخالفة 10 أحرف على الأقل');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: selectedTargetType,
          targetListingId: targetListingId || null,
          targetUserId: targetUserId || null,
          category,
          description: description.trim(),
          attachments,
          reporterName: reporterName.trim() || null,
          reporterEmail: reporterEmail.trim() || null,
          reporterPhone: reporterPhone.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'تعذر إرسال البلاغ');
      }

      const reportNumber = data.data?.reportNumber || data.reportNumber || 'VR-2026';
      setSuccessReportNumber(reportNumber);
      if (onSubmitted) {
        onSubmitted(reportNumber);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء إرسال البلاغ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessReportNumber(null);
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
          <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
              إبلاغ عن مخالفة أو احتيال
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

        {/* Success Confirmation (Submit-Only per FR-37) */}
        {successReportNumber ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                تم تسجيل بلاغك بنجاح
              </h3>
              <p className="text-sm font-semibold text-accent bg-accent/10 dark:bg-accent/20 py-1.5 px-4 rounded-full inline-block border border-accent/20">
                رقم البلاغ: {successReportNumber}
              </p>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-md mx-auto pt-2">
                شكراً لمساهمتك في حماية نزاهة منصة المصايف. سيقوم فريق الامتثال
                والرقابة بمراجعة البلاغ والأدلة المرفقة واتخاذ الإجراءات
                النظامية اللازمة.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Target context banner */}
            {(targetListingTitle || targetBrokerName) && (
              <div className="rounded-lg bg-amber-50 p-3.5 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50 flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-300">
                  <span className="font-semibold">المحتوى المستهدف: </span>
                  {targetListingTitle && `إعلان "${targetListingTitle}"`}
                  {targetBrokerName && `الوسيط "${targetBrokerName}"`}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900">
                {errorMessage}
              </div>
            )}

            {/* Target Type */}
            <div>
              <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                نوع المخالفة المستهدفة
              </label>
              <select
                value={selectedTargetType}
                onChange={(e) =>
                  setSelectedTargetType(e.target.value as ViolationTargetType)
                }
                className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
              >
                {VIOLATION_TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VIOLATION_TARGET_TYPE_LABELS_AR[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Violation Category */}
            <div>
              <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary mb-1">
                تصنيف المخالفة *
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ViolationCategory)
                }
                className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
              >
                {VIOLATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {VIOLATION_CATEGORY_LABELS_AR[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
                  تفاصيل البلاغ والأدلة *
                </label>
                <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
                  {description.length} / 2000 حرف (الحد الأدنى 10)
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="يرجى ذكر وقائع المخالفة بدقة، وأي معلومات أو أرقام تدعم بلاغك..."
                className="w-full rounded-lg border border-surface-border bg-surface-sunken p-2.5 text-sm text-ink-primary focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                required
              />
            </div>

            {/* Attachments Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
                  المرفقات والإثباتات (PDF أو صور - حتى 10 ميجابايت)
                </label>
                <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
                  {attachments.length} / {VIOLATION_REPORT_MAX_ATTACHMENTS} ملفات
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
                id="violation-file-upload"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  attachments.length >= VIOLATION_REPORT_MAX_ATTACHMENTS
                    ? 'border-surface-border bg-surface-sunken/50 opacity-60 pointer-events-none'
                    : 'border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent dark:border-accent/30 dark:bg-accent/10 dark:hover:bg-accent/15'
                }`}
              >
                <UploadCloud className="h-7 w-7 mx-auto text-accent mb-1.5" />
                <p className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                  اضغط هنا لاختيار ملفات وإثباتات من جهازك أو اسحبها إلى هنا
                </p>
                <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-0.5">
                  يدعم صور JPG, PNG, WEBP ومستندات PDF بحد أقصى {VIOLATION_REPORT_MAX_ATTACHMENTS} ملفات
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

            {/* Reporter Contact (Optional) */}
            <div className="border-t border-surface-border pt-3 dark:border-dark-surface-border">
              <span className="block text-xs font-semibold uppercase text-ink-muted dark:text-dark-ink-muted mb-2">
                بيانات المبلّغ (اختياري — تبقى سرية تماماً)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="الاسم"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface-sunken p-2 text-xs text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface-sunken p-2 text-xs text-ink-primary dark:border-dark-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال (05...)"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
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
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSubmitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

