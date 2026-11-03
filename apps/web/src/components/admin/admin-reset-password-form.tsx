'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { AdminCompletePasswordResetResponse } from '@elmasaif/shared';
import { apiClient, ApiError } from '../../lib/api-client';

export interface AdminResetPasswordFormProps {
  token: string;
}

export function AdminResetPasswordForm({ token }: AdminResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch;

  if (!token || token.trim().length === 0) {
    return (
      <div
        dir="rtl"
        className="w-full max-w-md mx-auto bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-lg p-6 text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
          رابط إعادة التعيين غير مكتمل أو غير صالح
        </h1>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          يرجى التأكد من فتح الرابط الكامل المرسل إلى بريدك الإلكتروني الوظيفي من قبل المشرف العام، أو طلب إصدار رابط جديد.
        </p>
        <Link
          href="/admin/login"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143325] transition-colors"
        >
          <span>العودة إلى بوابة دخول المشرفين</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div
        dir="rtl"
        className="w-full max-w-md mx-auto bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-lg p-6 text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[#1B4332] dark:text-emerald-300 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
          تم تحديث كلمة المرور الإدارية بنجاح
        </h1>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
          تم إبطال صلاحية رابط إعادة التعيين فوراً وإنهاء جميع الجلسات السابقة. يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.
        </p>
        <Link
          href="/admin/login"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143325] transition-colors"
        >
          <span>الانتقال إلى تسجيل الدخول الإداري</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await apiClient.post<AdminCompletePasswordResetResponse>(
        '/admin/auth/reset-password/confirm',
        {
          token: token.trim(),
          newPassword,
        }
      );
      setIsCompleted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.message || 'تعذر إتمام إعادة تعيين كلمة المرور الإدارية'
        );
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء الاتصال بالخادم');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="w-full max-w-md mx-auto bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-lg overflow-hidden"
    >
      <div className="bg-[#1B4332] text-white px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <KeyRound className="w-5 h-5 text-[#D8F3DC]" />
          </div>
          <div>
            <span className="inline-block text-[11px] font-semibold bg-white/15 text-[#D8F3DC] px-2 py-0.5 rounded-full">
              FR-70 • رابط أحادي الاستخدام
            </span>
            <h1 className="text-lg font-bold">تعيين كلمة مرور إدارية جديدة</h1>
          </div>
        </div>
        <p className="text-xs text-white/80">
          هذا الرابط صالح للاستخدام مرة واحدة فقط ولمدة 15 دقيقة من وقت إصداره من قِبل المشرف العام.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="admin-new-password"
            className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
          >
            كلمة المرور الإدارية الجديدة
          </label>
          <div className="relative">
            <input
              id="admin-new-password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 pe-10 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute end-3 top-2.5 p-1 text-ink-muted hover:text-ink-primary"
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="admin-confirm-password"
            className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
          >
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            id="admin-confirm-password"
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
          />
        </div>

        {/* Complexity Checklist */}
        <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border space-y-2 text-xs">
          <p className="font-bold text-ink-primary dark:text-dark-ink-primary">
            متطلبات أمان كلمة المرور الإدارية:
          </p>
          <ul className="space-y-1.5 text-ink-secondary dark:text-dark-ink-secondary">
            <li className="flex items-center gap-2">
              {hasMinLength ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-ink-muted" />
              )}
              <span>8 خانات على الأقل</span>
            </li>
            <li className="flex items-center gap-2">
              {hasLetter ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-ink-muted" />
              )}
              <span>حرف أبجدي واحد على الأقل (A-Z / a-z)</span>
            </li>
            <li className="flex items-center gap-2">
              {hasNumber ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-ink-muted" />
              )}
              <span>رقم واحد على الأقل (0-9)</span>
            </li>
            <li className="flex items-center gap-2">
              {passwordsMatch ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-ink-muted" />
              )}
              <span>تطابق كلمتي المرور</span>
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-[#1B4332] hover:bg-[#143325] disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            {isSubmitting ? 'جاري حفظ كلمة المرور الجديدة...' : 'حفظ كلمة المرور وتفعيل الحساب'}
          </span>
        </button>
      </form>
    </div>
  );
}

