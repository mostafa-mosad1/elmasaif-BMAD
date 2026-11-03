'use client';

import React, { useState, useEffect } from 'react';
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
      className="w-full max-w-md mx-auto bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl shadow-lg overflow-hidden"
    >
      {/* Executive Sovereign Header */}
      <div className="bg-[#1B4332] text-white px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <ShieldCheck className="w-6 h-6 text-[#D8F3DC]" />
          </div>
          <div>
            <span className="inline-block text-[11px] font-semibold tracking-wide bg-white/15 text-[#D8F3DC] px-2.5 py-0.5 rounded-full mb-1">
              نطاق أمني معزول • AD-5
            </span>
            <h1 className="text-xl font-bold">بوابة الإدارة السيادية — المصايف</h1>
          </div>
        </div>
        <p className="text-xs text-white/80 leading-relaxed">
          مخصصة لمنسوبي الإدارة المعتمدين فقط. جميع محاولات الدخول والعمليات الإدارية مسجلة في سجل التدقيق غير القابل للتعديل.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* 15-Minute Lockout Banner (423 Locked) */}
        {lockoutSeconds > 0 && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة</span>
              </div>
              <span
                dir="ltr"
                className="font-mono text-sm font-bold px-2.5 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-100"
              >
                {formatCountdown(lockoutSeconds)}
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              تجاوز الحساب الحد الأقصى لمحاولات الدخول الخاطئة (5 محاولات). يرجى الانتظار حتى انتهاء المؤقت أو التواصل مع المشرف العام.
            </p>
          </div>
        )}

        {/* General Error Alert */}
        {errorMessage && lockoutSeconds === 0 && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-medium flex items-center gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Identifier Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="admin-identifier"
            className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
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
              className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 ps-10 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
            <UserCheck className="w-4 h-4 text-ink-muted absolute start-3.5 top-3" />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="admin-password"
            className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
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
              className="w-full rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface px-3.5 py-2.5 ps-10 pe-10 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
            <Lock className="w-4 h-4 text-ink-muted absolute start-3.5 top-3" />
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={lockoutSeconds > 0 || isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-[#1B4332] hover:bg-[#143325] disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            {isSubmitting ? 'جاري التحقق من الهوية الإدارية...' : 'تسجيل الدخول إلى بوابة الإدارة'}
          </span>
        </button>

        {/* Session & Password Reset Governance Footnote */}
        <div className="pt-3 border-t border-surface-border dark:border-dark-surface-border space-y-2 text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
            <span>
              تنتهي صلاحية الجلسة الإدارية تلقائياً بعد{' '}
              <strong>{`${ADMIN_SESSION_INACTIVITY_HOURS} ساعات`}</strong> من عدم النشاط.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <KeyRound className="w-3.5 h-3.5 text-[#1B4332] shrink-0 mt-0.5" />
            <span>
              في حال نسيان كلمة المرور، يقوم <strong>المشرف العام (Super Admin)</strong> بإصدار رابط إعادة تعيين صالح للاستخدام مرة واحدة ولمدة 15 دقيقة إلى بريدك الوظيفي.
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
