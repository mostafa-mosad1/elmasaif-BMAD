'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnnouncementBannerDto, AnnouncementBannerType } from '@elmasaif/shared';
import { X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '../../lib/api-client';

export function AnnouncementBannerBar() {
  const [banners, setBanners] = useState<AnnouncementBannerDto[]>([]);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadActiveBanners() {
      try {
        const res: any = await apiClient.get('/cms/banners/active');
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (isMounted) {
          setBanners(items);
        }
      } catch {
        // Silently catch to not break page rendering if banners endpoint is unreachable
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    try {
      const stored = sessionStorage.getItem('elmasaif_dismissed_banners_v2');
      if (stored) {
        setDismissedBannerIds(JSON.parse(stored));
      }
    } catch {
      // sessionStorage might be restricted
    }

    loadActiveBanners();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeVisibleBanners = useMemo(
    () => banners.filter((b) => !dismissedBannerIds.includes(b.id)),
    [banners, dismissedBannerIds],
  );

  // Auto-rotate if more than 1 banner and not paused by user hover
  useEffect(() => {
    if (activeVisibleBanners.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeVisibleBanners.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [activeVisibleBanners.length, isPaused]);

  // Reset index if it goes out of bounds after dismissal
  useEffect(() => {
    if (currentIndex >= activeVisibleBanners.length && activeVisibleBanners.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, activeVisibleBanners.length]);

  const handleDismiss = () => {
    const idsToDismiss = activeVisibleBanners.map((b) => b.id);
    const updated = Array.from(new Set([...dismissedBannerIds, ...idsToDismiss]));
    setDismissedBannerIds(updated);
    try {
      sessionStorage.setItem('elmasaif_dismissed_banners_v2', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  if (isLoading || activeVisibleBanners.length === 0) {
    return null;
  }

  const currentBanner = activeVisibleBanners[currentIndex] || activeVisibleBanners[0];

  const getAccentForType = (type: AnnouncementBannerType) => {
    switch (type) {
      case AnnouncementBannerType.ALERT:
        return {
          dot: 'bg-rose-500',
          ping: 'bg-rose-400',
          label: 'text-rose-700 dark:text-rose-400 font-bold',
          link: 'text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold',
          container:
            'bg-rose-50/80 border-b border-rose-200/50 dark:bg-rose-950/20 dark:border-rose-900/40 text-stone-800 dark:text-stone-200',
        };
      case AnnouncementBannerType.WARNING:
        return {
          dot: 'bg-amber-500',
          ping: 'bg-amber-400',
          label: 'text-amber-800 dark:text-amber-300 font-bold',
          link: 'text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 font-semibold',
          container:
            'bg-amber-50/80 border-b border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/40 text-stone-800 dark:text-stone-200',
        };
      case AnnouncementBannerType.SUCCESS:
        return {
          dot: 'bg-emerald-500',
          ping: 'bg-emerald-400',
          label: 'text-emerald-700 dark:text-emerald-400 font-bold',
          link: 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold',
          container:
            'bg-emerald-50/80 border-b border-emerald-200/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-stone-800 dark:text-stone-200',
        };
      case AnnouncementBannerType.INFO:
      default:
        return {
          dot: 'bg-sky-500',
          ping: 'bg-sky-400',
          label: 'text-sky-700 dark:text-sky-400 font-bold',
          link: 'text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-semibold',
          container:
            'bg-sky-50/80 border-b border-sky-200/50 dark:bg-sky-950/20 dark:border-sky-900/40 text-stone-800 dark:text-stone-200',
        };
    }
  };

  const accent = getAccentForType(currentBanner.bannerType);

  return (
    <aside
      aria-label="تنبيهات المنصة"
      className={`relative z-40 text-xs backdrop-blur-md transition-colors duration-500 select-none ${accent.container}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[34px] sm:h-9 flex items-center justify-between gap-3">
        {/* Leading spacer or dots pagination */}
        <div className="shrink-0 w-8 sm:w-16 flex items-center gap-1">
          {activeVisibleBanners.length > 1 && (
            <div className="flex items-center gap-1">
              {activeVisibleBanners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? `w-3.5 ${accent.dot}`
                      : 'w-1 bg-stone-300 dark:bg-stone-700 hover:bg-stone-400'
                  }`}
                  title={`إعلان ${i + 1}`}
                  aria-label={`الانتقال إلى الإعلان ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Minimalist Centered Message */}
        <div
          key={currentBanner.id}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 sm:gap-2.5 text-xs text-center truncate animate-in fade-in duration-300"
        >
          {/* Subtle Glowing Pulse Dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${accent.ping}`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${accent.dot}`}
            />
          </span>

          {/* Title label */}
          {currentBanner.title && (
            <span className={`shrink-0 ${accent.label}`}>
              {currentBanner.title}
            </span>
          )}

          {/* Subtle separator dot */}
          {currentBanner.title && (
            <span className="text-stone-300 dark:text-stone-600 select-none hidden sm:inline">
              •
            </span>
          )}

          {/* Clean Message Content */}
          <span className="truncate font-medium text-stone-700 dark:text-stone-300">
            {currentBanner.content}
          </span>

          {/* Refined Inline Link */}
          {currentBanner.actionUrl && (
            <Link
              href={currentBanner.actionUrl}
              className={`shrink-0 inline-flex items-center gap-1 underline-offset-4 hover:underline transition-colors ${accent.link} group/link ms-1`}
            >
              <span>{currentBanner.actionText || 'اكتشف المزيد'}</span>
              <ArrowLeft className="w-3 h-3 rtl:rotate-0 transition-transform duration-150 group-hover/link:-translate-x-0.5" />
            </Link>
          )}
        </div>

        {/* Quiet Dismiss Button */}
        <div className="shrink-0 w-8 sm:w-16 flex items-center justify-end">
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 transition-colors"
            title="إغلاق التنبيه"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
