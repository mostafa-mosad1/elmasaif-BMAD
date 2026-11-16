'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';
import {
  CreditCard,
  ArrowRight,
  ShieldAlert,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  User,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import {
  type ContractFeePaymentDetailResponse,
  CONTRACT_FEE_PAYMENT_STATUS,
} from '@elmasaif/shared';
import {
  formatLockCountdown,
  CONTRACT_FEE_STATUS_CONFIG,
} from '../contract-fees-helpers';
import { useAdminAuth } from '../../../../components/providers/admin-auth-provider';

export interface AdminContractFeeDetailPageProps {
  initialDetail?: ContractFeePaymentDetailResponse;
}

export default function AdminContractFeeDetailPage(props?: AdminContractFeeDetailPageProps) {
  const { initialDetail } = props || {};
  const params = useParams();
  const router = useRouter();
  const { admin, hasPermission } = useAdminAuth();
  const paymentId = String(params?.id || initialDetail?.payment?.id || '');

  const [detail, setDetail] = useState<ContractFeePaymentDetailResponse | null>(initialDetail || null);
  const [loading, setLoading] = useState(!initialDetail);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Lock countdown state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialDetail?.lockInfo?.remainingSeconds || 0,
  );

  // Decision Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [forceUnlockModalOpen, setForceUnlockModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [forceUnlockReason, setForceUnlockReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  const canForceUnlock = admin?.role === 'SUPER_ADMIN' || hasPermission('Tasks.ForceUnlock');

  const fetchDetail = useCallback(async () => {
    if (!paymentId) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiClient<ContractFeePaymentDetailResponse>(`/admin/contract-fees/${paymentId}`);
      if (res) {
        setDetail(res);
        setRemainingSeconds(res.lockInfo?.remainingSeconds || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل تفاصيل إشعار رسوم العقد');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!initialDetail && paymentId) {
      fetchDetail();
    }
  }, [fetchDetail, initialDetail, paymentId]);

  // Lock countdown timer and 5-min heartbeat
  useEffect(() => {
    if (!detail?.lockInfo?.isLocked) return;

    const countdownTimer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    let heartbeatTimer: NodeJS.Timeout | null = null;
    if (detail.lockInfo.isLockedByCurrentAdmin) {
      heartbeatTimer = setInterval(async () => {
        try {
          const renewed = await apiClient<any>(`/admin/contract-fees/${paymentId}/heartbeat`, {
            method: 'POST',
          });
          if (renewed?.remainingSeconds) {
            setRemainingSeconds(renewed.remainingSeconds);
          }
        } catch (err) {
          console.warn('[Heartbeat] renewal failed:', err);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      clearInterval(countdownTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [detail?.lockInfo?.isLocked, detail?.lockInfo?.isLockedByCurrentAdmin, paymentId]);

  const handleClaim = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/contract-fees/${paymentId}/claim`, { method: 'POST' });
      await fetchDetail();
      setSuccessBanner('تم حجز قفل تدقيق الإشعار بنجاح لمدة 15 دقيقة');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في حجز القفل');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleHeartbeat = async () => {
    try {
      setActionInProgress(true);
      const renewed = await apiClient<any>(`/admin/contract-fees/${paymentId}/heartbeat`, {
        method: 'POST',
      });
      if (renewed?.remainingSeconds) {
        setRemainingSeconds(renewed.remainingSeconds);
      }
      setSuccessBanner('تم تمديد القفل لمدة 15 دقيقة إضافية');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تمديد القفل');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRelease = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/contract-fees/${paymentId}/release`, { method: 'POST' });
      await fetchDetail();
      setSuccessBanner('تم تحرير قفل المهمة وإعادتها للطابور');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحرير القفل');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleForceUnlock = async () => {
    if (forceUnlockReason.trim().length < 3) {
      setErrorBanner('سبب فك القفل الإجباري يجب أن يكون 3 أحرف على الأقل');
      return;
    }

    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/contract-fees/${paymentId}/force-unlock`, {
        method: 'POST',
        body: JSON.stringify({ reason: forceUnlockReason.trim() }),
      });
      setForceUnlockModalOpen(false);
      setForceUnlockReason('');
      await fetchDetail();
      setSuccessBanner('تم فك القفل الإجباري بنجاح');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في فك القفل الإجباري');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/contract-fees/${paymentId}/confirm`, {
        method: 'POST',
      });
      setConfirmModalOpen(false);
      await fetchDetail();
      setSuccessBanner('تم تأكيد سداد الرسوم وتفعيل العقد ونشر الإعلان في السوق العام بنجاح');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في اعتماد سداد الرسوم');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectPayment = async () => {
    if (rejectionReason.trim().length < 5) {
      setErrorBanner('سبب الرفض يجب ألا يقل عن 5 أحرف');
      return;
    }

    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/contract-fees/${paymentId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      setRejectModalOpen(false);
      setRejectionReason('');
      await fetchDetail();
      setSuccessBanner('تم رفض إشعار التحويل وإشعار المالك لتصحيح البيانات');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في رفض الإشعار');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="container mx-auto p-12 text-center" dir="rtl">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-700" />
        <p className="text-sm font-bold text-foreground">جاري تحميل ملف تدقيق إشعار رسوم العقد...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="container mx-auto p-12 text-center" dir="rtl">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <p className="text-base font-bold text-foreground">تعذر العثور على إشعار رسوم العقد المطلوب</p>
        <Link href="/admin/contract-fees" className="mt-4 inline-block">
          <Button variant="outline" size="sm">العودة إلى طابور الإشعارات</Button>
        </Link>
      </div>
    );
  }

  const { payment, contract, listing, owner, lockInfo } = detail;
  const isHeldByMe = lockInfo.isLocked && lockInfo.isLockedByCurrentAdmin;
  const isHeldByOther = lockInfo.isLocked && !lockInfo.isLockedByCurrentAdmin;
  const isDecided = payment.status === CONTRACT_FEE_PAYMENT_STATUS.CONFIRMED || payment.status === CONTRACT_FEE_PAYMENT_STATUS.REJECTED;

  const statusCfg = CONTRACT_FEE_STATUS_CONFIG[payment.status] || {
    label: payment.status,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  };

  const isPdf = payment.proofFileUrl?.toLowerCase().includes('.pdf');

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Top Breadcrumb & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/contract-fees"
              className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 font-bold"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>طابور رسوم العقود</span>
            </Link>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-xs font-mono font-bold text-foreground">#{payment.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>ملف تدقيق سداد الرسوم: {listing?.title || 'عقد تسويق عقاري'}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
              {statusCfg.label}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {listing?.id && (
            <Link href={`/listings/${listing.id}`} target="_blank">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة مسودة العقار</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorBanner && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorBanner(null)} className="h-6 px-2 text-xs">إغلاق</Button>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2" role="alert">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSuccessBanner(null)} className="h-6 px-2 text-xs">إغلاق</Button>
        </div>
      )}

      {/* 15-Minute Task Claim Lease Header Bar */}
      <Card className={`border shadow-sm ${
        isHeldByMe
          ? 'border-emerald-300 bg-emerald-50/50'
          : isHeldByOther
          ? 'border-rose-200 bg-rose-50/40'
          : 'border-surface-border bg-surface-sunken'
      }`}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {isHeldByMe ? (
              <>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-emerald-950">قفل المعاينة محجوز لحسابك (15 دقيقة)</p>
                  <p className="text-emerald-800/80 text-[11px]">
                    ينتهي القفل بعد: <strong className="font-mono text-emerald-900">{formatLockCountdown(remainingSeconds)}</strong>
                  </p>
                </div>
              </>
            ) : isHeldByOther ? (
              <>
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-rose-950">
                    المهمة محجوزة بواسطة: {lockInfo.lockedByAdminName || 'مشرف آخر'}
                  </p>
                  <p className="text-rose-800/80 text-[11px]">
                    المتبقي لانتهاء القفل التلقائي: <strong className="font-mono">{formatLockCountdown(remainingSeconds)}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-surface-sunken text-ink-secondary border border-surface-border flex items-center justify-center shrink-0">
                  <Unlock className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">المهمة متاحة للاستلام والتدقيق</p>
                  <p className="text-muted-foreground text-[11px]">
                    يجب استلام القفل قبل اتخاذ قرار الاعتماد أو الرفض لمنع التضارب الإداري
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isHeldByMe && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHeartbeat}
                  disabled={actionInProgress}
                  className="h-8 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100/50"
                  data-testid="heartbeat-lock-btn"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تمديد القفل</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRelease}
                  disabled={actionInProgress}
                  className="h-8 text-xs gap-1 text-ink-secondary hover:text-ink-primary"
                  data-testid="release-lock-btn"
                >
                  <Unlock className="w-3 h-3" />
                  <span>تحرير المهمة</span>
                </Button>
              </>
            )}

            {!lockInfo.isLocked && !isDecided && (
              <Button
                size="sm"
                onClick={handleClaim}
                disabled={actionInProgress}
                className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-bold gap-1"
                data-testid="claim-lock-btn"
              >
                <Lock className="w-3 h-3" />
                <span>حجز ومراجعة الآن</span>
              </Button>
            )}

            {isHeldByOther && canForceUnlock && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setForceUnlockModalOpen(true)}
                disabled={actionInProgress}
                className="h-8 text-xs gap-1"
                data-testid="force-unlock-btn"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>فك القفل الإجباري</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Pane: Property, Contract Terms, Bank Metadata, Owner Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Bank Transfer Details Card */}
          <Card className="shadow-sm border-emerald-200">
            <CardHeader className="p-4 border-b bg-emerald-50/40">
              <CardTitle className="text-sm font-bold text-emerald-950 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span>بيانات إشعار التحويل البنكي المقيدة</span>
                </span>
                <span className="text-base font-bold text-emerald-900">
                  {payment.amount.toLocaleString()} ر.س
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">رقم العملية / مرجع الحوالة:</span>
                  <strong className="font-mono text-foreground text-sm dir-ltr block text-right">
                    {payment.bankReferenceCode || 'لم يحدد'}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">اسم البنك المحول منه:</span>
                  <strong className="text-foreground text-sm block">
                    {payment.senderBankName || 'لم يحدد'}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">تاريخ ووقت الرفع:</span>
                  <span className="text-foreground font-medium block">
                    {payment.uploadedAt ? new Date(payment.uploadedAt).toLocaleString('ar-SA') : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">مهلة التدقيق وفق SLA:</span>
                  <span className="text-emerald-800 font-bold block">
                    خلال 4 ساعات عمل
                  </span>
                </div>
              </div>

              {payment.rejectionReason && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 space-y-1">
                  <span className="font-bold block">ملاحظة الرفض السابقة:</span>
                  <p className="leading-relaxed">{payment.rejectionReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Legal Information */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-700" />
                <span>بيانات المالك الموقع</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">الاسم القانوني:</span>
                <strong className="text-foreground">{owner.legalName}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">رقم الجوال:</span>
                <span className="font-mono text-foreground font-bold dir-ltr text-right block">{owner.maskedMobileNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">رقم الهوية الوطنية:</span>
                <span className="font-mono text-foreground">{owner.nationalId || 'مسجل بالحساب'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">آيبان تحويل الصفقات (Payout IBAN):</span>
                <span className="font-mono text-foreground text-[11px] dir-ltr text-right block">{owner.payoutIban || 'غير مسجل'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Contract Terms Summary */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>بنود العقد والتوقيع الإلكتروني</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">تاريخ توقيع العقد:</span>
                  <span className="font-bold text-foreground">
                    {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('ar-SA') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">بصمة IP للموقع:</span>
                  <span className="font-mono text-foreground">{contract.ipAddress || '127.0.0.1'}</span>
                </div>
              </div>

              {contract.signatureData && (
                <div className="p-2 border border-surface-border rounded-lg bg-surface-sunken text-center space-y-1">
                  <span className="text-[10px] text-muted-foreground block">توقيع المالك المعتمد:</span>
                  <img
                    src={contract.signatureData}
                    alt="توقيع المالك"
                    className="max-h-14 mx-auto object-contain"
                  />
                </div>
              )}

              <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border max-h-36 overflow-y-auto text-[11px] text-ink-primary leading-relaxed font-sans">
                {contract.contractTerms}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Left Pane: Interactive Document / Image Viewer (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-sm overflow-hidden border-surface-border">
            <CardHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span>مستند إشعار التحويل البنكي</span>
              </CardTitle>
              {payment.proofFileUrl && (
                <a
                  href={payment.proofFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الإيصال</span>
                </a>
              )}
            </CardHeader>

            <CardContent className="p-0 bg-surface-sunken flex items-center justify-center min-h-[380px] max-h-[550px] overflow-hidden">
              {payment.proofFileUrl ? (
                isPdf ? (
                  <iframe
                    src={payment.proofFileUrl}
                    title="إشعار التحويل البنكي"
                    className="w-full h-[450px] border-0"
                    data-testid="proof-pdf-frame"
                  />
                ) : (
                  <div className="p-4 overflow-auto max-h-[450px] flex items-center justify-center">
                    <img
                      src={payment.proofFileUrl}
                      alt="إشعار التحويل البنكي"
                      className="max-w-full h-auto object-contain rounded border shadow-sm"
                      data-testid="proof-image-viewer"
                    />
                  </div>
                )
              ) : (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <CreditCard className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">لم يتم رفع مستند إشعار التحويل لهذه الدفعة</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decision Actions Bar */}
          <Card className="shadow-sm border-surface-border">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">
                القرار الإداري وتفعيل النشر
              </CardTitle>
              <CardDescription className="text-xs">
                يتطلب اتخاذ القرار حيازة قفل المعاينة المباشر (15 دقيقة)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={!isHeldByMe || isDecided || actionInProgress}
                className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold h-10 gap-2 shadow-level1"
                data-testid="open-confirm-modal-btn"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد استلام الرسوم واعتماد نشر العقار</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectModalOpen(true)}
                disabled={!isHeldByMe || isDecided || actionInProgress}
                className="w-full text-xs font-bold h-10 gap-2 border-red-300 text-red-700 hover:bg-red-50"
                data-testid="open-reject-modal-btn"
              >
                <XCircle className="w-4 h-4" />
                <span>رفض إشعار التحويل</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <Modal
          open={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          ariaLabel="تأكيد استلام رسوم العقد ونشر الإعلان"
          panelClassName="max-w-lg"
        >
          <div className="text-right" dir="rtl">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-surface-border flex items-start gap-3.5 bg-gradient-to-l from-accent/10 via-surface-base to-surface-base">
              <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-primary">
                  تأكيد استلام رسوم العقد ونشر الإعلان
                </h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  يرجى التحقق من مطابقة إشعار التحويل البنكي لقيمة الرسوم المعتمدة وصحة الحساب البنكي قبل التفعيل النهائي.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-sunken border border-surface-border">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-ink-secondary block">قيمة الرسوم المستلمة</span>
                  <strong className="text-sm font-bold text-accent block">
                    {payment.amount.toLocaleString()} ر.س
                  </strong>
                </div>
                <div className="space-y-0.5 border-r border-surface-border pr-3">
                  <span className="text-[11px] text-ink-secondary block">مرجع الحوالة البنكية</span>
                  <strong className="text-xs font-mono font-bold text-ink-primary block dir-ltr text-right">
                    {payment.bankReferenceCode || 'غير محدد'}
                  </strong>
                </div>
                <div className="col-span-2 pt-2 border-t border-surface-border flex items-center justify-between text-[11px]">
                  <span className="text-ink-secondary">العقار المرتبط:</span>
                  <span className="font-bold text-ink-primary truncate max-w-[260px]">{listing.title}</span>
                </div>
              </div>

              {/* Regulatory & System Impact List */}
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span>الإجراءات النظامية المترتبة على الاعتماد:</span>
                </div>

                <ul className="space-y-2 text-[11px] text-ink-secondary leading-relaxed pr-1">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>
                      تفعيل عقد التسويق الإلكتروني فوراً وتحويل حالته إلى <strong className="text-accent font-bold">نشط (ACTIVE)</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-ink-primary">نشر إعلان العقار تلقائياً في السوق العام</strong> وإتاحته للمشترين والوسطاء.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>
                      إصدار فاتورة ضريبية رسمية (شاملة 15% ضريبة القيمة المضافة) وقيدها في السجل المالي.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>
                      رسوم الإدراج والتسويق غير مستردة نظامياً بعد تنفيذ هذا الإجراء.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-surface-sunken border-t border-surface-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                disabled={actionInProgress}
                className="text-xs h-9 px-4 bg-white"
              >
                تراجع
              </Button>
              <Button
                type="button"
                onClick={handleConfirmPayment}
                disabled={actionInProgress}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-bold h-9 px-5 gap-2 shadow-sm"
                data-testid="execute-confirm-payment-btn"
              >
                {actionInProgress ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التفعيل والنشر...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تأكيد السداد والنشر الفوري</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <Modal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          ariaLabel="رفض إشعار التحويل البنكي"
          panelClassName="max-w-lg"
        >
          <div className="text-right" dir="rtl">
            <div className="p-6 pb-4 border-b border-surface-border flex items-start gap-3.5 bg-gradient-to-l from-red-50/70 via-surface-base to-surface-base">
              <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-primary">
                  رفض إشعار التحويل البنكي
                </h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  يرجى كتابة سبب الرفض بوضوح ليتمكن المالك من تصحيحه وإعادة رفع إشعار تحويل جديد.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-ink-primary block">
                  سبب الرفض الموجه للمالك <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="اكتب سبب الرفض (مثال: الإشعار غير واضح، المبلغ المحول أقل من 1,000 ريال، اسم المحول غير مطابق...)"
                  rows={4}
                  className="w-full p-3 rounded-xl border border-surface-border bg-surface-sunken text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-red-500 leading-relaxed"
                  data-testid="rejection-reason-textarea"
                />
                <span className="text-[11px] text-muted-foreground block">
                  الحد الأدنى: 5 أحرف (المكتوب: {rejectionReason.trim().length})
                </span>
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-sunken border-t border-surface-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectModalOpen(false)}
                disabled={actionInProgress}
                className="text-xs h-9 px-4 bg-surface-base"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleRejectPayment}
                disabled={rejectionReason.trim().length < 5 || actionInProgress}
                className="bg-red-800 hover:bg-red-900 text-white text-xs font-bold h-9 px-5 gap-2 shadow-sm"
                data-testid="execute-reject-payment-btn"
              >
                {actionInProgress ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري تسجيل الرفض...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>تأكيد الرفض وإشعار المالك</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Force Unlock Modal */}
      {forceUnlockModalOpen && (
        <Modal
          open={forceUnlockModalOpen}
          onClose={() => setForceUnlockModalOpen(false)}
          ariaLabel="فك القفل الإجباري (Super Admin)"
          panelClassName="max-w-lg"
        >
          <div className="text-right" dir="rtl">
            <div className="p-6 pb-4 border-b border-surface-border flex items-start gap-3.5 bg-gradient-to-l from-amber-50/70 via-surface-base to-surface-base">
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-primary">
                  فك القفل الإجباري (Super Admin)
                </h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  إلغاء قفل المشرف الحالي يتيح إرجاع المهمة للطابور العام فوراً مع توثيق العملية في سجل التدقيق.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-ink-primary block">
                  سبب فك القفل الإجباري <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={forceUnlockReason}
                  onChange={(e) => setForceUnlockReason(e.target.value)}
                  placeholder="اكتب مبرر فك القفل الإجباري للتوثيق في سجل التدقيق (Audit Log)..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-surface-border bg-surface-sunken text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  data-testid="force-unlock-reason-textarea"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-sunken border-t border-surface-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForceUnlockModalOpen(false)}
                disabled={actionInProgress}
                className="text-xs h-9 px-4 bg-white"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleForceUnlock}
                disabled={forceUnlockReason.trim().length < 3 || actionInProgress}
                variant="destructive"
                className="text-xs font-bold h-9 px-5 gap-2 shadow-sm"
                data-testid="execute-force-unlock-btn"
              >
                <span>تأكيد فك القفل</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

