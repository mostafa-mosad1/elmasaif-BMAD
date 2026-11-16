'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react';
import {
  validateSaudiIban,
  getSaudiBankName,
  formatSaudiIban
} from '@elmasaif/shared';
import { Button } from '../ui/button';
import { PayoutAccountItem } from './monospace-iban-card';

export interface PayoutAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: PayoutAccountItem | null;
}

export function PayoutAccountModal({
  isOpen,
  onClose,
  onSuccess,
  initialData
}: PayoutAccountModalProps) {
  const isEditing = Boolean(initialData);

  const [accountHolderName, setAccountHolderName] = useState(
    initialData?.accountHolderName || ''
  );
  const [iban, setIban] = useState(
    initialData?.ibanFormatted || initialData?.ibanMasked || ''
  );
  const [otpCode, setOtpCode] = useState('');
  const [isDefault, setIsDefault] = useState(
    initialData?.isDefault ?? true
  );

  const [otpRequested, setOtpRequested] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when initialData changes
  useEffect(() => {
    if (initialData) {
      setAccountHolderName(initialData.accountHolderName);
      setIban(initialData.ibanFormatted || initialData.ibanMasked);
      setIsDefault(initialData.isDefault ?? true);
    } else {
      setAccountHolderName('');
      setIban('');
      setIsDefault(true);
    }
    setOtpCode('');
    setError(null);
    setOtpRequested(false);
    setCountdown(0);
  }, [initialData, isOpen]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  const detectedBankName = getSaudiBankName(cleanIban);
  const isIbanComplete = cleanIban.length === 24;
  const isIbanValid = isIbanComplete ? validateSaudiIban(cleanIban) : false;

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length <= 24) {
      setIban(formatSaudiIban(clean));
    }
  };

  const handleRequestOtp = async () => {
    setError(null);
    setIsRequestingOtp(true);
    try {
      const res = await fetch('/api/v1/users/payout-accounts/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل إرسال رمز التحقق');
      }
      setOtpRequested(true);
      setCountdown(data.data?.resendAvailableInSeconds || 60);
    } catch (err: unknown) {
      setError((err as Error).message || 'حدث خطأ أثناء طلب رمز التحقق');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (accountHolderName.trim().length < 3) {
      setError('اسم صاحب الحساب يجب أن يتكون من 3 أحرف على الأقل');
      return;
    }

    if (!isEditing && !isIbanValid) {
      setError('رقم الآيبان السعودي غير صالح (فشل التحقق من صيغة الحساب البنكي)');
      return;
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/v1/users/payout-accounts/${initialData?.id}`
        : '/api/v1/users/payout-accounts';

      const method = isEditing ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        accountHolderName: accountHolderName.trim(),
        otpCode: otpCode.trim(),
        isDefault
      };

      if (!isEditing || (cleanIban && !cleanIban.includes('*'))) {
        payload.iban = cleanIban;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشلت عملية حفظ الحساب البنكي');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'حدث خطأ أثناء حفظ الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="relative w-full max-w-lg rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-4 dark:border-dark-surface-border">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light text-accent-dark dark:bg-amber-950/60 dark:text-accent">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                {isEditing ? 'تعديل الحساب البنكي' : 'إضافة حساب بنكي جديد'}
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                الحساب المعتمد لتحويل عوائد البيع أو السعي العقاري
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink-primary dark:hover:bg-dark-surface-raised dark:hover:text-dark-ink-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Account Holder Name */}
          <div>
            <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
              اسم صاحب الحساب البنكي (كما هو مسجل لدى البنك) *
            </label>
            <input
              type="text"
              required
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="مثال: سعد بن عبد الله القحطاني"
              className="w-full rounded-lg border border-surface-border bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-sunken dark:text-dark-ink-primary"
            />
            <span className="block text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-1">
              يجب أن يتطابق مع الاسم المسجل أو الاسم التجاري المسجل برخصة فال.
            </span>
          </div>

          {/* Saudi IBAN with real-time Mod-97 check */}
          <div>
            <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
              رقم الآيبان السعودي (IBAN) *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                dir="ltr"
                value={iban}
                onChange={handleIbanChange}
                placeholder="SA03 8000 0000 0000 0000 0000"
                className={`w-full rounded-lg border px-3.5 py-2.5 font-mono text-sm tracking-wider focus:outline-none focus:ring-1 dark:text-dark-ink-primary ${
                  isIbanComplete
                    ? isIbanValid
                      ? 'border-accent focus:border-accent focus:ring-accent bg-accent/5 dark:bg-accent/10 dark:border-accent'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/20 dark:bg-red-950/20'
                    : 'border-surface-border bg-surface-sunken focus:border-accent focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-sunken'
                }`}
              />
              {isIbanComplete && (
                <div className="absolute inset-y-0 end-3 flex items-center">
                  {isIbanValid ? (
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              )}
            </div>

            {/* Bank Name Badge Indicator */}
            {detectedBankName && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent dark:text-accent">
                <Building2 className="h-4 w-4" />
                <span>البنك المكتشف: <strong>{detectedBankName}</strong></span>
              </div>
            )}

            {isIbanComplete && !isIbanValid && (
              <span className="block text-[11px] text-red-600 dark:text-red-400 mt-1">
                رقم الآيبان غير صحيح أو فشل التحقق من خوارزمية Mod-97. يرجى التأكد من صحة الرقم.
              </span>
            )}
          </div>

          {/* Step-Up OTP Verification Section */}
          <div className="rounded-xl bg-surface-sunken p-4 border border-surface-border dark:bg-dark-surface-sunken dark:border-dark-surface-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                <KeyRound className="h-4 w-4 text-accent" />
                <span>التحقق الأمني (Step-Up OTP) *</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRequestOtp}
                disabled={isRequestingOtp || countdown > 0}
                className="h-7 text-xs px-2.5 gap-1"
              >
                {isRequestingOtp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : countdown > 0 ? (
                  <span>إعادة الإرسال بعد ({countdown} ث)</span>
                ) : (
                  <span>{otpRequested ? 'إعادة طلب الرمز' : 'طلب رمز التحقق'}</span>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mb-2">
              لحماية أموالك، يتطلب تعديل أو إضافة الحساب البنكي إدخال رمز التحقق المرسل لجوالك.
            </p>

            <input
              type="text"
              dir="ltr"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-lg border border-surface-border bg-surface-base px-3.5 py-2 font-mono text-center text-lg tracking-widest text-ink-primary placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-base dark:text-dark-ink-primary"
            />
          </div>

          {/* Default Account Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-surface-borderStrong text-accent focus:ring-accent dark:border-dark-surface-border dark:bg-dark-surface-sunken"
            />
            <label htmlFor="isDefault" className="text-xs font-medium text-ink-secondary dark:text-dark-ink-secondary cursor-pointer">
              تعيين هذا الحساب كحساب استلام افتراضي للمبيعات والصفقات
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-4 dark:border-dark-surface-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || (!isEditing && !isIbanValid) || otpCode.length !== 6}
              className="text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isEditing ? 'تحديث الحساب البنكي' : 'تأكيد وحفظ الحساب'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
