'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  User,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { OtpInput } from './otp-input';
import { useAuth } from '../providers/auth-provider';
import { apiClient, ApiError } from '../../lib/api-client';
import {
  DEVICE_COOKIE_NAME,
  AUTH_ACCOUNT_LOCKED,
  AUTH_STEP_UP_REQUIRED,
  SessionUser
} from '@elmasaif/shared';

interface LoginResponsePayload {
  stepUpRequired?: boolean;
  stepUpToken?: string;
  mobileNumber?: string;
  resendAvailableInSeconds?: number;
  user?: SessionUser;
  deviceId?: string;
  deletionCancelled?: boolean;
}

interface StepUpResponsePayload {
  user: SessionUser;
  deviceId?: string;
}

export interface LoginFormProps {
  onSuccessRedirect?: string;
}

export function LoginForm({ onSuccessRedirect }: LoginFormProps) {
  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading, setSessionUser, refreshSession } = useAuth();

  const getEffectiveRedirect = useCallback(
    (targetUser?: SessionUser | null) => {
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const redir = params.get('redirect');
          if (redir && redir.startsWith('/') && !redir.startsWith('/auth')) {
            return redir;
          }
        } catch {
          // ignore
        }
      }
      if (onSuccessRedirect) {
        return onSuccessRedirect;
      }
      // Determine landing space strictly from this specific authenticated user
      const active = targetUser || authUser;
      let role = (active?.activeRole as string) || (active?.role as string);
      if (!role && active?.id && typeof window !== 'undefined') {
        const stored = localStorage.getItem(`elmasaif_default_role_${active.id}`);
        if (stored && ['BUYER', 'OWNER', 'MARKETER'].includes(stored)) {
          role = stored;
        }
      }
      const roleSlug = (role || 'buyer').toLowerCase();
      return `/app/${roleSlug}`;
    },
    [onSuccessRedirect, authUser]
  );

  // Auto-redirect if user is already authenticated
  useEffect(() => {
    if (!isAuthLoading && authUser) {
      const target = getEffectiveRedirect(authUser);
      router.replace(target);
    }
  }, [authUser, isAuthLoading, router, getEffectiveRedirect]);

  // Step state: 1 = Credentials, 2 = Step-Up OTP
  const [step, setStep] = useState<1 | 2>(1);

  // Form inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Step-Up OTP state
  const [stepUpToken, setStepUpToken] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [rawMobile, setRawMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);

  // Lockout & alert banners
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Countdown timer for account lockout banner
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Countdown timer for step-up OTP resend
  useEffect(() => {
    if (step !== 2 || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Format seconds to mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStoredDeviceId = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const local = localStorage.getItem(DEVICE_COOKIE_NAME);
    if (local) return local;
    return undefined;
  };

  const setStoredDeviceId = (id: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEVICE_COOKIE_NAME, id);
  };

  // Step 1: Handle credential login submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const deviceId = getStoredDeviceId();
      const res = await apiClient<{
        code: string;
        message: string;
        data: LoginResponsePayload;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          rememberDevice,
          deviceId
        })
      });

      if (res.code === AUTH_STEP_UP_REQUIRED || res.data?.stepUpRequired) {
        // Unrecognized device -> Switch to Step-Up OTP
        setStepUpToken(res.data.stepUpToken || '');
        setMaskedMobile(res.data.mobileNumber || '');
        setRawMobile(identifier.trim());
        setResendCooldown(res.data.resendAvailableInSeconds || 60);
        setStep(2);
      } else {
        // Recognized device -> Success
        if (res.data?.user) {
          setSessionUser(res.data.user);
        }
        if (res.data?.deletionCancelled) {
          setSuccessMessage('تم إلغاء طلب حذف الحساب واستعادة نشاطه بنجاح');
        }
        if (res.data?.deviceId) {
          setStoredDeviceId(res.data.deviceId);
        }
        try {
          await refreshSession();
        } catch {
          // ignore session hydration error if cookie already active
        }
        const target = getEffectiveRedirect(res.data?.user);
        router.push(target);
        router.refresh();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 423 || err.code === AUTH_ACCOUNT_LOCKED) {
          const details = err.details as { retryAfterSeconds?: number } | undefined;
          const retryAfter = details?.retryAfterSeconds || 15 * 60;
          setLockoutSeconds(retryAfter);
          setErrorMessage(
            'تم قفل الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار والمحاولة لاحقاً'
          );
        } else {
          setErrorMessage(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات المدخلة');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle step-up OTP verify submit
  const handleStepUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const deviceId = getStoredDeviceId();
      const res = await apiClient<{
        code: string;
        message: string;
        data: StepUpResponsePayload;
      }>('/auth/login/step-up', {
        method: 'POST',
        body: JSON.stringify({
          mobileNumber: rawMobile,
          code: otpCode,
          stepUpToken,
          deviceId
        })
      });

      if (res.data?.user) {
        setSessionUser(res.data.user);
      }
      if (res.data?.deviceId) {
        setStoredDeviceId(res.data.deviceId);
      }
      try {
        await refreshSession();
      } catch {
        // ignore
      }
      const target = getEffectiveRedirect(res.data?.user);
      router.push(target);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      } else {
        setErrorMessage('تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend Step-Up OTP
  const handleResendStepUp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Calling login again with credentials triggers a fresh OTP
      const deviceId = getStoredDeviceId();
      const res = await apiClient<{
        code: string;
        data: LoginResponsePayload;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: rawMobile,
          password,
          rememberDevice,
          deviceId
        })
      });

      if (res.data?.stepUpToken) {
        setStepUpToken(res.data.stepUpToken);
        setResendCooldown(res.data.resendAvailableInSeconds || 60);
      }
    } catch {
      setErrorMessage('تعذر إعادة إرسال الرمز حالياً. يرجى المحاولة بعد قليل');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* 15-Minute Brute-Force Lockout Warning Banner */}
      {lockoutSeconds > 0 && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-status-alert/40 bg-status-alert/10 text-ink-primary dark:text-dark-ink-primary flex items-start gap-3 shadow-sm"
        >
          <Clock className="w-6 h-6 text-status-alert shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm sm:text-base text-status-alert">
              تم قفل الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة
            </h4>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary">
              لحماية حسابك، يرجى الانتظار حتى انتهاء فترة التهدئة الأمنية:{' '}
              <span className="font-mono font-bold text-status-alert text-base" dir="ltr">
                {formatTime(lockoutSeconds)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-status-alert/30 bg-status-alert/10 text-status-alert text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Celebratory / Deletion Cancelled Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-lg border border-status-verified/30 bg-status-verified/10 text-status-verified text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* State 1: Credential Login Form */}
      {step === 1 && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* Identifier Input (Mobile or Username) */}
          <div className="space-y-1.5">
            <label
              htmlFor="identifier"
              className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
            >
              اسم المستخدم أو رقم الجوال
            </label>
            <div className="relative">
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                disabled={isLoading || lockoutSeconds > 0}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="05XXXXXXXX أو اسم المستخدم"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus:bg-surface dark:focus:bg-dark-surface text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-sans"
              />
              <User className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
              >
                كلمة المرور
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-accent hover:underline transition-colors"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isLoading || lockoutSeconds > 0}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full ps-10 pe-11 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus:bg-surface dark:focus:bg-dark-surface text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-sans"
              />
              <Lock className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-1 rounded-md transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Device Checkbox */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                disabled={isLoading || lockoutSeconds > 0}
                className="rounded border-surface-border text-primary focus:ring-primary/30 w-4 h-4 accent-primary cursor-pointer"
              />
              <span>تذكر هذا الجهاز</span>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading || lockoutSeconds > 0 || !identifier || password.length < 8}
            className="w-full py-3 rounded-xl font-bold shadow-sm hover:shadow-md transition-all mt-2"
          >
            تسجيل الدخول
          </Button>
        </form>
      )}

      {/* State 2: Step-Up OTP Verification */}
      {step === 2 && (
        <form onSubmit={handleStepUpSubmit} className="space-y-6">
          <div className="p-4 rounded-xl border border-desert-gold/30 bg-desert-gold/5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-desert-gold font-bold">
              <ShieldAlert className="w-4 h-4 text-desert-gold" />
              <Badge variant="pending">تأكيد جهاز دخول جديد</Badge>
            </div>

            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary">
              تم رصد تسجيل دخول من جهاز جديد. لتأمين حسابك، تم إرسال رمز تحقق إضافي إلى جوالك المسجل:
            </p>

            <div className="font-mono font-bold text-sm text-ink-primary dark:text-dark-ink-primary tracking-wider" dir="ltr">
              {maskedMobile || rawMobile}
            </div>
          </div>

          {/* Monospace Reusable OtpInput */}
          <div className="space-y-2 text-center">
            <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
              رمز التحقق (6 أرقام)
            </label>
            <div className="flex justify-center pt-2">
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={isLoading}
                hasError={Boolean(errorMessage)}
              />
            </div>
          </div>

          {/* Resend OTP Section */}
          <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary pt-2">
            <span>لم يصلك الرمز؟</span>
            {resendCooldown > 0 ? (
              <span className="font-mono text-ink-secondary">
                إعادة الإرسال خلال {resendCooldown} ثانية
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendStepUp}
                disabled={isLoading}
                className="text-primary hover:text-primary-hover font-bold inline-flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة إرسال الرمز</span>
              </button>
            )}
          </div>

          {/* Submit Step-Up OTP */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading || otpCode.length !== 6}
            className="w-full font-bold shadow-md"
          >
            تأكيد ومتابعة الدخول
          </Button>

          {/* Back to Login Step 1 */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrorMessage(null);
                setOtpCode('');
              }}
              className="text-xs text-ink-secondary hover:text-ink-primary transition-colors inline-flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لتسجيل الدخول</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
