'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Building2,
  MapPin,
  Maximize2,
  BedDouble,
  Heart,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import {
  ListingSummaryItem,
  ListingStatus,
  UserRole,
  PROPERTY_TYPE_LABELS_AR,
  PLATFORM_COMMISSION_RATE,
} from '@elmasaif/shared';
import { Card, Badge, Button } from '../ui';
import { PropertyMediaCarousel } from './property-media-carousel';

export interface PropertyCardProps {
  listing: ListingSummaryItem;
  href?: string;
  actionLabel?: string;
  onActionClick?: (listing: ListingSummaryItem) => void;
  onFavoriteToggle?: (listingId: string) => void;
  isFavorited?: boolean;
  className?: string;
}

export function PropertyCard({
  listing,
  href,
  actionLabel = 'تقديم عرض',
  onActionClick,
  onFavoriteToggle,
  isFavorited = false,
  className,
}: PropertyCardProps) {
  const numericPrice = Number(listing.askPrice) || 0;
  const formattedAskPrice = numericPrice.toLocaleString('en-US');
  const commission = Math.round(numericPrice * PLATFORM_COMMISSION_RATE);
  const formattedCommission = commission.toLocaleString('en-US');
  const formattedArea = (Number(listing.areaSquareMeters) || 0).toLocaleString('en-US');

  const isMarketer =
    listing.sellerRole === UserRole.MARKETER || listing.isFalVerified === true;

  const propertyTypeLabel =
    PROPERTY_TYPE_LABELS_AR[listing.propertyType] || 'عقار';

  const resolvedPhotos =
    Array.isArray(listing.photos) && listing.photos.length > 0
      ? listing.photos
      : listing.primaryPhotoUrl
        ? [listing.primaryPhotoUrl]
        : [];

  const locationText =
    listing.cityName && listing.districtName
      ? `${listing.cityName}، حي ${listing.districtName}`
      : listing.cityName || listing.districtName || 'المملكة العربية السعودية';

  const bedroomsLabel =
    listing.bedrooms != null && listing.bedrooms > 0
      ? `${listing.bedrooms} غرف نوم`
      : 'غير محدد / أرض';

  const topRightBadges = (
    <>
      {isMarketer ? (
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

      {listing.status === ListingStatus.RESERVED && (
        <Badge variant="info" size="sm">
          محجوز بصفقة نشطة
        </Badge>
      )}

      {listing.status === ListingStatus.SOLD && (
        <Badge variant="danger" size="sm">
          تم البيع
        </Badge>
      )}
    </>
  );

  const bottomRightPrice = (
    <div
      dir="ltr"
      className="text-white font-mono-numbers text-[22px] leading-[1.3] font-bold drop-shadow-sm flex items-baseline gap-1.5"
    >
      <span>{formattedAskPrice}</span>
      <span className="text-xs font-sans font-semibold">ر.س</span>
    </div>
  );

  return (
    <Card
      hoverEffect
      className={twMerge('overflow-hidden flex flex-col p-0 group', className)}
    >
      <div className="relative">
        <PropertyMediaCarousel
          photos={resolvedPhotos}
          photoCount={listing.photoCount}
          alt={listing.title}
          propertyType={listing.propertyType}
          topRightSlot={topRightBadges}
          bottomRightSlot={bottomRightPrice}
        />

        {onFavoriteToggle && (
          <button
            type="button"
            aria-label={isFavorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFavoriteToggle(listing.id);
            }}
            className="absolute bottom-3 left-3 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${
                isFavorited ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Location Tag & Property Type Label */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs text-ink-secondary dark:text-dark-ink-secondary truncate">
              <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light shrink-0" />
              <span className="truncate">{locationText}</span>
            </div>

            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border shrink-0">
              {propertyTypeLabel}
            </span>
          </div>

          {/* Listing Title */}
          <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary line-clamp-1">
            {href ? (
              <Link href={href} className="hover:text-primary dark:hover:text-primary-light transition-colors">
                {listing.title}
              </Link>
            ) : (
              listing.title
            )}
          </h3>

          {/* Strict Specs Strip (Area m² & Bedrooms ONLY — Bathrooms strictly omitted per BR-13) */}
          <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border grid grid-cols-2 divide-x divide-x-reverse divide-surface-border dark:divide-dark-surface-border text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div className="flex items-center gap-2 pe-3">
              <Maximize2 className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
              <div>
                <span
                  dir="ltr"
                  className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm font-mono-numbers"
                >
                  {`${formattedArea} م²`}
                </span>
                <span>المساحة</span>
              </div>
            </div>

            <div className="flex items-center gap-2 ps-3">
              <BedDouble className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
              <div>
                <span className="block font-bold text-ink-primary dark:text-dark-ink-primary text-sm">
                  {bedroomsLabel}
                </span>
                <span>غرف النوم</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Transparent 2.5% Platform Commission & Primary Action */}
        <div className="mt-5 pt-4 border-t border-surface-border dark:border-dark-surface-border flex items-center justify-between gap-2">
          <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <span>سعي المنصة (2.5%): </span>
            <span
              dir="ltr"
              className="font-bold text-primary dark:text-primary-light font-mono-numbers"
            >
              {`${formattedCommission} ر.س`}
            </span>
          </div>

          {href ? (
            <Link href={href}>
              <Button variant="outline" size="sm">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onActionClick?.(listing)}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

