'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AdminRole,
  DocumentVisibility,
  LISTING_LOCK_HEARTBEAT_INTERVAL_MS,
  ListingLockInfo,
  ListingStatus,
  PriceSuggestionItem,
  PriceSuggestionStatus,
  PropertyType,
  UserRole,
  SuspensionCategory,
} from '@elmasaif/shared';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Ban,
  X,
  Unlock,
  User,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TITLE_DEED: 'صك الملكية الإلكتروني',
  OWNER_AUTHORIZATION: 'عقد تفويض المالك / اتفاقية الوساطة',
  COMMERCIAL_REGISTRATION: 'السجل التجاري',
  FLOOR_PLAN: 'المخطط الهندسي / الكروكي',
  OTHER: 'مستند إضافي',
};

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface ListingModerationReviewProps {
  listingId: string;
  initialDetail?: any;
}

export function ListingModerationReview({
  listingId,
  initialDetail,
}: ListingModerationReviewProps) {
  const router = useRouter();
  const { admin, hasPermission } = useAdminAuth();

  const [detail, setDetail] = useState<any | null>(initialDetail || null);
  const [loading, setLoading] = useState<boolean>(!initialDetail);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialDetail?.lockInfo?.remainingSeconds ?? 0,
  );

  // Decision form state
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  // Force unlock modal state
  const [showForceUnlockModal, setShowForceUnlockModal] = useState(false);
  const [forceUnlockReason, setForceUnlockReason] = useState('');

  // Price suggestion form state (FR-57, BR-16)
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [suggestionReason, setSuggestionReason] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const canManageCompliance =
    hasPermission('Listings.Compliance') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.COMPLIANCE_OFFICER;

  // Compliance actions state (Story 2.6 / FR-14, UC-66)
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [complianceReason, setComplianceReason] = useState('');
  const [suspensionCategory, setSuspensionCategory] = useState<string>('');

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockingReason, setBlockingReason] = useState('');
  const [violationCode, setViolationCode] = useState('');

  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const [submittingCompliance, setSubmittingCompliance] = useState<string | null>(null);

  const canForceUnlock =
    hasPermission('Tasks.ForceUnlock') || admin?.role === AdminRole.SUPER_ADMIN;

  const canSuggestPrice =
    hasPermission('Price.Suggest') ||
    admin?.role === AdminRole.SUPER_ADMIN ||
    admin?.role === AdminRole.MODERATOR;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}`,
      );
      if (res?.data) {
        setDetail(res.data);
        setRemainingSeconds(res.data.lockInfo?.remainingSeconds ?? 0);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر تحميل بيانات الإعلان للمراجعة',
      });
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (!initialDetail) {
      loadDetail();
    }
  }, [initialDetail, loadDetail]);

  // Live 1-second countdown timer for active locks
  useEffect(() => {
    if (!detail?.lockInfo?.isLocked || remainingSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [detail?.lockInfo?.isLocked, remainingSeconds]);

  // Automatic 5-minute heartbeat renewal while holding the lock
  useEffect(() => {
    if (!detail?.lockInfo?.isLocked || !detail?.lockInfo?.isLockedByCurrentAdmin) {
      return;
    }

    const heartbeatTimer = setInterval(async () => {
      try {
        const res = await apiClient.post<{ statusCode: number; data: any }>(
          `/admin/listings/${listingId}/heartbeat`,
        );
        if (res?.data?.lockInfo) {
          setDetail((prev: any) =>
            prev ? { ...prev, lockInfo: res.data.lockInfo } : prev,
          );
          setRemainingSeconds(res.data.lockInfo.remainingSeconds ?? 900);
        }
      } catch {
        // Ignore transient network errors; manual extend or re-claim remains available
      }
    }, LISTING_LOCK_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeatTimer);
  }, [
    listingId,
    detail?.lockInfo?.isLocked,
    detail?.lockInfo?.isLockedByCurrentAdmin,
  ]);

  const handleClaimTask = async () => {
    setSubmittingAction('claim');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}/claim`,
      );
      if (res?.data?.lockInfo) {
        setDetail((prev: any) =>
          prev ? { ...prev, lockInfo: res.data.lockInfo } : prev,
        );
        setRemainingSeconds(res.data.lockInfo.remainingSeconds ?? 900);
      }
      setFeedback({
        type: 'success',
        message: 'تم استلام المهمة وقفلها حصرياً باسمك لمدة 15 دقيقة',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر استلام المهمة — قد تكون مقفولة بواسطة مشرف آخر',
      });
      await loadDetail();
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleHeartbeatExtend = async () => {
    setSubmittingAction('heartbeat');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}/heartbeat`,
      );
      if (res?.data?.lockInfo) {
        setDetail((prev: any) =>
          prev ? { ...prev, lockInfo: res.data.lockInfo } : prev,
        );
        setRemainingSeconds(res.data.lockInfo.remainingSeconds ?? 900);
      }
      setFeedback({
        type: 'success',
        message: 'تم تمديد مهلة قفل المراجعة لمدة 15 دقيقة إضافية',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر تمديد قفل المراجعة',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReleaseLock = async () => {
    setSubmittingAction('release');
    setFeedback(null);
    try {
      await apiClient.post(`/admin/listings/${listingId}/release`);
      router.push('/admin/listings/moderation');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر تحرير قفل المهمة',
      });
      setSubmittingAction(null);
    }
  };

  const handleForceUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forceUnlockReason.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'سبب فك القفل الإجباري يجب ألا يقل عن 5 أحرف',
      });
      return;
    }

    setSubmittingAction('force-unlock');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}/force-unlock`,
        { reason: forceUnlockReason.trim() },
      );
      if (res?.data?.lockInfo) {
        setDetail((prev: any) =>
          prev ? { ...prev, lockInfo: res.data.lockInfo } : prev,
        );
        setRemainingSeconds(0);
      }
      setShowForceUnlockModal(false);
      setForceUnlockReason('');
      setFeedback({
        type: 'success',
        message: 'تم فك القفل الإجباري للمهمة وتسجيل الإجراء في سجل التدقيق',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر تنفيذ فك القفل الإجباري',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setSubmittingAction('approve');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}/approve`,
        {
          version: detail.version,
          notes: approvalNotes.trim() || undefined,
        },
      );
      if (res?.data) {
        setDetail((prev: any) => ({
          ...prev,
          status: res.data.status ?? ListingStatus.ACTIVE,
          version: res.data.version ?? prev.version + 1,
          lockInfo: res.data.lockInfo,
        }));
      }
      setFeedback({
        type: 'success',
        message:
          res?.data?.status === ListingStatus.PENDING_FEE
            ? 'تم اعتماد بيانات الإعلان بنجاح. العقار مرتبط بعقد مالك وهو الآن بانتظار سداد الرسوم وتأكيد النشر عبر طابور رسوم العقود.'
            : 'تم اعتماد الإعلان العقاري ونشره بنجاح في المنصة',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر اعتماد الإعلان العقاري',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (rejectionReason.trim().length < 10) {
      setFeedback({
        type: 'error',
        message: 'سبب الرفض يجب ألا يقل عن 10 أحرف لتوضيح الملاحظات لمقدم الإعلان',
      });
      return;
    }

    setSubmittingAction('reject');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any }>(
        `/admin/listings/${listingId}/reject`,
        {
          version: detail.version,
          rejectionReason: rejectionReason.trim(),
        },
      );
      if (res?.data) {
        setDetail((prev: any) => ({
          ...prev,
          status: ListingStatus.REJECTED,
          rejectionReason: rejectionReason.trim(),
          version: res.data.version ?? prev.version + 1,
          lockInfo: res.data.lockInfo,
        }));
      }
      setFeedback({
        type: 'success',
        message: 'تم رفض الإعلان العقاري وحفظ أسباب الرفض في السجل',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر رفض الإعلان العقاري',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (complianceReason.trim().length < 10) {
      setFeedback({
        type: 'error',
        message: 'سبب الإيقاف يجب ألا يقل عن 10 أحرف للتوضيح النظامي',
      });
      return;
    }
    setSubmittingCompliance('suspend');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any; message: string }>(
        `/admin/listings/${listingId}/suspend`,
        {
          complianceReason: complianceReason.trim(),
          suspensionCategory: suspensionCategory || undefined,
        },
      );
      if (res?.data) {
        setDetail((prev: any) => ({
          ...prev,
          status: ListingStatus.SUSPENDED,
          complianceReason: complianceReason.trim(),
          complianceCategory: suspensionCategory || null,
          version: res.data.version ?? prev.version + 1,
        }));
      }
      setShowSuspendModal(false);
      setComplianceReason('');
      setSuspensionCategory('');
      setFeedback({
        type: 'success',
        message: 'تم إيقاف الإعلان مؤقتاً للامتثال وإخفاؤه من البحث العام بنجاح',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر إيقاف الإعلان للامتثال',
      });
    } finally {
      setSubmittingCompliance(null);
    }
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (blockingReason.trim().length < 10) {
      setFeedback({
        type: 'error',
        message: 'سبب الحظر يجب ألا يقل عن 10 أحرف',
      });
      return;
    }
    setSubmittingCompliance('block');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any; message: string }>(
        `/admin/listings/${listingId}/block`,
        {
          blockingReason: blockingReason.trim(),
          violationCode: violationCode.trim() || undefined,
        },
      );
      if (res?.data) {
        setDetail((prev: any) => ({
          ...prev,
          status: ListingStatus.BLOCKED,
          complianceReason: blockingReason.trim(),
          complianceCategory: violationCode.trim() || null,
          version: res.data.version ?? prev.version + 1,
        }));
      }
      setShowBlockModal(false);
      setBlockingReason('');
      setViolationCode('');
      setFeedback({
        type: 'success',
        message: 'تم فرض حظر نهائي على الإعلان وإلغاء العروض المرتبطة بنجاح',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر حظر الإعلان',
      });
    } finally {
      setSubmittingCompliance(null);
    }
  };

  const handleUnsuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (resolutionNotes.trim().length < 10) {
      setFeedback({
        type: 'error',
        message: 'ملاحظات المعالجة يجب ألا تقل عن 10 أحرف',
      });
      return;
    }
    setSubmittingCompliance('unsuspend');
    setFeedback(null);
    try {
      const res = await apiClient.post<{ statusCode: number; data: any; message: string }>(
        `/admin/listings/${listingId}/unsuspend`,
        {
          resolutionNotes: resolutionNotes.trim(),
        },
      );
      if (res?.data) {
        setDetail((prev: any) => ({
          ...prev,
          status: ListingStatus.ACTIVE,
          complianceReason: null,
          complianceCategory: null,
          complianceActionAt: null,
          complianceOfficerId: null,
          version: res.data.version ?? prev.version + 1,
        }));
      }
      setShowUnsuspendModal(false);
      setResolutionNotes('');
      setFeedback({
        type: 'success',
        message: 'تم رفع الإيقاف وإعادة تنشيط الإعلان في البحث العام بنجاح',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر رفع الإيقاف عن الإعلان',
      });
    } finally {
      setSubmittingCompliance(null);
    }
  };

  const handleSuggestPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const priceNum = Number(suggestedPrice);
    if (!priceNum || priceNum < 1 || priceNum > 50000000) {
      setFeedback({
        type: 'error',
        message: 'السعر المقترح يجب أن يكون بين 1 و 50,000,000 ريال سعودي',
      });
      return;
    }
    if (Math.abs(priceNum - Number(detail.askPrice)) < 0.005) {
      setFeedback({
        type: 'error',
        message: 'السعر المقترح مطابق للسعر الحالي المطلوب؛ يرجى تحديد سعر مختلف',
      });
      return;
    }
    if (suggestionReason.trim().length < 10) {
      setFeedback({
        type: 'error',
        message: 'سبب ومبررات اقتراح السعر يجب ألا يقل عن 10 أحرف',
      });
      return;
    }

    setSubmittingSuggestion(true);
    setFeedback(null);
    try {
      const res = await apiClient.post<{
        statusCode: number;
        message: string;
        data: PriceSuggestionItem;
      }>(`/admin/listings/${listingId}/suggest-price`, {
        suggestedPrice: priceNum,
        reason: suggestionReason.trim(),
      });
      if (res?.data) {
        const newSuggestion = res.data;
        setDetail((prev: any) => {
          if (!prev) return prev;
          const oldList = Array.isArray(prev.priceSuggestions) ? prev.priceSuggestions : [];
          // mark existing pending as superseded in local list
          const updatedList = oldList.map((s: PriceSuggestionItem) =>
            s.status === PriceSuggestionStatus.PENDING
              ? { ...s, status: PriceSuggestionStatus.SUPERSEDED }
              : s,
          );
          return {
            ...prev,
            activePriceSuggestion: newSuggestion,
            priceSuggestions: [newSuggestion, ...updatedList],
          };
        });
        setSuggestedPrice('');
        setSuggestionReason('');
        setFeedback({
          type: 'success',
          message: 'تم إرسال مقترح تعديل السعر وإشعار البائع بنجاح',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'تعذر تقديم مقترح السعر',
      });
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  if (loading && !detail) {
    return (
      <div dir="rtl" className="p-12 text-center text-ink-muted text-sm">
        جاري تحميل تفاصيل الإعلان العقاري للمراجعة...
      </div>
    );
  }

  if (!detail) {
    return (
      <div dir="rtl" className="p-12 text-center space-y-3">
        <p className="text-sm font-bold text-red-600">
          لم يتم العثور على الإعلان العقاري المطلوب
        </p>
        <Link
          href="/admin/listings/moderation"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary underline"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى طابور المراجعة</span>
        </Link>
      </div>
    );
  }

  const lockInfo: ListingLockInfo = detail.lockInfo || {
    isLocked: false,
    isLockedByCurrentAdmin: false,
    lockedByAdminId: null,
    lockedByAdminName: null,
    lockedAt: null,
    lockExpiresAt: null,
    remainingSeconds: 0,
  };

  const isLockedByCurrentAdmin =
    lockInfo.isLocked && lockInfo.isLockedByCurrentAdmin && remainingSeconds > 0;
  const isLockedByOther =
    lockInfo.isLocked && !lockInfo.isLockedByCurrentAdmin && remainingSeconds > 0;
  const isPendingReview = detail.status === ListingStatus.PENDING_REVIEW;
  const canExecuteDecision =
    isPendingReview && isLockedByCurrentAdmin && !submittingAction;

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/listings/moderation"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary hover:text-primary transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى طابور مراجعة الإعلانات العقارية</span>
        </Link>

        <span dir="ltr" className="text-xs font-mono text-ink-muted">
          {`Listing ID: ${detail.id} • v${detail.version}`}
        </span>
      </div>

      {/* 1. Lock Status Banner (AC #2, #3, #4, #5) */}
      {isLockedByCurrentAdmin ? (
        <div className="rounded-2xl bg-primary text-white p-5 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">
                  قفل المراجعة الحصري نشط باسمك
                </h2>
                <span
                  dir="ltr"
                  className="px-2.5 py-0.5 rounded-full bg-white/10 text-accent-light font-mono text-xs font-bold border border-white/10"
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1">
                يتم تمديد القفل تلقائياً كل 5 دقائق طالما أن نافذة المراجعة نشطة لمنع تضارب القرارات.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={handleHeartbeatExtend}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تمديد القفل</span>
            </button>

            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={handleReleaseLock}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-primary hover:bg-accent-light text-xs font-bold shadow-sm transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>تحرير المهمة</span>
            </button>
          </div>
        </div>
      ) : isLockedByOther ? (
        <div
          role="region"
          aria-label="Read-Only Lock Warning"
          className="rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/70 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[11px] font-bold">
                  وضع القراءة فقط
                </span>
                <h2 className="text-sm font-bold">
                  {`هذا الإعلان قيد المراجعة حالياً بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}
                </h2>
                <span
                  dir="ltr"
                  className="px-2.5 py-0.5 rounded-full bg-amber-900 text-amber-50 font-mono text-xs font-bold"
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                جميع أزرار الاعتماد والرفض معطلة مؤقتاً لمنع تضارب المراجعة حتى انتهاء المهلة أو تحرير المهمة.
              </p>
            </div>
          </div>

          {canForceUnlock && (
            <button
              type="button"
              onClick={() => setShowForceUnlockModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm transition-colors shrink-0"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>فك القفل الإجباري (Force Unlock)</span>
            </button>
          )}
        </div>
      ) : (
        isPendingReview && (
          <div className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  الإعلان متاح للاستلام والمراجعة
                </h2>
                <p className="text-xs text-ink-secondary">
                  يجب استلام المهمة أولاً لتفعيل قفل المراجعة الحصري (15 دقيقة) وتتمكن من اتخاذ قرار الاعتماد أو الرفض.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={handleClaimTask}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>استلام المهمة لبدء المراجعة (15 دقيقة)</span>
            </button>
          </div>
        )
      )}

      {/* Active Listing Notice Banner */}
      {detail.status === ListingStatus.ACTIVE && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-900 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-950 text-xs font-bold">
                  منشور في السوق (ACTIVE)
                </span>
                <h2 className="text-sm font-bold">
                  هذا العقار معتمد ومنشور حالياً في المنصة
                </h2>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                يمكنك كمسؤول تقييم فحص السعر وتقديم مقترح سعر استرشادي أقل للبائع مع مبررات التقييم من لوحة المقترحات أدناه.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Main Two-Column Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Column (8 cols): Property & Legal Document Inspection */}
        <div className="lg:col-span-8 space-y-6">
          {/* Property Overview Card */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border dark:border-dark-surface-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                    {PROPERTY_TYPE_LABELS[detail.propertyType] || detail.propertyType}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-surface-sunken text-ink-secondary text-xs font-semibold">
                    {`الحالة: ${detail.status}`}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary mt-2">
                  {detail.title}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-ink-secondary mt-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {`${detail.cityName || ''} — حي ${detail.districtName || ''}${
                      detail.streetName ? ` (${detail.streetName})` : ''
                    }`}
                  </span>
                </div>
              </div>

              <div className="text-left">
                <div className="text-[11px] text-ink-muted">السعر المطلوب</div>
                <div
                  dir="ltr"
                  className="text-xl font-mono font-bold text-primary dark:text-accent"
                >
                  {`${Number(detail.askPrice).toLocaleString('en-US')} SAR`}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-secondary">وصف العقار</h3>
              <p className="text-xs text-ink-primary dark:text-dark-ink-primary leading-relaxed whitespace-pre-line">
                {detail.description}
              </p>
            </div>

            {/* Key Specs & Monospace IBAN */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface">
                <div className="text-[11px] text-ink-muted">المساحة</div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {`${detail.areaSquareMeters} م²`}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface">
                <div className="text-[11px] text-ink-muted">غرف النوم</div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {detail.bedrooms ?? 'غير محدد'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface">
                <div className="text-[11px] text-ink-muted">سنة البناء</div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {detail.yearBuilt ?? 'غير محدد'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface">
                <div className="text-[11px] text-ink-muted">الإحداثيات الجغرافية</div>
                <div dir="ltr" className="text-[11px] font-mono font-semibold mt-0.5">
                  {`${detail.latitude}, ${detail.longitude}`}
                </div>
              </div>
            </div>

            {/* Payout IBAN Card (Monospace) */}
            {detail.payoutIban && (
              <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-between">
                <span className="text-xs font-bold text-accent-dark dark:text-accent">
                  حساب الآيبان المرتبط لصرف مستحقات البائع (IBAN):
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-xs font-bold tracking-wider text-ink-primary dark:text-dark-ink-primary"
                >
                  {detail.payoutIban}
                </span>
              </div>
            )}
          </div>

          {/* Classified Legal Documents Section (ADMIN_ONLY) */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  المستندات القانونية والملكية المصنفة
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                سري للإدارة فقط (ADMIN_ONLY)
              </span>
            </div>

            <div className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {(detail.documents || []).map((doc: any) => (
                <div
                  key={doc.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                        {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                        {doc.scanStatus || 'CLEAN'}
                      </span>
                      {doc.visibility === DocumentVisibility.ADMIN_ONLY && (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                          ADMIN_ONLY
                        </span>
                      )}
                    </div>
                    <div dir="ltr" className="text-[11px] font-mono text-ink-muted">
                      {`${doc.mimeType} • ${Math.round((doc.fileSize || 0) / 1024)} KB`}
                    </div>
                  </div>

                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>معاينة المستند (رابط موقع 300 ثانية)</span>
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Public Photos Gallery */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                {`صور العقار العامة (${(detail.photos || []).length})`}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(detail.photos || []).map((photo: any, idx: number) => (
                <div
                  key={photo.id || idx}
                  className="p-3 rounded-xl border border-surface-border bg-surface-sunken flex flex-col justify-between gap-2"
                >
                  <div className="text-xs font-semibold text-ink-primary">
                    {`صورة العقار #${idx + 1}`}
                  </div>
                  <a
                    href={photo.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>فتح الصورة</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Left Column (4 cols): Seller Info & Moderation Decision Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Seller Profile Card */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
              <User className="w-4 h-4 text-primary" />
              <span>بيانات مقدم الإعلان</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">الاسم الكامل:</span>
                <span className="font-bold">
                  {detail.sellerProfile?.user?.fullName || 'غير متوفر'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">الصفة:</span>
                <span className="font-semibold text-primary">
                  {detail.sellerProfile?.role === UserRole.MARKETER
                    ? 'وسيط عقاري مرخص (فال)'
                    : 'مالك العقار المباشر'}
                </span>
              </div>
              {detail.sellerProfile?.user?.mobileNumber && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">رقم الجوال:</span>
                  <span dir="ltr" className="font-mono">
                    {detail.sellerProfile.user.mobileNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Moderation Decision Panel (AC #6) */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 border-b border-surface-border dark:border-dark-surface-border pb-3">
              <ShieldCheck className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                قرار المراجعة الإدارية
              </h2>
            </div>

            {/* Decision or Active Notice */}
            {detail.status === ListingStatus.ACTIVE ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>الإعلان معتمد ونشط حالياً في المنصة</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  الإعلان معروض في السوق. في حال رأيت أن السعر المعروض مبالغ فيه أو غير متوافق مع حركة الصفقات في الحي، يمكنك تقديم مقترح استرشادي عبر لوحة المقترحات أدناه.
                </p>
              </div>
            ) : detail.status === ListingStatus.REJECTED ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-700" />
                  <span>الإعلان في حالة مرفوض</span>
                </div>
                {detail.rejectionReason && (
                  <p className="text-[11px] text-red-800 leading-relaxed">
                    {`سبب الرفض: ${detail.rejectionReason}`}
                  </p>
                )}
              </div>
            ) : detail.status === ListingStatus.SUSPENDED ? (
              <div
                className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2"
                data-testid="admin-suspended-banner"
              >
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>الإعلان موقوف مؤقتاً للامتثال والرقابة</span>
                </div>
                {detail.complianceReason && (
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-bold">السبب: </span>
                    <span>{detail.complianceReason}</span>
                  </p>
                )}
                {detail.complianceCategory && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    <span className="font-bold">التصنيف: </span>
                    <span>{detail.complianceCategory}</span>
                  </p>
                )}
                {canManageCompliance && (
                  <button
                    type="button"
                    onClick={() => setShowUnsuspendModal(true)}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                    data-testid="unsuspend-listing-btn"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>رفع الإيقاف وإعادة التنشيط</span>
                  </button>
                )}
              </div>
            ) : detail.status === ListingStatus.BLOCKED ? (
              <div
                className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-2"
                data-testid="admin-blocked-banner"
              >
                <div className="font-bold flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>الإعلان محظور نهائياً بموجب قرار الامتثال</span>
                </div>
                {detail.complianceReason && (
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-bold">سبب الحظر: </span>
                    <span>{detail.complianceReason}</span>
                  </p>
                )}
                <p className="text-[11px] text-rose-700 dark:text-rose-400">
                  هذا الإعلان محظور نهائياً ولا يمكن تنشيطه أو تعديله.
                </p>
              </div>
            ) : detail.status === ListingStatus.ARCHIVED ? (
              <div
                className="p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary text-xs space-y-1.5"
                data-testid="admin-archived-banner"
              >
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldOff className="w-4 h-4 text-ink-muted" />
                  <span>الإعلان مؤرشف من قبل البائع</span>
                </div>
                {detail.archiveReason && (
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-bold">سبب الأرشفة: </span>
                    <span>{detail.archiveReason}</span>
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Approve Section */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-ink-secondary">
                    ملاحظات الاعتماد الداخلية (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canExecuteDecision}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="تم التحقق من مطابقة الصك ورخصة فال..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!canExecuteDecision}
                    onClick={handleApprove}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد ونشر الإعلان</span>
                  </button>
                </div>

                <hr className="border-surface-border dark:border-dark-surface-border" />

                {/* Reject Section */}
                <form onSubmit={handleReject} className="space-y-2.5">
                  <label className="block text-xs font-semibold text-red-700">
                    أسباب وملاحظات الرفض (إلزامي عند الرفض — 10 أحرف على الأقل)
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canExecuteDecision}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="وضح سبب رفض الإعلان بدقة ليتمكن المالك أو الوسيط من تصحيحه..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!canExecuteDecision}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض الإعلان مع الملاحظات</span>
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Price Suggestion Panel & History (Story 2.5 / FR-57 / BR-16) */}
          <div className="bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" />
                <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  اقتراح تعديل السعر الاسترشادي (FR-57)
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-sunken text-ink-secondary">
                BR-16: استقلالية تسعير البائع
              </span>
            </div>

            <p className="text-xs text-ink-secondary leading-relaxed">
              يمكنك تقديم مقترح سعر استرشادي للبائع مع توضيح المبررات السوقية. لا يتم تعديل سعر الإعلان مباشرة إلا بموافقة البائع الصريحة.
            </p>

            {/* Price Suggestion Form */}
            <form onSubmit={handleSuggestPrice} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  السعر الاسترشادي المقترح (ر.س) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50000000}
                    step="any"
                    required
                    disabled={!canSuggestPrice || isLockedByOther || submittingSuggestion}
                    value={suggestedPrice}
                    onChange={(e) => setSuggestedPrice(e.target.value)}
                    placeholder="مثال: 3850000"
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-surface-border bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <span className="absolute left-3 top-2 text-xs text-ink-muted font-mono">
                    SAR
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  مبررات التقييم العقاري وتحليل السوق (10 أحرف على الأقل) *
                </label>
                <textarea
                  rows={3}
                  required
                  disabled={!canSuggestPrice || isLockedByOther || submittingSuggestion}
                  value={suggestionReason}
                  onChange={(e) => setSuggestionReason(e.target.value)}
                  placeholder="بناءً على صفقات الحي الأخيرة ومتوسط سعر المتر المماثل..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!canSuggestPrice || isLockedByOther || submittingSuggestion}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>إرسال مقترح السعر للبائع</span>
              </button>
            </form>

            {/* Suggestions History List */}
            {Array.isArray(detail.priceSuggestions) && detail.priceSuggestions.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-surface-border dark:border-dark-surface-border">
                <h3 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                  سجل مقترحات الأسعار السابقة ({detail.priceSuggestions.length})
                </h3>
                <div className="space-y-2.5 max-h-64 overflow-y-auto">
                  {detail.priceSuggestions.map((s: PriceSuggestionItem) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          dir="ltr"
                          className="font-mono font-bold text-primary dark:text-accent"
                        >
                          {`${Number(s.suggestedPrice).toLocaleString('en-US')} SAR`}
                        </span>
                        <div>
                          {s.status === PriceSuggestionStatus.PENDING ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                              بانتظار رد البائع
                            </span>
                          ) : s.status === PriceSuggestionStatus.ACCEPTED ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                              تم القبول
                            </span>
                          ) : s.status === PriceSuggestionStatus.DECLINED ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900">
                              تم الرفض
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary">
                              تم استبداله
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-ink-secondary leading-snug">
                        {s.reason}
                      </div>

                      {s.sellerResponseNote && (
                        <div className="text-[11px] text-ink-primary bg-white/70 dark:bg-black/20 p-1.5 rounded-lg">
                          <span className="font-semibold">رد البائع: </span>
                          <span>{s.sellerResponseNote}</span>
                        </div>
                      )}

                      <div className="text-[10px] text-ink-muted">
                        {`بواسطة: ${s.suggestedByAdminName}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Actions Panel (Story 2.6 / FR-14 / UC-66) */}
          {canManageCompliance && (
            <div
              className="bg-surface dark:bg-dark-surface-raised border border-amber-300/40 dark:border-amber-800/40 rounded-2xl p-5 space-y-4"
              data-testid="admin-compliance-panel"
            >
              <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    إجراءات الامتثال والرقابة (FR-14)
                  </h2>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  صلاحيات الامتثال
                </span>
              </div>

              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                إجراءات رقابية سيادية للتعامل مع مخالفات الإعلانات، رخص فال، أو شبهات التلاعب مع الحفاظ على الصفقات الجارية.
              </p>

              <div className="space-y-2.5">
                {detail.status !== ListingStatus.SUSPENDED &&
                  detail.status !== ListingStatus.BLOCKED && (
                    <button
                      type="button"
                      onClick={() => setShowSuspendModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
                      data-testid="open-suspend-modal-btn"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>إيقاف مؤقت للامتثال (Suspend)</span>
                    </button>
                  )}

                {detail.status === ListingStatus.SUSPENDED && (
                  <button
                    type="button"
                    onClick={() => setShowUnsuspendModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-colors"
                    data-testid="open-unsuspend-modal-btn"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>رفع الإيقاف وإعادة التنشيط (Unsuspend)</span>
                  </button>
                )}

                {detail.status !== ListingStatus.BLOCKED && (
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-sm transition-colors"
                    data-testid="open-block-modal-btn"
                  >
                    <Ban className="w-4 h-4" />
                    <span>حظر نهائي للإعلان (Permanent Block)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Force Unlock Modal (AC #5) */}
      {showForceUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface-raised border border-surface-border rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>فك القفل الإجباري للمهمة (Tasks.ForceUnlock)</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              سيتم إلغاء القفل الحالي المملوك للمشرف المناوب وتسجيل عملية فك القفل الإجباري في سجل التدقيق غير القابل للتعديل (AuditLog).
            </p>
            <form onSubmit={handleForceUnlock} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  سبب فك القفل الإجباري (5 أحرف على الأقل) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={forceUnlockReason}
                  onChange={(e) => setForceUnlockReason(e.target.value)}
                  placeholder="مثال: انتهاء مناوبة المشرف أو انقطاع الاتصال..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForceUnlockModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingAction === 'force-unlock'}
                  className="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold"
                >
                  تأكيد فك القفل الإجباري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Listing Modal (Story 2.6 / FR-14) */}
      {showSuspendModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          data-testid="suspend-modal"
        >
          <div className="bg-white dark:bg-dark-surface-raised border border-surface-border rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>إيقاف مؤقت للإعلان العقاري للامتثال والرقابة</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="text-ink-muted hover:text-ink-primary p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              سيتم إخفاء هذا الإعلان فوراً من البحث العام وإلغاء العروض المعلقة غير المرتبطة بصفقة نشطة. الصفقات الجارية تستمر دون انقطاع.
            </p>
            <form onSubmit={handleSuspend} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">
                  تصنيف سبب الإيقاف (اختياري)
                </label>
                <select
                  value={suspensionCategory}
                  onChange={(e) => setSuspensionCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="suspension-category-select"
                >
                  <option value="">بدون تصنيف محدد</option>
                  <option value={SuspensionCategory.MISLEADING_SPECIFICATIONS}>مواصفات مضللة أو غير دقيقة</option>
                  <option value={SuspensionCategory.INVALID_FAL_LICENSE}>رخصة فال غير صالحة أو منتهية</option>
                  <option value={SuspensionCategory.UNAUTHORIZED_BROKERAGE}>وساطة غير مصرح بها</option>
                  <option value={SuspensionCategory.FRAUD_SUSPICION}>اشتباه في تلاعب أو احتيال</option>
                  <option value={SuspensionCategory.OTHER}>أسباب أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  سبب الإيقاف وملاحظات الرقابة (10 أحرف على الأقل) *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  maxLength={1000}
                  value={complianceReason}
                  onChange={(e) => setComplianceReason(e.target.value)}
                  placeholder="اذكر بالتفصيل المخالفة المرصودة والاشتراطات المطلوب استيفاؤها..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="compliance-reason-input"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCompliance === "suspend"}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50"
                  data-testid="confirm-suspend-btn"
                >
                  {submittingCompliance === "suspend" ? "جاري الإيقاف..." : "تأكيد الإيقاف المؤقت"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Block Listing Modal (Story 2.6 / FR-14, BR-16) */}
      {showBlockModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          data-testid="block-modal"
        >
          <div className="bg-white dark:bg-dark-surface-raised border border-red-300 dark:border-red-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <Ban className="w-5 h-5" />
                <span>حظر نهائي للإعلان العقاري (Permanent Ban)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="text-ink-muted hover:text-ink-primary p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-900 dark:text-red-200 space-y-1">
              <p className="font-bold">تحذير أمني ونظامي حرج:</p>
              <p className="leading-relaxed">
                حظر الإعلان إجراء دائم ونهائي لا يمكن التراجع عنه أو إعادة نشر العقار بعده. سيتم شطب الإعلان من العرض، وإلغاء كافة العروض المفتوحة وإشعار البائع بالقرار.
              </p>
            </div>
            <form onSubmit={handleBlock} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">
                  رمز أو رقم المخالفة النظامية (اختياري)
                </label>
                <input
                  type="text"
                  value={violationCode}
                  onChange={(e) => setViolationCode(e.target.value)}
                  placeholder="مثال: VIO-REGA-2026-99"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  data-testid="violation-code-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  أسباب ومبررات الحظر النهائي (10 أحرف على الأقل) *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  maxLength={1000}
                  value={blockingReason}
                  onChange={(e) => setBlockingReason(e.target.value)}
                  placeholder="بيان تفصيلي بالمخالفة الجسيمة أو قرار المنع الصادر بحق الإعلان..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:outline-none focus:ring-2 focus:ring-rose-500"
                  data-testid="blocking-reason-input"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCompliance === "block"}
                  className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold disabled:opacity-50"
                  data-testid="confirm-block-btn"
                >
                  {submittingCompliance === "block" ? "جاري الحظر..." : "تأكيد الحظر النهائي"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unsuspend Listing Modal (Story 2.6 / UC-66) */}
      {showUnsuspendModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          data-testid="unsuspend-modal"
        >
          <div className="bg-white dark:bg-dark-surface-raised border border-surface-border rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
                <CheckCircle2 className="w-5 h-5" />
                <span>رفع الإيقاف وإعادة تنشيط الإعلان العقاري</span>
              </div>
              <button
                type="button"
                onClick={() => setShowUnsuspendModal(false)}
                className="text-ink-muted hover:text-ink-primary p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              سيتم إعادة نشر الإعلان فوراً في البحث العام للمشترين والجمهور وإشعار البائع بحل ملاحظات الامتثال.
            </p>
            <form onSubmit={handleUnsuspend} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">
                  ملاحظات ومبررات رفع الإيقاف (10 أحرف على الأقل) *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  maxLength={1000}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="بيان معالجة الملاحظات، التحقق من تجديد رخصة فال، أو صحة الوثائق..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  data-testid="resolution-notes-input"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowUnsuspendModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCompliance === "unsuspend"}
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                  data-testid="confirm-unsuspend-btn"
                >
                  {submittingCompliance === "unsuspend" ? "جاري التنشيط..." : "تأكيد رفع الإيقاف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

