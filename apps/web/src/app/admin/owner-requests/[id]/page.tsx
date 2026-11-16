'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';
import {
  FileText,
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
  CreditCard,
  Building,
  RefreshCw,
  Send,
  Edit,
  ExternalLink,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import {
  OwnerListingRequestDetailResponse,
  ContractTemplateItem,
  OwnerListingRequestStatus,
  OwnerContractStatus,
  PropertyType,
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
} from '@elmasaif/shared';
import {
  formatLockCountdown,
  OWNER_REQUEST_STATUS_MAP,
  PROPERTY_TYPE_MAP,
} from '../contracts-helpers';
import { useAdminAuth } from '../../../../components/providers/admin-auth-provider';

export interface AdminOwnerRequestDetailPageProps {
  initialDetail?: OwnerListingRequestDetailResponse;
}

export default function AdminOwnerRequestDetailPage(props?: AdminOwnerRequestDetailPageProps) {
  const { initialDetail } = props || {};
  const params = useParams();
  const router = useRouter();
  const { admin, hasPermission } = useAdminAuth();
  const requestId = String(params?.id || initialDetail?.id || '');

  const [detail, setDetail] = useState<OwnerListingRequestDetailResponse | null>(initialDetail || null);
  const [templates, setTemplates] = useState<ContractTemplateItem[]>([]);
  const [loading, setLoading] = useState(!initialDetail);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Lock countdown state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialDetail?.lockInfo?.remainingSeconds || 0,
  );

  // Dispatch Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contractFee, setContractFee] = useState<number>(DEFAULT_OWNER_CONTRACT_FEE_SAR);
  const [feeOverrideReason, setFeeOverrideReason] = useState<string>('');
  const [customTerms, setCustomTerms] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [modificationModalOpen, setModificationModalOpen] = useState(false);
  const [forceUnlockModalOpen, setForceUnlockModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [modificationNotes, setModificationNotes] = useState('');
  const [forceUnlockReason, setForceUnlockReason] = useState('');

  const canForceUnlock = admin?.role === 'SUPER_ADMIN' || hasPermission('Tasks.ForceUnlock');
  const canOverrideFee = admin?.role === 'SUPER_ADMIN' || hasPermission('Contracts.FeeOverride');

  const fetchDetail = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiClient<OwnerListingRequestDetailResponse>(`/admin/owner-requests/${requestId}`);
      if (res) {
        setDetail(res);
        setRemainingSeconds(res.lockInfo?.remainingSeconds || 0);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل تفاصيل طلب المالك');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiClient<ContractTemplateItem[]>('/admin/contract-templates');
      if (Array.isArray(res)) {
        setTemplates(res);
        if (res.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(res[0]!.id);
        }
      }
    } catch {
      // Templates fetch failure fallback
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!initialDetail) {
      fetchDetail();
    }
    fetchTemplates();
  }, [fetchDetail, fetchTemplates, initialDetail]);

  // Heartbeat & countdown timers
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
          const renewed = await apiClient<any>(`/admin/owner-requests/${requestId}/heartbeat`, {
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
  }, [detail?.lockInfo?.isLocked, detail?.lockInfo?.isLockedByCurrentAdmin, requestId]);

  const handleClaim = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/claim`, { method: 'POST' });
      await fetchDetail();
      setSuccessBanner('تم استلام مهمة المراجعة بنجاح وقفلها لمدة 15 دقيقة');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في استلام المهمة');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRelease = async () => {
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/release`, { method: 'POST' });
      await fetchDetail();
      setSuccessBanner('تم إلغاء قفل المهمة وإعادتها للطابور');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في إلغاء القفل');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleForceUnlock = async () => {
    if (!forceUnlockReason.trim()) return;
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/force-unlock`, {
        method: 'POST',
        body: JSON.stringify({ reason: forceUnlockReason }),
      });
      setForceUnlockModalOpen(false);
      setForceUnlockReason('');
      await fetchDetail();
      setSuccessBanner('تم فك القفل الإجباري بنجاح وتسجيله في سجل التدقيق');
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في فك القفل الإجباري');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDispatchContract = async () => {
    if (!selectedTemplateId) return;
    if (contractFee !== DEFAULT_OWNER_CONTRACT_FEE_SAR && !feeOverrideReason.trim()) {
      setErrorBanner('يجب تقديم مبرر لتعديل رسوم العقد القياسية');
      return;
    }

    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/dispatch-contract`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplateId,
          contractFee,
          feeOverrideReason: contractFee !== DEFAULT_OWNER_CONTRACT_FEE_SAR ? feeOverrideReason : undefined,
          customTerms: customTerms.trim() || undefined,
        }),
      });
      setSuccessBanner('تم إرسال العقد الرسمي بنجاح إلى المالك للتوقيع الإلكتروني');
      await fetchDetail();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في إرسال العقد');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      setRejectModalOpen(false);
      setSuccessBanner('تم رفض طلب الإدراج وإشعار المالك بالسبب');
      await fetchDetail();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في رفض الطلب');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRequestModification = async () => {
    if (!modificationNotes.trim()) return;
    try {
      setActionInProgress(true);
      setErrorBanner(null);
      await apiClient(`/admin/owner-requests/${requestId}/request-modification`, {
        method: 'POST',
        body: JSON.stringify({ notes: modificationNotes }),
      });
      setModificationModalOpen(false);
      setSuccessBanner('تم إرسال طلب التعديل بنجاح إلى المالك');
      await fetchDetail();
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في إرسال طلب التعديل');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading && !detail) {
    return (
      <div dir="rtl" className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span>جاري تحميل تفاصيل طلب المالك...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div dir="rtl" className="p-12 text-center text-muted-foreground">
        <p className="text-lg font-bold">لم يتم العثور على الطلب المطلوب</p>
        <Link href="/admin/owner-requests" className="text-primary hover:underline text-sm mt-2 inline-block">
          العودة إلى طابور طلبات الملاك
        </Link>
      </div>
    );
  }

  const isLockedByMe = Boolean(detail.lockInfo?.isLockedByCurrentAdmin);
  const isLockedByOther = Boolean(detail.lockInfo?.isLocked && !detail.lockInfo?.isLockedByCurrentAdmin);
  const isUnlocked = !detail.lockInfo?.isLocked;
  const isPending = detail.status === OwnerListingRequestStatus.PENDING;

  const statusConfig = OWNER_REQUEST_STATUS_MAP[detail.status] || {
    label: detail.status,
    bg: 'bg-surface-sunken dark:bg-dark-surface-sunken',
    text: 'text-ink-secondary dark:text-dark-ink-secondary',
    border: 'border-surface-border dark:border-dark-surface-border',
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/owner-requests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لطابور طلبات الملاك</span>
        </Link>

        <span
          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Claim Lease Operational Banner (AD-10 & FR-51) */}
      <div className="rounded-xl border p-4 shadow-sm transition-all duration-200">
        {isLockedByMe ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                  أنت مستلم هذه المهمة الآن
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>الوقت المتبقي في القفل: {formatLockCountdown(remainingSeconds)}</span>
                  <span>•</span>
                  <span>يتم التجديد تلقائياً كل 5 دقائق</span>
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRelease}
              disabled={actionInProgress}
              className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>إلغاء القفل وإعادة الإتاحة</span>
            </Button>
          </div>
        ) : isLockedByOther ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900 dark:text-rose-100">
                  وضع المعاينة للقراءة فقط (محجوز)
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  هذا الطلب قيد الفحص حالياً بواسطة: {detail.lockInfo?.lockedByAdminName || 'مشرف آخر'}. لا يمكنك تنفيذ إجراءات عليه حتى ينتهي القفل.
                </p>
              </div>
            </div>

            {canForceUnlock && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setForceUnlockModalOpen(true)}
                className="text-xs gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>فك القفل الإجباري (Super Admin)</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/60 p-3 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Unlock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">الطلب متاح للاستلام</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  لاستكمال فحص الطلب وإرسال العقد أو اتخاذ قرار، يجب استلام المهمة أولاً لحجز قفل مدته 15 دقيقة.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleClaim}
              disabled={actionInProgress}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>استلام المهمة الآن</span>
            </Button>
          </div>
        )}
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successBanner}</span>
        </div>
      )}

      {/* Main Grid: Property Specs & Documents + Owner Info & Contract Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Property Details & Legal Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Overview Card */}
          <Card>
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <span>{detail.listing?.title || 'عقار بدون عنوان'}</span>
                </CardTitle>
                <span className="text-base font-bold text-foreground">
                  {Number(detail.listing?.askPrice || 0).toLocaleString()} ر.س
                </span>
              </div>
              <CardDescription className="text-xs">
                {PROPERTY_TYPE_MAP[detail.propertyType] || detail.propertyType} • {detail.cityName} - {detail.districtName}
                {detail.streetName ? ` • ${detail.streetName}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/30 p-3 rounded-lg">
                {detail.listing?.description || 'لا يوجد وصف مضاف.'}
              </p>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border bg-background">
                  <div className="text-muted-foreground">المساحة الإجمالية</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {detail.listing?.areaSquareMeters || '-'} م²
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border bg-background">
                  <div className="text-muted-foreground">غرف النوم</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {detail.listing?.bedrooms ?? 'غير محدد'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border bg-background">
                  <div className="text-muted-foreground">سنة البناء</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {detail.listing?.yearBuilt ?? 'غير محدد'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border bg-background">
                  <div className="text-muted-foreground">رقم صك الملكية</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {detail.titleDeedNumber}
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              {detail.listing?.photos && detail.listing.photos.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-muted-foreground">صور العقار ({detail.listing.photos.length}):</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {detail.listing.photos.map((p, idx) => (
                      <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border bg-muted group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.fileUrl} alt="صورة العقار" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Electronic Title Deed Document Viewer (AC-4 & BR-06) */}
          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>وثيقة صك الملكية الإلكتروني الرسمي</span>
              </CardTitle>
              <CardDescription className="text-xs">
                مستند خاص بالإدارة وخاضع لرابط تحميل مشفر وآمن لمدة 300 ثانية.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="p-4 rounded-xl border bg-muted/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      صك الملكية الإلكتروني (رقم: {detail.titleDeedNumber})
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      تصنيف الأمان: سري للإدارة فقط (ADMIN_ONLY)
                    </div>
                  </div>
                </div>

                {detail.titleDeedDocumentUrl ? (
                  <a
                    href={detail.titleDeedDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل الصك للمعاينة (300 ثانية)</span>
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">الرابط غير متاح</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Owner Info & Administrative Decision / Dispatch */}
        <div className="space-y-6">
          {/* Owner Details & Payout Verification */}
          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>بيانات المالك وحساب الصرف</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">الاسم النظامي:</span>
                <span className="font-bold text-foreground">{detail.owner.legalName}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">رقم الجوال:</span>
                <span className="font-semibold text-foreground" dir="ltr">{detail.owner.maskedMobileNumber}</span>
              </div>

              {detail.owner.nationalId && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">رقم الهوية / الإقامة:</span>
                  <span className="font-semibold text-foreground">{detail.owner.nationalId}</span>
                </div>
              )}

              <div className="p-3 rounded-lg border bg-background space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">آيبان الصرف (IBAN):</span>
                  {detail.owner.isPayoutIbanVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>موثق ومسجل</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertTriangle className="w-3 h-3" />
                      <span>غير مطابق للملف</span>
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-foreground font-semibold" dir="ltr">
                  {detail.owner.payoutIban || 'غير محدد'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Administrative Decision & Contract Dispatch (AC-6, AC-7) */}
          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Send className="w-5 h-5 text-accent" />
                <span>إرسال العقد الإلكتروني واتخاذ القرار</span>
              </CardTitle>
              <CardDescription className="text-xs">
                يتطلب حيازة القفل النشط للطلب لاتخاذ الإجراءات الإدارية.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              {!isLockedByMe ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed flex items-start gap-2.5">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    نموذج اتخاذ القرار معطل حالياً. يجب الضغط على زر &quot;استلام المهمة&quot; بالأعلى لتفعيل إرسال العقد أو الرفض أو طلب التعديلات.
                  </span>
                </div>
              ) : !isPending ? (
                <div className="p-4 rounded-xl bg-muted/60 text-muted-foreground text-xs leading-relaxed space-y-3">
                  <div>
                    تم اتخاذ إجراء على هذا الطلب بالفعل (الحالة الحالية: <span className="font-bold text-foreground">{statusConfig.label}</span>).
                  </div>
                  {detail.contract && (
                    <div className="pt-2.5 border-t border-border space-y-2.5">
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span>العقد المرتبط:</span>
                        <span className="font-mono text-[11px] font-bold">
                          #{detail.contract.id.slice(0, 8)} ({detail.contract.status})
                        </span>
                      </div>
                      {detail.contract.status === 'PENDING_FEE' && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col gap-2">
                          <p className="leading-relaxed font-normal">
                            تم توقيع العقد من المالك بنجاح وهو بانتظار سداد الرسوم. يتم تدقيق إشعارات التحويل البنكي وتفعيل العقد ونشر العقار عبر طابور رسوم العقود:
                          </p>
                          <Link href="/admin/contract-fees">
                            <Button size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs w-full gap-1.5">
                              <span>فتح طابور تدقيق رسوم العقود والنشر الآلي</span>
                            </Button>
                          </Link>
                        </div>
                      )}
                      {detail.contract.status === 'ACTIVE' && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                          تم تفعيل العقد ونشر العقار في السوق العام بنجاح.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5 text-xs">
                  {/* Template Selector */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">قالب العقد المعتمد:</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full p-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary"
                      disabled={templates.length === 0}
                    >
                      {templates.length === 0 ? (
                        <option value="">لا توجد قوالب عقود نشطة متاحة</option>
                      ) : (
                        templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.title} (إصدار {tpl.version})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Contract Fee */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-foreground">رسوم العقد (ر.س):</label>
                      <span className="text-[11px] text-muted-foreground">القياسية: 1,000.00 ر.س</span>
                    </div>
                    <input
                      type="number"
                      value={contractFee}
                      onChange={(e) => setContractFee(Number(e.target.value))}
                      disabled={!canOverrideFee && contractFee === DEFAULT_OWNER_CONTRACT_FEE_SAR}
                      className="w-full p-2 rounded-lg border bg-background text-xs font-semibold focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Fee Override Reason if modified */}
                  {contractFee !== DEFAULT_OWNER_CONTRACT_FEE_SAR && (
                    <div className="space-y-1 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                      <label className="font-semibold text-amber-900">
                        سبب تعديل الرسوم (إلزامي للتدقيق):
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: خصم خاص بالمالك معتمد من الإدارة"
                        value={feeOverrideReason}
                        onChange={(e) => setFeeOverrideReason(e.target.value)}
                        className="w-full p-2 rounded-md border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Custom Terms */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">شروط وأحكام إضافية (اختياري):</label>
                    <textarea
                      rows={2}
                      placeholder="أية بنود إضافية يتم تضمينها في العقد..."
                      value={customTerms}
                      onChange={(e) => setCustomTerms(e.target.value)}
                      className="w-full p-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Live Terms Preview Snippet */}
                  {selectedTemplate && (
                    <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground">معاينة نص العقد:</div>
                      <p className="line-clamp-3 leading-relaxed">
                        عقد تسويق ووساطة عقارية بين منصة المصايف والمالك ({detail.owner.legalName}) لبيع العقار ({detail.listing?.title}) بسعر ({Number(detail.listing?.askPrice || 0).toLocaleString()} ر.س) وبرسوم تسويق قدرها ({contractFee.toLocaleString()} ر.س).
                      </p>
                    </div>
                  )}

                  {/* Dispatch CTA */}
                  <Button
                    onClick={handleDispatchContract}
                    disabled={actionInProgress || !selectedTemplateId || templates.length === 0}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2.5 gap-2 text-xs shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>إرسال العقد للمالك للتوقيع</span>
                  </Button>

                  {/* Secondary Actions: Reject & Modification */}
                  <div className="pt-2 border-t flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModificationModalOpen(true)}
                      disabled={actionInProgress}
                      className="flex-1 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>طلب تعديلات</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={actionInProgress}
                      className="flex-1 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رفض الطلب</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rejection Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        ariaLabel="رفض طلب الإدراج"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
            <XCircle className="w-5 h-5" />
            <h3>رفض طلب الإدراج العقاري للمالك</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيتم تغيير حالة الطلب والإعلان إلى &quot;مرفوض&quot; وإشعار المالك بالسبب المحدد. يرجى توضيح السبب بدقة.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">سبب الرفض (إلزامي):</label>
            <textarea
              rows={4}
              placeholder="اكتب سبب الرفض المفصل هنا..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionInProgress || rejectionReason.trim().length < 5}
              onClick={handleReject}
            >
              تأكيد الرفض
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modification Request Modal */}
      <Modal
        open={modificationModalOpen}
        onClose={() => setModificationModalOpen(false)}
        ariaLabel="طلب تعديلات من المالك"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-base">
            <Edit className="w-5 h-5" />
            <h3>طلب تعديلات على بيانات الإدراج</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيتم إشعار المالك بالملاحظات المطلوبة ليقوم بتعديل بيانات العقار أو إعادة رفع الوثائق المطلوبة.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">ملاحظات التعديل المطلوبة (إلزامي):</label>
            <textarea
              rows={4}
              placeholder="اكتب الملاحظات والتعديلات المطلوبة بدقة..."
              value={modificationNotes}
              onChange={(e) => setModificationNotes(e.target.value)}
              className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModificationModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={actionInProgress || modificationNotes.trim().length < 5}
              onClick={handleRequestModification}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              إرسال طلب التعديل
            </Button>
          </div>
        </div>
      </Modal>

      {/* Force Unlock Modal */}
      <Modal
        open={forceUnlockModalOpen}
        onClose={() => setForceUnlockModalOpen(false)}
        ariaLabel="فك القفل الإجباري"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
            <Unlock className="w-5 h-5" />
            <h3>فك القفل الإجباري للمهمة (Super Admin)</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيتم فك قفل المهمة من المشرف الحالي فوراً وإعادتها للطابور. هذا الإجراء مسجل بصورة دائمة في سجل تدقيق الأمان.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">سبب فك القفل الإجباري (إلزامي):</label>
            <textarea
              rows={3}
              placeholder="اكتب مبرر فك القفل الإجباري..."
              value={forceUnlockReason}
              onChange={(e) => setForceUnlockReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForceUnlockModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionInProgress || forceUnlockReason.trim().length < 3}
              onClick={handleForceUnlock}
            >
              تأكيد فك القفل
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
