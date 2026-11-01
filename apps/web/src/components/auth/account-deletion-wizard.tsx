'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Clock,
  RotateCw,
  Loader2,
  Calendar,
  CheckCircle2,
  FileText,
  Building
} from 'lucide-react';
import { OtpInput } from './otp-input';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { apiClient, ApiError } from '../../lib/api-client';
import {
  AccountDeletionEligibilityResponse,
  InitiateAccountDeletionResponse,
  ConfirmAccountDeletionResponse,
  AUTH_DELETION_ACTIVE_DEAL_BLOCK,
  AUTH_DELETION_OPEN_DISPUTE_BLOCK,
  AUTH_DELETION_ACTIVE_CONTRACT_BLOCK
} from '@elmasaif/shared';

export interface AccountDeletionWizardProps {
  initialEligible?: boolean;
  initialMode?: 'COOLING_OFF' | 'STATUTORY_RETENTION' | 'BLOCKED';
  initialBlockedReason?: string;
  onSuccess?: () => void;
}

export type DeletionStep = 'password' | 'otp' | 'completed';

export function AccountDeletionWizard({
  initialEligible = true,
  initialMode = 'COOLING_OFF',
  initialBlockedReason,
  onSuccess
}: AccountDeletionWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<DeletionStep>('password');

  // Blocking / Eligibility state
  const [isBlocked, setIsBlocked] = useState(!initialEligible || initialMode === 'BLOCKED');
  const [blockingReason, setBlockingReason] = useState<string | null>(initialBlockedReason || null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deletionToken, setDeletionToken] = useState('');
  const [maskedMobileNumber, setMaskedMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Post completion state
  const [completedMode, setCompletedMode] = useState<'COOLING_OFF' | 'STATUTORY_RETENTION'>('COOLING_OFF');
  const [deletionDueAt, setDeletionDueAt] = useState<string | null>(null);

  // Status and countdown
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check eligibility on mount if not pre-configured
  useEffect(() => {
    let isMounted = true;
    async function checkEligibility() {
      setIsCheckingEligibility(true);
      try {
        const res = await apiClient<AccountDeletionEligibilityResponse>(
          '/users/delete-account/eligibility'
        );
        if (isMounted) {
          if (!res.data.eligible) {
            setIsBlocked(true);
            setBlockingReason(res.data.blockingReason || res.data.message);
          } else {
            setIsBlocked(false);
            setBlockingReason(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 409) {
            setIsBlocked(true);
            setBlockingReason(err.message || 'لا يمكن تقديم طلب الحذف لوجود ارتباطات عقارية نشطة');
          }
        }
      } finally {
        if (isMounted) {
          setIsCheckingEligibility(false);
        }
      }
    }

    if (!initialBlockedReason && initialEligible) {
      checkEligibility();
    }
    return () => {
      isMounted = false;
    };
  }, [initialEligible, initialBlockedReason]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Request Deletion (Verify Password & Dispatch OTP)
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setErrorMessage('كلمة المرور الحالية مطلوبة لمتابعة إجراء حذف الحساب');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient<InitiateAccountDeletionResponse>(
        '/users/delete-account/initiate',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword })
        }
      );

      setDeletionToken(res.data.deletionToken);
      setMaskedMobileNumber(res.data.maskedMobileNumber);
      setResendCooldown(res.data.resendAvailableInSeconds || 60);
      setStep('otp');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setIsBlocked(true);
          setBlockingReason(err.message);
        } else {
          setErrorMessage(err.message || 'فشل التحقق من كلمة المرور');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Confirm Deletion with OTP & challenge token
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage('رمز التحقق يجب أن يتكون من 6 أرقام');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient<ConfirmAccountDeletionResponse>(
        '/users/delete-account/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            deletionToken,
            code: otpCode
          })
        }
      );

      if (res.data.status === 'DELETION_PENDING') {
        setCompletedMode('COOLING_OFF');
        setDeletionDueAt(res.data.deletionDueAt ? String(res.data.deletionDueAt) : null);
      } else {
        setCompletedMode('STATUTORY_RETENTION');
      }

      setStep('completed');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      } else {
        setErrorMessage('فشل تأكيد حذف الحساب، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient<InitiateAccountDeletionResponse>(
        '/users/delete-account/initiate',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword })
        }
      );

      setDeletionToken(res.data.deletionToken);
      setResendCooldown(res.data.resendAvailableInSeconds || 60);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إعادة إرسال رمز التحقق');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="w-full max-w-2xl mx-auto space-y-6">
      {/* PDPL Statutory Disclosure Banner (Amber/Rose) */}
      <div
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-5 space-y-3"
        role="region"
        aria-label="إشعار الامتثال لنظام حماية البيانات الشخصية"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              حقوق الخصوصية والامتثال لنظام حماية البيانات الشخصية السعودي (PDPL)
            </h3>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              وفقاً لنظام حماية البيانات الشخصية (PDPL) الصادر بالمرسوم الملكي، يحق لك طلب حذف بياناتك الشخصية وحسابك في منصة المصايف.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">مهلة نظامية 14 يوماً:</span> للحسابات الخالية من التعاملات التجارية السابقة. تسجيل الدخول خلال هذه الفترة يلغي طلب الحذف فوراً.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">الاحتفاظ النظامي (BR-18):</span> للحسابات ذات التعاملات المالية أو العقارية، تُحفظ السجلات التعاقدية والضريبية وفق الأنظمة السعودية مع حجب الملف الشخصي.
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Flight Blocking Alert */}
      {isBlocked && (
        <Card className="border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-base font-bold">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
              طلب حذف أو تعطيل الحساب معلق نظامياً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-rose-800 dark:text-rose-200">
            <p>
              {blockingReason ||
                'لا يمكن حذف أو تعطيل الحساب لوجود صفقات عقارية جارية غير مكتملة، أو نزاعات قيد التحقيق، أو عقود وساطة معلقة الرسوم.'}
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              يجب إتمام أو إلغاء كافة الصفقات والنزاعات والعقود المعلقة قبل التمكن من تقديم طلب الحذف.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/app/deals">
                <Button variant="outline" size="sm" className="bg-white/80 dark:bg-zinc-900/80">
                  عرض الصفقات العقارية
                </Button>
              </Link>
              <Link href="/app/disputes">
                <Button variant="outline" size="sm" className="bg-white/80 dark:bg-zinc-900/80">
                  عرض النزاعات المفتوحة
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Wizard Card */}
      {!isBlocked && step !== 'completed' && (
        <Card className="border-rose-200 dark:border-rose-900/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              منطقة الحذف والأمان (Danger Zone)
            </CardTitle>
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              {step === 'password'
                ? 'الخطوة 1 من 2: تأكيد كلمة المرور الحالية لتوليد رمز التحقق الأمني.'
                : 'الخطوة 2 من 2: إدخال رمز التحقق (OTP) المرسل إلى جوالك لتأكيد الحذف.'}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <div
                className="p-3 text-sm rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-2"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {step === 'password' && (
              <form onSubmit={handleInitiate} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary"
                  >
                    كلمة المرور الحالية <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الحالية لتأكيد هويتك"
                      disabled={isLoading}
                      required
                      className="w-full h-11 px-3 pe-10 rounded-lg border border-border bg-surface text-ink-primary focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary focus:outline-none"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !currentPassword}
                  className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-medium gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  طلب رمز التحقق لحذف الحساب
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleConfirm} className="space-y-5">
                <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/60 p-4 border border-border/60 text-sm space-y-1 text-ink-secondary dark:text-dark-ink-secondary">
                  <p>تم إرسال رمز تحقق مؤلف من 6 أرقام إلى جوالك المسجل:</p>
                  <p className="font-mono text-base font-bold text-ink-primary dark:text-dark-ink-primary dir-ltr text-right">
                    {maskedMobileNumber}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary">
                    رمز التحقق (OTP)
                  </label>
                  <OtpInput
                    length={6}
                    value={otpCode}
                    onChange={(val) => setOtpCode(val)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-ink-tertiary pt-1">
                  <span>صلاحية الرمز 5 دقائق</span>
                  {resendCooldown > 0 ? (
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      إعادة الإرسال بعد {resendCooldown} ثانية
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <RotateCw className="h-3 w-3" />
                      إعادة إرسال الرمز
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full h-11 bg-rose-700 hover:bg-rose-800 text-white font-bold gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  تأكيد حذف الحساب نهائياً
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Submission Feedback Cards */}
      {step === 'completed' && (
        <div className="space-y-6">
          {completedMode === 'COOLING_OFF' ? (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2">
                  <Calendar className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-amber-900 dark:text-amber-200">
                  تمت جدولة حذف الحساب بنجاح
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center text-sm text-ink-secondary dark:text-dark-ink-secondary">
                <p>
                  دخل حسابك في فترة مهلة نظامية مدتها <strong className="text-ink-primary font-bold">14 يوماً</strong>{' '}
                  {deletionDueAt && (
                    <span>
                      تنتهي في{' '}
                      <span className="font-semibold text-ink-primary">
                        {new Date(deletionDueAt).toLocaleDateString('ar-SA')}
                      </span>
                    </span>
                  )}
                  .
                </p>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-border text-xs text-ink-secondary">
                  💡 <strong>ملاحظة هامة:</strong> يمكنك إلغاء طلب الحذف في أي وقت وبكل سهولة بمجرد تسجيل الدخول مجدداً إلى حسابك خلال هذه المهلة.
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button className="w-full">تسجيل الدخول / العودة للرئيسية</Button>
                </Link>
              </CardFooter>
            </Card>
          ) : (
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                  تم تعطيل الحساب والامتثال النظامي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center text-sm text-ink-secondary dark:text-dark-ink-secondary">
                <p>
                  تم تعطيل حسابك وإخفاء ملفك الشخصي من البحث العام بنجاح.
                </p>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-border text-xs text-ink-secondary text-right space-y-1">
                  <div className="flex items-center gap-2 font-bold text-ink-primary">
                    <FileText className="h-4 w-4 text-primary" />
                    الاحتفاظ بالسجلات التجارية والمالية (BR-18):
                  </div>
                  <p>
                    نظراً لوجود تعاملات تجارية ومالية سابقة مرتبطة بحسابك، يتم الاحتفاظ بالسجلات التعاقدية والمالية وفقاً للمدد المقررة في الأنظمة التجارية والضريبية السعودية.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button className="w-full">العودة لصفحة تسجيل الدخول</Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

