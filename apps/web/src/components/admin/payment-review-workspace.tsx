'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  FileX2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  type AdminPaymentDetail,
  type ClaimLockInfo,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_TYPE_LABELS_AR,
  DEAL_STATUS_LABELS_AR,
  PAYMENT_CLAIMABLE_STATUSES,
  NoteEntityType,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { formatLockCountdown } from './payment-review-queue';
import { OperationalInternalNotesCard } from './operational-internal-notes-card';

/** Heartbeat cadence: 4 minutes (against 15-minute lease and 5-minute advisory). */
export const PAYMENT_REVIEW_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

export function resolvePaymentReviewActions(
  payment: AdminPaymentDetail | null | undefined,
  lockInfo: ClaimLockInfo | null | undefined,
) {
  const isMine = Boolean(lockInfo?.isLocked && lockInfo?.isLockedByCurrentAdmin);
  const isOther = Boolean(lockInfo?.isLocked && !lockInfo?.isLockedByCurrentAdmin);
  const isClaimable =
    !lockInfo?.isLocked && PAYMENT_CLAIMABLE_STATUSES.includes(payment?.status as any);
  const isUnderReview = payment?.status === DEAL_PAYMENT_STATUS.UNDER_REVIEW;
  const isDecidable = isMine && isUnderReview;
  const isTerminal =
    payment?.status === DEAL_PAYMENT_STATUS.CONFIRMED ||
    payment?.status === DEAL_PAYMENT_STATUS.EXPIRED;
  const isReadOnly = isOther || isTerminal;

  return {
    isMine,
    isOther,
    canClaim: isClaimable,
    canHeartbeat: isMine,
    canRelease: isMine,
    canConfirm: isDecidable,
    canReject: isDecidable,
    canForceUnlock: isOther,
    isReadOnly,
  };
}

export function buildGracePeriodNotice(
  payment: { status?: string | null; correctionWindowExpiresAt?: string | null } | null | undefined,
  serverNow?: string | Date | null,
): { inGracePeriod: boolean; expiresAt: string; message: string } | null {
  if (payment?.status !== DEAL_PAYMENT_STATUS.REJECTED || !payment?.correctionWindowExpiresAt) {
    return null;
  }
  return {
    inGracePeriod: true,
    expiresAt: payment.correctionWindowExpiresAt,
    message: 'مهلة تصحيح إضافية لمدة 12 ساعة ممنوحة للمشتري لإعادة رفع الإيصال',
  };
}

export function validateRejectionNote(
  reason: string | null | undefined,
): { valid: boolean; error?: string } {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < 5) {
    return { valid: false, error: 'سبب الرفض يجب ألا يقل عن 5 أحرف' };
  }
  if (trimmed.length > 500) {
    return { valid: false, error: 'سبب الرفض يجب ألا يتجاوز 500 حرف' };
  }
  return { valid: true };
}

interface PaymentReviewWorkspaceProps {
  paymentId: string;
}

