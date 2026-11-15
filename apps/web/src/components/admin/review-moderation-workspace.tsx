'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AdminReviewModerationQueueResponseDto,
  AdminReviewModerationItemDto,
  AdminReviewModerationDetailDto,
  ReviewVisibilityFilter,
  REVIEW_MODERATION_MIN_REASON_LENGTH,
  REVIEW_MODERATION_MAX_REASON_LENGTH,
} from '@elmasaif/shared';
import {
  Star,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  History,
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  Building2,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';

export type ReviewQueueTabFilter = ReviewVisibilityFilter | 'LOW_SCORE';

export interface ReviewModerationWorkspaceProps {
  initialQueueData?: AdminReviewModerationQueueResponseDto | null;
  initialSelectedDetail?: AdminReviewModerationDetailDto | null;
  initialVisibilityFilter?: ReviewQueueTabFilter;
  initialScoreFilter?: number | null;
  initialModalMode?: 'HIDE' | 'RESTORE' | null;
  initialModalTarget?: AdminReviewModerationItemDto | null;
}

const HIDE_REASON_PRESETS = [
  'ألفاظ مسيئة أو تشهير غير نظامي',
  'محتوى كيدي أو غير مرتبط بالصفقة العقارية',
  'تضمن بيانات تواصل شخصية مخالفة',
  'مخالفة ضوابط النشر وتقييم الوسطاء المعتمدين',
];

const RESTORE_REASON_PRESETS = [
  'تم التحقق من سلامة التقييم ومطابقته للضوابط',
  'ثبوت ارتباط التقييم بصفقة مكتملة وخلوه من الإساءة',
  'قبول تظلم المشتري وإعادة إظهار التقييم للعموم',
];

function renderStarIcons(score: number) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${score} من 5 نجوم`}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const filled = starIndex <= score;
        return (
          <Star
            key={starIndex}
            className={`w-4 h-4 ${
              filled
                ? 'text-[#D97706] fill-[#D97706]'
                : 'text-slate-300 dark:text-slate-600'
            }`}
          />
        );
      })}
    </div>
  );
}

export function ReviewModerationWorkspace({
  initialQueueData = null,
  initialSelectedDetail = null,
  initialVisibilityFilter = 'ALL',
  initialScoreFilter = null,
  initialModalMode = null,
  initialModalTarget = null,
}: ReviewModerationWorkspaceProps) {
  const [queueData, setQueueData] =
    useState<AdminReviewModerationQueueResponseDto | null>(initialQueueData);
  const [selectedDetail, setSelectedDetail] =
    useState<AdminReviewModerationDetailDto | null>(initialSelectedDetail);
  const [visibilityTab, setVisibilityTab] = useState<ReviewQueueTabFilter>(
    initialVisibilityFilter,
  );
  const [scoreFilter, setScoreFilter] = useState<number | null>(
    initialScoreFilter,
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<
    string | null
  >(null);

  const [modalMode, setModalMode] = useState<'HIDE' | 'RESTORE' | null>(
    initialModalMode,
  );
  const [modalTarget, setModalTarget] =
    useState<AdminReviewModerationItemDto | null>(initialModalTarget);
  const [moderationReason, setModerationReason] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingModeration, setIsSubmittingModeration] =
    useState<boolean>(false);

  const fetchReviewsQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (visibilityTab === 'LOW_SCORE') {
        params.set('visibility', 'VISIBLE');
        params.set('lowScoreOnly', 'true');
      } else {
        params.set('visibility', visibilityTab);
      }
      if (scoreFilter !== null) {
        params.set('score', String(scoreFilter));
      }
      if (searchTerm.trim().length > 0) {
        params.set('search', searchTerm.trim());
      }

      const response = await apiClient.get<{
        statusCode: number;
        code: string;
        data: AdminReviewModerationQueueResponseDto;
      }>(`/admin/reviews?${params.toString()}`);

      if (response?.data) {
        setQueueData(response.data);
      }
    } catch (err) {
      setError(describeApiError(err).message || 'تعذر تحميل طابور مراجعة التقييمات');
    } finally {
      setIsLoading(false);
    }
  }, [visibilityTab, scoreFilter, searchTerm]);

  const fetchReviewDetail = useCallback(async (ratingId: string) => {
    setIsDetailLoading(true);
    try {
      const response = await apiClient.get<{
        statusCode: number;
        code: string;
        data: AdminReviewModerationDetailDto;
      }>(`/admin/reviews/${ratingId}`);
      if (response?.data) {
        setSelectedDetail(response.data);
      }
    } catch (err) {
      setError(describeApiError(err).message || 'تعذر تحميل سجل التدقيق للتقييم');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialQueueData) {
      fetchReviewsQueue();
    }
  }, [initialQueueData, fetchReviewsQueue]);

  const counts = queueData?.counts ?? {
    totalReviews: 0,
    visibleReviews: 0,
    hiddenReviews: 0,
    lowScoreVisibleReviews: 0,
  };

  const displayedItems = useMemo(() => {
    const rawItems = queueData?.items ?? [];
    return rawItems.filter((item) => {
      if (visibilityTab === 'VISIBLE' && item.isHidden) return false;
      if (visibilityTab === 'HIDDEN' && !item.isHidden) return false;
      if (visibilityTab === 'LOW_SCORE' && (item.isHidden || item.score > 2)) {
        return false;
      }
      if (scoreFilter !== null && item.score !== scoreFilter) return false;
      if (searchTerm.trim().length > 0) {
        const q = searchTerm.trim().toLowerCase();
        const matches =
          (item.comment || '').toLowerCase().includes(q) ||
          item.dealNumber.toLowerCase().includes(q) ||
          item.rater.fullName.toLowerCase().includes(q) ||
          item.targetBroker.commercialName.toLowerCase().includes(q) ||
          item.targetBroker.fullName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [queueData, visibilityTab, scoreFilter, searchTerm]);

  const openModerationModal = (
    item: AdminReviewModerationItemDto,
    mode: 'HIDE' | 'RESTORE',
  ) => {
    setModalTarget(item);
    setModalMode(mode);
    setModerationReason('');
    setModalError(null);
  };

  const closeModerationModal = () => {
    setModalTarget(null);
    setModalMode(null);
    setModerationReason('');
    setModalError(null);
  };

  const trimmedReasonLength = moderationReason.trim().length;
  const isReasonValid =
    trimmedReasonLength >= REVIEW_MODERATION_MIN_REASON_LENGTH &&
    trimmedReasonLength <= REVIEW_MODERATION_MAX_REASON_LENGTH;

  const handleConfirmModeration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTarget || !modalMode) return;
    if (!isReasonValid) {
      setModalError('سبب الإجراء يجب ألا يقل عن 3 أحرف ولا يتجاوز 500 حرف');
      return;
    }

    setIsSubmittingModeration(true);
    setModalError(null);
    setActionSuccessMessage(null);

    const endpoint =
      modalMode === 'HIDE'
        ? `/admin/reviews/${modalTarget.id}/hide`
        : `/admin/reviews/${modalTarget.id}/restore`;

    try {
      await apiClient.post(endpoint, {
        reason: moderationReason.trim(),
      });

      setActionSuccessMessage(
        modalMode === 'HIDE'
          ? `تم حجب التقييم الخاص بالصفقة (${modalTarget.dealNumber}) واستبعاده من المتوسط العام للوسيط مع حفظ السجل في AuditLog.`
          : `تمت استعادة التقييم الخاص بالصفقة (${modalTarget.dealNumber}) وإعادة إدراجه في المتوسط العام للوسيط.`,
      );
      const moderatedId = modalTarget.id;
      closeModerationModal();
      await fetchReviewsQueue();
      await fetchReviewDetail(moderatedId);
    } catch (err) {
      setModalError(describeApiError(err).message || 'تعذر تنفيذ إجراء المراجعة على التقييم');
    } finally {
      setIsSubmittingModeration(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Sovereign Header Banner */}
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 text-[#D8F3DC] px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              مساحة تدقيق التقييمات والسمعة • Reviews.Moderate (FR-19, FR-52, AD-6)
            </span>
          </div>
          <h1 className="text-2xl font-bold">
            مراجعة وتدقيق تقييمات الوسطاء العقاريين
          </h1>
          <p className="text-xs text-white/80 max-w-3xl leading-relaxed">
            مراجعة التقييمات المسجلة من المشترين بعد إتمام الصفقات، وحجب المحتوى المسيء أو التشهيري من العرض العام وحساب المتوسط مع الاحتفاظ الدائم بالسجل الفيزيائي وتوثيق كافة القرارات في سجل التدقيق غير القابل للتعديل (AuditLog).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchReviewsQueue}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1B4332] text-xs font-bold shadow-sm hover:bg-[#D8F3DC] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث القائمة</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          data-testid="kpi-total-reviews"
          className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary font-medium">
            <span>إجمالي التقييمات المسجلة</span>
            <Star className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink-primary dark:text-dark-ink-primary">
            {counts.totalReviews}
          </div>
          <p className="text-[11px] text-ink-muted">
            محفوظة بالكامل في قاعدة البيانات (لا تُحذف أبداً)
          </p>
        </div>

        <div
          data-testid="kpi-visible-reviews"
          className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-emerald-500/30 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <span>مُدرجة في العرض العام ومتوسط التقييم</span>
            <Eye className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {counts.visibleReviews}
          </div>
          <p className="text-[11px] text-ink-muted">
            تظهر في صفحة الوسيط العامة وتدخل في حساب المتوسط
          </p>
        </div>

        <div
          data-testid="kpi-hidden-reviews"
          className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-red-500/30 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-red-700 dark:text-red-400 font-semibold">
            <span>محجوبة إدارياً ومستبعدة من المتوسط</span>
            <EyeOff className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-400">
            {counts.hiddenReviews}
          </div>
          <p className="text-[11px] text-ink-muted">
            مخفية عن العموم ومستبعدة فوراً من متوسط التقييم
          </p>
        </div>

        <div
          data-testid="kpi-low-score-reviews"
          className="p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-amber-500/30 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold">
            <span>تقييمات منخفضة (1-2 ★) معروضة</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
            {counts.lowScoreVisibleReviews}
          </div>
          <p className="text-[11px] text-ink-muted">
            تقييمات تتطلب مراجعة استباقية للتأكد من خلوها من الإساءة
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionSuccessMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Visibility Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'VISIBLE', label: 'معروضة للعموم (نشطة)' },
                { id: 'HIDDEN', label: 'محجوبة إدارياً' },
                { id: 'LOW_SCORE', label: 'تقييمات منخفضة (1-2 نجوم)' },
              ] as Array<{ id: ReviewQueueTabFilter; label: string }>
            ).map((tab) => {
              const active = visibilityTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVisibilityTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#1B4332] text-white shadow-sm'
                      : 'bg-surface-sunken dark:bg-dark-surface text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Star Score Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted me-1">فلتر النجوم:</span>
            <button
              type="button"
              onClick={() => setScoreFilter(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                scoreFilter === null
                  ? 'bg-[#D97706] text-white border-[#D97706]'
                  : 'border-surface-border text-ink-secondary hover:bg-surface-sunken'
              }`}
            >
              الكل
            </button>
            {[5, 4, 3, 2, 1].map((starValue) => (
              <button
                key={starValue}
                type="button"
                onClick={() =>
                  setScoreFilter(scoreFilter === starValue ? null : starValue)
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  scoreFilter === starValue
                    ? 'bg-[#D97706] text-white border-[#D97706]'
                    : 'border-surface-border text-ink-secondary hover:bg-surface-sunken'
                }`}
              >
                {`${starValue} ★`}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-ink-muted absolute top-3 start-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بنص التعليق، رقم الصفقة (ELM-...)، اسم الوسيط أو المنشأة العقارية، أو اسم المشتري..."
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
          />
        </div>
      </div>

      {/* Main Split Grid: Review Moderation Cards + Audit Trail Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Center Column: Review Moderation Cards (DESIGN.md Component #9) */}
        <div className="lg:col-span-2 space-y-4">
          {displayedItems.length === 0 ? (
            <div className="p-10 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-center space-y-2">
              <Star className="w-8 h-8 text-ink-muted mx-auto" />
              <p className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                لا توجد تقييمات مطابقة لمعايير التصفية الحالية
              </p>
              <p className="text-xs text-ink-secondary">
                يمكنك تغيير فلتر الظهور أو مسح كلمات البحث لعرض كافة التقييمات المسجلة.
              </p>
            </div>
          ) : (
            displayedItems.map((item) => {
              const isSelected = selectedDetail?.id === item.id;
              return (
                <article
                  key={item.id}
                  data-testid={`review-card-${item.id}`}
                  className={`p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border transition-all space-y-4 ${
                    item.isHidden
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                      : isSelected
                      ? 'border-[#1B4332] ring-1 ring-[#1B4332]'
                      : 'border-surface-border dark:border-dark-surface-border'
                  }`}
                >
                  {/* Top Bar: Stars + Score + Inclusion/Exclusion Status Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {renderStarIcons(item.score)}
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-300/60 text-[#D97706] font-mono text-xs font-bold">
                        {item.score} / 5
                      </span>
                      <span
                        dir="ltr"
                        className="px-2.5 py-0.5 rounded-md bg-surface-sunken dark:bg-dark-surface font-mono text-xs font-semibold text-ink-secondary"
                      >
                        {item.dealNumber}
                      </span>
                    </div>

                    {/* Inclusion / Exclusion Badge Indicator (DESIGN.md #9) */}
                    {item.isHidden ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs font-bold">
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>
                          محجوب إدارياً — مستبعد من العرض العام ومتوسط التقييم
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مُدرج في التقييم العام ومتوسط الوسيط</span>
                      </span>
                    )}
                  </div>

                  {/* Qualitative Review Comment */}
                  <div className="p-3.5 rounded-xl bg-surface-sunken/70 dark:bg-dark-surface border border-surface-border/70 dark:border-dark-surface-border">
                    <p className="text-sm text-ink-primary dark:text-dark-ink-primary leading-relaxed">
                      {item.comment || 'تقييم بالنجوم فقط بدون تعليق نصي مرفق.'}
                    </p>
                  </div>

                  {/* Buyer & Target Broker Context Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Rater (Buyer) Info */}
                    <div className="p-3 rounded-xl bg-surface-sunken/40 dark:bg-dark-surface/50 border border-surface-border/60 space-y-1">
                      <div className="flex items-center gap-1.5 text-ink-muted font-medium">
                        <User className="w-3.5 h-3.5" />
                        <span>المشتري المقيِّم (صفقة مكتملة):</span>
                      </div>
                      <div className="font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                        <span>{item.rater.fullName}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[11px] font-mono text-ink-secondary">
                          الاسم العام: {item.rater.maskedName}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-secondary truncate">
                        العقار: {item.listingTitle}
                      </div>
                    </div>

                    {/* Target Broker Info & Live Public Reputation */}
                    <div className="p-3 rounded-xl bg-surface-sunken/40 dark:bg-dark-surface/50 border border-surface-border/60 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-ink-muted font-medium">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>الوسيط العقاري المُقيَّم:</span>
                        </span>
                        {item.targetBroker.isFalVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            <span>مرخص فال</span>
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-ink-primary dark:text-dark-ink-primary flex items-center justify-between gap-2">
                        <span>{item.targetBroker.commercialName}</span>
                        {item.targetBroker.profileId && (
                          <Link
                            href={`/brokers/${item.targetBroker.profileId}`}
                            className="inline-flex items-center gap-1 text-[11px] text-[#1B4332] dark:text-emerald-400 hover:underline"
                          >
                            <span>ملف الوسيط العام</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-secondary flex items-center gap-2">
                        <span>
                          المتوسط العام النشط:{' '}
                          <strong className="font-mono text-[#D97706]">
                            {item.targetBroker.publicAverageRating !== null
                              ? `${item.targetBroker.publicAverageRating} ★`
                              : 'لا يوجد'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          التقييمات المعتمدة:{' '}
                          <strong className="font-mono">
                            {item.targetBroker.publicVisibleReviewsCount}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hidden Moderation Details Box (if currently hidden) */}
                  {item.isHidden && (
                    <div className="p-3.5 rounded-xl bg-red-100/70 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 text-xs space-y-1">
                      <div className="font-bold text-red-900 dark:text-red-300 flex items-center justify-between">
                        <span>تفاصيل قرار الحجب الإداري الحالي:</span>
                        {item.hiddenByAdminName && (
                          <span>بواسطة: {item.hiddenByAdminName}</span>
                        )}
                      </div>
                      {item.hiddenReason && (
                        <p className="text-red-800 dark:text-red-200">
                          السبب المسجل: {item.hiddenReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Card Footer: Timestamp & Action Buttons */}
                  <div className="pt-2 border-t border-surface-border/70 dark:border-dark-surface-border flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-ink-muted font-mono">
                      تاريخ التقييم: {item.createdAt.slice(0, 10)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchReviewDetail(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border dark:border-dark-surface-border text-xs font-bold text-ink-secondary hover:bg-surface-sunken transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>سجل التدقيق (AuditLog)</span>
                      </button>

                      {item.isHidden ? (
                        <button
                          type="button"
                          onClick={() => openModerationModal(item, 'RESTORE')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة التقييم</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModerationModal(item, 'HIDE')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>إخفاء التقييم</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Right Column: Immutable Audit Trail Panel */}
        <aside className="rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border p-5 space-y-4 h-fit sticky top-24">
          <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#1B4332]" />
              <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                سجل التدقيق غير القابل للتعديل (AuditLog)
              </h2>
            </div>
            {isDetailLoading && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-ink-muted" />
            )}
          </div>

          {!selectedDetail ? (
            <div className="py-8 text-center space-y-2">
              <History className="w-7 h-7 text-ink-muted mx-auto" />
              <p className="text-xs text-ink-secondary leading-relaxed">
                اختر أي تقييم واضغط على «سجل التدقيق (AuditLog)» لعرض كافة قرارات الحجب أو الاستعادة السابقة والمنفذين والأسباب المسجلة.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface text-xs space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>صفقة: {selectedDetail.dealNumber}</span>
                  <span className="text-[#D97706]">
                    {selectedDetail.score} ★
                  </span>
                </div>
                <p className="text-ink-secondary">
                  الوسيط: {selectedDetail.targetBroker.commercialName}
                </p>
                <p className="text-ink-muted text-[11px]">
                  المشتري: {selectedDetail.rater.fullName} ({selectedDetail.rater.maskedName})
                </p>
              </div>

              {selectedDetail.auditTrail.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-4">
                  لم يتم تسجيل أي إجراء حجب أو استعادة على هذا التقييم حتى الآن.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedDetail.auditTrail.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.action === 'REVIEW_HIDDEN'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {entry.action === 'REVIEW_HIDDEN'
                            ? 'حجب تقييم (REVIEW_HIDDEN)'
                            : 'استعادة تقييم (REVIEW_UNHIDDEN)'}
                        </span>
                        <span className="font-mono text-[10px] text-ink-muted">
                          {entry.id}
                        </span>
                      </div>

                      <div className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                        المنفذ: {entry.actorName}
                      </div>

                      {entry.reason && (
                        <p className="text-ink-secondary bg-surface dark:bg-dark-surface-raised p-2 rounded-lg border border-surface-border/60">
                          السبب: {entry.reason}
                        </p>
                      )}

                      <div className="text-[10px] text-ink-muted font-mono flex items-center justify-between">
                        <span>{entry.createdAt.slice(0, 19).replace('T', ' ')}</span>
                        {entry.ipAddress && <span>IP: {entry.ipAddress}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Mandatory Justification Modal for Hide / Restore (DESIGN.md #9 & FR-52) */}
      {modalMode && modalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-2xl overflow-hidden">
            <div
              className={`px-6 py-4 flex items-center justify-between text-white ${
                modalMode === 'HIDE' ? 'bg-red-800' : 'bg-[#1B4332]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {modalMode === 'HIDE' ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>تأكيد حجب التقييم من العرض العام</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>تأكيد استعادة التقييم للعرض العام</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={closeModerationModal}
                className="p-1 rounded-lg hover:bg-white/15 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmModeration} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border text-xs space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>صفقة: {modalTarget.dealNumber}</span>
                  <span className="text-[#D97706]">{modalTarget.score} / 5 ★</span>
                </div>
                <p className="text-ink-secondary">
                  الوسيط: {modalTarget.targetBroker.commercialName}
                </p>
                <p className="text-ink-primary dark:text-dark-ink-primary mt-1 font-medium">
                  «{modalTarget.comment || 'بدون تعليق نصي'}»
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                  أسباب تنظيمية سريعة (اختياري للادراج الفوري):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(modalMode === 'HIDE'
                    ? HIDE_REASON_PRESETS
                    : RESTORE_REASON_PRESETS
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setModerationReason(preset)}
                      className="px-2.5 py-1 rounded-lg bg-surface-sunken dark:bg-dark-surface hover:bg-[#1B4332]/10 border border-surface-border text-[11px] text-ink-secondary hover:text-ink-primary transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="review-moderation-reason"
                  className="block text-xs font-bold text-ink-primary dark:text-dark-ink-primary"
                >
                  السبب الإلزامي للقرار الإداري (يُسجل في AuditLog غير القابل للتعديل) *
                </label>
                <textarea
                  id="review-moderation-reason"
                  rows={3}
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  placeholder="أدخل مبررات الحجب أو الاستعادة بوضوح (3 إلى 500 حرف)..."
                  className="w-full p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>
                    الحد الأدنى {REVIEW_MODERATION_MIN_REASON_LENGTH} أحرف • السجل الفيزيائي محفوظ دائماً (FR-52)
                  </span>
                  <span className="font-mono">
                    {trimmedReasonLength} / {REVIEW_MODERATION_MAX_REASON_LENGTH}
                  </span>
                </div>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeModerationModal}
                  className="px-4 py-2 rounded-xl border border-surface-border text-xs font-bold text-ink-secondary hover:bg-surface-sunken"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!isReasonValid || isSubmittingModeration}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-40 ${
                    modalMode === 'HIDE'
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {isSubmittingModeration
                    ? 'جاري التنفيذ...'
                    : modalMode === 'HIDE'
                    ? 'تأكيد حجب التقييم واستبعاده من المتوسط'
                    : 'تأكيد استعادة التقييم للعرض العام'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
