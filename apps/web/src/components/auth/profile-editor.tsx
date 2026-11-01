'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Loader2,
  Mail,
  User,
  ArrowLeft,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { apiClient, ApiError } from '../../lib/api-client';

export interface ProfileData {
  id: string;
  fullName: string;
  username: string;
  mobileNumber: string;
  nationalId?: string | null;
  email?: string | null;
  pendingEmail?: string | null;
  isEmailPending?: boolean;
  emailVerifiedAt?: string | Date | null;
  hasCommercialNameMismatch?: boolean;
  commercialNameMismatchNotice?: string;
}

interface ProfileEditorProps {
  initialProfile?: ProfileData;
}

export function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const [profile, setProfile] = useState<ProfileData>(
    initialProfile || {
      id: '',
      fullName: '',
      username: '',
      mobileNumber: '',
      nationalId: '',
      email: '',
      pendingEmail: null,
      isEmailPending: false,
      emailVerifiedAt: null,
      hasCommercialNameMismatch: false
    }
  );

  const [fullName, setFullName] = useState(initialProfile?.fullName || '');
  const [email, setEmail] = useState(initialProfile?.email || '');

  const [isLoadingProfile, setIsLoadingProfile] = useState(!initialProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialProfile) {
      let isMounted = true;
      apiClient<{ code: string; data: ProfileData }>('/users/profile')
        .then((res) => {
          if (isMounted && res.data) {
            setProfile(res.data);
            setFullName(res.data.fullName || '');
            setEmail(res.data.email || '');
          }
        })
        .catch(() => {
          // Fallback or silent fail if unauthenticated/mock
        })
        .finally(() => {
          if (isMounted) setIsLoadingProfile(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [initialProfile]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldownSeconds > 0) {
      timer = setInterval(() => {
        setResendCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldownSeconds]);

  const hasNameChanged = fullName.trim() !== (profile.fullName || '').trim();
  const hasEmailChanged = email.trim().toLowerCase() !== (profile.email || '').trim().toLowerCase();
  const isFormDirty = hasNameChanged || hasEmailChanged;
  const isNameLengthValid = fullName.trim().length >= 3 && fullName.trim().length <= 100;
  const isEmailFormatValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = isFormDirty && isNameLengthValid && isEmailFormatValid && !isSaving;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: { fullName?: string; email?: string } = {};
    if (hasNameChanged) payload.fullName = fullName.trim();
    if (hasEmailChanged) payload.email = email.trim().toLowerCase();

    try {
      const res = await apiClient<{
        code: string;
        message: string;
        data: ProfileData;
      }>('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      setProfile(res.data);
      setFullName(res.data.fullName);
      setEmail(res.data.email || '');

      if (res.data.pendingEmail) {
        setResendCooldownSeconds(60);
      }

      setSuccessMessage(res.message || 'تم تحديث البيانات بنجاح');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر تحديث البيانات الشخصية');
      } else {
        setErrorMessage('حدث خطأ غير متوقع أثناء حفظ التغييرات');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldownSeconds > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient<{
        code: string;
        message: string;
        data: { resendAvailableInSeconds: number };
      }>('/users/email/resend', {
        method: 'POST'
      });

      setResendCooldownSeconds(res.data?.resendAvailableInSeconds || 60);
      setSuccessMessage(res.message || 'تم إعادة إرسال رابط التحقق بنجاح');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر إعادة إرسال رابط التحقق');
      } else {
        setErrorMessage('حدث خطأ غير متوقع');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelPendingEmail = async () => {
    if (isCancelling) return;

    setIsCancelling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient<{ code: string; message: string }>('/users/email/pending', {
        method: 'DELETE'
      });

      setProfile((prev) => ({
        ...prev,
        pendingEmail: null,
        isEmailPending: false
      }));

      setResendCooldownSeconds(0);
      setSuccessMessage(res.message || 'تم إلغاء تحديث البريد الإلكتروني بنجاح');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'تعذر إلغاء البريد المعلق');
      } else {
        setErrorMessage('حدث خطأ غير متوقع');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-ink-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm">جاري تحميل بيانات الحساب...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Pending Email Alert Banner */}
      {profile.pendingEmail && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/30 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                البريد الإلكتروني الجديد قيد التحقق
              </h3>
              <p className="text-sm text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                تم إرسال رابط تأكيد إلى ({profile.pendingEmail}). الحساب مستمر في استخدام بريدك الحالي ({profile.email || 'غير محدد'}) حتى يتم فتح الرابط وتأكيده.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendCooldownSeconds > 0 || isResending}
                  className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {resendCooldownSeconds > 0
                    ? `إعادة إرسال الرابط (${resendCooldownSeconds} ثانية)`
                    : 'إعادة إرسال الرابط'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelPendingEmail}
                  disabled={isCancelling}
                  className="gap-2 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  إلغاء التحديث
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commercial Name Mismatch Warning Banner */}
      {profile.hasCommercialNameMismatch && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
              {profile.commercialNameMismatchNotice ||
                'تنبيه نظامي: اسمك المدخل يختلف عن الاسم التجاري المعتمد في رخصة فال. تم إشعار فريق الرقابة الإدارية للمطابقة.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Profile Form Card */}
      <Card className="shadow-sm border-border/80">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            البيانات الشخصية
          </CardTitle>
          <CardDescription>
            تعديل الاسم والبريد الإلكتروني المعتمد واستعراض المعرفات الرسمية المقفلة
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Feedback Banners */}
            {successMessage && (
              <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="fullName" className="text-sm font-medium text-ink-primary dark:text-dark-ink-primary">
                    الاسم الكامل (الظاهر بالمنصة)
                  </label>
                  <span
                    className={`text-xs ${
                      fullName.length < 3 || fullName.length > 100
                        ? 'text-rose-500 font-semibold'
                        : 'text-ink-secondary dark:text-dark-ink-secondary'
                    }`}
                  >
                    {fullName.length} / 100 حرف
                  </span>
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  required
                  minLength={3}
                  maxLength={100}
                />
              </div>

              {/* Email Address Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="email" className="text-sm font-medium text-ink-primary dark:text-dark-ink-primary">
                    البريد الإلكتروني المعتمد
                  </label>
                  {profile.emailVerifiedAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تم التحقق ✓
                    </span>
                  )}
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>

              {/* Username (Read-Only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-between">
                  <span>اسم المستخدم</span>
                  <span className="text-xs text-ink-tertiary flex items-center gap-1">
                    <Lock className="h-3 w-3" /> معرف غير قابل للتعديل
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile.username}
                    readOnly
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/50 text-sm text-ink-secondary cursor-not-allowed select-all font-mono"
                  />
                </div>
              </div>

              {/* Mobile Number (Read-Only with Update Link) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-between">
                  <span>رقم الجوال المعتمد</span>
                  <Link
                    href="/app/settings/mobile"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    تحديث رقم الجوال
                    <ArrowLeft className="h-3 w-3" />
                  </Link>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile.mobileNumber}
                    readOnly
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/50 text-sm text-ink-secondary cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              {/* National ID (Read-Only with Verification Link) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-between">
                  <span>رقم الهوية الوطنية / الإقامة</span>
                  <Link
                    href="/app/settings/identity"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    توثيق الهوية
                    <ArrowLeft className="h-3 w-3" />
                  </Link>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile.nationalId || 'مكتمل التوثيق'}
                    readOnly
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/50 text-sm text-ink-secondary cursor-not-allowed font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 flex justify-end">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="gap-2 min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'حفظ التغييرات'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
