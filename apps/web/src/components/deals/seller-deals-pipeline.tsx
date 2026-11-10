'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  XCircle,
  ShieldCheck,
  User,
  MapPin,
  Building2,
  ChevronLeft,
  Ban,
  Phone,
  Mail,
  Sparkles,
  ArrowUpLeft,
} from 'lucide-react';
import {
  DealStatus,
  SellerDealItemDto,
  DealPipelineStageBreakdown,
  SellerDealMetrics,
  DEAL_STATUS_LABELS_AR,
} from '@elmasaif/shared';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SellerCancelRequestModal } from './seller-cancel-request-modal';

export interface SellerDealsPipelineProps {
  activeDeals: SellerDealItemDto[];
  stageBreakdown?: DealPipelineStageBreakdown;
  metrics?: SellerDealMetrics;
  onRefresh?: () => void;
  isLoading?: boolean;
}

type FunnelFilter = 'ALL' | 'AWAITING_PAYMENT' | 'UNDER_AUDIT' | 'GRACE_DISPUTED' | 'COMPLETED';

export function DealCountdownChip({ deadline }: { deadline: string }) {
  const [remainingText, setRemainingText] = useState('');
  const [isUnder12Hours, setIsUnder12Hours] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const end = new Date(deadline).getTime();
      const diff = end - now;
      if (diff <= 0) {
        setRemainingText('انتهت مهلة السداد');
        setIsExpired(true);
        setIsUnder12Hours(true);
        return;
      }
      const totalMinutes = Math.floor(diff / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setRemainingText(`${hours} س و ${minutes} د متبقية`);
      setIsUnder12Hours(diff <= 12 * 3600000);
      setIsExpired(false);
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span
      data-testid="deal-countdown-chip"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isExpired
          ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
          : isUnder12Hours
          ? 'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse'
          : 'bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
      }`}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>{remainingText}</span>
    </span>
  );
}

export function SellerDealsPipeline({
  activeDeals = [],
  stageBreakdown,
  metrics,
  onRefresh,
  isLoading = false,
}: SellerDealsPipelineProps) {
  const [activeBucket, setActiveBucket] = useState<FunnelFilter>('ALL');
  const [cancelModalDeal, setCancelModalDeal] = useState<{ id: string; number: string } | null>(null);

  // Categorize counts
  const awaitingPaymentCount =
    stageBreakdown?.AWAITING_PAYMENT_PROOF ??
    activeDeals.filter((d) => d.status === DealStatus.AWAITING_PAYMENT_PROOF).length;

  const underAuditCount =
    stageBreakdown?.UNDER_ADMIN_AUDIT ??
    activeDeals.filter((d) => d.status === DealStatus.UNDER_ADMIN_AUDIT).length;

  const graceDisputedCount =
    (stageBreakdown?.PAYMENT_REJECTED ?? 0) +
    (stageBreakdown?.DISPUTED ?? 0) ||
    activeDeals.filter((d) =>
      [DealStatus.PAYMENT_REJECTED, DealStatus.DISPUTED].includes(d.status),
    ).length;

  const completedCount =
    stageBreakdown?.COMPLETED ??
    activeDeals.filter((d) => d.status === DealStatus.COMPLETED).length;

  // Filter deals by active bucket
  const filteredDeals = useMemo(() => {
    switch (activeBucket) {
      case 'AWAITING_PAYMENT':
        return activeDeals.filter((d) => d.status === DealStatus.AWAITING_PAYMENT_PROOF);
      case 'UNDER_AUDIT':
        return activeDeals.filter((d) => d.status === DealStatus.UNDER_ADMIN_AUDIT);
      case 'GRACE_DISPUTED':
        return activeDeals.filter((d) =>
          [DealStatus.PAYMENT_REJECTED, DealStatus.DISPUTED].includes(d.status),
        );
      case 'COMPLETED':
        return activeDeals.filter((d) => d.status === DealStatus.COMPLETED);
      default:
        return activeDeals;
    }
  }, [activeDeals, activeBucket]);

  return (
    <div className="space-y-4" data-testid="seller-deals-pipeline">
      {/* Header with Title & Pipeline Stage Tabs */}
      <div className="bg-surface-base dark:bg-dark-surface-base p-5 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                مسار الصفقات والعمليات الجارية
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span>{metrics?.activeDealsCount ?? activeDeals.length} جارية</span>
              </span>
            </div>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              متابعة مراحل السداد والتدقيق المالي وإفراغ الصفقات في منصة المسايف المعتمدة.
            </p>
          </div>

          {metrics && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="bg-surface-sunken dark:bg-dark-surface-sunken px-3 py-1.5 rounded-xl border border-surface-border dark:border-dark-surface-border">
                <span className="text-ink-muted text-[11px] block">عمولات متوقعة:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {Number(metrics.pendingCommissionForecast).toLocaleString('en-US')} ر.س
                </span>
              </div>
              <div className="bg-surface-sunken dark:bg-dark-surface-sunken px-3 py-1.5 rounded-xl border border-surface-border dark:border-dark-surface-border">
                <span className="text-ink-muted text-[11px] block">عمولات محققة:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Number(metrics.earnedCommissionTotal).toLocaleString('en-US')} ر.س
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Operational Funnel Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-border/60 dark:border-dark-surface-border/60">
          <button
            type="button"
            onClick={() => setActiveBucket('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeBucket === 'ALL'
                ? 'bg-ink-primary text-white dark:bg-dark-ink-primary dark:text-dark-surface-base shadow-xs'
                : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary'
            }`}
          >
            الكل ({activeDeals.length})
          </button>

          <button
            type="button"
            data-testid="filter-awaiting-payment"
            onClick={() => setActiveBucket('AWAITING_PAYMENT')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeBucket === 'AWAITING_PAYMENT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary hover:text-indigo-600'
            }`}
          >
            <span>بانتظار سداد المشتري</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200 font-bold">
              {awaitingPaymentCount}
            </span>
          </button>

          <button
            type="button"
            data-testid="filter-under-audit"
            onClick={() => setActiveBucket('UNDER_AUDIT')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeBucket === 'UNDER_AUDIT'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary hover:text-sky-600'
            }`}
          >
            <span>قيد التدقيق الإداري</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200 font-bold">
              {underAuditCount}
            </span>
          </button>

          <button
            type="button"
            data-testid="filter-grace-disputed"
            onClick={() => setActiveBucket('GRACE_DISPUTED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeBucket === 'GRACE_DISPUTED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary hover:text-amber-600'
            }`}
          >
            <span>مهلة تصحيح / نزاع</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 font-bold">
              {graceDisputedCount}
            </span>
          </button>

          {completedCount > 0 && (
            <button
              type="button"
              data-testid="filter-completed"
              onClick={() => setActiveBucket('COMPLETED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeBucket === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary hover:text-emerald-600'
              }`}
            >
              <span>الصفقات المنجزة</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 font-bold">
                {completedCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Deals Cards List */}
      {filteredDeals.length === 0 ? (
        <div
          data-testid="empty-deals-pipeline"
          className="bg-surface-base dark:bg-dark-surface-base p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border text-center space-y-2 shadow-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-surface-sunken dark:bg-dark-surface-sunken text-ink-muted flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
            لا توجد صفقات جارية في هذا المسار
          </h3>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary max-w-md mx-auto">
            عند قبول عرض شراء وتحويله لصفقة رسمية، ستظهر مراحل السداد والتحقق والعمولات هنا تلقائياً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4" data-testid="deals-pipeline-list">
          {filteredDeals.map((deal) => {
            const isAwaitingPayment = deal.status === DealStatus.AWAITING_PAYMENT_PROOF;
            const isUnderAudit = deal.status === DealStatus.UNDER_ADMIN_AUDIT;
            const isPaymentRejected = deal.status === DealStatus.PAYMENT_REJECTED;
            const isDisputed = deal.status === DealStatus.DISPUTED;
            const isCompleted = deal.status === DealStatus.COMPLETED;

            return (
              <div
                key={deal.id}
                data-testid={`deal-card-${deal.id}`}
                className="bg-surface-base dark:bg-dark-surface-base p-5 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-sm hover:border-emerald-500/30 transition-all space-y-4"
              >
                {/* Deal Header: Number + Status Badge + Countdown */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-xs bg-surface-sunken dark:bg-dark-surface-sunken px-2.5 py-1 rounded-lg border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary">
                      {deal.dealNumber}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      ({deal.dealReferenceCode})
                    </span>

                    {/* Stage Badge */}
                    {isAwaitingPayment && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>بانتظار سداد المشتري</span>
                      </span>
                    )}

                    {isUnderAudit && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
                        <FileCheck2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>الإيصالات مرفوعة - بانتظار اعتماد الإدارة</span>
                      </span>
                    )}

                    {isPaymentRejected && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>إثبات مرفوض - مهلة تصحيح (12 ساعة)</span>
                      </span>
                    )}

                    {isDisputed && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>صفقة متنازع عليها - التدقيق معلق</span>
                      </span>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>صفقة مكتملة وموثقة</span>
                      </span>
                    )}
                  </div>

                  {/* Countdown Timer for Awaiting Payment */}
                  {isAwaitingPayment && (
                    <DealCountdownChip deadline={deal.paymentDeadline} />
                  )}
                </div>

                {/* Deal Body: Property Title & Financials */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-surface-border/60 dark:border-dark-surface-border/60">
                  {/* Property Details */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-muted block">العقار المرتبط:</span>
                    <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      {deal.listingTitle || 'عقار معروض'}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-ink-muted">
                      <MapPin className="w-3 h-3 text-ink-muted shrink-0" />
                      <span>{deal.cityName}</span>
                      {deal.districtName && <span>، حي {deal.districtName}</span>}
                    </div>
                  </div>

                  {/* Buyer Snapshot (Masked vs Unmasked) */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-muted block">طرف الشراء:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-ink-muted">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                        {deal.buyer.fullName}
                      </span>
                    </div>

                    {isCompleted && deal.buyer.phone ? (
                      <div className="space-y-0.5 pt-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span dir="ltr" className="font-mono text-[11px]">
                            {deal.buyer.phone}
                          </span>
                        </div>
                        {deal.buyer.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-emerald-600" />
                            <span className="text-[11px]">{deal.buyer.email}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-muted">
                        بيانات التواصل المباشرة تُكشف تلقائياً فور اكتمال السداد للإفراغ (FR-32).
                      </p>
                    )}
                  </div>

                  {/* Financial Values & Commission */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-muted block">القيمة والعمولة:</span>
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-base font-extrabold text-ink-primary dark:text-dark-ink-primary">
                        {Number(deal.dealPrice).toLocaleString('en-US')}
                      </span>
                      <span className="text-xs text-ink-muted">ر.س</span>
                    </div>
                    <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-mono">
                      عمولة الوساطة: <span className="font-bold text-emerald-600 dark:text-emerald-400">{Number(deal.platformCommission).toLocaleString('en-US')} ر.س</span>
                    </div>
                  </div>
                </div>

                {/* Status Notice or Action Button Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-border/60 dark:border-dark-surface-border/60 text-xs">
                  {/* Status Notes */}
                  {isAwaitingPayment && (
                    <div className="text-ink-muted text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>مهلة سداد المشتري 48 ساعة من تاريخ اعتماد الصفقة.</span>
                    </div>
                  )}

                  {isUnderAudit && (
                    <div className="text-sky-700 dark:text-sky-300 text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>جارٍ تدقيق إيصالات التحويل البنكي بواسطة فريق العمليات (اتفاقية مستوى الخدمة 24 ساعة).</span>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>اكتملت الصفقة بنجاح. تواصل مع المشتري لإتمام إجراءات الإفراغ العقاري عبر منصة البورصة العقارية.</span>
                    </div>
                  )}

                  {/* Pre-payment Seller Cancellation Action Button */}
                  {isAwaitingPayment && (
                    <div className="ms-auto">
                      {deal.sellerCancellationRequestedAt ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>طلب الإلغاء قيد المراجعة الإدارية</span>
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`cancel-deal-btn-${deal.id}`}
                          onClick={() => setCancelModalDeal({ id: deal.id, number: deal.dealNumber })}
                          className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/40 gap-1.5 rounded-xl"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>طلب إلغاء الصفقة</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Seller Cancel Request Modal */}
      {cancelModalDeal && (
        <SellerCancelRequestModal
          isOpen={Boolean(cancelModalDeal)}
          dealId={cancelModalDeal.id}
          dealNumber={cancelModalDeal.number}
          onClose={() => setCancelModalDeal(null)}
          onSuccess={() => {
            setCancelModalDeal(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

