'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Building2, Home, Landmark, Trees, Store } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PropertyType } from '@elmasaif/shared';

export interface PropertyMediaCarouselProps {
  photos: string[];
  photoCount?: number;
  alt: string;
  propertyType?: PropertyType;
  initialIndex?: number;
  onSlideChange?: (index: number) => void;
  topRightSlot?: React.ReactNode;
  bottomRightSlot?: React.ReactNode;
  className?: string;
  showThumbnails?: boolean;
}

function getPlaceholderIcon(propertyType?: PropertyType) {
  switch (propertyType) {
    case PropertyType.VILLA:
    case PropertyType.APARTMENT:
      return <Home className="w-7 h-7 text-primary-light/80 mb-2" />;
    case PropertyType.LAND:
      return <Landmark className="w-7 h-7 text-primary-light/80 mb-2" />;
    case PropertyType.FARM:
      return <Trees className="w-7 h-7 text-primary-light/80 mb-2" />;
    case PropertyType.COMMERCIAL:
      return <Store className="w-7 h-7 text-primary-light/80 mb-2" />;
    case PropertyType.BUILDING:
    default:
      return <Building2 className="w-7 h-7 text-primary-light/80 mb-2" />;
  }
}

export function PropertyMediaCarousel({
  photos,
  photoCount,
  alt,
  propertyType,
  initialIndex = 0,
  onSlideChange,
  topRightSlot,
  bottomRightSlot,
  className,
  showThumbnails = false,
}: PropertyMediaCarouselProps) {
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const totalPhotos = safePhotos.length;
  const effectiveTotal = Math.max(totalPhotos, photoCount || 1);

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    totalPhotos > 0 ? Math.min(Math.max(0, initialIndex), totalPhotos - 1) : 0,
  );
  const [failedIndices, setFailedIndices] = useState<Record<number, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    if (!showThumbnails) return;
    const container = thumbnailContainerRef.current;
    const activeThumb = thumbnailRefs.current[currentIndex];
    if (container && activeThumb) {
      const isVertical = typeof window !== 'undefined' && window.innerWidth >= 640;
      if (isVertical) {
        const thumbTop = activeThumb.offsetTop;
        const thumbHeight = activeThumb.offsetHeight;
        const containerHeight = container.clientHeight;
        const targetScrollTop = thumbTop - (containerHeight / 2) + (thumbHeight / 2);
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        } else {
          container.scrollTop = Math.max(0, targetScrollTop);
        }
      } else {
        const thumbLeft = activeThumb.offsetLeft;
        const thumbWidth = activeThumb.offsetWidth;
        const containerWidth = container.clientWidth;
        const targetScrollLeft = thumbLeft - (containerWidth / 2) + (thumbWidth / 2);
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
        } else {
          container.scrollLeft = Math.max(0, targetScrollLeft);
        }
      }
    }
  }, [currentIndex, showThumbnails]);

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (totalPhotos <= 1) return;
      const wrapped = ((nextIdx % totalPhotos) + totalPhotos) % totalPhotos;
      setCurrentIndex(wrapped);
      onSlideChange?.(wrapped);
    },
    [totalPhotos, onSlideChange],
  );

  const handlePrev = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      goToIndex(currentIndex - 1);
    },
    [currentIndex, goToIndex],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      goToIndex(currentIndex + 1);
    },
    [currentIndex, goToIndex],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (totalPhotos <= 1) return;
      // In RTL, ArrowRight goes to previous slide and ArrowLeft goes to next slide
      if (e.key === 'ArrowRight') {
        handlePrev(e);
      } else if (e.key === 'ArrowLeft') {
        handleNext(e);
      }
    },
    [totalPhotos, handlePrev, handleNext],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchCurrentXRef.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      touchCurrentXRef.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (totalPhotos <= 1 || touchStartXRef.current === null || touchCurrentXRef.current === null) {
        touchStartXRef.current = null;
        touchCurrentXRef.current = null;
        return;
      }

      const deltaX = touchCurrentXRef.current - touchStartXRef.current;
      touchStartXRef.current = null;
      touchCurrentXRef.current = null;

      if (Math.abs(deltaX) >= 40) {
        e.stopPropagation();
        // In RTL, swiping right (deltaX > 0) moves to next slide; swiping left (deltaX < 0) moves to previous
        if (deltaX > 0) {
          goToIndex(currentIndex + 1);
        } else {
          goToIndex(currentIndex - 1);
        }
      }
    },
    [totalPhotos, currentIndex, goToIndex],
  );

  const activePhotoUrl = safePhotos[currentIndex];
  const showImage = Boolean(activePhotoUrl) && !failedIndices[currentIndex];

  const carouselNode = (
    <div
      className={twMerge(
        clsx(
          'relative aspect-video w-full bg-surface-sunken dark:bg-dark-surface-sunken overflow-hidden select-none group/carousel',
          showThumbnails && safePhotos.length > 1 ? 'rounded-xl' : 'rounded-t-card',
          className,
        ),
      )}
      tabIndex={totalPhotos > 1 ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Bottom gradient scrim for price legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent z-10" />

      {/* Active Image or Dignified Institutional Placeholder */}
      {showImage ? (
        <img
          src={activePhotoUrl}
          alt={alt}
          loading="lazy"
          onError={() =>
            setFailedIndices((prev) => ({
              ...prev,
              [currentIndex]: true,
            }))
          }
          className="w-full h-full object-cover transition-transform duration-300 group-hover/carousel:scale-[1.02]"
        />
      ) : (
        <div className="w-full h-full bg-primary flex flex-col items-center justify-center text-primary-light text-sm font-medium px-4 text-center">
          {getPlaceholderIcon(propertyType)}
          <span className="line-clamp-2">{alt}</span>
        </div>
      )}

      {/* Top-Right Overlay Slot (Fal Verified / Seller Role / Status Badges in RTL) */}
      {topRightSlot && (
        <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center gap-1.5">
          {topRightSlot}
        </div>
      )}

      {/* Top-Left Photo Counter Pill (dir="ltr" + font-mono) */}
      <div
        dir="ltr"
        className="absolute top-3 left-3 z-20 bg-black/65 backdrop-blur-sm text-white px-2.5 py-1 rounded-pill text-xs font-mono"
      >
        {`${currentIndex + 1}/${effectiveTotal}`}
      </div>

      {/* Previous / Next Navigation Controls (Only when photos.length > 1) */}
      {totalPhotos > 1 && (
        <>
          <button
            type="button"
            aria-label="الصورة السابقة"
            onClick={handlePrev}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-opacity opacity-90 sm:opacity-0 sm:group-hover/carousel:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="الصورة التالية"
            onClick={handleNext}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-opacity opacity-90 sm:opacity-0 sm:group-hover/carousel:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Bottom-Right Overlay Slot (Single Ask Price in RTL) */}
      {bottomRightSlot && (
        <div className="absolute bottom-3 right-3 z-20">{bottomRightSlot}</div>
      )}
    </div>
  );

  if (!showThumbnails || safePhotos.length <= 1) {
    return carouselNode;
  }

  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 p-3 sm:p-4 bg-surface-base dark:bg-dark-surface-base w-full min-w-0">
      {/* Right column in RTL: Thumbnails list */}
      <div
        ref={thumbnailContainerRef}
        className="relative sm:w-24 md:w-28 shrink-0 flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto scrollbar-thin py-1 sm:py-0 min-h-0 max-h-[280px] sm:max-h-[380px] md:max-h-[440px]"
        data-testid="carousel-thumbnails"
      >
        {safePhotos.map((photoUrl, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={idx}
              ref={(el) => {
                thumbnailRefs.current[idx] = el;
              }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(idx);
              }}
              className={clsx(
                'relative shrink-0 w-20 h-14 sm:w-full sm:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary',
                isActive
                  ? 'border-primary ring-2 ring-primary/30 opacity-100 scale-[1.02] shadow-sm'
                  : 'border-transparent opacity-60 hover:opacity-100 hover:border-surface-border',
              )}
              aria-label={`عرض الصورة ${idx + 1}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <img
                src={photoUrl}
                alt={`${alt} - مصغرة ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Left side in RTL: Main Carousel */}
      <div className="flex-1 min-w-0">
        {carouselNode}
      </div>
    </div>
  );
}

