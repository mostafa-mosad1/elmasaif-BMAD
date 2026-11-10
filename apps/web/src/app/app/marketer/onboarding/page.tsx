'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import {
  ShieldCheck,
  FileCheck,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  X,
  ExternalLink,
  RotateCw,
  Building2,
  Calendar,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { ProfileStatus } from '@elmasaif/shared';
import { useAuth } from '../../../../components/providers/auth-provider';

interface FalLicenseData {
  id?: string;
  licenseNumber?: string;
  commercialName?: string | null;
  crNumber?: string | null;
  expiryDate?: string;
  status: ProfileStatus;
  rejectionReason?: string | null;
  certificateUrl?: string;
  certificateDownloadUrl?: string;
  supportingDocumentUrls?: string[];
  supportingDocumentDownloadUrls?: string[];
}

export interface MarketerOnboardingPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  initialLicense?: FalLicenseData | null;
  initialLoading?: boolean;
}

export default function MarketerOnboardingPage(props?: MarketerOnboardingPageProps) {
  const { initialLicense = null, initialLoading = false } = props || {};
  const { user } = useAuth();
  const [loading, setLoading] = useState(initialLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [existingLicense, setExistingLicense] = useState<FalLicenseData | null>(initialLicense);

  // Form State
  const [licenseNumber, setLicenseNumber] = useState(initialLicense?.licenseNumber || '');
  const [commercialName, setCommercialName] = useState(initialLicense?.commercialName || '');
  const [crNumber, setCrNumber] = useState(initialLicense?.crNumber || '');
  const [expiryDate, setExpiryDate] = useState(
    initialLicense?.expiryDate
      ? new Date(initialLicense.expiryDate).toISOString().split('T')[0]
      : '',
  );
  const [certificateUrl, setCertificateUrl] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [supportingDocs, setSupportingDocs] = useState<{ url: string; name: string }[]>([]);

  // UI state
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingSupporting, setUploadingSupporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate tomorrow as min date
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const fetchLicenseStatus = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiClient.get<{
        profile: { id: string; status: ProfileStatus } | null;
        falLicense: FalLicenseData | null;
      }>('/users/fal-license');

      if (res?.falLicense) {
        setExistingLicense(res.falLicense);
        // Pre-fill form if rejected or under review
        setLicenseNumber(res.falLicense.licenseNumber || '');
        setCommercialName(res.falLicense.commercialName || '');
        setCrNumber(res.falLicense.crNumber || '');
        if (res.falLicense.expiryDate) {
          setExpiryDate(new Date(res.falLicense.expiryDate).toISOString().split('T')[0]);
        }
        if (res.falLicense.certificateUrl) {
          setCertificateUrl(res.falLicense.certificateUrl);
          setCertificateName('شهادة رخصة فال المرفوعة مسبقاً');
        }
      }
    } catch {
      // 404 or empty is expected for unsubmitted licenses
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialLicense) {
      fetchLicenseStatus();
    }
  }, []);

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('حجم الملف يتجاوز الحد المسموح (10 ميجابايت)');
      return;
    }

    try {
      setUploadingCert(true);
      setErrorMessage(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetPartition', 'licenses');
      formData.append('userId', user?.id || 'current-user');

      const res = await apiClient<any>('/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const key = res?.data?.key || res?.key || res?.fileObjectId;
      setCertificateUrl(key);
      setCertificateName(file.name);
    } catch (err: any) {
      setErrorMessage(err?.message || 'فشل في رفع ملف شهادة رخصة فال');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleSupportingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (supportingDocs.length + files.length > 5) {
      setErrorMessage('لا يمكن إرفاق أكثر من 5 وثائق داعمة كحد أقصى');
      return;
    }

    try {
      setUploadingSupporting(true);
      setErrorMessage(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          setErrorMessage(`الملف ${file.name} يتجاوز 10 ميجابايت`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('targetPartition', 'licenses');
        formData.append('userId', user?.id || 'current-user');

        const res = await apiClient<any>('/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const key = res?.data?.key || res?.key || res?.fileObjectId;
        setSupportingDocs((prev) => [...prev, { url: key, name: file.name }]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'فشل في رفع بعض الوثائق الداعمة');
    } finally {
      setUploadingSupporting(false);
    }
  };

  const removeSupportingDoc = (index: number) => {
    setSupportingDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validations
    if (!/^\d{10,12}$/.test(licenseNumber.trim())) {
      setErrorMessage('رقم رخصة فال يجب أن يتكون من 10 إلى 12 رقماً');
      return;
    }

    if (!commercialName.trim() || commercialName.trim().length < 3) {
      setErrorMessage('الاسم التجاري يجب ألا يقل عن 3 أحرف');
      return;
    }

    if (!/^\d{10}$/.test(crNumber.trim())) {
      setErrorMessage('رقم السجل التجاري يجب أن يتكون من 10 أرقام');
      return;
    }

    if (!expiryDate) {
      setErrorMessage('يرجى تحديد تاريخ انتهاء رخصة فال');
      return;
    }

    const selectedExpiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedExpiry <= today) {
      setErrorMessage('تاريخ انتهاء رخصة فال يجب أن يكون في المستقبل');
      return;
    }

    if (!certificateUrl) {
      setErrorMessage('يرجى رفع ملف شهادة رخصة فال الرسمية');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        licenseNumber: licenseNumber.trim(),
        commercialName: commercialName.trim(),
        crNumber: crNumber.trim(),
        expiryDate: new Date(expiryDate).toISOString(),
        certificateUrl,
        supportingDocumentUrls: supportingDocs.map((d) => d.url),
      };

      await apiClient.post('/users/fal-license', payload);
      setSuccessMessage('تم إرسال طلب اعتماد رخصة فال بنجاح وجارٍ التدقيق الإداري');
      await fetchLicenseStatus();
    } catch (err: any) {
      setErrorMessage(err?.message || 'فشل في إرسال طلب الترخيص؛ يرجى مراجعة البيانات المدخلة');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center" dir="rtl">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-ink-muted">جارٍ تحميل بيانات الترخيص والامتثال...</p>
      </div>
    );
  }

  // Active Marketer State
  if (existingLicense?.status === ProfileStatus.ACTIVE) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6" dir="rtl">
        <Card className="p-6 sm:p-10 rounded-2xl border-emerald-300 dark:border-emerald-800 bg-gradient-to-b from-emerald-50/70 via-surface to-surface dark:from-emerald-950/30 dark:via-dark-surface dark:to-dark-surface shadow-level2">
          <CardHeader className="text-center p-0 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 ring-8 ring-emerald-500/5 shadow-sm">
              <CheckCircle2 className="w-11 h-11" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-emerald-950 dark:text-emerald-100">
              تم اعتماد رخصة فال بنجاح!
            </CardTitle>
            <CardDescription className="text-emerald-800 dark:text-emerald-300 text-sm sm:text-base mt-2 max-w-lg mx-auto leading-relaxed">
              حسابك موثق رسمياً ومصرح له بنشر وإدارة العروض والطلبات العقارية وفق ضوابط الهيئة العامة للعقار (REGA).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 space-y-6">
            <div className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/50 p-5 sm:p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border divide-y divide-surface-border dark:divide-dark-surface-border space-y-3.5">
              <div className="flex justify-between items-center text-sm pt-0">
                <span className="text-ink-muted font-medium">رقم رخصة فال</span>
                <span className="font-mono font-bold text-base text-ink-primary dark:text-dark-ink-primary bg-surface dark:bg-dark-surface px-3 py-1 rounded-lg border border-surface-border/80">
                  {existingLicense.licenseNumber}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">الاسم التجاري للمكتب</span>
                <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                  {existingLicense.commercialName || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">رقم السجل التجاري (CR)</span>
                <span className="font-mono font-medium text-ink-primary dark:text-dark-ink-primary">
                  {existingLicense.crNumber || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">تاريخ انتهاء الصلاحية</span>
                <span className="font-mono font-medium text-ink-primary dark:text-dark-ink-primary">
                  {existingLicense.expiryDate
                    ? new Date(existingLicense.expiryDate).toLocaleDateString('ar-SA')
                    : 'غير محدد'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">حالة الاعتماد</span>
                <Badge variant="verified" className="px-3 py-1 font-semibold gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>معتمد ونشط</span>
                </Badge>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
              <Link href="/app/marketer" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 text-base shadow-md font-semibold">
                  <span>الانتقال إلى مساحة المسوق</span>
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Under Review State
  if (existingLicense?.status === ProfileStatus.UNDER_REVIEW) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6" dir="rtl">
        <Card className="p-6 sm:p-10 rounded-2xl border-amber-300/80 dark:border-amber-800/80 bg-gradient-to-b from-amber-50/70 via-surface to-surface dark:from-amber-950/30 dark:via-dark-surface dark:to-dark-surface shadow-level2">
          <CardHeader className="text-center p-0 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20 ring-8 ring-amber-500/5 shadow-sm">
              <Clock className="w-11 h-11 animate-pulse" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-100">
              طلبك قيد المراجعة والتدقيق الإداري
            </CardTitle>
            <CardDescription className="text-amber-900/80 dark:text-amber-300 text-sm sm:text-base mt-2 max-w-lg mx-auto leading-relaxed">
              تم استلام بيانات وشهادة رخصة فال بنجاح، ويقوم فريق التحقق والامتثال بمراجعتها وتدقيقها وفق متطلبات REGA.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 space-y-6">
            {/* Details Table */}
            <div className="bg-surface-sunken/70 dark:bg-dark-surface-sunken/50 p-5 sm:p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border divide-y divide-surface-border dark:divide-dark-surface-border space-y-3.5">
              <div className="flex justify-between items-center text-sm pt-0">
                <span className="text-ink-muted font-medium">رقم رخصة فال</span>
                <span className="font-mono font-bold text-base text-ink-primary dark:text-dark-ink-primary bg-surface dark:bg-dark-surface px-3 py-1 rounded-lg border border-surface-border/80">
                  {existingLicense.licenseNumber}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">الاسم التجاري</span>
                <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                  {existingLicense.commercialName || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">رقم السجل التجاري</span>
                <span className="font-mono font-medium text-ink-primary dark:text-dark-ink-primary">
                  {existingLicense.crNumber || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3.5">
                <span className="text-ink-muted font-medium">حالة الطلب</span>
                <Badge variant="warning" className="px-3 py-1 font-semibold gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>قيد المراجعة الإدارية</span>
                </Badge>
              </div>
            </div>

            {/* SLA Informative Banner */}
            <div className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3 leading-relaxed">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">مدة التدقيق المتوقعة</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  تتم مراجعة الطلبات خلال ساعات العمل الرسمية (خلال 24 ساعة كحد أقصى). سيتم إشعارك فور اتخاذ القرار واعتماد الرخصة وتفعيل مساحة العمل الخاصة بك تلقائياً.
                </p>
              </div>
            </div>

            {/* Refresh Action */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => fetchLicenseStatus(true)}
                disabled={refreshing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm"
              >
                <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث حالة الطلب'}</span>
              </Button>
              <Link href="/app" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto text-sm text-ink-muted hover:text-ink-primary">
                  العودة للرئيسية
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submission / Re-submission Form
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6" dir="rtl">
      {/* Header section outside card */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
          <ShieldCheck className="w-4 h-4" />
          <span>الهيئة العامة للعقار (REGA)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
          {existingLicense?.status === ProfileStatus.COMPLIANCE_RESTRICTED
            ? 'تجديد رخصة فال العقارية (منتهية الصلاحية)'
            : existingLicense?.status === ProfileStatus.REJECTED
            ? 'إعادة تقديم طلب اعتماد رخصة فال'
            : 'توثيق واعتماد رخصة فال العقارية'}
        </h1>
        <p className="text-sm text-ink-muted max-w-lg mx-auto mt-2 leading-relaxed">
          متطلب نظامي إلزامي للمسوقين والوسطاء لنشر وإدارة العروض والطلبات العقارية في منصة المصايف.
        </p>
      </div>

      {/* Compliance Restricted Alert if returning after license expiry */}
      {existingLicense?.status === ProfileStatus.COMPLIANCE_RESTRICTED && (
        <div
          data-testid="compliance-restricted-onboarding-alert"
          className="mb-6 p-5 sm:p-6 rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-bold text-base">تم تقييد حسابك لانتهاء صلاحية رخصة فال</h3>
              <p className="text-sm text-rose-800 dark:text-rose-300 leading-relaxed">
                انتهت صلاحية رخصة فال السابقة وتم تعليق ظهور إعلاناتك النشطة آلياً. يرجى إرفاق شهادة الترخيص المجددة وتحديث تاريخ الانتهاء لاستعادة نشاط الحساب ورفع التعليق فور الاعتماد.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Alert if returning after rejection */}
      {existingLicense?.status === ProfileStatus.REJECTED && (
        <div className="mb-6 p-5 sm:p-6 rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-bold text-base">تم رفض طلب الاعتماد السابق</h3>
              <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
                سبب الرفض الموثق من قبل إدارة المنصة:{' '}
                <span className="font-semibold underline decoration-red-400">
                  {existingLicense?.rejectionReason || 'البيانات أو الشهادة غير مطابقة'}
                </span>
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 pt-1">
                يرجى تصحيح البيانات أو إرفاق شهادة واضحة وسارية وإعادة تقديم الطلب للمراجعة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Card with generous padding */}
      <Card className="p-6 sm:p-10 rounded-2xl border-surface-border dark:border-dark-surface-border shadow-level2 bg-surface-base dark:bg-dark-surface-base">
        <CardHeader className="p-0 mb-8 pb-6 border-b border-surface-border dark:border-dark-surface-border">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                  بيانات الترخيص والشهادة
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-ink-muted mt-0.5">
                  جميع الحقول المؤشر عليها بـ (*) إلزامية لاستكمال عملية التدقيق
                </CardDescription>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted bg-surface-sunken dark:bg-dark-surface-sunken px-2.5 py-1 rounded-lg border border-surface-border">
              <Lock className="w-3 h-3 text-emerald-600" /> مشفر وآمن
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* License Number */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                رقم رخصة فال العقارية <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="مثال: 1200012345"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full px-4 py-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 text-ink-primary dark:text-dark-ink-primary font-mono text-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <span className="absolute left-3 top-3.5 text-xs text-ink-muted font-mono">
                  {licenseNumber.length}/12
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                يتكون رقم الترخيص من 10 إلى 12 رقماً صادرة رسمياً من الهيئة العامة للعقار.
              </p>
            </div>

            {/* Commercial Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                الاسم التجاري / اسم المكتب المرخص <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مؤسسة أفق العقارية أو الاسم كما هو مدون في رخصة فال"
                value={commercialName}
                onChange={(e) => setCommercialName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 text-ink-primary dark:text-dark-ink-primary text-sm focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <p className="text-xs text-ink-muted leading-relaxed">
                يجب أن يتطابق الاسم تماماً مع الاسم الوارد في شهادة ترخيص فال والسجل التجاري.
              </p>
            </div>

            {/* CR Number & Expiry Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* CR Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                  رقم السجل التجاري (CR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="10 أرقام"
                    value={crNumber}
                    onChange={(e) => setCrNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-4 py-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 text-ink-primary dark:text-dark-ink-primary font-mono text-sm focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                  <span className="absolute left-3 top-3.5 text-xs text-ink-muted font-mono">
                    {crNumber.length}/10
                  </span>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                  تاريخ انتهاء الرخصة <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={tomorrowStr}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 text-ink-primary dark:text-dark-ink-primary font-mono text-sm focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            {/* Certificate Upload */}
            <div className="space-y-2.5 pt-2">
              <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                شهادة رخصة فال الرسمية (PDF أو صورة) <span className="text-red-500">*</span>
              </label>

              <div className="border-2 border-dashed border-surface-border dark:border-dark-surface-border hover:border-primary/60 dark:hover:border-primary/60 rounded-2xl p-6 sm:p-8 text-center transition-all bg-surface-sunken/30 hover:bg-surface-sunken/60 group">
                <input
                  type="file"
                  id="cert-file"
                  accept=".pdf,image/jpeg,image/png"
                  onChange={handleCertificateUpload}
                  className="hidden"
                />
                <label
                  htmlFor="cert-file"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                    {uploadingCert ? (
                      <RotateCw className="w-7 h-7 animate-spin" />
                    ) : (
                      <UploadCloud className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary block">
                      {uploadingCert ? 'جارٍ رفع وفحص الملف أمنياً...' : 'اضغط لاختيار ملف الشهادة أو اسحبه هنا'}
                    </span>
                    <span className="text-xs text-ink-muted mt-1 block">
                      الملفات المدعومة: PDF أو JPG أو PNG (الحد الأقصى 10 ميجابايت)
                    </span>
                  </div>
                </label>
              </div>

              {certificateName && (
                <div className="mt-3 flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-medium truncate">
                    <FileText className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="truncate">{certificateName}</span>
                  </div>
                  <Badge variant="verified" className="px-2.5 py-0.5 text-[11px] shrink-0 font-medium">
                    تم الرفع بنجاح
                  </Badge>
                </div>
              )}
            </div>

            {/* Supporting Documents (Optional, up to 5) */}
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                  وثائق داعمة إضافية <span className="text-xs text-ink-muted font-normal">(اختياري)</span>
                </label>
                <span className="text-xs text-ink-muted font-mono">
                  {supportingDocs.length} / 5
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                يمكن إرفاق حتى 5 وثائق مثل: شهادة السجل التجاري، تفويض الهيئة، أو وكالة شرعية سارية.
              </p>

              <input
                type="file"
                id="supporting-file"
                multiple
                accept=".pdf,image/jpeg,image/png"
                onChange={handleSupportingUpload}
                disabled={supportingDocs.length >= 5}
                className="hidden"
              />
              <label
                htmlFor="supporting-file"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  supportingDocs.length >= 5
                    ? 'opacity-50 cursor-not-allowed bg-surface-sunken'
                    : 'bg-surface hover:bg-surface-sunken border-surface-border shadow-sm'
                }`}
              >
                <UploadCloud className="w-4 h-4 text-ink-muted" />
                <span>
                  {uploadingSupporting ? 'جارٍ رفع الوثائق...' : 'إضافة وثيقة داعمة'}
                </span>
              </label>

              {supportingDocs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {supportingDocs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-sunken/60 dark:bg-dark-surface-sunken/50 border border-surface-border text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-ink-muted shrink-0" />
                        <span className="truncate font-medium">{doc.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSupportingDoc(idx)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="حذف المستند"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions and Disclaimer */}
            <div className="pt-6 border-t border-surface-border dark:border-dark-surface-border space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[11px] text-ink-muted leading-relaxed text-center sm:text-right">
                  🔒 بالضغط على زر الإرسال، تقر بصحة البيانات المرفقة ومطابقتها للمتطلبات الرسمية للهيئة العامة للعقار.
                </p>
                <Button
                  type="submit"
                  disabled={submitting || uploadingCert || uploadingSupporting}
                  className="w-full sm:w-auto px-8 py-3 text-base font-semibold shadow-md shrink-0 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>{submitting ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الاعتماد'}</span>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
