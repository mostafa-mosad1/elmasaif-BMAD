'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, X, AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { PayoutAccountItem } from './monospace-iban-card';

export interface DeletePayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: PayoutAccountItem | null;
}

export function DeletePayoutModal({
  isOpen,
  onClose,
  onSuccess,
  account
}: DeletePayoutModalProps) {
  const [otpCode, setOtpCode] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOtpCode('');
    setError(null);
    setOtpRequested(false);
    setCountdown(0);
  }, [isOpen, account]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen || !account) return null;

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

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/payout-accounts/${account.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otpCode: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل حذف الحساب البنكي');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'حدث خطأ أثناء حذف الحساب');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="relative w-full max-w-md rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border"
      >
        <div className="flex items-center justify-between border-b border-surface-border pb-3 dark:border-dark-surface-border">
          <div className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              تأكيد حذف الحساب البنكي
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink-primary dark:hover:bg-dark-surface-raised dark:hover:text-dark-ink-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              هل أنت متأكد من رغبتك في حذف الحساب البنكي <strong>({account.bankName || 'حساب بنكي'})</strong> صاحب الآيبان المنتهي بـ <strong>{account.ibanLast4}</strong>؟
            </span>
          </div>

          <div className="rounded-xl bg-surface-sunken p-4 border border-surface-border dark:bg-dark-surface-sunken dark:border-dark-surface-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-accent" />
                رمز التحقق لتأكيد الحذف *
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRequestOtp}
                disabled={isRequestingOtp || countdown > 0}
                className="h-7 text-xs px-2.5"
              >
                {isRequestingOtp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : countdown > 0 ? (
                  <span>({countdown} ث)</span>
                ) : (
                  <span>{otpRequested ? 'إعادة الإرسال' : 'طلب الرمز'}</span>
                )}
              </Button>
            </div>

            <input
              type="text"
              dir="ltr"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 font-mono text-center text-lg tracking-widest text-ink-primary placeholder:text-ink-muted focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 dark:border-dark-surface-border dark:bg-dark-surface-base dark:text-dark-ink-primary"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-surface-border pt-3 dark:border-dark-surface-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isDeleting} className="text-xs">
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDelete}
            disabled={isDeleting || otpCode.length !== 6}
            className="text-xs bg-red-600 hover:bg-red-700 text-white border-transparent gap-1.5"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>حذف نهائي</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
