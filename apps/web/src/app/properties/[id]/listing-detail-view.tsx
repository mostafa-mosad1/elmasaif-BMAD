'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Maximize2,
  ShieldAlert,
  Star,
  Share2,
  Check,
  Calculator,
} from 'lucide-react';
import {
  ListingDetailItem,
  ListingStatus,
  UserRole,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { Badge, Button, Card, EmptyState } from '../../../components/ui';
import {
  CommissionCalculator,
  ContactShieldingCallout,
  ListingFavoriteButton,
  ListingStatusBadge,
  PropertyMediaCarousel,
  SimilarListingsSection,
} from '../../../components/listings';
import { ViolationReportModal } from '../../../components/support/violation-report-modal';
import { ApiError } from '../../../lib/api-client';

/** Formats a money or count value the way the marketplace cards do (LTR, grouped). */
export function formatDetailNumber(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

/** Fal verification is expressed by the seller holding a licensed MARKETER profile. */
export function isSellerFalVerified(detail: ListingDetailItem | null): boolean {
  if (!detail) return false;
  return detail.isFalVerified === true || detail.sellerProfile?.role === UserRole.MARKETER;
}

/** Which primary action the listing state allows (offer intake itself ships with Epic 4). */
export function resolveCta(
  status: ListingStatus,
): { label: string; variant: 'primary' | 'outline' } {
  if (status === ListingStatus.RESERVED) {
    return { label: 'عرض احتياطي (Backup Offer)', variant: 'outline' };
  }
  return { label: 'تقديم عرض (Submit Offer)', variant: 'primary' };
}

/** Maps the global API error envelope to the screen's structured failure state (AD-8 / AC#7). */
export function toDetailError(reason: unknown): ListingDetailError {
  return reason instanceof ApiError && reason.status === 404 ? 'not-found' : 'failed';
}

/**
 * `GET /listings/:id` answers with the bare detail object, while the list endpoints wrap their
 * payload in `{ statusCode, data }`; tolerate both so the screen keeps rendering.
 */
export function unwrapDetailResponse(
  payload: ListingDetailItem | { data?: ListingDetailItem } | null,
): ListingDetailItem | null {
  if (!payload) return null;
  const wrapped = (payload as { data?: ListingDetailItem }).data;
  return wrapped ?? (payload as ListingDetailItem);
}

export interface ListingDetailViewProps {
  detail: ListingDetailItem | null;
  loading: boolean;
  /** Structured failure state; `null` while the read succeeded. */
  error?: ListingDetailError | null;
  onCtaClick?: () => void;
  ctaNotice?: string | null;
  /** Optional control rendered on the same line as the "back to results" link (top of the page). */
  headerAction?: React.ReactNode;
}

export type ListingDetailError = 'not-found' | 'failed';

const ERROR_COPY: Record<ListingDetailError, { title: string; description: string }> = {
  'not-found': {
    title: 'لم نتمكن من العثور على هذا العقار',
    description:
      'ربما تم أرشفة العقار أو تعليقه للامتثال أو حذفه من المنصة، وهو غير متاح حالياً للعرض.',
  },
  failed: {
    title: 'تعذر تحميل تفاصيل هذا العقار',
    description:
      'حدث خطأ أثناء جلب بيانات العقار. أعد المحاولة بعد قليل أو عُد إلى نتائج البحث لتصفح عقارات أخرى.',
  },
};

export function ListingDetailView({
  detail,
  loading,
  error = null,
  onCtaClick,
  ctaNotice = null,
  headerAction = null,
}: ListingDetailViewProps) {
  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      try {
        navigator.clipboard?.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } catch {
        // clipboard unavailable
      }
    }
  };

  if (loading) {
    return (
      <div className="py-6 sm:py-8" dir="rtl" aria-busy="true">
        <div className="animate-pulse space-y-6">
          <div className="aspect-video w-full rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-7 w-2/3 rounded bg-surface-sunken dark:bg-dark-surface-sunken" />
              <div className="h-4 w-1/2 rounded bg-surface-sunken dark:bg-dark-surface-sunken" />
              <div className="h-32 w-full rounded bg-surface-sunken dark:bg-dark-surface-sunken" />
            </div>
            <div className="h-48 rounded-card bg-surface-sunken dark:bg-dark-surface-sunken" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    const copy = ERROR_COPY[error ?? 'failed'];
    return (
      <div className="py-10 sm:py-16" dir="rtl">
        <EmptyState
          icon={<Building2 className="w-7 h-7" />}
          title={copy.title}
          description={copy.description}
          actionLabel="العودة إلى البحث"
          actionHref="/properties"
        />
      </div>
    );
  }

  const propertyTypeLabel = PROPERTY_TYPE_LABELS_AR[detail.propertyType] || 'عقار';
  const falVerified = isSellerFalVerified(detail);
  const cta = resolveCta(detail.status);
  const pricePerMeter =
    detail.askPrice && detail.areaSquareMeters > 0
      ? Math.round(detail.askPrice / detail.areaSquareMeters)
      : null;
  const locationText = [
    detail.districtName ? `حي ${detail.districtName}` : '',
    detail.cityName || '',
  ]
    .filter(Boolean)
    .join('، ');
  const rawPhotos = (detail.photos || []).map((photo) => photo.fileUrl).filter(Boolean);
  const photos =
    rawPhotos.length > 0
      ? rawPhotos
      : [
          'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        ];

  return (
    <div className="py-6 sm:py-8" dir="rtl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary dark:text-dark-ink-secondary hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى نتائج البحث</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-raised text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
            aria-label="مشاركة رابط العقار"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم نسخ الرابط!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-accent" />
                <span>مشاركة</span>
              </>
            )}
          </button>
          {headerAction}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Primary column — media, identity, specifications */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden p-0">
            <PropertyMediaCarousel
              photos={photos}
              photoCount={photos.length}
              alt={detail.title}
              propertyType={detail.propertyType}
              showThumbnails={true}
              topRightSlot={
                <>
                  {falVerified ? (
                    <Badge
                      variant="verified"
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                    >
                      معلن مرخص (فال)
                    </Badge>
                  ) : (
                    <Badge
                      variant="pending"
                      size="sm"
                      icon={<Building2 className="w-3.5 h-3.5 text-status-pending" />}
                    >
                      عرض مالك مباشر
                    </Badge>
                  )}
                  <ListingStatusBadge status={detail.status} />
                </>
              }
            />
          </Card>

          <Card className="p-6 sm:p-8 space-y-7 rounded-3xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base shadow-level1">
            {/* Header: Type Badge, Title, Location, and Favorite */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 dark:bg-accent/15 text-accent border border-accent/20">
                    {propertyTypeLabel}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-ink-primary dark:text-dark-ink-primary leading-tight tracking-tight">
                  {detail.title}
                </h1>
                <div className="flex items-center gap-2 text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary font-medium">
                  <MapPin className="w-4 h-4 text-accent shrink-0" />
                  <span>{locationText || 'المملكة العربية السعودية'}</span>
                  {detail.streetName ? (
                    <span className="text-ink-muted dark:text-dark-ink-muted">
                      — {detail.streetName}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 pt-1">
                <ListingFavoriteButton
                  listingId={detail.id}
                  initialFavorited={detail.isFavorited}
                  initialTotalFavorites={detail.totalFavorites}
                />
              </div>
            </div>

            {/* Specifications Cards Grid (Spacious, prominent numbers & distinct labels) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-6 border-t border-surface-border dark:border-dark-surface-border">
              {/* Area Card */}
              <div className="p-4 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-raised border border-surface-border/70 dark:border-dark-surface-border flex flex-col justify-between gap-3 hover:border-accent/40 transition-colors shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    المساحة
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-accent/10 dark:bg-accent/15 text-accent flex items-center justify-center">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span
                    dir="ltr"
                    className="block font-mono-numbers text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary"
                  >
                    {`${formatDetailNumber(detail.areaSquareMeters)} م²`}
                  </span>
                </div>
              </div>

              {/* Price Per Square Meter Card */}
              {pricePerMeter ? (
                <div className="p-4 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-raised border border-surface-border/70 dark:border-dark-surface-border flex flex-col justify-between gap-3 hover:border-accent/40 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                      سعر المتر المربع
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-accent/10 dark:bg-accent/15 text-accent flex items-center justify-center">
                      <Calculator className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span
                      dir="ltr"
                      className="block font-mono-numbers text-xl sm:text-2xl font-black text-accent"
                    >
                      {`${formatDetailNumber(pricePerMeter)} ر.س`}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Bedrooms Card */}
              {detail.bedrooms != null ? (
                <div className="p-4 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-raised border border-surface-border/70 dark:border-dark-surface-border flex flex-col justify-between gap-3 hover:border-accent/40 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                      غرف النوم
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light flex items-center justify-center">
                      <BedDouble className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span
                      dir="ltr"
                      className="block font-mono-numbers text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary"
                    >
                      {formatDetailNumber(detail.bedrooms)}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Year Built Card */}
              {detail.yearBuilt != null ? (
                <div className="p-4 rounded-2xl bg-surface-sunken/60 dark:bg-dark-surface-raised border border-surface-border/70 dark:border-dark-surface-border flex flex-col justify-between gap-3 hover:border-accent/40 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                      سنة البناء
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light flex items-center justify-center">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span
                      dir="ltr"
                      className="block font-mono-numbers text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary"
                    >
                      {detail.yearBuilt}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Property Description */}
            <div className="pt-6 border-t border-surface-border dark:border-dark-surface-border space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-accent" />
                <h2 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  وصف العقار
                </h2>
              </div>
              <p className="text-sm sm:text-base leading-relaxed sm:leading-loose text-ink-secondary dark:text-dark-ink-secondary whitespace-pre-line font-normal">
                {detail.description}
              </p>
            </div>
          </Card>

          <SimilarListingsSection listingId={detail.id} />
        </div>

        {/* Sticky rail — price, commission, seller identity, shielding, intent */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6 space-y-5 rounded-3xl shadow-level2 border-surface-border/90 dark:border-dark-surface-border/90">
            {/* Price section - High contrast prominent card */}
            <div className="p-4 rounded-2xl bg-surface-sunken/80 dark:bg-dark-surface-sunken/70 border border-surface-border dark:border-dark-surface-border flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-extrabold text-ink-primary dark:text-dark-ink-primary">
                  سعر الطلب
                </span>
              </div>
              <div
                dir="ltr"
                className="font-mono-numbers text-2xl sm:text-3xl font-black text-ink-primary dark:text-dark-ink-primary flex items-baseline gap-1.5"
              >
                <span>{formatDetailNumber(detail.askPrice)}</span>
                <span className="text-sm font-sans font-bold text-accent dark:text-accent-light">ر.س</span>
              </div>
            </div>

            {/* Total Cost Calculator */}
            <CommissionCalculator askPrice={detail.askPrice} />

            {/* Seller profile & Action buttons */}
            <div className="pt-2 space-y-4">
              <div className="p-3 rounded-2xl bg-surface-sunken/40 dark:bg-dark-surface-sunken/30 border border-surface-border/60 dark:border-dark-surface-border/60 flex items-center justify-between gap-3">
                {detail.sellerProfile?.id && (detail.sellerProfile?.role === 'MARKETER' || falVerified) ? (
                  <Link
                    href={`/brokers/${detail.sellerProfile.id}`}
                    className="flex items-center gap-2.5 min-w-0 group hover:opacity-95 transition-opacity"
                    data-testid="broker-profile-link"
                  >
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center text-sm font-bold group-hover:bg-primary group-hover:text-white transition-colors border border-primary/20">
                      {(detail.sellerProfile?.user?.fullName || 'ب').charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary truncate group-hover:text-primary transition-colors">
                        {detail.sellerProfile?.user?.fullName || 'بائع العقار'}
                      </p>
                      <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{falVerified ? 'معلن مرخص (فال)' : 'وسيط عقاري'}</span>
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center text-sm font-bold border border-surface-border">
                      {(detail.sellerProfile?.user?.fullName || 'ب').charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                        {detail.sellerProfile?.user?.fullName || 'بائع العقار'}
                      </p>
                      <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary font-medium">
                        {falVerified ? 'معلن مرخص (فال)' : 'مالك مباشر'}
                      </p>
                    </div>
                  </div>
                )}
                {/* Broker ratings ship with Epic 6 — never fabricated here */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium shrink-0 border border-amber-500/20"
                  data-testid="seller-rating-placeholder"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>التقييم قريباً</span>
                </span>
              </div>

              <Button
                variant={cta.variant}
                size="lg"
                className={
                  cta.variant === 'primary'
                    ? 'w-full h-12 text-base font-bold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
                    : 'w-full h-12 text-base font-bold rounded-2xl shadow-sm hover:shadow transition-all'
                }
                onClick={onCtaClick}
                data-testid="listing-cta"
              >
                <span>{cta.label}</span>
              </Button>

              {ctaNotice ? (
                <p
                  className="text-center text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary px-1"
                  data-testid="listing-cta-notice"
                >
                  {ctaNotice}
                </p>
              ) : null}
            </div>
          </Card>

          <ContactShieldingCallout />

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-950/70 transition-all rounded-xl shadow-xs"
            data-testid="report-listing-button"
          >
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>إبلاغ عن مخالفة في هذا الإعلان</span>
          </button>
        </div>
      </div>

      {detail && (
        <ViolationReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetType="LISTING"
          targetListingId={detail.id}
          targetListingTitle={detail.title}
        />
      )}
    </div>
  );
}
