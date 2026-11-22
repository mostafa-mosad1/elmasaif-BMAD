'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Clock,
  User,
  CreditCard,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { OtpInput } from './otp-input';
import { TermsModal } from './terms-modal';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../providers/auth-provider';
import {
  OTP_THROTTLE_SECONDS,
  OTP_EXPIRY_SECONDS,
  registerSchema,
  SessionUser
} from '@elmasaif/shared';

export interface RegisterFormProps {
  onSuccessRedirect?: string;
}

export function RegisterForm({ onSuccessRedirect = '/app/buyer' }: RegisterFormProps) {
  const router = useRouter();
  const { setSessionUser, refreshSession } = useAuth();

  // Step state: 1 = Registration Form, 2 = OTP Verification
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // UI helpers
  const [showPassword, setShowPassword] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(OTP_THROTTLE_SECONDS);
  const [sessionExpiresIn, setSessionExpiresIn] = useState(OTP_EXPIRY_SECONDS);
  const [normalizedMobile, setNormalizedMobile] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Password complexity helpers
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);

  // Resend Countdown Timer
  useEffect(() => {
    if (step !== 2) return;
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // Overall Expiry Timer
  useEffect(() => {
    if (step !== 2) return;
    if (sessionExpiresIn <= 0) return;

    const timer = setInterval(() => {
      setSessionExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, sessionExpiresIn]);

  // Step 1: Submit Details & Request OTP
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side quick checks
    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('يجب الموافقة الصريحة على شروط الاستخدام وسياسة الخصوصية للمتابعة');
      return;
    }

    // Format mobile with +966 prefix if needed
    let cleanMobile = mobileNumber.replace(/[\s-]/g, '');
    if (cleanMobile.startsWith('05')) {
      cleanMobile = `+966${cleanMobile.slice(1)}`;
    } else if (cleanMobile.startsWith('5')) {
      cleanMobile = `+966${cleanMobile}`;
    }

    try {
      // Validate schema
      const payload = registerSchema.parse({
        fullName,
        mobileNumber: cleanMobile,
        nationalId,
        password,
        termsAccepted,
        privacyAccepted
      });

      setIsLoading(true);

      const response = await apiClient.post<{
        code: string;
        message: string;
        data: { mobileNumber: string; resendAvailableInSeconds: number };
      }>('/auth/register', payload);

      setNormalizedMobile(response.data.mobileNumber || cleanMobile);
      setResendCooldown(response.data.resendAvailableInSeconds || OTP_THROTTLE_SECONDS);
      setSessionExpiresIn(OTP_EXPIRY_SECONDS);
      setStep(2);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: { message: string }[] }).issues)) {
        setErrorMessage((err as { issues: { message: string }[] }).issues[0]?.message || 'بيانات الإدخال غير صحيحة');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('حدث خطأ أثناء إرسال البيانات');
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
      const verifyRes = await apiClient.post<{
        code: string;
        message: string;
        data: { user: SessionUser };
      }>('/auth/verify-otp', {
        mobileNumber: normalizedMobile,
        code
      });

      if (verifyRes.data?.user) {
        setSessionUser(verifyRes.data.user);
      }
      try {
        await refreshSession();
      } catch {
        // ignore
      }

      setSuccessMessage('تم التحقق بنجاح! جاري تحويلك...');
      setTimeout(() => {
        router.push(onSuccessRedirect);
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        if (err.statusCode === 423) {
          setIsLocked(true);
        } else if (err.details && typeof err.details === 'object' && 'remainingAttempts' in err.details) {
          setRemainingAttempts(Number((err.details as Record<string, unknown>).remainingAttempts));
        }
      } else {
        setErrorMessage('رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLocked || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post<{
        code: string;
        data: { resendAvailableInSeconds: number };
      }>('/auth/otp/resend', {
        mobileNumber: normalizedMobile
      });

      setResendCooldown(response.data.resendAvailableInSeconds || OTP_THROTTLE_SECONDS);
      setSessionExpiresIn(OTP_EXPIRY_SECONDS);
      setOtpCode('');
      setRemainingAttempts(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        if (err.statusCode === 423) {
          setIsLocked(true);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('تعذر إعادة إرسال الرمز حالياً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Mask mobile number for presentation: +966 5X *** *123
  const formatMaskedMobile = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('9665')) {
      const p1 = clean.slice(0, 3); // 966
      const p2 = clean.slice(3, 5); // 5X
      const p4 = clean.slice(8);    // 1234
      return `+${p1} ${p2} *** *${p4.slice(-3)}`;
    }
    return phone;
  };

  return (
    <div className="w-full">
      {/* Global Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-lg bg-status-dangerBg/10 border border-status-danger text-status-danger text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Global Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="mb-6 p-4 rounded-lg bg-accent-light border border-accent/40 text-accent-dark text-sm flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-accent" />
          <div className="flex-1 font-bold">{successMessage}</div>
        </div>
      )}

      {step === 1 ? (
        /* STEP 1: Registration Form */
        <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              الاسم الكامل <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="fullName"
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم الثلاثي أو الرباعي كما في الهوية"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus:bg-surface dark:focus:bg-dark-surface text-ink-primary dark:text-dark-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <User className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            </div>
          </div>

          {/* Saudi Mobile Number */}
          <div className="space-y-1.5">
            <label htmlFor="mobileNumber" className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              رقم الجوال السعودي <span className="text-status-danger">*</span>
            </label>
            <div className="relative flex rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary focus-within:bg-surface dark:focus-within:bg-dark-surface transition-all overflow-hidden" dir="ltr">
              <span className="inline-flex items-center gap-1 px-3.5 border-e border-surface-border dark:border-dark-surface-border bg-surface-sunken/80 dark:bg-dark-surface-sunken/80 text-ink-secondary dark:text-dark-ink-secondary font-mono text-xs font-bold select-none">
                <span>🇸🇦</span>
                <span>+966</span>
              </span>
              <input
                id="mobileNumber"
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="5XXXXXXXX"
                className="flex-1 block w-full px-3.5 py-2.5 bg-transparent text-ink-primary dark:text-dark-ink-primary font-mono text-sm tracking-wider focus:outline-none text-left"
              />
            </div>
            <p className="text-[11px] text-ink-muted">
              يبدأ بـ 05 أو 5 ويتكون من 9 إلى 10 أرقام
            </p>
          </div>

          {/* National ID / Resident Iqama */}
          <div className="space-y-1.5">
            <label htmlFor="nationalId" className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              رقم الهوية الوطنية أو الإقامة <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="nationalId"
                type="text"
                inputMode="numeric"
                required
                maxLength={10}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                placeholder="1XXXXXXXXX أو 2XXXXXXXXX"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus:bg-surface dark:focus:bg-dark-surface text-ink-primary dark:text-dark-ink-primary font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left"
                dir="ltr"
              />
              <CreditCard className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            </div>
            <p className="text-[11px] text-ink-muted">
              10 أرقام تبدأ بـ 1 (للمواطن السعودي) أو 2 (للمقيم)
            </p>
          </div>

          {/* Password with Strength Indicators */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
              كلمة المرور <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية"
                className="w-full ps-10 pe-11 py-2.5 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 focus:bg-surface dark:focus:bg-dark-surface text-ink-primary dark:text-dark-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <Lock className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-ink-muted hover:text-ink-primary focus:outline-none"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Checklist with clean platform indicators */}
            <div className="pt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all ${
                hasMinLength
                  ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                  : 'bg-surface-sunken dark:bg-dark-surface-sunken border-surface-border dark:border-dark-surface-border text-ink-muted'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-accent' : 'bg-surface-border dark:bg-dark-surface-border'}`} />
                <span>8 خانات كحد أدنى</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all ${
                hasLetter
                  ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                  : 'bg-surface-sunken dark:bg-dark-surface-sunken border-surface-border dark:border-dark-surface-border text-ink-muted'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasLetter ? 'bg-accent' : 'bg-surface-border dark:bg-dark-surface-border'}`} />
                <span>حرف هجائي واحد</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all ${
                hasNumber
                  ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                  : 'bg-surface-sunken dark:bg-dark-surface-sunken border-surface-border dark:border-dark-surface-border text-ink-muted'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-accent' : 'bg-surface-border dark:bg-dark-surface-border'}`} />
                <span>رقم واحد على الأقل</span>
              </div>
            </div>
          </div>

          {/* Legal Consents (PDPL Compliant) */}
          <div className="pt-2 space-y-2.5 border-t border-surface-border dark:border-dark-surface-border">
            <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-sunken/50 transition-colors">
              <input
                id="termsAccepted"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/20 border-surface-border cursor-pointer accent-primary"
              />
              <label htmlFor="termsAccepted" className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed cursor-pointer select-none">
                أوافق على{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="font-bold text-primary hover:underline inline"
                >
                  شروط الاستخدام والأحكام العامة لمنصة المصايف
                </button>
              </label>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-sunken/50 transition-colors">
              <input
                id="privacyAccepted"
                type="checkbox"
                required
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/20 border-surface-border cursor-pointer accent-primary"
              />
              <label htmlFor="privacyAccepted" className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed cursor-pointer select-none">
                أوافق على{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="font-bold text-primary hover:underline inline"
                >
                  سياسة الخصوصية وحماية البيانات الشخصية وفقاً لنظام (PDPL) السعودي
                </button>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full py-3 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
            >
              <span>المتابعة والتحقق من الجوال</span>
              <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
            </Button>
          </div>
        </form>
      ) : (
        /* STEP 2: 6-Digit OTP Verification */
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              تم إرسال رمز التحقق المكون من 6 أرقام عبر رسالة SMS إلى:
            </p>
            <div className="inline-flex items-center gap-2 bg-surface-sunken dark:bg-dark-surface-raised px-3 py-1 rounded-full border border-surface-border dark:border-dark-surface-border">
              <span className="font-mono font-bold text-sm tracking-wider text-ink-primary dark:text-dark-ink-primary" dir="ltr">
                {formatMaskedMobile(normalizedMobile)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErrorMessage(null);
                }}
                className="text-xs text-primary font-bold hover:underline"
              >
                تعديل الرقم
              </button>
            </div>
          </div>

          {/* Overall 300s Expiry Notice */}
          <div className="flex justify-center">
            <Badge variant="neutral" size="sm" icon={<Clock className="w-3.5 h-3.5" />}>
              صلاحية الرمز: {Math.floor(sessionExpiresIn / 60)}:{(sessionExpiresIn % 60).toString().padStart(2, '0')} دقيقة
            </Badge>
          </div>

          {/* Attempt Warning */}
          {remainingAttempts !== null && remainingAttempts > 0 && (
            <div className="p-3 text-center text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg border border-amber-300 dark:border-amber-800">
              تنبيه: متبقي {remainingAttempts} محاولات قبل قفل التحقق لمدة 15 دقيقة
            </div>
          )}

          {/* Lockout Notice */}
          {isLocked && (
            <div className="p-4 text-center text-sm font-bold text-status-danger bg-status-dangerBg/10 rounded-lg border border-status-danger">
              تم قفل التحقق لمدة 15 دقيقة لتكرار المحاولات الخاطئة. يرجى الانتظار والمحاولة لاحقاً.
            </div>
          )}

          {/* OTP Input Component */}
          <div className="py-2">
            <OtpInput
              value={otpCode}
              onChange={setOtpCode}
              onComplete={handleVerifyOtp}
              disabled={isLoading || isLocked || sessionExpiresIn <= 0}
              hasError={!!errorMessage}
            />
          </div>

          {/* Verify Action Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={otpCode.length !== 6 || isLocked || sessionExpiresIn <= 0}
            onClick={() => handleVerifyOtp()}
            className="w-full text-base font-bold shadow-sm"
          >
            تأكيد الرمز وتفعيل الحساب
          </Button>

          {/* Resend Action */}
          <div className="pt-2 text-center text-sm">
            {resendCooldown > 0 ? (
              <span className="text-ink-muted dark:text-dark-ink-muted">
                إعادة إرسال الرمز بعد{' '}
                <span className="font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
                  {resendCooldown}
                </span>{' '}
                ثانية
              </span>
            ) : (
              <button
                type="button"
                disabled={isLoading || isLocked}
                onClick={handleResendOtp}
                className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline focus:outline-none disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة إرسال رمز التحقق
              </button>
            )}
          </div>
        </div>
      )}

      {/* PDPL Terms & Privacy Modal */}
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
    </div>
  );
}
