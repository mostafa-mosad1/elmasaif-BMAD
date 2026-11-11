'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';
import {
  FileCheck,
  ArrowRight,
  ShieldAlert,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  User,
  Phone,
  CreditCard,
  Building2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import { FalLicenseDetailResponse, ProfileStatus } from '@elmasaif/shared';
import { formatLockCountdown } from '../licensing-helpers';

export interface AdminLicenseReviewDetailPageProps {
  initialLicense?: FalLicenseDetailResponse;
  initialLoading?: boolean;
}

export default function AdminLicenseReviewDetailPage(props?: AdminLicenseReviewDetailPageProps) {
  const { initialLicense, initialLoading = !props?.initialLicense } = props || {};
  const params = useParams();
  const router = useRouter();
  const licenseId = String(params?.id || initialLicense?.id || '');

  const [loading, setLoading] = useState(initialLoading);
  const [license, setLicense] = useState<FalLicenseDetailResponse | null>(initialLicense || null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Lock countdown state
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [forceUnlockModalOpen, setForceUnlockModalOpen] = useState(false);

  // Mutation states
  const [rejectionReason, setRejectionReason] = useState('');
  const [forceUnlockReason, setForceUnlockReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchLicense = useCallback(async () => {
    if (!licenseId) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiClient.get<FalLicenseDetailResponse>(`/admin/licenses/${licenseId}`);
      if (res) {
        setLicense(res);
        setRemainingSeconds(res.lockInfo?.remainingSeconds || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل بيانات طلب رخصة فال');
    } finally {
      setLoading(false);
    }
  }, [licenseId]);

  useEffect(() => {
    if (!initialLicense) {
      fetchLicense();
    }
  }, [fetchLicense, initialLicense]);

  // Heartbeat & countdown timers
  useEffect(() => {
    if (!license?.lockInfo?.isLocked) return;

    // Local 1-second countdown interval
    const countdownTimer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 5-minute heartbeat interval if held by current admin
    let heartbeatTimer: NodeJS.Timeout | null = null;
    if (license.lockInfo.isLockedByCurrentAdmin) {
      heartbeatTimer = setInterval(async () => {
        try {
          const hbRes = await apiClient.post<{ remainingSeconds: number }>(
            `/admin/licenses/${licenseId}/heartbeat`,
            {},
          );
          if (hbRes?.remainingSeconds) {
            setRemainingSeconds(hbRes.remainingSeconds);
          }
        } catch (err: any) {
          setErrorBanner('انتهت صلاحية حجز القفل؛ يرجى إعادة حجز المهمة');
          fetchLicense();
        }
      }, 5 * 60 * 1000);
    }

    return () => {
      clearInterval(countdownTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [license?.lockInfo?.isLocked, license?.lockInfo?.isLockedByCurrentAdmin, licenseId, fetchLicense]);

  const handleClaim = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${licenseId}/claim`, {});
      await fetchLicense();
    } catch (err: any) {
      setErrorBanner(err?.message || 'تعذر حجز قفل المراجعة');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRelease = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${licenseId}/release`, {});
      await fetchLicense();
    } catch (err: any) {
      setErrorBanner(err?.message || 'تعذر تحرير القفل');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleForceUnlock = async () => {
    if (!forceUnlockReason.trim() || forceUnlockReason.trim().length < 5) {
      setErrorBanner('سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف');
      return;
    }
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${licenseId}/force-unlock`, {
        reason: forceUnlockReason.trim(),
      });
      setForceUnlockModalOpen(false);
      setForceUnlockReason('');
      await fetchLicense();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل فك القفل الإجباري');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApprove = async () => {
    if (!license) return;
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${licenseId}/approve`, {
        version: license.version,
      });
      setSuccessBanner('تم اعتماد رخصة فال وتفعيل حساب المسوق بنجاح');
      setApproveModalOpen(false);
      await fetchLicense();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في اعتماد الرخصة');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!license) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      setErrorBanner('سبب الرفض يجب ألا يقل عن 10 أحرف موثقة');
      return;
    }
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient.post(`/admin/licenses/${licenseId}/reject`, {
        version: license.version,
        rejectionReason: rejectionReason.trim(),
      });
      setSuccessBanner('تم رفض طلب الترخيص وتوثيق السبب للمستخدم');
      setRejectModalOpen(false);
      setRejectionReason('');
      await fetchLicense();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في رفض الطلب');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-muted">جارٍ تحميل تفاصيل رخصة فال والوثائق...</p>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <p className="text-sm text-red-600 mb-4">{errorBanner || 'الطلب غير موجود'}</p>
        <Link href="/admin/licenses">
          <Button variant="outline">العودة إلى طابور التراخيص</Button>
        </Link>
      </div>
    );
  }

  const isLockedByOther = Boolean(
    license.lockInfo?.isLocked && !license.lockInfo.isLockedByCurrentAdmin,
  );
  const isHeldByMe = Boolean(
    license.lockInfo?.isLocked && license.lockInfo.isLockedByCurrentAdmin,
  );
  const isDecided =
    license.status === ProfileStatus.ACTIVE || license.status === ProfileStatus.REJECTED;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4" dir="rtl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Link href="/admin/licenses" className="hover:text-primary transition-colors">
            طابور التراخيص
          </Link>
          <span>/</span>
          <span className="font-mono">{license.licenseNumber}</span>
        </div>

        <Link href="/admin/licenses">
          <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للطابور</span>
          </Button>
        </Link>
      </div>

      {/* Lock Banner when held by another admin */}
      {isLockedByOther && (
        <div className="mb-6 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">
                  هذا الطلب قيد المراجعة حالياً من قبل{' '}
                  <span className="underline font-bold">
                    {license.lockInfo.lockedByAdminName || 'مشرف آخر'}
                  </span>
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  وضع المعاينة للقراءة فقط. الوقت المتبقي لحجز القفل:{' '}
                  <span className="font-mono font-bold">
                    {formatLockCountdown(remainingSeconds)}
                  </span>
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setForceUnlockModalOpen(true)}
              className="text-xs border-amber-400 text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              فك القفل إجبارياً
            </Button>
          </div>
        </div>
      )}

      {/* Lock Banner when held by current admin */}
      {isHeldByMe && !isDecided && (
        <div className="mb-6 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>
              أنت تحتجز قفل مراجعة هذا الطلب. الوقت المتبقي قبل انتهاء الصلاحية:{' '}
              <span className="font-mono font-bold text-sm">
                {formatLockCountdown(remainingSeconds)}
              </span>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRelease}
            disabled={actionInProgress}
            className="text-xs"
          >
            تحرير القفل
          </Button>
        </div>
      )}

      {/* Error / Success Banners */}
      {errorBanner && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: License & Document Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Renewal Inspection Card (Story 6.3 AC #2, #5) */}
          {license.isRenewal && (
            <Card
              data-testid="renewal-inspection-card"
              className="rounded-2xl border-purple-200 dark:border-purple-800/60 bg-gradient-to-r from-purple-50/80 via-surface to-surface dark:from-purple-950/20 dark:via-dark-surface dark:to-dark-surface shadow-xs overflow-hidden"
            >
              <CardHeader className="px-6 py-4 border-b border-purple-100 dark:border-purple-900/40 mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 font-bold">
                      طلب تجديد رخصة فال
                    </Badge>
                    <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                      مقارنة صلاحية الترخيص وتأثير التجديد على الإعلانات المعلقة
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Date comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border">
                    <span className="text-[11px] text-ink-muted block mb-1">
                      تاريخ الانتهاء السابق المسجل
                    </span>
                    <span className="font-mono font-bold text-sm text-ink-secondary dark:text-dark-ink-secondary">
                      {license.previousExpiryDate
                        ? new Date(license.previousExpiryDate).toLocaleDateString('ar-SA')
                        : 'غير متوفر'}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <span className="text-[11px] text-purple-800 dark:text-purple-300 block mb-1">
                      تاريخ الانتهاء الجديد المطلوب (تمديد)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-purple-950 dark:text-purple-200">
                        {new Date(license.expiryDate).toLocaleDateString('ar-SA')}
                      </span>
                      <span className="inline-flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ تمديد صلاحية سليم
                      </span>
                    </div>
                  </div>
                </div>

                {/* Suspended Listings Automatic Reinstatement Panel */}
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <h5 className="font-bold text-amber-900 dark:text-amber-200">
                        إعلانات معلقة ستتم إعادتها آلياً فور الاعتماد (
                        <span data-testid="reinstatement-count">
                          {license.suspendedListingsCount || 0}
                        </span>
                        )
                      </h5>
                      <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                        وفقاً لقواعد الامتثال، سيتم آلياً فور الضغط على اعتماد نقل كافة إعلانات المسوق
                        المعلقة بسبب انتهاء الرخصة السابقة إلى الحالة النشطة (ACTIVE).
                      </p>
                      {license.suspendedListings && license.suspendedListings.length > 0 && (
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-amber-200 dark:border-amber-800/40">
                          {license.suspendedListings.slice(0, 5).map((lst) => (
                            <div
                              key={lst.id}
                              className="flex items-center justify-between bg-surface dark:bg-dark-surface px-3 py-1.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40 text-[11px]"
                            >
                              <span className="font-semibold text-ink-primary dark:text-dark-ink-primary truncate max-w-xs">
                                {lst.title}
                              </span>
                              <span className="font-mono text-ink-muted">
                                {Number(lst.askPrice).toLocaleString()} ر.س
                              </span>
                            </div>
                          ))}
                          {license.suspendedListings.length > 5 && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 block pt-1">
                              + {license.suspendedListings.length - 5} إعلانات إضافية
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Credentials Card */}
          <Card className="rounded-2xl border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden bg-surface-base dark:bg-dark-surface-base">
            <CardHeader className="px-6 py-5 border-b border-surface-border dark:border-dark-surface-border mb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <span>بيانات رخصة فال والتسجيل التجاري</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-muted mt-1">
                    تم التقديم في {new Date(license.createdAt).toLocaleString('ar-SA')}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    license.status === ProfileStatus.ACTIVE
                      ? 'verified'
                      : license.status === ProfileStatus.REJECTED
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {license.status === ProfileStatus.ACTIVE
                    ? 'معتمدة'
                    : license.status === ProfileStatus.REJECTED
                      ? 'مرفوضة'
                      : 'قيد المراجعة'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border">
                  <span className="text-[11px] text-ink-muted block mb-1">رقم رخصة فال</span>
                  <span className="font-mono font-bold text-base text-ink-primary dark:text-dark-ink-primary">
                    {license.licenseNumber}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border">
                  <span className="text-[11px] text-ink-muted block mb-1">الاسم التجاري المرخص</span>
                  <span className="font-semibold text-base text-ink-primary dark:text-dark-ink-primary">
                    {license.commercialName || 'غير مسجل'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border">
                  <span className="text-[11px] text-ink-muted block mb-1">رقم السجل التجاري (CR)</span>
                  <span className="font-mono text-base text-ink-primary dark:text-dark-ink-primary">
                    {license.crNumber || '—'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border">
                  <span className="text-[11px] text-ink-muted block mb-1">تاريخ الانتهاء</span>
                  <span className="font-mono text-base text-ink-primary dark:text-dark-ink-primary">
                    {new Date(license.expiryDate).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </div>

              {license.rejectionReason && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                  <span className="font-bold block mb-1">سبب الرفض الإداري السابق:</span>
                  <p>{license.rejectionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Card */}
          <Card className="rounded-2xl border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden bg-surface-base dark:bg-dark-surface-base">
            <CardHeader className="px-6 py-5 border-b border-surface-border dark:border-dark-surface-border mb-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>الوثائق والشهادات المرفقة</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Primary Fal Certificate */}
              <div className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      شهادة رخصة فال الرسمية (REGA)
                    </h4>
                    <span className="text-xs font-mono text-ink-muted truncate block max-w-sm">
                      {license.certificateUrl}
                    </span>
                  </div>
                </div>

                {license.certificateDownloadUrl ? (
                  <a
                    href={license.certificateDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الشهادة</span>
                  </a>
                ) : (
                  <span className="text-xs text-ink-muted shrink-0">رابط المعاينة غير متاح</span>
                )}
              </div>

              {/* Supporting Documents */}
              {license.supportingDocumentUrls && license.supportingDocumentUrls.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                    الوثائق الداعمة الإضافية ({license.supportingDocumentUrls.length})
                  </h5>
                  <div className="space-y-2">
                    {license.supportingDocumentUrls.map((url, idx) => {
                      const downloadUrl = license.supportingDocumentDownloadUrls?.[idx];
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 flex items-center justify-between text-xs"
                        >
                          <span className="font-mono text-ink-muted truncate max-w-xs">{url}</span>
                          {downloadUrl ? (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-medium"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>تحميل الوثيقة</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-ink-muted">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Applicant Card & Actions (1 col) */}
        <div className="space-y-6">
          {/* Applicant Info Card */}
          <Card className="rounded-2xl border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden bg-surface-base dark:bg-dark-surface-base">
            <CardHeader className="px-6 py-5 border-b border-surface-border dark:border-dark-surface-border mb-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>بيانات مقدم الطلب</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-surface-border dark:border-dark-surface-border">
                <span className="text-ink-muted">الاسم الكامل</span>
                <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                  {license.applicant.fullName}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-border dark:border-dark-surface-border">
                <span className="text-ink-muted">رقم الجوال</span>
                <span className="font-mono text-ink-primary dark:text-dark-ink-primary">
                  {license.applicant.phoneNumber}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-muted">الهوية الوطنية</span>
                <span className="font-mono text-ink-primary dark:text-dark-ink-primary">
                  {license.applicant.nationalId || '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Decision Actions Card */}
          <Card className="rounded-2xl border-surface-border dark:border-dark-surface-border shadow-xs overflow-hidden bg-surface-base dark:bg-dark-surface-base">
            <CardHeader className="px-6 py-5 border-b border-surface-border dark:border-dark-surface-border mb-0">
              <CardTitle className="text-sm font-bold">اتخاذ القرار الإداري</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {!license.lockInfo?.isLocked && !isDecided && (
                <Button
                  onClick={handleClaim}
                  disabled={actionInProgress}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl shadow-xs"
                >
                  <Lock className="w-4 h-4" />
                  <span>حجز الطلب للبدء في المراجعة</span>
                </Button>
              )}

              {isHeldByMe && !isDecided && (
                <div className="space-y-3">
                  <Button
                    onClick={() => setApproveModalOpen(true)}
                    disabled={actionInProgress}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5 rounded-xl shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد رخصة فال وتفعيل الحساب</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={actionInProgress}
                    className="w-full flex items-center justify-center gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs py-2.5 rounded-xl"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض الطلب مع ذكر السبب</span>
                  </Button>
                </div>
              )}

              {isLockedByOther && !isDecided && (
                <div className="text-center p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface text-xs text-ink-muted">
                  أزرار القرار معطلة لأن الطلب محجوز لمشرف آخر.
                </div>
              )}

              {isDecided && (
                <div className="text-center p-3 rounded-lg bg-surface-sunken dark:bg-dark-surface text-xs text-ink-muted">
                  تم اتخاذ القرار الإداري مسبقاً بهذا الطلب.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        ariaLabel={license.isRenewal ? 'تأكيد اعتماد تجديد رخصة فال' : 'تأكيد اعتماد رخصة فال'}
      >
        <div className="p-6 space-y-4 text-xs" dir="rtl">
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            {license.isRenewal ? 'تأكيد اعتماد تجديد رخصة فال' : 'تأكيد اعتماد رخصة فال'}
          </h3>
          <p className="text-ink-primary dark:text-dark-ink-primary leading-relaxed">
            هل أنت متأكد من صحة بيانات رخصة فال رقم{' '}
            <span className="font-mono font-bold text-primary">{license.licenseNumber}</span> التابعة
            لـ <span className="font-semibold">{license.applicant.fullName}</span>؟
          </p>

          {license.isRenewal ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <span className="font-bold block">إعادة تفعيل الإعلانات المعلقة تلقائياً:</span>
              <p className="leading-relaxed">
                سيؤدي هذا الاعتماد إلى تمديد صلاحية رخصة فال وتحديث الملف الشخصي إلى (ACTIVE)، مع
                إعادة تفعيل تلقائية لـ{' '}
                <span className="font-bold font-mono text-emerald-950 dark:text-emerald-100">
                  {license.suspendedListingsCount || 0}
                </span>{' '}
                إعلان(ات) معلقة لانتهاء الرخصة ونقلها مباشرة إلى الحالة النشطة (ACTIVE).
              </p>
            </div>
          ) : (
            <p className="text-ink-muted">
              سيؤدي هذا الإجراء إلى تفعيل دور المسوق (Marketer) في حساب المستخدم وإشعاره بالاعتماد.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveModalOpen(false)}
              disabled={actionInProgress}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={actionInProgress}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionInProgress ? 'جارٍ الاعتماد...' : 'تأكيد الاعتماد والتفعيل'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        ariaLabel={license.isRenewal ? 'رفض طلب تجديد رخصة فال' : 'رفض طلب اعتماد رخصة فال'}
      >
        <div className="p-6 space-y-4 text-xs" dir="rtl">
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            {license.isRenewal ? 'رفض طلب تجديد رخصة فال' : 'رفض طلب اعتماد رخصة فال'}
          </h3>

          {license.isRenewal && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-1">
              <span className="font-bold block text-[11px]">تنبيه بشأن أثر رفض التجديد:</span>
              <p className="text-[11px] leading-relaxed">
                في حال كانت الرخصة السابقة منتهية الصلاحية، سيبقى الحساب مقيداً للامتثال
                (COMPLIANCE_RESTRICTED) وإعلاناته معلقة. أما إذا كانت الرخصة السابقة لا تزال سارية،
                فسيظل الحساب نشطاً حتى تاريخ انتهائها الأصلي.
              </p>
            </div>
          )}

          <p className="text-ink-primary dark:text-dark-ink-primary">
            يرجى توثيق سبب الرفض بالتفصيل ليتم إبلاغ المستخدم به وتوجيهه لتصحيحه:
          </p>
          <textarea
            rows={4}
            required
            placeholder="مثال: صورة الشهادة غير واضحة وتاريخ الانتهاء غير مطابق للسجلات الرسمية..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
          <span className="text-[11px] text-ink-muted block">
            يجب ألا يقل سبب الرفض عن 10 أحرف (المدخل حالياً: {rejectionReason.trim().length})
          </span>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={actionInProgress}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={actionInProgress || rejectionReason.trim().length < 10}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionInProgress ? 'جارٍ الرفض...' : 'تأكيد الرفض'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Super Admin Force Unlock Modal */}
      <Modal
        open={forceUnlockModalOpen}
        onClose={() => setForceUnlockModalOpen(false)}
        ariaLabel="فك القفل الإجباري (صلاحية المشرف العام)"
      >
        <div className="p-6 space-y-4 text-xs" dir="rtl">
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
            فك القفل الإجباري (صلاحية المشرف العام)
          </h3>
          <p className="text-ink-primary dark:text-dark-ink-primary">
            سيتم إلغاء حجز القفل عن المشرف الحالي وإتاحة الطلب في الطابور العام. يرجى توثيق سبب فك
            القفل:
          </p>
          <input
            type="text"
            required
            placeholder="مثال: غياب المشرف وتجاوز مدة الانتظار"
            value={forceUnlockReason}
            onChange={(e) => setForceUnlockReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForceUnlockModalOpen(false)}
              disabled={actionInProgress}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleForceUnlock}
              disabled={actionInProgress || forceUnlockReason.trim().length < 5}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {actionInProgress ? 'جارٍ فك القفل...' : 'فك القفل وتوثيق السبب'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

