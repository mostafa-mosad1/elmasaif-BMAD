'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FileX2,
  Lock,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  type ClaimLockInfo,
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_TYPE_LABELS_AR,
  DealStatus,
  PaymentType,
} from '@elmasaif/shared';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { formatSar } from '../listings/commission-calculator';
import { DealStatusBadge } from '../deals/deal-status-badge';
import { formatLockCountdown } from './payment-review-queue';

export const DISPUTE_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

export interface DisputeCounterparty {
  id: string;
  name: string;
  phone?: string | null;
  nationalId?: string | null;
  iban?: string | null;
}

export interface DisputeListingSnapshot {
  id: string;
  title: string;
  propertyType?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  askPrice?: number | null;
  finalPrice?: number | null;
}

export interface DisputePaymentSnapshot {
  id: string;
  paymentType: PaymentType | string;
  amount: string | number;
  status: string;
  hasProof: boolean;
  proofFileObjectId?: string | null;
  bankReferenceCode?: string | null;
  senderBankName?: string | null;
  uploadedAt?: string | null;
  rejectionReason?: string | null;
}

export interface DisputeAuditLogSnapshot {
  id: string;
  action: string;
  actorRole: string;
  actorName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface AdminDisputeDetail {
  id: string;
  dealId: string;
  dealNumber: string;
  dealStatus: DealStatus;
  filedByRole: 'BUYER' | 'SELLER' | 'SYSTEM';
  filedByName: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  resolutionAction: 'COMPLETE' | 'CANCEL' | 'RETURN_TO_REVIEW' | null;
  resolutionNotes: string | null;
  resolvedByAdminName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  lockInfo: ClaimLockInfo;
  deal: {
    id: string;
    dealNumber: string;
    status: DealStatus;
    createdAt: string;
    paymentDeadline?: string | null;
    buyer: DisputeCounterparty;
    seller: DisputeCounterparty;
    listing: DisputeListingSnapshot;
    payments: DisputePaymentSnapshot[];
    auditLogs: DisputeAuditLogSnapshot[];
  };
}

export interface DisputeWorkspaceActions {
  isMine: boolean;
  isOther: boolean;
  canClaim: boolean;
  canHeartbeat: boolean;
  canRelease: boolean;
  canAdjudicate: boolean;
  canForceUnlock: boolean;
  isReadOnly: boolean;
}

export function resolveDisputeWorkspaceActions(
  dispute: { status: 'OPEN' | 'RESOLVED' } | null | undefined,
  lockInfo: ClaimLockInfo | null | undefined,
): DisputeWorkspaceActions {
  const isMine = Boolean(lockInfo?.isLocked && lockInfo?.isLockedByCurrentAdmin);
  const isOther = Boolean(lockInfo?.isLocked && !lockInfo?.isLockedByCurrentAdmin);
  const isResolved = dispute?.status === 'RESOLVED';
  const canClaim = !isResolved && !lockInfo?.isLocked;
  const canAdjudicate = isMine && !isResolved;
  const isReadOnly = isOther || isResolved;

  return {
    isMine,
    isOther,
    canClaim,
    canHeartbeat: isMine && !isResolved,
    canRelease: isMine && !isResolved,
    canAdjudicate,
    canForceUnlock: isOther && !isResolved,
    isReadOnly,
  };
}

export interface AdjudicationFormState {
  action: 'COMPLETE' | 'CANCEL' | 'RETURN_TO_REVIEW';
  notes: string;
  newDeadlineHours: number;
}

export function DisputePaymentProofViewer({ paymentId }: { paymentId: string }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProof = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data?: { downloadUrl: string; expiresInSeconds: number } }>(
        `/admin/payments/${paymentId}/proof-url`,
      );
      setDownloadUrl(res?.data?.downloadUrl ?? null);
    } catch (err: unknown) {
      setError(describeApiError(err).message || 'تعذر تحميل إيصال التحويل');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchProof();
  }, [fetchProof]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 pt-2 text-xs text-ink-muted">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>جارٍ تجهيز إيصال التحويل...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1.5 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-status-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchProof}
          className="text-xs text-primary underline hover:text-primary-hover font-semibold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!downloadUrl) return null;

  const isPdf = downloadUrl.toLowerCase().includes('.pdf');

  return (
    <div className="space-y-3 pt-2">
      {/* Visual Image / PDF Preview */}
      <div className="relative overflow-hidden rounded-xl border border-surface-border bg-white dark:bg-dark-surface-sunken p-2 max-w-md shadow-xs">
        {isPdf ? (
          <iframe
            src={downloadUrl}
            title="إيصال التحويل البنكي"
            className="w-full h-56 border-0 rounded"
          />
        ) : (
          <img
            src={downloadUrl}
            alt="إيصال التحويل البنكي"
            className="max-h-56 w-full object-contain rounded"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          معاينة بالحجم الكامل
        </a>
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          تحميل الإيصال
        </a>
      </div>
    </div>
  );
}

interface DisputeWorkspaceProps {
  disputeId: string;
}

export function DisputeAdjudicationWorkspace({ disputeId }: DisputeWorkspaceProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminDisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Form state
  const [verdict, setVerdict] = useState<AdjudicationFormState>({
    action: 'COMPLETE',
    notes: '',
    newDeadlineHours: 24,
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [forceUnlockReason, setForceUnlockReason] = useState('');
  const [showForceUnlockModal, setShowForceUnlockModal] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data?: AdminDisputeDetail }>(
        `/admin/disputes/${disputeId}`,
      );
      if (res?.data) {
        setDetail(res.data);
      }
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'تعذر تحميل تفاصيل النزاع');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const lockInfo = detail?.lockInfo;
  const actions = resolveDisputeWorkspaceActions(detail, lockInfo);

  // Heartbeat lease renewal
  useEffect(() => {
    if (!actions.canHeartbeat) return;
    const interval = setInterval(async () => {
      try {
        await apiClient.post(`/admin/disputes/${disputeId}/renew`);
      } catch (err) {
        setErrorBanner('انتهت مهلة قفل المراجعة أو تم كسر القفل');
        fetchDetail();
      }
    }, DISPUTE_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [actions.canHeartbeat, disputeId, fetchDetail]);

  const handleClaim = async () => {
    setActionInProgress('claim');
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/disputes/${disputeId}/claim`);
      setSuccessBanner('تم حجز قفل القضية بنجاح لمدة 15 دقيقة');
      await fetchDetail();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'فشل حجز قفل القضية');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRelease = async () => {
    setActionInProgress('release');
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/disputes/${disputeId}/release`);
      router.push('/admin/disputes');
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'فشل تحرير القفل');
      setActionInProgress(null);
    }
  };

  const handleForceUnlock = async () => {
    if (!forceUnlockReason.trim()) return;
    setActionInProgress('force-unlock');
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/disputes/${disputeId}/force-unlock`, {
        reason: forceUnlockReason.trim(),
      });
      setShowForceUnlockModal(false);
      setForceUnlockReason('');
      setSuccessBanner('تم كسر القفل الإداري بنجاح');
      await fetchDetail();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'فشل كسر القفل الإداري');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAdjudicate = async () => {
    if (verdict.notes.trim().length < 10) return;
    setActionInProgress('adjudicate');
    setErrorBanner(null);
    try {
      await apiClient.post(`/admin/disputes/${disputeId}/adjudicate`, {
        action: verdict.action,
        notes: verdict.notes.trim(),
        newDeadlineHours:
          verdict.action === 'RETURN_TO_REVIEW' ? Number(verdict.newDeadlineHours) : undefined,
      });
      setShowConfirmModal(false);
      setSuccessBanner('تم إصدار القرار الإداري النهائي بنجاح وتحديث حالة الصفقة');
      await fetchDetail();
    } catch (err) {
      setErrorBanner(describeApiError(err).message || 'فشل إصدار القرار الإداري');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken" />
        <div className="h-48 animate-pulse rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
        <div className="h-72 animate-pulse rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4" dir="rtl">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لطابور النزاعات
        </Link>
        <div className="rounded-card border border-status-dangerBorder bg-status-dangerBg p-6 text-center text-status-danger">
          <AlertCircle className="mx-auto h-8 w-8 mb-2" />
          <p className="font-bold">تعذر تحميل ملف النزاع</p>
          <p className="text-xs mt-1">{errorBanner || 'النزاع المطلوب غير موجود'}</p>
        </div>
      </div>
    );
  }

  const holderName = readLockHolderName(lockInfo);
  const deal = detail.deal;
  const dealNumber = detail.dealNumber || deal?.dealNumber || '—';
  const dealStatus = (detail.dealStatus || deal?.status) as DealStatus;
  const filedByName =
    detail.filedByName ||
    deal?.buyer?.name ||
    deal?.seller?.name ||
    'طرف النزاع';
  const filedByRole = detail.filedByRole || 'BUYER';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-primary dark:text-dark-ink-secondary transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          العودة إلى طابور فض النزاعات
        </Link>

        {/* Lock lease status badge */}
        <div className="flex items-center gap-3">
          {actions.isMine ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Clock className="h-4 w-4 animate-spin" />
              <span>متبقي على القفل: {formatLockCountdown(lockInfo?.remainingSeconds ?? 0)}</span>
              <button
                type="button"
                onClick={handleRelease}
                disabled={actionInProgress === 'release'}
                className="mr-2 text-ink-secondary hover:text-red-600 underline text-[11px]"
              >
                تحرير القفل
              </button>
            </div>
          ) : actions.isOther ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4" />
              <span>قيد المراجعة بواسطة: {holderName}</span>
              <button
                type="button"
                onClick={() => setShowForceUnlockModal(true)}
                className="mr-2 text-red-600 hover:underline text-[11px]"
              >
                كسر القفل
              </button>
            </div>
          ) : actions.canClaim ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={actionInProgress === 'claim'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
            >
              <Lock className="h-4 w-4" />
              حجز القضية للبت
            </button>
          ) : null}
        </div>
      </div>

      {/* Notifications */}
      {errorBanner ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg p-4 text-xs font-semibold text-status-danger"
          data-testid="dispute-error-banner"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {successBanner ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-status-verifiedBorder bg-status-verifiedBg p-4 text-xs font-semibold text-status-verified"
          data-testid="dispute-success-banner"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successBanner}</span>
        </div>
      ) : null}

      {/* Top Banner: Dispute Snapshot */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border dark:border-dark-surface-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-amber-500" />
              <h1 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                ملف النزاع الإداري — الصفقة {dealNumber}
              </h1>
            </div>
            <p className="mt-1 text-xs text-ink-muted dark:text-dark-ink-muted font-mono">
              معرّف النزاع: {detail.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {dealStatus ? <DealStatusBadge status={dealStatus} /> : null}
            {detail.status === 'RESOLVED' ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                محسوم ({detail.resolutionAction})
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                نزاع مفتوح
              </span>
            )}
          </div>
        </div>

        {/* Dispute Details Body */}
        <div className="grid gap-4 pt-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs text-ink-muted dark:text-dark-ink-muted">مقدّم النزاع:</span>
            <div className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
              {filedByName} ({filedByRole === 'BUYER' ? 'المشتري' : filedByRole === 'SELLER' ? 'البائع' : 'النظام الآلي'})
            </div>
            <span className="block text-[11px] font-mono text-ink-muted dark:text-dark-ink-muted">
              تاريخ الرفع: {new Date(detail.createdAt).toLocaleString('ar-SA')}
            </span>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 p-3.5 dark:bg-amber-950/20">
            <span className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
              سبب وتفاصيل النزاع المقدم:
            </span>
            <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-300">
              {detail.reason}
            </p>
          </div>
        </div>

        {/* Resolution Outcome if resolved */}
        {detail.status === 'RESOLVED' ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 dark:bg-emerald-950/20 space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>الحكم والقرار الصادر: {detail.resolutionAction}</span>
            </div>
            <p className="text-xs text-emerald-900/90 dark:text-emerald-200">
              ملاحظات القرار: {detail.resolutionNotes}
            </p>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 pt-1">
              المسؤول: {detail.resolvedByAdminName || 'مدير النظام'} — التاريخ: {detail.resolvedAt ? new Date(detail.resolvedAt).toLocaleString('ar-SA') : ''}
            </div>
          </div>
        ) : null}
      </div>

      {/* Counterparties & Property Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Buyer Card */}
        <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
            <User className="h-4 w-4 text-primary" />
            <span>بيانات المشتري</span>
          </div>
          <div className="text-sm font-semibold">{deal?.buyer?.name || 'غير معروف'}</div>
          <div className="space-y-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>الجوال: {deal?.buyer?.phone || '—'}</div>
            <div>الهوية: {deal?.buyer?.nationalId || '—'}</div>
          </div>
        </div>

        {/* Seller Card */}
        <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
            <User className="h-4 w-4 text-emerald-600" />
            <span>بيانات البائع</span>
          </div>
          <div className="text-sm font-semibold">{deal?.seller?.name || 'غير معروف'}</div>
          <div className="space-y-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>الجوال: {deal?.seller?.phone || '—'}</div>
            <div className="font-mono text-[11px]">الآيبان: {deal?.seller?.iban || '—'}</div>
          </div>
        </div>

        {/* Listing Card */}
        <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
            <FileText className="h-4 w-4 text-purple-600" />
            <span>بيانات العقار</span>
          </div>
          <div className="text-sm font-semibold truncate">{deal?.listing?.title || 'عقار'}</div>
          <div className="space-y-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div>الموقع: {deal?.listing?.cityName} — {deal?.listing?.districtName}</div>
            <div className="font-semibold text-primary">السعر: {formatSar(deal?.listing?.finalPrice || deal?.listing?.askPrice || 0)}</div>
          </div>
        </div>
      </div>

      {/* Wire Transfers & Proofs Audit */}
      <div className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised p-6 space-y-4">
        <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
          سجل الحوالات البنكية وإثباتات السداد
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {(deal?.payments ?? []).map((payment) => (
            <div
              key={payment.id}
              className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-3 bg-surface-sunken/40 dark:bg-dark-surface-sunken/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                  {DEAL_PAYMENT_TYPE_LABELS_AR[payment.paymentType as keyof typeof DEAL_PAYMENT_TYPE_LABELS_AR] || payment.paymentType}
                </span>
                <span className="font-mono text-sm font-bold text-primary">
                  {formatSar(payment.amount)}
                </span>
              </div>

              <div className="space-y-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                <div>الحالة: {DEAL_PAYMENT_STATUS_LABELS_AR[payment.status as keyof typeof DEAL_PAYMENT_STATUS_LABELS_AR] || payment.status}</div>
                {payment.senderBankName ? <div>بنك المحوّل: {payment.senderBankName}</div> : null}
                {payment.bankReferenceCode ? <div>الرقم المرجعي: {payment.bankReferenceCode}</div> : null}
                {payment.uploadedAt ? (
                  <div className="text-[11px] text-ink-muted">تاريخ الرفع: {new Date(payment.uploadedAt).toLocaleString('ar-SA')}</div>
                ) : null}
              </div>

              {payment.proofFileObjectId ? (
                <DisputePaymentProofViewer paymentId={payment.id} />
              ) : (
                <div className="text-[11px] text-ink-muted italic">لا يوجد إيصال مرفوع</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Adjudication Verdict Form (Only when locked by current admin and OPEN) */}
      {actions.canAdjudicate ? (
        <div
          className="rounded-card border border-primary/30 bg-surface dark:bg-dark-surface-raised p-6 shadow-md space-y-5"
          data-testid="adjudication-form-card"
        >
          <div className="border-b border-surface-border dark:border-dark-surface-border pb-3">
            <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              إصدار القرار الإداري النهائي الملزم (Super Admin Verdict)
            </h2>
            <p className="text-xs text-ink-muted dark:text-dark-ink-muted mt-0.5">
              حدد القرار المناسب مع تدوين الأسباب النظامية. القرار ملزم وغير قابل للتراجع.
            </p>
          </div>

          {/* Action selection */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* COMPLETE */}
            <label
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                verdict.action === 'COMPLETE'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/20'
                  : 'border-surface-border hover:bg-surface-sunken dark:border-dark-surface-border'
              }`}
            >
              <input
                type="radio"
                name="verdictAction"
                value="COMPLETE"
                checked={verdict.action === 'COMPLETE'}
                onChange={() => setVerdict((v) => ({ ...v, action: 'COMPLETE' }))}
                className="sr-only"
              />
              <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                <FileCheck2 className="h-4 w-4" />
                <span>إتمام الصفقة (COMPLETE)</span>
              </div>
              <p className="mt-2 text-xs text-emerald-900/80 dark:text-emerald-200">
                اعتماد التحويلات بالكامل، توليد الفاتورة الضريبية، وفك حظر بيانات التواصل.
              </p>
            </label>

            {/* CANCEL */}
            <label
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                verdict.action === 'CANCEL'
                  ? 'border-red-600 bg-red-50/60 dark:border-red-500 dark:bg-red-950/20'
                  : 'border-surface-border hover:bg-surface-sunken dark:border-dark-surface-border'
              }`}
            >
              <input
                type="radio"
                name="verdictAction"
                value="CANCEL"
                checked={verdict.action === 'CANCEL'}
                onChange={() => setVerdict((v) => ({ ...v, action: 'CANCEL' }))}
                className="sr-only"
              />
              <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300 text-sm">
                <FileX2 className="h-4 w-4" />
                <span>إلغاء الصفقة (CANCEL)</span>
              </div>
              <p className="mt-2 text-xs text-red-900/80 dark:text-red-200">
                إلغاء الصفقة، إعادة العقار للسوق النشط، وإنهاء الدفعات مع علم استرداد العمولة إن سُددت.
              </p>
            </label>

            {/* RETURN_TO_REVIEW */}
            <label
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                verdict.action === 'RETURN_TO_REVIEW'
                  ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/20'
                  : 'border-surface-border hover:bg-surface-sunken dark:border-dark-surface-border'
              }`}
            >
              <input
                type="radio"
                name="verdictAction"
                value="RETURN_TO_REVIEW"
                checked={verdict.action === 'RETURN_TO_REVIEW'}
                onChange={() => setVerdict((v) => ({ ...v, action: 'RETURN_TO_REVIEW' }))}
                className="sr-only"
              />
              <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-300 text-sm">
                <RotateCcw className="h-4 w-4" />
                <span>إعادة للتدقيق (RETURN)</span>
              </div>
              <p className="mt-2 text-xs text-blue-900/80 dark:text-blue-200">
                إعادة الصفقة لحالة التدقيق وتمديد مهلة السداد لإتاحة إعادة المحاولة أو إثباتها.
              </p>
            </label>
          </div>

          {/* If RETURN_TO_REVIEW: show deadline extension hours */}
          {verdict.action === 'RETURN_TO_REVIEW' ? (
            <div className="max-w-xs space-y-1.5">
              <label htmlFor="newDeadlineHours" className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
                ساعات التمديد الإضافية (12 إلى 72 ساعة):
              </label>
              <input
                id="newDeadlineHours"
                type="number"
                min={12}
                max={72}
                value={verdict.newDeadlineHours}
                onChange={(e) =>
                  setVerdict((v) => ({ ...v, newDeadlineHours: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm dark:border-dark-surface-border dark:bg-dark-surface-raised font-mono"
              />
            </div>
          ) : null}

          {/* Notes textarea */}
          <div className="space-y-1.5">
            <label htmlFor="verdictNotes" className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary">
              مسببات وملاحظات الحكم الإداري <span className="text-red-500">*</span> (10 أحرف على الأقل):
            </label>
            <textarea
              id="verdictNotes"
              rows={4}
              value={verdict.notes}
              onChange={(e) => setVerdict((v) => ({ ...v, notes: e.target.value }))}
              placeholder="اكتب أسباب وحيثيات القرار الصادر بدقة للتوثيق والشفافية..."
              maxLength={1000}
              className="w-full rounded-xl border border-surface-border bg-surface p-3 text-sm dark:border-dark-surface-border dark:bg-dark-surface-raised"
            />
            <div className="flex justify-between text-[11px] text-ink-muted">
              <span>الحد الأدنى 10 أحرف</span>
              <span>{verdict.notes.length} / 1000</span>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={verdict.notes.trim().length < 10 || actionInProgress === 'adjudicate'}
              onClick={() => setShowConfirmModal(true)}
              data-testid="adjudicate-submit-button"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50"
            >
              <Scale className="h-4 w-4" />
              إصدار القرار الإداري النهائي
            </button>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal */}
      {showConfirmModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                تأكيد إصدار الحكم الإداري
              </h3>
            </div>
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              أنت على وشك إصدار قرار <strong>({verdict.action})</strong> على الصفقة <strong>{dealNumber}</strong>. هذا الإجراء نهائي وملزم. هل تريد المتابعة؟
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:border-dark-surface-border dark:text-dark-ink-secondary dark:hover:bg-dark-surface-raised"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleAdjudicate}
                disabled={actionInProgress === 'adjudicate'}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
              >
                {actionInProgress === 'adjudicate' ? 'جارٍ البت...' : 'تأكيد وإصدار القرار'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Force Unlock Modal */}
      {showForceUnlockModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border space-y-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                كسر القفل الإداري
              </h3>
            </div>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              القضية محجوزة حالياً بواسطة <strong>{holderName}</strong>. يُرجى توضيح سبب كسر القفل لتوثيقه في سجل التدقيق.
            </p>
            <textarea
              rows={3}
              value={forceUnlockReason}
              onChange={(e) => setForceUnlockReason(e.target.value)}
              placeholder="اكتب سبب كسر القفل الإداري..."
              className="w-full rounded-xl border border-surface-border bg-surface-sunken p-3 text-xs text-ink-primary placeholder:text-ink-muted dark:border-dark-surface-border dark:bg-dark-surface-sunken dark:text-dark-ink-primary"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForceUnlockModal(false)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-sunken dark:border-dark-surface-border dark:text-dark-ink-secondary"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleForceUnlock}
                disabled={!forceUnlockReason.trim() || actionInProgress === 'force-unlock'}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                تأكيد كسر القفل
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
