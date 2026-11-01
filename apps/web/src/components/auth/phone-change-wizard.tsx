'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCw,
  Loader2,
  AlertTriangle,
  Headphones
} from 'lucide-react';
import { OtpInput } from './otp-input';
import { Button } from '../ui/button';
import { apiClient, ApiError } from '../../lib/api-client';
import {
  AUTH_PHONE_SAME_AS_CURRENT,
  AUTH_PHONE_IN_USE,
  AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK,
  AUTH_PHONE_CHANGE_EXPIRED,
  AUTH_OTP_LOCKED,
  AUTH_OTP_INVALID,
  InitiatePhoneChangeResponse,
  VerifyPhoneChangeOtpResponse,
  PhoneChangeCompletionResponse
} from '@elmasaif/shared';

export interface PhoneChangeWizardProps {
  initialPhone?: string;
  hasActiveDeals?: boolean;
  onSuccess?: (newPhone: string) => void;
}

export type WizardStep = 'initiate' | 'verify' | 'completed';

export function PhoneChangeWizard({
  initialPhone = '+966500000000',
  hasActiveDeals = false,
  onSuccess
}: PhoneChangeWizardProps) {
  const [step, setStep] = useState<WizardStep>('initiate');

  // Step 1: Initiation
  const [currentPhone] = useState(initialPhone);
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [activeDealBlocked, setActiveDealBlocked] = useState(hasActiveDeals);

  // Step 2: Verification
  const [requestId, setRequestId] = useState('');
  const [oldPhoneMasked, setOldPhoneMasked] = useState('');
  const [newPhoneMasked, setNewPhoneMasked] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [oldVerified, setOldVerified] = useState(false);
  const [newVerified, setNewVerified] = useState(false);

  // Countdown timers
  const [remainingValiditySeconds, setRemainingValiditySeconds] = useState(900); // 15 mins
  const [resendOldSeconds, setResendOldSeconds] = useState(60);
  const [resendNewSeconds, setResendNewSeconds] = useState(60);

  // Step 3: Completed
  const [updatedPhone, setUpdatedPhone] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingOld, setIsVerifyingOld] = useState(false);
  const [isVerifyingNew, setIsVerifyingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutAlert, setLockoutAlert] = useState<string | null>(null);

  // Helper function for phone masking
  const maskPhone = (phone: string) => {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  };

  // 15-minute validity timer countdown in verify step
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify' && remainingValiditySeconds > 0) {
      timer = setInterval(() => {
        setRemainingValiditySeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, remainingValiditySeconds]);

  // 60-second resend cooldown timers
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify' && (resendOldSeconds > 0 || resendNewSeconds > 0)) {
      timer = setInterval(() => {
        setResendOldSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        setResendNewSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendOldSeconds, resendNewSeconds]);

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit Step 1: Initiate Phone Change
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLockoutAlert(null);

    const clean = newMobileNumber.replace(/[\s-]/g, '');
    if (!/^(\+966|0)?5[0-9]{8}$/.test(clean)) {
      setErrorMessage('يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05 أو +9665');
      return;
    }

    const normalized = clean.startsWith('05')
      ? `+966${clean.slice(1)}`
      : clean.startsWith('5')
      ? `+966${clean}`
      : clean;

    setIsLoading(true);
    try {
      const res = await apiClient<InitiatePhoneChangeResponse>('/users/phone-change/initiate', {
        method: 'POST',
        body: JSON.stringify({ newMobileNumber: normalized })
      });

      setRequestId(res.data.requestId);
      setOldPhoneMasked(res.data.oldPhoneNumberMasked);
      setNewPhoneMasked(res.data.newPhoneNumberMasked);
      setRemainingValiditySeconds(res.data.expiresInSeconds || 900);
      setResendOldSeconds(res.data.resendAvailableInSeconds || 60);
      setResendNewSeconds(res.data.resendAvailableInSeconds || 60);
      setStep('verify');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === AUTH_PHONE_SAME_AS_CURRENT) {
          setErrorMessage('رقم الجوال الجديد مطابق لرقم الجوال الحالي المسجل');
        } else if (err.code === AUTH_PHONE_IN_USE) {
          setErrorMessage('رقم الجوال المدخل مستخدم بالفعل في حساب آخر');
        } else if (err.code === AUTH_PHONE_CHANGE_ACTIVE_DEAL_BLOCK) {
          setActiveDealBlocked(true);
          setErrorMessage(
            'لا يمكن تحديث رقم الجوال أثناء وجود صفقات نشطة قيد الدفع أو المراجعة أو النزاع'
          );
        } else {
          setErrorMessage(err.message || 'حدث خطأ أثناء بدء طلب تغيير الجوال');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Old Phone OTP
  const handleVerifyOld = async () => {
    if (oldCode.length !== 6) {
      setErrorMessage('رمز التحقق لرقمك الحالي يجب أن يتكون من 6 أرقام');
      return;
    }

    setErrorMessage(null);
    setLockoutAlert(null);
    setIsVerifyingOld(true);

    try {
      const res = await apiClient<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse>(
        '/users/phone-change/verify-old',
        {
          method: 'POST',
          body: JSON.stringify({ requestId, code: oldCode })
        }
      );

      if (res.data.isCompleted) {
        const finalPhone =
          ('mobileNumber' in res.data ? (res.data.mobileNumber as string) : undefined) ||
          newMobileNumber;
        setUpdatedPhone(finalPhone);
        setStep('completed');
        if (onSuccess) onSuccess(finalPhone);
      } else {
        setOldVerified(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 423 || err.code === AUTH_OTP_LOCKED) {
          setLockoutAlert('تم قفل التحقق مؤقتاً لمدة 15 دقيقة بعد استنفاد المحاولات الخاطئة');
        } else if (err.code === AUTH_PHONE_CHANGE_EXPIRED) {
          setErrorMessage('انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد');
        } else if (err.code === AUTH_OTP_INVALID) {
          setErrorMessage(err.message || 'رمز التحقق لرقمك الحالي غير صحيح');
        } else {
          setErrorMessage(err.message || 'فشل التحقق من رمز الرقم الحالي');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsVerifyingOld(false);
    }
  };

  // Verify New Phone OTP
  const handleVerifyNew = async () => {
    if (newCode.length !== 6) {
      setErrorMessage('رمز التحقق للرقم الجديد يجب أن يتكون من 6 أرقام');
      return;
    }

    setErrorMessage(null);
    setLockoutAlert(null);
    setIsVerifyingNew(true);

    try {
      const res = await apiClient<VerifyPhoneChangeOtpResponse | PhoneChangeCompletionResponse>(
        '/users/phone-change/verify-new',
        {
          method: 'POST',
          body: JSON.stringify({ requestId, code: newCode })
        }
      );

      if (res.data.isCompleted) {
        const finalPhone =
          ('mobileNumber' in res.data ? (res.data.mobileNumber as string) : undefined) ||
          newMobileNumber;
        setUpdatedPhone(finalPhone);
        setStep('completed');
        if (onSuccess) onSuccess(finalPhone);
      } else {
        setNewVerified(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 423 || err.code === AUTH_OTP_LOCKED) {
          setLockoutAlert('تم قفل التحقق مؤقتاً لمدة 15 دقيقة بعد استنفاد المحاولات الخاطئة');
        } else if (err.code === AUTH_PHONE_CHANGE_EXPIRED) {
          setErrorMessage('انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد');
        } else if (err.code === AUTH_OTP_INVALID) {
          setErrorMessage(err.message || 'رمز التحقق للرقم الجديد غير صحيح');
        } else {
          setErrorMessage(err.message || 'فشل التحقق من رمز الرقم الجديد');
        }
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsVerifyingNew(false);
    }
  };

  // Resend OTP
  const handleResend = async (target: 'OLD' | 'NEW') => {
    setErrorMessage(null);
    setLockoutAlert(null);

    try {
      const res = await apiClient<{ data: { resendAvailableInSeconds: number } }>(
        '/users/phone-change/resend',
        {
          method: 'POST',
          body: JSON.stringify({ requestId, target })
        }
      );

      if (target === 'OLD') {
        setResendOldSeconds(res.data?.resendAvailableInSeconds || 60);
      } else {
        setResendNewSeconds(res.data?.resendAvailableInSeconds || 60);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'حدث خطأ أثناء إعادة إرسال رمز التحقق');
      } else {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
      }
    }
  };

  // STEP 3: Completed
  if (step === 'completed') {
    return (
      <div className="space-y-6 text-center py-6" data-testid="phone-change-completed">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
            تم تحديث رقم الجوال بنجاح
          </h2>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-md mx-auto">
            أصبح رقم الجوال الجديد ({maskPhone(updatedPhone || newMobileNumber)}) هو الرقم المعتمد لحسابك لتسجيل الدخول واستلام الإشعارات.
          </p>
        </div>

        <div className="pt-4">
          <Link href="/app/settings/profile">
            <Button className="w-full sm:w-auto min-w-[200px]">
              العودة إلى إعدادات الحساب
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // STEP 2: Verification (Dual-OTP)
  if (step === 'verify') {
    const isExpired = remainingValiditySeconds <= 0;

    return (
      <div className="space-y-6" data-testid="phone-change-verify">
        {/* 15-Minute Countdown Header */}
        <div className="rounded-lg p-4 bg-surface-muted dark:bg-dark-surface-muted border border-surface-border dark:border-dark-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink-primary dark:text-dark-ink-primary font-medium text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span>الوقت المتبقي لصلاحية الطلب:</span>
          </div>
          <span
            className={`font-mono text-base font-bold ${
              isExpired
                ? 'text-red-600 dark:text-red-400'
                : 'text-primary'
            }`}
            data-testid="validity-countdown"
          >
            {formatCountdown(remainingValiditySeconds)}
          </span>
        </div>

        {/* Expired alert banner */}
        {isExpired && (
          <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>انتهت صلاحية طلب تحديث رقم الجوال (15 دقيقة). يرجى تقديم طلب جديد.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep('initiate');
                  setOldVerified(false);
                  setNewVerified(false);
                  setOldCode('');
                  setNewCode('');
                }}
              >
                بدء طلب جديد
              </Button>
            </div>
          </div>
        )}

        {/* Lockout alert */}
        {lockoutAlert && (
          <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{lockoutAlert}</span>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && (
          <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Box 1: Current Number OTP */}
        <div className="border border-surface-border dark:border-dark-surface-border rounded-xl p-5 space-y-4 bg-surface-card dark:bg-dark-surface-card shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
              رمز التحقق للرقم الحالي ({oldPhoneMasked || maskPhone(currentPhone)})
            </h3>
            {oldVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تم التحقق ✓
              </span>
            ) : (
              <span className="text-xs text-ink-muted dark:text-dark-ink-muted">قيد الانتظار</span>
            )}
          </div>

          {!oldVerified && (
            <div className="space-y-4">
              <OtpInput
                value={oldCode}
                onChange={setOldCode}
                onComplete={() => {}}
                disabled={isExpired || isVerifyingOld}
                autoFocus={true}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resendOldSeconds > 0 || isExpired || isVerifyingOld}
                  onClick={() => handleResend('OLD')}
                  className="gap-2 text-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  {resendOldSeconds > 0
                    ? `إعادة الإرسال خلال (${resendOldSeconds}ث)`
                    : 'إعادة إرسال الرمز للرقم الحالي'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={oldCode.length !== 6 || isExpired || isVerifyingOld}
                  onClick={handleVerifyOld}
                  className="w-full sm:w-auto"
                >
                  {isVerifyingOld ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جاري التحقق...
                    </>
                  ) : (
                    'تأكيد رمز الرقم الحالي'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Box 2: New Number OTP */}
        <div className="border border-surface-border dark:border-dark-surface-border rounded-xl p-5 space-y-4 bg-surface-card dark:bg-dark-surface-card shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
              رمز التحقق للرقم الجديد ({newPhoneMasked || maskPhone(newMobileNumber)})
            </h3>
            {newVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تم التحقق ✓
              </span>
            ) : (
              <span className="text-xs text-ink-muted dark:text-dark-ink-muted">قيد الانتظار</span>
            )}
          </div>

          {!newVerified && (
            <div className="space-y-4">
              <OtpInput
                value={newCode}
                onChange={setNewCode}
                onComplete={() => {}}
                disabled={isExpired || isVerifyingNew}
                autoFocus={false}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resendNewSeconds > 0 || isExpired || isVerifyingNew}
                  onClick={() => handleResend('NEW')}
                  className="gap-2 text-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  {resendNewSeconds > 0
                    ? `إعادة الإرسال خلال (${resendNewSeconds}ث)`
                    : 'إعادة إرسال الرمز للرقم الجديد'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={newCode.length !== 6 || isExpired || isVerifyingNew}
                  onClick={handleVerifyNew}
                  className="w-full sm:w-auto"
                >
                  {isVerifyingNew ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جاري التحقق...
                    </>
                  ) : (
                    'تأكيد رمز الرقم الجديد'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 1: Initiate (Input Form)
  return (
    <form onSubmit={handleInitiate} className="space-y-6" data-testid="phone-change-initiate">
      {/* Current Registered Phone Callout */}
      <div className="border border-surface-border dark:border-dark-surface-border rounded-lg p-4 bg-surface-muted/50 dark:bg-dark-surface-muted/50 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            رقم الجوال المسجل حالياً:
          </span>
          <p className="font-mono font-bold text-base text-ink-primary dark:text-dark-ink-primary">
            {maskPhone(currentPhone)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" />
          تم التحقق ✓
        </span>
      </div>

      {/* Security Callout Banner */}
      <div className="rounded-lg p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-100 text-xs sm:text-sm flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <p className="leading-relaxed">
          لأسباب أمنية ولحماية حسابك من الاختراق، يتطلب تغيير رقم الجوال إرسال رمز تحقق إلى رقمك الحالي ورمز تحقق آخر إلى رقمك الجديد، ويجب تأكيد الرمزين خلال 15 دقيقة.
        </p>
      </div>

      {/* Active Deals Warning Banner */}
      {activeDealBlocked && (
        <div className="rounded-lg p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-100 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">تحديث رقم الجوال معلق مؤقتاً</p>
            <p className="leading-relaxed">
              لا يمكن تغيير رقم الجوال أثناء وجود صفقات نشطة قيد سداد الدفعة أو التدقيق الإداري أو النزاع المفتوح. يرجى الانتظار حتى اكتمال الصفقات الحالية.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Input Field for New Saudi Mobile */}
      <div className="space-y-1.5">
        <label
          htmlFor="newMobileNumber"
          className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary"
        >
          رقم الجوال الجديد
        </label>
        <div className="relative">
          <input
            id="newMobileNumber"
            name="newMobileNumber"
            type="tel"
            dir="ltr"
            disabled={isLoading || activeDealBlocked}
            value={newMobileNumber}
            onChange={(e) => setNewMobileNumber(e.target.value)}
            placeholder="05XXXXXXXX"
            className="w-full text-right px-3.5 py-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-card dark:bg-dark-surface-card text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition"
          />
        </div>
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
          أدخل رقم الجوال بصيغة 05XXXXXXXX أو +9665XXXXXXXX
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading || activeDealBlocked || !newMobileNumber}
        className="w-full gap-2 py-2.5 font-medium"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            جاري إرسال الرموز...
          </>
        ) : (
          'بدء إجراء التحديث وإرسال الرموز'
        )}
      </Button>

      {/* Support Assist Link */}
      <div className="pt-2 text-center border-t border-surface-border dark:border-dark-surface-border">
        <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center gap-1.5">
          <Headphones className="w-3.5 h-3.5 text-ink-muted" />
          فقدت الوصول إلى شريحة رقمك القديم؟{' '}
          <Link
            href="/support/contact"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            تواصل مع الدعم الفني لطلب التحديث الإداري بعد التحقق من الهوية
          </Link>
        </p>
      </div>
    </form>
  );
}

