'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  UserCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { apiClient, ApiError } from '../../lib/api-client';
import {
  AUTH_NOT_AUTHORIZED,
  AUTH_PHONE_IN_USE,
  AUTH_PHONE_SAME_AS_CURRENT,
  AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
  ADMIN_PHONE_CHANGE_SUCCESS,
  PhoneChangeCompletionResponse
} from '@elmasaif/shared';

export interface AdminPhoneChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    fullName: string;
    nationalId?: string;
    mobileNumber: string;
  };
  onSuccess?: (newPhone: string) => void;
}

export function AdminPhoneChangeDialog({
  isOpen,
  onClose,
  targetUser,
  onSuccess
}: AdminPhoneChangeDialogProps) {
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [officialIdVerified, setOfficialIdVerified] = useState(false);
  const [reason, setReason] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = newMobileNumber.replace(/[\s-]/g, '');
    if (!/^(\+966|0)?5[0-9]{8}$/.test(clean)) {
      setErrorMessage('يرجى إدخال رقم جوال سعودي صحيح (05XXXXXXXX)');
      return;
    }

    if (!officialIdVerified) {
      setErrorMessage('يجب تأكيد التحقق من الهوية الرسمية للمستخدم أولاً');
      return;
    }

    if (reason.trim().length < 10) {
      setErrorMessage('سبب التحديث الإداري مطلوب (10 أحرف على الأقل)');
      return;
    }

    const normalized = clean.startsWith('05')
      ? `+966${clean.slice(1)}`
      : clean.startsWith('5')
      ? `+966${clean}`
      : clean;

    setIsLoading(true);

    try {
      const res = await apiClient<PhoneChangeCompletionResponse>(
        `/admin/users/${targetUser.id}/phone-change`,
        {
          method: 'POST',
          body: JSON.stringify({
            newMobileNumber: normalized,
            officialIdVerified: true,
            reason: reason.trim()
          })
        }
      );

      setSuccessMessage(res.message || 'تم تحديث رقم جوال المستخدم بنجاح');
      if (onSuccess) {
        onSuccess(normalized);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403 || err.code === AUTH_NOT_AUTHORIZED) {
          setErrorMessage('تتطلب هذه العملية صلاحية Users.PhoneChange المقتصرة على المشرف العام (Super Admin)');
        } else if (err.code === AUTH_PHONE_SAME_AS_CURRENT) {
          setErrorMessage('رقم الجوال الجديد مطابق لرقم الجوال الحالي للمستخدم');
        } else if (err.code === AUTH_PHONE_IN_USE) {
          setErrorMessage('رقم الجوال المدخل مستخدم بالفعل في حساب آخر');
        } else if (err.code === AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK) {
          setErrorMessage('لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع');
        } else {
          setErrorMessage(err.message || 'حدث خطأ أثناء تنفيذ التحديث الإداري');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="admin-phone-change-dialog"
    >
      <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden text-ink-primary dark:text-dark-ink-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-dark-surface-border bg-surface-muted/30 dark:bg-dark-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold">
              تحديث رقم الجوال عبر الدعم (إشراف عام)
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-DEFAULT text-ink-muted hover:text-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Target User Info Summary */}
          <div className="rounded-lg p-3.5 bg-surface-muted dark:bg-dark-surface-muted border border-surface-border dark:border-dark-surface-border text-xs sm:text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink-secondary dark:text-dark-ink-secondary">اسم المستخدم:</span>
              <span className="font-semibold">{targetUser.fullName}</span>
            </div>
            {targetUser.nationalId && (
              <div className="flex justify-between">
                <span className="text-ink-secondary dark:text-dark-ink-secondary">رقم الهوية:</span>
                <span className="font-mono">{targetUser.nationalId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-secondary dark:text-dark-ink-secondary">رقم الجوال الحالي:</span>
              <span className="font-mono text-primary font-medium" dir="ltr">
                {targetUser.mobileNumber}
              </span>
            </div>
          </div>

          {/* R-09 Security Risk Notice */}
          <div className="rounded-lg p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-100 text-xs sm:text-sm flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="leading-relaxed">
              <strong>تحذير أمني عالي المخاطر (R-09):</strong> هذه العملية استثنائية وتجاوز للتحقق المزدوج. يتم تسجيل هذا الإجراء بسجل رقابة دائم غير قابل للإلغاء مقترناً بمعرف حسابك الإداري وعنوان IP الخاص بك.
            </p>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!successMessage && (
            <>
              {/* New Mobile Number Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adminNewMobileNumber"
                  className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary"
                >
                  رقم الجوال الجديد المعتمد
                </label>
                <input
                  id="adminNewMobileNumber"
                  type="tel"
                  dir="ltr"
                  disabled={isLoading}
                  value={newMobileNumber}
                  onChange={(e) => setNewMobileNumber(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full text-right px-3.5 py-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-card dark:bg-dark-surface-card text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-primary focus:outline-none transition text-sm"
                />
              </div>

              {/* Mandatory Identity Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="officialIdVerified"
                  type="checkbox"
                  disabled={isLoading}
                  checked={officialIdVerified}
                  onChange={(e) => setOfficialIdVerified(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="officialIdVerified"
                  className="text-xs sm:text-sm text-ink-primary dark:text-dark-ink-primary font-medium leading-relaxed cursor-pointer"
                >
                  أؤكد التحقق من وثيقة الهوية الرسمية للمستخدم عبر القنوات المعتمدة
                </label>
              </div>

              {/* Mandatory Reason Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="adminReason"
                  className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary"
                >
                  سبب التحديث الإداري وتفاصيل التحقق (مطلوب للرقابة)
                </label>
                <textarea
                  id="adminReason"
                  rows={3}
                  disabled={isLoading}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="بيّن سبب تعذر وصول المستخدم للرقم القديم وتفاصيل مطابقة الوثائق الرسمية (10 أحرف على الأقل)..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-card dark:bg-dark-surface-card text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-primary focus:outline-none transition text-sm"
                />
                <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
                  {reason.trim().length} / 10 أحرف على الأقل
                </span>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border dark:border-dark-surface-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !newMobileNumber ||
                    !officialIdVerified ||
                    reason.trim().length < 10
                  }
                  className="gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جاري التحديث...
                    </>
                  ) : (
                    'تأكيد التحديث الإداري'
                  )}
                </Button>
              </div>
            </>
          )}

          {successMessage && (
            <div className="pt-2 text-center">
              <Button onClick={onClose}>إغلاق النافذة</Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

