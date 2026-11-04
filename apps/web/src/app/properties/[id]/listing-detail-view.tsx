'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Maximize2,
  Star,
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
  ListingStatusBadge,
  PropertyMediaCarousel,
} from '../../../components/listings';
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
}: ListingDetailViewProps) {
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
  const locationText = [
    detail.districtName ? `حي ${detail.districtName}` : '',
    detail.cityName || '',
  ]
    .filter(Boolean)
    .join('، ');
  const photos = (detail.photos || []).map((photo) => photo.fileUrl);

  return (
    <div className="py-6 sm:py-8" dir="rtl">
      <div className="mb-5">
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary dark:text-dark-ink-secondary hover:text-primary dark:hover:text-primary-light transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى نتائج البحث</span>
        </Link>
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
              topRightSlot={
                <>
                  {falVerified ? (
                    <Badge
                      variant="verified"
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5 text-status-verified" />}
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

          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border">
                    {propertyTypeLabel}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary leading-snug">
                  {detail.title}
                </h1>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-secondary dark:text-dark-ink-secondary">
                  <MapPin className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
                  <span>{locationText || 'المملكة العربية السعودية'}</span>
                  {detail.streetName ? (
                    <span className="text-ink-secondary dark:text-dark-ink-secondary">
                      — {detail.streetName}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Strict specs strip — the schema has no bathrooms or amenities, so none are rendered */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-border dark:border-dark-surface-border text-xs text-ink-secondary dark:text-dark-ink-secondary">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
                <div>
                  <span
                    dir="ltr"
                    className="block font-mono-numbers text-sm font-bold text-ink-primary dark:text-dark-ink-primary"
                  >
                    {`${formatDetailNumber(detail.areaSquareMeters)} م²`}
                  </span>
                  <span>المساحة</span>
                </div>
              </div>

              {detail.bedrooms != null ? (
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
                  <div>
                    <span
                      dir="ltr"
                      className="block font-mono-numbers text-sm font-bold text-ink-primary dark:text-dark-ink-primary"
                    >
                      {formatDetailNumber(detail.bedrooms)}
                    </span>
                    <span>غرف النوم</span>
                  </div>
                </div>
              ) : null}

              {detail.yearBuilt != null ? (
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
                  <div>
                    <span
                      dir="ltr"
                      className="block font-mono-numbers text-sm font-bold text-ink-primary dark:text-dark-ink-primary"
                    >
                      {detail.yearBuilt}
                    </span>
                    <span>سنة البناء</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-surface-border dark:border-dark-surface-border">
              <h2 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary mb-2">
                وصف العقار
              </h2>
              <p className="text-sm leading-relaxed text-ink-secondary dark:text-dark-ink-secondary whitespace-pre-line">
                {detail.description}
              </p>
            </div>
          </Card>
        </div>

        {/* Sticky rail — price, commission, seller identity, shielding, intent */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                سعر الطلب
              </span>
              <div
                dir="ltr"
                className="font-mono-numbers text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-baseline gap-1.5"
              >
                <span>{formatDetailNumber(detail.askPrice)}</span>
                <span className="text-xs font-sans font-semibold">ر.س</span>
              </div>
            </div>

            <CommissionCalculator askPrice={detail.askPrice} className="p-4" />

            <div className="pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-8 h-8 rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center text-xs font-bold">
                    {(detail.sellerProfile?.user?.fullName || 'ب').charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                      {detail.sellerProfile?.user?.fullName || 'بائع العقار'}
                    </p>
                    <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
                      {falVerified ? 'معلن مرخص (فال)' : 'مالك مباشر'}
                    </p>
                  </div>
                </div>
                {/* Broker ratings ship with Epic 6 — never fabricated here */}
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-ink-secondary dark:text-dark-ink-secondary shrink-0"
                  data-testid="seller-rating-placeholder"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>التقييم قريباً</span>
                </span>
              </div>

              <Button
                variant={cta.variant}
                size="lg"
                className="w-full"
                onClick={onCtaClick}
                data-testid="listing-cta"
              >
                <span>{cta.label}</span>
              </Button>

              {ctaNotice ? (
                <p
                  className="mt-2.5 text-[11px] leading-relaxed text-ink-secondary dark:text-dark-ink-secondary"
                  data-testid="listing-cta-notice"
                >
                  {ctaNotice}
                </p>
              ) : null}
            </div>
          </Card>

          <ContactShieldingCallout />
        </div>
      </div>
    </div>
  );
}
