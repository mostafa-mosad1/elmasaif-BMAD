'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnnouncementBannerDto, AnnouncementBannerType } from '@elmasaif/shared';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '../../lib/api-client';

export function AnnouncementBannerBar() {
  const [banners, setBanners] = useState<AnnouncementBannerDto[]>([]);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadActiveBanners() {
      try {
        const res: any = await apiClient.get('/cms/banners/active');
        const items = res?.data || res || [];
        if (isMounted) {
          setBanners(items);
        }
      } catch {
        // Silently catch to not break page rendering if banners endpoint is unreachable
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    // Load dismissed banner IDs from sessionStorage
    try {
      const stored = sessionStorage.getItem('elmasaif_dismissed_banners');
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

  const handleDismiss = () => {
    const idsToDismiss = activeVisibleBanners.map((b) => b.id);
    const updated = Array.from(new Set([...dismissedBannerIds, ...idsToDismiss]));
    setDismissedBannerIds(updated);
    try {
      sessionStorage.setItem('elmasaif_dismissed_banners', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const activeVisibleBanners = useMemo(
    () => banners.filter((b) => !dismissedBannerIds.includes(b.id)),
    [banners, dismissedBannerIds],
  );

  // Prepare infinite smooth loop items (duplicated so -50% translation loops seamlessly)
  const tickerItems = useMemo(() => {
    if (activeVisibleBanners.length === 0) return [];
    const multiplier = activeVisibleBanners.length === 1 ? 4 : activeVisibleBanners.length === 2 ? 3 : 2;
    const chunk = Array.from({ length: multiplier }, () => activeVisibleBanners).flat();
    return [...chunk, ...chunk];
  }, [activeVisibleBanners]);

  if (isLoading || activeVisibleBanners.length === 0) {
    return null;
  }

  const getStyleForType = (type: AnnouncementBannerType) => {
    switch (type) {
      case AnnouncementBannerType.ALERT:
        return {
          container: 'bg-[#450A0A] text-rose-100 border-b border-rose-900/60',
          icon: <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />,
        };
      case AnnouncementBannerType.WARNING:
        return {
          container: 'bg-[#451A03] text-amber-100 border-b border-amber-900/60',
          icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />,
        };
      case AnnouncementBannerType.SUCCESS:
        return {
          container: 'bg-[#0B1510] text-emerald-100 border-b border-emerald-900/40',
          icon: <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />,
        };
      case AnnouncementBannerType.INFO:
      default:
        return {
          container: 'bg-[#0F172A] text-slate-100 border-b border-slate-800',
          icon: <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />,
        };
    }
  };

  // Determine dominant style from highest-priority banner
  const priorityOrder = [
    AnnouncementBannerType.ALERT,
    AnnouncementBannerType.WARNING,
    AnnouncementBannerType.SUCCESS,
    AnnouncementBannerType.INFO,
  ];
  const dominantType =
    priorityOrder.find((t) => activeVisibleBanners.some((b) => b.bannerType === t)) ||
    activeVisibleBanners[0]?.bannerType ||
    AnnouncementBannerType.INFO;

  const style = getStyleForType(dominantType);

  return (
    <aside
      aria-label="تنبيهات المنصة"
      className={`relative z-40 text-xs transition-all duration-200 overflow-hidden select-none ${style.container}`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center h-9 sm:h-10 gap-3">
        {/* Pinned Category Pill */}
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold shadow-xs z-10 bg-black/25 backdrop-blur-md border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          {style.icon}
          <span className="hidden sm:inline">إعلانات المنصة</span>
        </div>

        {/* Marquee Ticker Track with Smooth Side Gradient Fade Masks */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)] group">
          <div className="animate-marquee-track items-center gap-8 whitespace-nowrap">
            {tickerItems.map((b, idx) => (
              <div key={`${b.id}-${idx}`} className="inline-flex items-center gap-2">
                <span className="font-extrabold text-amber-300 dark:text-amber-400 bg-white/10 px-2 py-0.5 rounded text-[11px] border border-white/15">
                  {b.title}:
                </span>
                <span className="text-white/95 font-medium text-xs">
                  {b.content}
                </span>
                {b.actionUrl && (
                  <Link
                    href={b.actionUrl}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all duration-150"
                  >
                    <span>{b.actionText || 'عرض التفاصيل'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
                <span className="text-white/30 text-xs px-2 select-none">✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned Dismiss Button */}
        <div className="shrink-0 flex items-center z-10">
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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

