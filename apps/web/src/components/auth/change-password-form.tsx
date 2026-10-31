'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Clock,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { apiClient, ApiError } from '../../lib/api-client';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutAlert, setLockoutAlert] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dynamic requirements checklist
  const isLengthValid = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid =
    currentPassword.length > 0 && isLengthValid && hasLetter && hasNumber && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLockoutAlert(null);
    setSuccessMessage(null);

    if (!isFormValid) {
      setErrorMessage('يرجى استيفاء كافة شروط كلمة المرور وتأكيد تطابقها');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient<{ code: string; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      setSuccessMessage(res.message || 'تم تغيير كلمة المرور بنجاح وتم إلغاء الجلسات الأخرى النشطة');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 423 || err.code === 'AUTH_ACCOUNT_LOCKED') {
          setLockoutAlert('تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة');
        } else if (err.code === 'AUTH_PASSWORD_SAME_AS_CURRENT') {
          setErrorMessage('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية');
        } else if (err.code === 'AUTH_INVALID_CREDENTIALS') {
          setErrorMessage('كلمة المرور الحالية غير صحيحة');
        } else {
          setErrorMessage(err.message || 'فشل تغيير كلمة المرور');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      {/* Informational Security Banner */}
      <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl text-sm text-sky-800 dark:text-sky-300 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
        <p className="leading-relaxed">
          تنبيه أمني: تغيير كلمة المرور سيؤدي إلى إنهاء كافة الجلسات النشطة على أجهزتك الأخرى باستثناء هذا المتصفح.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {lockoutAlert && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>{lockoutAlert}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Current Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="currentPassword"
            className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary"
          >
            كلمة المرور الحالية
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            نسيت كلمة المرور الحالية؟
          </Link>
        </div>
        <div className="relative">
          <input
            id="currentPassword"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isLoading || !!lockoutAlert}
            className="w-full px-3.5 py-2.5 text-base rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-primary dark:bg-dark-surface-primary text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors pl-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary"
            aria-label={showCurrentPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New Password Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="newPassword"
          className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary"
        >
          كلمة المرور الجديدة
        </label>
        <div className="relative">
          <input
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading || !!lockoutAlert}
            className="w-full px-3.5 py-2.5 text-base rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-primary dark:bg-dark-surface-primary text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors pl-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary"
            aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary"
        >
          تأكيد كلمة المرور الجديدة
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || !!lockoutAlert}
            className="w-full px-3.5 py-2.5 text-base rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-primary dark:bg-dark-surface-primary text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors pl-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary"
            aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dynamic Requirements Checklist */}
      <div className="p-3.5 bg-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-lg space-y-2 border border-surface-border dark:border-dark-surface-border">
        <p className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1">
          شروط كلمة المرور:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div
            className={`flex items-center gap-1.5 ${
              isLengthValid ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-tertiary'
            }`}
          >
            {isLengthValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            <span>8 خانات على الأقل</span>
          </div>
          <div
            className={`flex items-center gap-1.5 ${
              hasLetter ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-tertiary'
            }`}
          >
            {hasLetter ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            <span>يتضمن حرفاً واحداً على الأقل</span>
          </div>
          <div
            className={`flex items-center gap-1.5 ${
              hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-tertiary'
            }`}
          >
            {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            <span>يتضمن رقماً واحداً على الأقل</span>
          </div>
          <div
            className={`flex items-center gap-1.5 ${
              isMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-tertiary'
            }`}
          >
            {isMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            <span>تطابق كلمتي المرور</span>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !isFormValid || !!lockoutAlert}
        className="w-full py-2.5 font-bold gap-2"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        حفظ كلمة المرور الجديدة
      </Button>
    </form>
  );
}