export function PaymentReviewWorkspace({ paymentId }: PaymentReviewWorkspaceProps) {
  const router = useRouter();
  const [payment, setPayment] = useState<AdminPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Force-unlock modal state
  const [forceUnlockModalOpen, setForceUnlockModalOpen] = useState(false);
  const [forceUnlockReason, setForceUnlockReason] = useState('');
  const [forceUnlockError, setForceUnlockError] = useState<string | null>(null);

  // Download URL state
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchPayment = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: AdminPaymentDetail }>(
        `/admin/payments/${paymentId}`,
      );
      setPayment(res?.data ?? null);
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل بيانات إثبات الدفع');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  // Proof verified download URL
  const fetchProofUrl = useCallback(async () => {
    setDownloadLoading(true);
    setDownloadError(null);
    try {
      const res = await apiClient.get<{ data: { downloadUrl: string; expiresInSeconds: number } }>(
        `/admin/payments/${paymentId}/proof-url`,
      );
      setDownloadUrl(res?.data?.downloadUrl ?? null);
    } catch (err) {
      setDownloadError(describeApiError(err).message || 'تعذر استخراج رابط تحميل الإيصال');
    } finally {
      setDownloadLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (payment?.proofFileObjectId) {
      fetchProofUrl();
    }
  }, [payment?.proofFileObjectId, fetchProofUrl]);

  // Periodic heartbeat when isMine
  useEffect(() => {
    if (!payment?.lockInfo?.isLocked || !payment.lockInfo.isLockedByCurrentAdmin) return;

    const timer = setInterval(async () => {
      try {
        await apiClient.post(`/admin/payments/${paymentId}/heartbeat`);
      } catch (err) {
        // Lease might have expired
        fetchPayment();
      }
    }, PAYMENT_REVIEW_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [payment?.lockInfo?.isLocked, payment?.lockInfo?.isLockedByCurrentAdmin, paymentId, fetchPayment]);

  const actions = resolvePaymentReviewActions(payment, payment?.lockInfo);
  const graceNotice = buildGracePeriodNotice(payment, payment?.serverNow);

  const handleClaim = async () => {
    setActionLoading(true);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/claim`);
      setSuccessBanner('تم استلام مهمة التدقيق لمدة 15 دقيقة بنجاح');
      await fetchPayment();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر استلام المهمة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    setActionLoading(true);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/release`);
      setSuccessBanner('تم تحرير قفل التدقيق بنجاح');
      await fetchPayment();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحرير القفل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/confirm`);
      setSuccessBanner('تم تأكيد إثبات الدفع بنجاح وتحرير قفل التدقيق');
      await fetchPayment();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تأكيد إثبات الدفع');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRejectionNote(rejectionReason);
    if (!validation.valid) {
      setRejectionError(validation.error || 'سبب الرفض غير صالح');
      return;
    }

    setActionLoading(true);
    setRejectionError(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/reject`, {
        reason: rejectionReason.trim(),
      });
      setRejectModalOpen(false);
      setSuccessBanner('تم رفض إثبات الدفع وتسجيل السبب، وتم تحويل الصفقة إلى إثبات مرفوض');
      await fetchPayment();
    } catch (err) {
      setRejectionError(describeApiError(err).message || 'تعذر تسجيل الرفض');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((forceUnlockReason ?? '').trim().length < 5) {
      setForceUnlockError('يجب إدخال سبب معتمد (5 أحرف على الأقل)');
      return;
    }

    setActionLoading(true);
    setForceUnlockError(null);
    try {
      await apiClient.post(`/admin/payments/${paymentId}/force-unlock`, {
        reason: forceUnlockReason.trim(),
      });
      setForceUnlockModalOpen(false);
      setSuccessBanner('تم إلغاء قفل التدقيق وتسجيل السبب');
      await fetchPayment();
    } catch (err) {
      setForceUnlockError(describeApiError(err).message || 'تعذر إلغاء القفل');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className="p-12 text-center text-ink-muted space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-accent" />
        <p className="text-sm">جارٍ تحميل مساحة تدقيق الدفعة...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div dir="rtl" className="p-12 text-center bg-surface-sunken rounded-2xl border border-surface-border space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-base font-semibold text-ink-primary">إثبات الدفع غير موجود</p>
        <Link href="/admin/payments" className="text-xs text-accent hover:underline">
          العودة إلى طابور التدقيق
        </Link>
      </div>
    );
  }

  const typeLabel = DEAL_PAYMENT_TYPE_LABELS_AR[payment.paymentType] || payment.paymentType;
  const statusLabel = DEAL_PAYMENT_STATUS_LABELS_AR[payment.status] || payment.status;

  return (
    <div dir="rtl" className="space-y-6">
      {/* Navigation breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Link href="/admin/payments" className="hover:text-ink-primary inline-flex items-center gap-1">
          <ArrowRight className="w-3.5 h-3.5" />
          <span>طابور تدقيق إثباتات الدفع</span>
        </Link>
        <span>/</span>
        <span className="font-mono text-ink-secondary">{payment.dealNumber}</span>
        <span>/</span>
        <span className="text-ink-primary font-semibold">{typeLabel}</span>
      </div>

      {/* Success / Error Banners */}
      {successBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <div className="flex-1 font-medium">{successBanner}</div>
          <button onClick={() => setSuccessBanner(null)} className="text-xs text-emerald-700 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div className="flex-1 font-medium">{errorBanner}</div>
          <button onClick={() => setErrorBanner(null)} className="text-xs text-red-600 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Lock status banner */}
      {actions.isMine && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-900">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>
              أنت تملك قفل التدقيق الحصري لهذه الدفعة • المتبقي:{' '}
              {formatLockCountdown(payment.lockInfo.remainingSeconds)} دقيقة
            </span>
          </div>
          <button
            onClick={handleRelease}
            disabled={actionLoading}
            className="self-end sm:self-auto text-xs px-3 py-1.5 border border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg transition-colors font-medium"
          >
            تحرير المهمة للزملاء
          </button>
        </div>
      )}

      {actions.isOther && (
        <div
          data-testid="read-only-inspection-banner"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <span>
              قيد التدقيق بواسطة زميل آخر ({payment.lockInfo.lockedByAdminName || 'مشرف آخر'}) • العرض متاح للقراءة فقط (
              {formatLockCountdown(payment.lockInfo.remainingSeconds)})
            </span>
          </div>
          <button
            onClick={() => setForceUnlockModalOpen(true)}
            className="self-end sm:self-auto text-xs px-3 py-1.5 border border-amber-300 bg-white hover:bg-amber-100 text-amber-800 rounded-lg transition-colors font-medium inline-flex items-center gap-1.5"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>إلغاء القفل الإداري</span>
          </button>
        </div>
      )}

      {!payment.lockInfo.isLocked && actions.canClaim && (
        <div className="rounded-xl border border-surface-border bg-surface-sunken p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
            <Unlock className="w-4 h-4 text-ink-muted" />
            <span>هذه الدفعة متاحة للتدقيق. استلم المهمة لحجز قفل التدقيق والبدء في المراجعة.</span>
          </div>
          <button
            onClick={handleClaim}
            disabled={actionLoading}
            className="self-end sm:self-auto px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-level1"
          >
            استلام المهمة (15 دقيقة)
          </button>
        </div>
      )}

      {/* 12-hour grace period SLA banner */}
      {graceNotice && (
        <div
          data-testid="grace-period-banner"
          className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 flex items-start gap-3"
        >
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-amber-900">{graceNotice.message}</div>
            <div className="text-xs text-amber-800">
              تنتهي مهلة التصحيح في:{' '}
              <strong className="font-mono">
                {new Date(graceNotice.expiresAt).toLocaleString('ar-SA')}
              </strong>
              . يمنح هذا الإجراء حماية للمشتري من الإلغاء الفوري للصفقة.
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Slot details & proof preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-base rounded-2xl border border-surface-border p-6 shadow-level1 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4">
              <div>
                <span className="text-xs font-bold text-ink-muted">بيانات التحويل البنكي</span>
                <h2 className="text-xl font-bold text-ink-primary mt-1">{typeLabel}</h2>
              </div>
              <div className="text-left">
                <span className="text-xs text-ink-muted">المبلغ المطلوب</span>
                <div className="text-2xl font-extrabold text-accent">
                  {formatSar(Number(payment.amount))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border">
                <div className="text-ink-secondary mb-1">حالة الدفعة</div>
                <div className="text-sm font-bold text-ink-primary">{statusLabel}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border">
                <div className="text-ink-secondary mb-1">تاريخ ووقت رفع الإيصال</div>
                <div className="text-sm font-bold text-ink-primary">
                  {payment.uploadedAt ? new Date(payment.uploadedAt).toLocaleString('ar-SA') : '—'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border">
                <div className="text-ink-secondary mb-1">اسم البنك المحوّل</div>
                <div className="text-sm font-bold text-ink-primary">{payment.senderBankName || '—'}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border">
                <div className="text-ink-secondary mb-1">الرقم المرجعي للتحويل</div>
                <div className="text-sm font-mono font-bold text-ink-primary">
                  {payment.bankReferenceCode || '—'}
                </div>
              </div>
            </div>

            {payment.rejectionReason && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>سبب الرفض المسجل مسبقاً:</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{payment.rejectionReason}</p>
              </div>
            )}

            {/* Proof document download/preview */}
            <div className="rounded-xl border border-surface-border p-5 bg-surface-sunken space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  <span className="text-sm font-bold text-ink-primary">إيصال التحويل المرفوع</span>
                </div>
                <span className="text-xs text-ink-secondary bg-surface-base border border-surface-border px-2 py-0.5 rounded">
                  فحص أمني ناجح (CLEAN)
                </span>
              </div>

              {downloadLoading ? (
                <div className="py-4 text-center text-xs text-ink-muted">
                  <RefreshCw className="w-4 h-4 animate-spin inline-block ml-1" />
                  جارٍ إعداد رابط المعاينة الآمن...
                </div>
              ) : downloadError ? (
                <div className="py-3 px-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{downloadError}</span>
                </div>
              ) : downloadUrl ? (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface-base border border-surface-border rounded-lg text-xs font-semibold text-ink-primary hover:bg-surface-sunken transition-colors shadow-level1"
                  >
                    <ExternalLink className="w-4 h-4 text-accent" />
                    <span>معاينة الإيصال في نافذة جديدة</span>
                  </a>
                  <a
                    href={downloadUrl}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-xs font-semibold text-white hover:bg-primary/90 transition-colors shadow-level1"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الإيصال (رابط مؤقت 5 دقائق)</span>
                  </a>
                </div>
              ) : (
                <div className="text-xs text-ink-muted py-2">لا يوجد ملف إيصال مرتبط.</div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Deal Summary & Actions */}
        <div className="space-y-6">
          {/* Deal summary card */}
          <div className="bg-surface-base rounded-2xl border border-surface-border p-5 shadow-level1 space-y-4">
            <h3 className="text-sm font-bold text-ink-primary border-b border-surface-border pb-3">
              ملخص الصفقة العقارية
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-secondary">رقم الصفقة:</span>
                <span className="font-mono font-bold text-ink-primary">{payment.dealNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">العقار:</span>
                <span className="font-bold text-ink-primary text-left">{payment.propertyTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">حالة الصفقة:</span>
                <span className="font-semibold text-emerald-800">
                  {DEAL_STATUS_LABELS_AR[payment.dealStatus] || payment.dealStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">الموعد النهائي للدفع:</span>
                <span className="font-mono text-ink-primary">
                  {payment.paymentDeadline
                    ? new Date(payment.paymentDeadline).toLocaleString('ar-SA')
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Decision Controls */}
          <div className="bg-surface-base rounded-2xl border border-surface-border p-5 shadow-level1 space-y-4">
            <h3 className="text-sm font-bold text-ink-primary border-b border-surface-border pb-3">
              قرار التدقيق الإداري
            </h3>

            {!actions.isMine ? (
              <div className="text-xs text-ink-secondary bg-surface-sunken p-3 rounded-xl border border-surface-border leading-relaxed">
                {actions.isOther
                  ? 'الدفعة قيد التدقيق بواسطة مشرف آخر. أزرار القرار معطلة للقراءة فقط.'
                  : 'يجب استلام المهمة أولاً لتفعيل أزرار التأكيد أو الرفض.'}
              </div>
            ) : payment.status !== DEAL_PAYMENT_STATUS.UNDER_REVIEW ? (
              <div className="text-xs text-ink-secondary bg-surface-sunken p-3 rounded-xl border border-surface-border leading-relaxed">
                تم اتخاذ القرار على هذه الدفعة مسبقاً ({statusLabel}).
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  data-testid="confirm-payment-btn"
                  onClick={handleConfirm}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>تأكيد إثبات الدفع (اعتماد التحويل)</span>
                </button>

                <button
                  data-testid="reject-payment-btn"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  <FileX2 className="w-4 h-4" />
                  <span>رفض إثبات الدفع (مع تسجيل السبب)</span>
                </button>
              </div>
            )}
          </div>

          {/* Operational Internal Staff Notes */}
          <OperationalInternalNotesCard
            entityType={NoteEntityType.PAYMENT}
            entityId={payment.id}
          />
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-base rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-level3 border border-surface-border">
            <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
              <FileX2 className="w-5 h-5 text-red-600" />
              <span>رفض إثبات الدفع</span>
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              يرجى توضيح سبب الرفض بدقة (5 – 500 حرف). سيتم إشعار المشتري بالسبب المكتوب، وسيتم نقل
              الصفقة إلى حالة «إثبات مرفوض» لمنحه فرصة إعادة الرفع.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setRejectionError(null);
                }}
                rows={4}
                placeholder="أدخل سبب الرفض بالتفصيل (مثل: المبلغ المحول ناقص، رقم الحساب خاطئ...)"
                className="w-full text-xs p-3 border border-surface-border bg-surface-sunken rounded-xl text-ink-primary focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <div className="flex justify-between text-[11px] text-ink-muted">
                <span>الحد الأدنى: 5 أحرف</span>
                <span>{rejectionReason.length} / 500</span>
              </div>

              {rejectionError && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {rejectionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 border border-surface-border text-ink-secondary rounded-xl text-xs hover:bg-surface-sunken"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'جارٍ تسجيل الرفض...' : 'تأكيد رفض الإيصال'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Unlock Modal */}
      {forceUnlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-base rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-level3 border border-surface-border">
            <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-amber-600" />
              <span>إلغاء قفل التدقيق الإداري</span>
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              يتطلب فك قفل المشرف الآخر إدخال سبب معتمد (5 أحرف على الأقل). سيتم تسجيل هذا الإجراء في
              سجل التدقيق الرقابي.
            </p>

            <form onSubmit={handleForceUnlockSubmit} className="space-y-3">
              <input
                type="text"
                value={forceUnlockReason}
                onChange={(e) => {
                  setForceUnlockReason(e.target.value);
                  setForceUnlockError(null);
                }}
                placeholder="سبب إلغاء القفل (مثل: عدم استجابة المشرف، تدقيق طارئ...)"
                className="w-full text-xs p-3 border border-surface-border bg-surface-sunken rounded-xl text-ink-primary focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              {forceUnlockError && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {forceUnlockError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForceUnlockModalOpen(false)}
                  className="px-4 py-2 border border-surface-border text-ink-secondary rounded-xl text-xs hover:bg-surface-sunken"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'جارٍ فك القفل...' : 'فك القفل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

