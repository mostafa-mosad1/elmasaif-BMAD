'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Clock,
  RotateCw
} from 'lucide-react';
import { OtpInput } from './otp-input';
import { Button } from '../ui/button';
import { apiClient, ApiError } from '../../lib/api-client';

type Step = 1 | 2 | 3 | 'success';

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [mobileNumber, setMobileNumber] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  // Step 2 state
  const [otpCode, setOtpCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resetToken, setResetToken] = useState('');

  // Step 3 state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutAlert, setLockoutAlert] = useState<string | null>(null);

  // Timer countdown for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && resendSeconds > 0) {
      timer = setInterval(() => {
        setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendSeconds]);

  const maskPhone = (phone: string) => {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  };

  // Step 1: Request OTP
  const handleInitiateReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLockoutAlert(null);

    const clean = mobileNumber.replace(/[\s-]/g, '');
    if (!/^(\+966|0)?5[0-9]{8}$/.test(clean)) {
      setErrorMessage('يرجى إدخال رقم جوال سعودي صحيح (05XXXXXXXX)');
      return;
    }

    setIsLoading(true);
    try {
      const normalized = clean.startsWith('05')
        ? `+966${clean.slice(1)}`
        : clean.startsWith('5')
        ? `+966${clean}`
        : clean;

      const res = await apiClient<{ data: { resendAvailableInSeconds: number } }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ mobileNumber: normalized })
        }
      );

      setMaskedPhone(maskPhone(normalized));
      setResendSeconds(res.data?.resendAvailableInSeconds || 60);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'حدث خطأ أثناء إرسال رمز التحقق');
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendSeconds > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const clean = mobileNumber.replace(/[\s-]/g, '');
      const normalized = clean.startsWith('05')
        ? `+966${clean.slice(1)}`
        : clean.startsWith('5')
        ? `+966${clean}`
        : clean;

      const res = await apiClient<{ data: { resendAvailableInSeconds: number } }>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ mobileNumber: normalized })
        }
      );

      setResendSeconds(res.data?.resendAvailableInSeconds || 60);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر إعادة إرسال الرمز');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6) {
      setErrorMessage('رمز التحقق يجب أن يتكون من 6 أرقام');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const clean = mobileNumber.replace(/[\s-]/g, '');
      const normalized = clean.startsWith('05')
        ? `+966${clean.slice(1)}`
        : clean.startsWith('5')
        ? `+966${clean}`
        : clean;

      const res = await apiClient<{
        data: { resetToken: string; expiresInSeconds: number };
      }>('/auth/reset-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ mobileNumber: normalized, code })
      });

      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 423 || err.code === 'AUTH_OTP_LOCKED') {
          setLockoutAlert(
            'تم قفل محاولات الاستعادة لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة'
          );
        } else {
          setErrorMessage(err.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
        }
      } else {
        setErrorMessage('حدث خطأ أثناء التحقق، يرجى المحاولة ثانية');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Password Complexity Checks
  const isLengthValid = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isLengthValid && hasLetter && hasNumber && isMatch;

  // Step 3: Reset Password Submission
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setErrorMessage('يرجى التأكد من استيفاء كافة شروط كلمة المرور وتطابقها');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ resetToken, newPassword })
      });

      setStep('success');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AUTH_PASSWORD_SAME_AS_CURRENT') {
          setErrorMessage('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية');
        } else if (
          err.code === 'AUTH_RESET_TOKEN_INVALID' ||
          err.code === 'AUTH_RESET_TOKEN_EXPIRED'
        ) {
          setErrorMessage('انتهت صلاحية جلسة التغيير، يرجى إعادة بدء عملية الاستعادة');
        } else {
          setErrorMessage(err.message || 'فشل تحديث كلمة المرور');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render Step 1
  if (step === 1) {
    return (
      <form onSubmit={handleInitiateReset} className="space-y-5" dir="rtl">
        {errorMessage && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="mobileNumber" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            رقم الجوال
          </label>
          <input
            id="mobileNumber"
            type="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 text-base rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-primary dark:bg-dark-surface-primary text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-right"
            required
          />
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور
          </p>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full py-2.5 font-bold gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          إرسال رمز التحقق
        </Button>

        <div className="text-center pt-2">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary hover:text-primary transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </form>
    );
  }

  // Render Step 2
  if (step === 2) {
    return (
      <div className="space-y-5" dir="rtl">
        {lockoutAlert && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <Clock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{lockoutAlert}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="text-center space-y-1">
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
            تم إرسال رمز التحقق إلى الرقم
          </p>
          <p className="text-base font-bold text-ink-primary dark:text-dark-ink-primary font-mono" dir="ltr">
            {maskedPhone}
          </p>
        </div>

        <div className="py-2">
          <OtpInput
            value={otpCode}
            onChange={setOtpCode}
            onComplete={(code) => handleVerifyOtp(code)}
            disabled={isLoading || !!lockoutAlert}
            hasError={!!errorMessage}
          />
        </div>

        <Button
          onClick={() => handleVerifyOtp()}
          disabled={isLoading || otpCode.length !== 6 || !!lockoutAlert}
          className="w-full py-2.5 font-bold gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          تأكيد رمز التحقق
        </Button>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendSeconds > 0 || isLoading || !!lockoutAlert}
            className={`flex items-center gap-1 font-medium transition-colors ${
              resendSeconds > 0 || !!lockoutAlert
                ? 'text-ink-tertiary cursor-not-allowed'
                : 'text-primary hover:text-primary-hover'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            {resendSeconds > 0
              ? `إعادة إرسال الرمز بعد ${resendSeconds} ثانية`
              : 'إعادة إرسال الرمز الآن'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setOtpCode('');
              setErrorMessage(null);
            }}
            className="text-ink-secondary dark:text-dark-ink-secondary hover:text-primary transition-colors"
          >
            تغيير رقم الجوال
          </button>
        </div>
      </div>
    );
  }

  // Render Step 3
  if (step === 3) {
    return (
      <form onSubmit={handleResetPassword} className="space-y-5" dir="rtl">
        {errorMessage && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

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
              disabled={isLoading}
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
              disabled={isLoading}
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
        <div className="p-3 bg-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-lg space-y-2 border border-surface-border dark:border-dark-surface-border">
          <p className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mb-1">
            شروط كلمة المرور:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div
              className={`flex items-center gap-1.5 ${
                isLengthValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-tertiary'
              }`}
            >
              {isLengthValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              <span>8 خانات على الأقل</span>
            </div>
            <div
              className={`flex items-center gap-1.5 ${
                hasLetter ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-tertiary'
              }`}
            >
              {hasLetter ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              <span>يتضمن حرفاً واحداً على الأقل</span>
            </div>
            <div
              className={`flex items-center gap-1.5 ${
                hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-tertiary'
              }`}
            >
              {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              <span>يتضمن رقماً واحداً على الأقل</span>
            </div>
            <div
              className={`flex items-center gap-1.5 ${
                isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-tertiary'
              }`}
            >
              {isMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              <span>تطابق كلمتي المرور</span>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={isLoading || !isFormValid} className="w-full py-2.5 font-bold gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          تغيير كلمة المرور
        </Button>
      </form>
    );
  }

  // Render Success View
  return (
    <div className="text-center space-y-4 py-4" dir="rtl">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
          تم إعادة تعيين كلمة المرور بنجاح
        </h2>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-sm mx-auto">
          تم تأمين حسابك وإلغاء كافة الجلسات النشطة السابقة. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
        </p>
      </div>

      <div className="pt-2">
        <Link href="/auth/login">
          <Button className="w-full py-2.5 font-bold">
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    </div>
  );
}

