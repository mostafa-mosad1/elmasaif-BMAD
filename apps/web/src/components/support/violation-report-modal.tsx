'use client';

import React, { useState } from 'react';
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
  FileText,
  Paperclip,
  ShieldAlert,
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

  if (!isOpen) {
    return null;
  }

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
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-sans max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 text-danger-600 dark:text-danger-400">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              إبلاغ عن مخالفة أو احتيال
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

        {/* Success Confirmation (Submit-Only per FR-37) */}
        {successReportNumber ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                تم تسجيل بلاغك بنجاح
              </h3>
              <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 bg-neutral-100 dark:bg-neutral-800 py-1.5 px-4 rounded-full inline-block">
                رقم البلاغ: {successReportNumber}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto pt-2">
                شكراً لمساهمتك في حماية نزاهة منصة المصايف. سيقوم فريق الامتثال
                والرقابة بمراجعة البلاغ والأدلة المرفقة واتخاذ الإجراءات
                النظامية اللازمة.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
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
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                نوع المخالفة المستهدفة
              </label>
              <select
                value={selectedTargetType}
                onChange={(e) =>
                  setSelectedTargetType(e.target.value as ViolationTargetType)
                }
                className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
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
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                تصنيف المخالفة *
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ViolationCategory)
                }
                className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
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
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  تفاصيل البلاغ والأدلة *
                </label>
                <span className="text-xs text-neutral-500">
                  {description.length} / 2000 حرف (الحد الأدنى 10)
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="يرجى ذكر وقائع المخالفة بدقة، وأي معلومات أو أرقام تدعم بلاغك..."
                className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                required
              />
            </div>

            {/* Attachments Section */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                المرفقات والإثباتات (بحد أقصى {VIOLATION_REPORT_MAX_ATTACHMENTS}{' '}
                ملفات)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="رابط أو مسار الملف المرفق (PDF, صور)..."
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  disabled={
                    !newAttachmentUrl.trim() ||
                    attachments.length >= VIOLATION_REPORT_MAX_ATTACHMENTS
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

            {/* Reporter Contact (Optional) */}
            <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <span className="block text-xs font-semibold uppercase text-neutral-500 mb-2">
                بيانات المبلّغ (اختياري — تبقى سرية تماماً)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="الاسم"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  className="rounded-lg border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال (05...)"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
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

