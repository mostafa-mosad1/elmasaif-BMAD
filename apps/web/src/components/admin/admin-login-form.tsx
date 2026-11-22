'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ADMIN_ACCOUNT_LOCKED,
  ADMIN_SESSION_INACTIVITY_HOURS,
  AdminLoginResponse,
} from '@elmasaif/shared';
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  KeyRound,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: () => {},
      replace: () => {},
    };
  }
}

export interface AdminLoginFormProps {
  initialError?: string | null;
  initialLockoutSeconds?: number;
}

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AdminLoginForm({
  initialError = null,
  initialLockoutSeconds = 0,
}: AdminLoginFormProps) {
  const router = useSafeRouter();
  const { setSessionAdmin } = useAdminAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(initialLockoutSeconds);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<AdminLoginResponse>('/admin/auth/login', {
        identifier: identifier.trim(),
        password,
      });

      if (response?.data?.admin) {
        setSessionAdmin(response.data.admin);
      }
      router.push('/admin');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر تسجيل الدخول الإداري');
        if (err.status === 423 || err.code === ADMIN_ACCOUNT_LOCKED) {
          const retrySeconds =
            typeof (err.details as Record<string, unknown> | undefined)?.retryAfterSeconds ===
            'number'
              ? ((err.details as Record<string, unknown>).retryAfterSeconds as number)
              : 900;
          setLockoutSeconds(retrySeconds);
        }
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء الاتصال ببوابة الإدارة');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="w-full max-w-[440px] mx-auto bg-white dark:bg-[#121824] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-8 sm:p-9 space-y-6 transition-all"
    >
      {/* Top Header inside Card */}
      <div className="text-center space-y-2">
        {/* Soft Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>بوابة الإدارة السيادية</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          تسجيل الدخول إلى بوابة الإدارة
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
          أهلاً بك مجدداً، يرجى إدخال بيانات الدخول المعتمدة للوصول إلى لوحة التحكم والعمليات.
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 15-Minute Lockout Banner (423 Locked) */}
        {lockoutSeconds > 0 && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 text-red-900 dark:text-red-200 space-y-2 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة</span>
              </div>
              <span
                dir="ltr"
                className="font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-700/60"
              >
                {formatCountdown(lockoutSeconds)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-red-700/90 dark:text-red-300/90">
              تجاوز الحساب الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). يرجى الانتظار حتى انتهاء المؤقت أو التواصل مع المشرف العام.
            </p>
          </div>
        )}

        {/* General Error Alert */}
        {errorMessage && lockoutSeconds === 0 && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-2 shadow-2xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Identifier Field */}
        <div className="space-y-1.5 text-start">
          <label
            htmlFor="admin-identifier"
            className="block text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            اسم المستخدم أو البريد الإلكتروني الإداري
          </label>
          <div className="relative">
            <input
              id="admin-identifier"
              name="identifier"
              type="text"
              dir="ltr"
              required
              autoComplete="username"
              disabled={lockoutSeconds > 0 || isSubmitting}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="superadmin / admin@elmasaif.sa"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0B0F17] hover:bg-white dark:hover:bg-[#0E1420] focus:bg-white dark:focus:bg-[#0E1420] px-4 py-3 ps-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 shadow-2xs transition-all disabled:opacity-50"
            />
            <UserCheck className="w-4 h-4 text-slate-400 absolute start-3.5 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5 text-start">
          <label
            htmlFor="admin-password"
            className="block text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            كلمة المرور الإدارية
          </label>
          <div className="relative">
            <input
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              required
              autoComplete="current-password"
              disabled={lockoutSeconds > 0 || isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0B0F17] hover:bg-white dark:hover:bg-[#0E1420] focus:bg-white dark:focus:bg-[#0E1420] px-4 py-3 ps-10 pe-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 shadow-2xs transition-all disabled:opacity-50"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-3.5 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute end-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-amber-400 transition-colors"
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={lockoutSeconds > 0 || isSubmitting}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-amber-500/15 hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>جاري التحقق من الهوية الإدارية...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>تسجيل الدخول إلى بوابة الإدارة</span>
            </>
          )}
        </button>

        {/* Subtle Footnotes */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-start">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              تنتهي صلاحية الجلسة الإدارية تلقائياً بعد{' '}
              <strong className="text-slate-700 dark:text-slate-200">{`${ADMIN_SESSION_INACTIVITY_HOURS} ساعات`}</strong> من عدم النشاط.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              في حال نسيان كلمة المرور، يقوم <strong className="text-slate-700 dark:text-slate-200">المشرف العام (Super Admin)</strong> بإصدار رابط إعادة تعيين صالح للاستخدام مرة واحدة ولمدة 15 دقيقة إلى بريدك الوظيفي.
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
