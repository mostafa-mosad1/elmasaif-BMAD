'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Info,
  Sparkles,
  Lock,
} from 'lucide-react';
import { VerificationStatus } from '@elmasaif/shared';
import { useAuth } from '../../../../components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { IdentityDocumentPreview } from '../../../../components/identity/identity-document-preview';
import { IdentityStatusBadge } from '../../../../components/identity/identity-status-badge';
import { IdentityUploadForm } from '../../../../components/identity/identity-upload-form';

export default function IdentitySettingsPage() {
  const { identityStatus, refreshIdentityStatus } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    refreshIdentityStatus().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحميل حالة الهوية.');
    });
  }, [refreshIdentityStatus]);

  const refreshAfterUpload = async () => {
    try {
      await refreshIdentityStatus();
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحديث حالة الهوية.');
    }
  };

  const status = identityStatus?.status || VerificationStatus.NOT_UPLOADED;
  const canUpload =
    status === VerificationStatus.NOT_UPLOADED || status === VerificationStatus.REJECTED;

  return (
    <div dir="rtl" lang="ar" className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Institutional Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-border dark:border-dark-surface-border">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-xs ring-4 ring-primary/5">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted dark:text-dark-ink-muted">
              إعدادات الحساب والأمان
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              توثيق الهوية الوطنية / الإقامة
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary border border-surface-border dark:border-dark-surface-border">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            بيانات مشفرة ومحمية
          </span>
        </div>
      </div>

      {/* Saudi Real Estate Compliance Banner */}
      <div className="flex items-start gap-3.5 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 text-xs sm:text-sm">
          <strong className="text-ink-primary dark:text-dark-ink-primary block font-bold">
            متطلب نظامي إلزامي (الهيئة العامة للعقار):
          </strong>
          <p className="leading-6">
            وفقاً للأنظمة واللوائح العقارية في المملكة العربية السعودية، يلزم التحقق من الهوية الوطنية للمواطنين أو الإقامة النظامية للمقيمين قبل إتمام أي تعاملات مالية أو تقديم عروض شراء ملزمة، لضمان موثوقية وأمان الصفقات العقارية.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Main Status Overview Card */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs bg-surface-base dark:bg-dark-surface-base">
        <CardHeader className="p-0 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border dark:border-dark-surface-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-primary">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">
                  حالة توثيق الهوية
                </CardTitle>
                <CardDescription className="text-xs">
                  مستوى التحقق القانوني من حسابك الشخصي في المنصة
                </CardDescription>
              </div>
            </div>
            <div className="self-start sm:self-auto">
              <IdentityStatusBadge status={status} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-6">
          {/* Status Context Banners */}
          {status === VerificationStatus.PENDING_REVIEW && (
            <div className="p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">
                    الوثيقة قيد الفحص الأمني والمراجعة الإدارية
                  </h4>
                  <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                    تم استلام وثيقة الهوية الخاصة بك بنجاح، ويقوم فريق الامتثال والرقابة بمطابقتها للتأكد من نظاميتها. سنقوم بإشعارك فور اكتمال الاعتماد.
                  </p>
                  {identityStatus?.uploadedAt && (
                    <p className="text-[11px] font-medium text-amber-800/70 dark:text-amber-300/70 pt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      تاريخ إرسال الوثيقة: {new Date(identityStatus.uploadedAt).toLocaleDateString('ar-SA')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {status === VerificationStatus.VERIFIED && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <span>تم اعتماد وتوثيق الهوية الوطنية بنجاح</span>
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </h4>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                  حسابك الآن موثق رسمياً ويتمتع بكافة الصلاحيات الكاملة لإبرام عقود الوساطة العقارية، وتقديم عروض الشراء، واستقبال وتوقيع الصفقات الملزمة.
                </p>
              </div>
            </div>
          )}

          {status === VerificationStatus.REJECTED && (
            <div className="p-5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  تم رفض وثيقة الهوية المرفوعة
                </h4>
                <p className="text-xs text-rose-900/80 dark:text-rose-300/80 leading-relaxed font-semibold">
                  سبب الرفض الموجه من الإدارة:{' '}
                  <span className="font-normal">{identityStatus?.rejectionReason || 'الوثيقة غير واضحة المعالم أو لا تطابق البيانات المسجلة.'}</span>
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  يرجى مراجعة الملاحظة أدناه وإعادة رفع صورة واضحة ومطابقة للهوية الوطنية أو الإقامة.
                </p>
              </div>
            </div>
          )}

          {status === VerificationStatus.NOT_UPLOADED && (
            <div className="p-5 rounded-2xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <h4 className="font-bold text-ink-primary dark:text-dark-ink-primary">
                  لم تقم برفع وثيقة الهوية بعد
                </h4>
                <p className="text-ink-secondary dark:text-dark-ink-secondary leading-relaxed text-xs">
                  رفع وتوثيق الهوية يستغرق دقيقة واحدة فقط ويمنح حسابك شارة التوثيق الرسمية المعتمدة ويفتح لك تقديم عروض الشراء والتفاوض المباشر.
                </p>
              </div>
            </div>
          )}

          {/* Attached Document Preview Section */}
          <IdentityDocumentPreview isUploaded={identityStatus?.isUploaded ?? false} />
        </CardContent>
      </Card>

      {/* Document Upload or Re-upload Section */}
      {canUpload && (
        <Card className="p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs bg-surface-base dark:bg-dark-surface-base">
          <CardHeader className="p-0 mb-6 pb-4 border-b border-surface-border dark:border-dark-surface-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">
                  {status === VerificationStatus.REJECTED
                    ? 'إعادة رفع وثيقة الهوية بعد التصحيح'
                    : 'رفع وثيقة الهوية الوطنية / الإقامة'}
                </CardTitle>
                <CardDescription className="text-xs">
                  يرجى التأكد من وضوح كافة البيانات وسريان صلاحية الوثيقة
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <IdentityUploadForm
              onUploaded={refreshAfterUpload}
              maskedIdNumber={identityStatus?.maskedIdNumber}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
