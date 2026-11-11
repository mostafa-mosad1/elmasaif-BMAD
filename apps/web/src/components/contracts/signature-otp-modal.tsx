'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Clock, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { OtpInput } from '../auth/otp-input';
import { STATIC_DEV_OTP } from '@elmasaif/shared';

export interface SignatureOtpModalProps {
  open: boolean;
  onClose: () => void;
  maskedMobile: string;
  initialCooldownSeconds?: number;
  onResendOtp: () => Promise<number | void>; // returns new cooldown or void
  onConfirmSignature: (otpCode: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function SignatureOtpModal({
  open,
  onClose,
  maskedMobile,
  initialCooldownSeconds = 60,
  onResendOtp,
  onConfirmSignature,
  isSubmitting = false,
}: SignatureOtpModalProps) {
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(initialCooldownSeconds);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setOtpCode('');
      setErrorMsg(null);
      setCooldown(initialCooldownSeconds);
    }
  }, [open, initialCooldownSeconds]);

  // Cooldown countdown timer
  useEffect(() => {
    if (!open || cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [open, cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return;
    try {
      setIsResending(true);
      setErrorMsg(null);
      const newCooldown = await onResendOtp();
      setCooldown(typeof newCooldown === 'number' ? newCooldown : 60);
      setOtpCode('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل في إعادة إرسال رمز التحقق');
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending, onResendOtp]);

  const handleConfirm = useCallback(async () => {
    if (otpCode.length !== 6 || isSubmitting) return;
    try {
      setErrorMsg(null);
      await onConfirmSignature(otpCode);
    } catch (err: any) {
      setErrorMsg(err?.message || 'رمز التحقق غير صحيح أو انتهت صلاحيته');
    }
  }, [otpCode, isSubmitting, onConfirmSignature]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      ariaLabel="تأكيد التوقيع الإلكتروني برمز التحقق"
      closeLabel="إلغاء"
      panelClassName="max-w-md"
      testId="signature-otp-modal"
    >
      <div className="p-6 space-y-5" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            تأكيد التوقيع الإلكتروني
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            تم إرسال رمز تحقق مؤلف من 6 أرقام إلى رقم جوالك المسجل:
            <span className="font-bold text-slate-800 dir-ltr inline-block mx-1">
              {maskedMobile}
            </span>
          </p>
        </div>

        {/* Dev Mode Badge */}
        {isDev && (
          <div
            className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold"
            data-testid="dev-static-otp-hint"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>بيئة التطوير: الرمز الثابت هو</span>
            </div>
            <code className="px-2 py-0.5 rounded bg-white font-mono font-bold text-amber-900 border border-amber-300">
              {STATIC_DEV_OTP}
            </code>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
            data-testid="signature-otp-error"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* OTP Input Fields */}
        <div className="py-2">
          <label className="block text-center text-xs font-medium text-slate-700 mb-2">
            أدخل رمز التحقق المكون من 6 أرقام
          </label>
          <OtpInput
            value={otpCode}
            onChange={(val) => {
              setOtpCode(val);
              if (errorMsg) setErrorMsg(null);
            }}
            onComplete={(code) => {
              // Auto-submit when all 6 digits entered
              if (!isSubmitting) {
                onConfirmSignature(code).catch((err: any) => {
                  setErrorMsg(err?.message || 'رمز التحقق غير صحيح أو انتهت صلاحيته');
                });
              }
            }}
            disabled={isSubmitting}
            hasError={Boolean(errorMsg)}
          />
        </div>

        {/* Resend Cooldown */}
        <div className="flex items-center justify-center text-xs text-slate-500">
          {cooldown > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>إعادة إرسال الرمز متاحة خلال {cooldown} ثانية</span>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={isResending || isSubmitting}
              className="text-xs text-primary hover:text-primary/90 font-bold gap-1.5"
              data-testid="resend-otp-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>إعادة إرسال الرمز</span>
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={otpCode.length !== 6 || isSubmitting}
            className="flex-1 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs h-10 shadow-sm"
            data-testid="confirm-signature-btn"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري توثيق التوقيع...</span>
              </span>
            ) : (
              <span>اعتماد وتوثيق التوقيع</span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-10 px-4"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}

