'use client';

import React, { useState } from 'react';
import {
  AdminSessionUser,
  AdminInitiatePasswordResetResponse,
} from '@elmasaif/shared';
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  X,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';

export interface AdminPasswordResetModalProps {
  isOpen: boolean;
  targetAdmin: AdminSessionUser | null;
  onClose: () => void;
  onDispatched?: (result: AdminInitiatePasswordResetResponse['data']) => void;
}

export function AdminPasswordResetModal({
  isOpen,
  targetAdmin,
  onClose,
  onDispatched,
}: AdminPasswordResetModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dispatchedData, setDispatchedData] = useState<
    AdminInitiatePasswordResetResponse['data'] | null
  >(null);

  if (!isOpen || !targetAdmin) {
    return null;
  }

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 10 && trimmedReason.length <= 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<AdminInitiatePasswordResetResponse>(
        `/admin/auth/${targetAdmin.id}/reset-password/initiate`,
        { reason: trimmedReason }
      );

      if (response?.data) {
        setDispatchedData(response.data);
        onDispatched?.(response.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر إرسال رابط إعادة تعيين كلمة المرور');
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء إرسال الطلب');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setErrorMessage(null);
    setDispatchedData(null);
    onClose();
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1B4332] text-white">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-[#D8F3DC]" />
            <h2 id="admin-reset-modal-title" className="text-base font-bold">
              إصدار رابط إعادة تعيين كلمة مرور إدارية
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Target Admin Summary */}
          <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted">المشرف المستهدف:</p>
              <p className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                {targetAdmin.fullName} ({targetAdmin.username})
              </p>
              <p dir="ltr" className="text-xs font-mono text-ink-secondary">
                {targetAdmin.email}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1B4332]/10 text-[#1B4332] dark:text-emerald-300">
              {targetAdmin.role}
            </span>
          </div>

          {dispatchedData ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم إرسال رابط إعادة التعيين بنجاح</span>
                </div>
                <p className="text-xs leading-relaxed">
                  تم إرسال رابط صالح للاستخدام مرة واحدة ولمدة 15 دقيقة إلى البريد الإلكتروني{' '}
                  <strong dir="ltr">{dispatchedData.email}</strong>، وتم إلغاء جميع الجلسات النشطة للمشرف فوراً وتسجيل العملية في سجل التدقيق.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143325] transition-colors"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Security Policy Warning */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>ضوابط الأمان الإدارية (FR-70 / AD-5)</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                  <li>يُمنع تعيين كلمات مرور مؤقتة يدوية؛ يتم إرسال رابط مشفر للبريد الوظيفي فقط.</li>
                  <li>الرابط صالح لمدة <strong>15 دقيقة</strong> و<strong>للاستخدام مرة واحدة فقط</strong>.</li>
                  <li>سيتم <strong>إلغاء جميع الجلسات النشطة</strong> للمشرف المستهدف فوراً.</li>
                </ul>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-reset-reason"
                  className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
                >
                  سبب إعادة تعيين كلمة المرور (إلزامي لسجل التدقيق)
                </label>
                <textarea
                  id="admin-reset-reason"
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: طلب رسمي موثق من المشرف بعد فقدان كلمة المرور..."
                  className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface p-3 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>10 أحرف على الأقل — يُحفظ في سجل التدقيق غير القابل للتعديل</span>
                  <span dir="ltr">{trimmedReason.length} / 500</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-bold text-ink-secondary hover:bg-surface-sunken transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!isReasonValid || isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143325] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'جاري الإرسال وإلغاء الجلسات...'
                      : 'إرسال رابط إعادة التعيين (15 دقيقة)'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

