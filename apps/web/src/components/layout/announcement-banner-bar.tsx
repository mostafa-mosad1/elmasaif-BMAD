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

  // Prepare seamless continuous loop chunks (A + B chunk)
  // Each chunk contains repeated items so it spans wide enough before repeating seamlessly
  const tickerItems = useMemo(() => {
    if (activeVisibleBanners.length === 0) return [];
    // Ensure sufficient width per chunk regardless of how few banners exist
    const repeats = activeVisibleBanners.length === 1 ? 6 : activeVisibleBanners.length === 2 ? 4 : 2;
    const chunk = Array.from({ length: repeats }, () => activeVisibleBanners).flat();
    return {
      chunkA: chunk,
      chunkB: chunk,
    };
  }, [activeVisibleBanners]);

  if (isLoading || activeVisibleBanners.length === 0) {
    return null;
  }

  const getStyleForType = (type: AnnouncementBannerType) => {
    switch (type) {
      case AnnouncementBannerType.ALERT:
        return {
          container: 'bg-[#1C1917] text-amber-200 border-b border-amber-800/40',
          titleBadge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-500/30',
        };
      case AnnouncementBannerType.WARNING:
        return {
          container: 'bg-[#1C1917] text-amber-200 border-b border-amber-800/40',
          titleBadge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-500/30',
        };
      case AnnouncementBannerType.SUCCESS:
      case AnnouncementBannerType.INFO:
      default:
        return {
          container: 'bg-[#0F172A] text-slate-100 border-b border-slate-800',
          titleBadge: 'text-amber-300 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
          btn: 'bg-white/10 hover:bg-white/20 text-white border-white/15',
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
        {/* Marquee Ticker Track with Smooth Side Gradient Fade Masks */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] group">
          <div className="animate-marquee-track items-center gap-8 whitespace-nowrap">
            {/* Chunk 1 */}
            {tickerItems.chunkA.map((b, idx) => (
              <div key={`a-${b.id}-${idx}`} className="inline-flex items-center gap-2">
                <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] border ${style.titleBadge}`}>
                  {b.title}:
                </span>
                <span className="text-white/95 font-medium text-xs">
                  {b.content}
                </span>
                {b.actionUrl && (
                  <Link
                    href={b.actionUrl}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all duration-150 ${style.btn}`}
                  >
                    <span>{b.actionText || 'عرض التفاصيل'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
                <span className="text-amber-500/40 text-xs px-2 select-none">✦</span>
              </div>
            ))}

            {/* Chunk 2 (Seamless loop pair) */}
            {tickerItems.chunkB.map((b, idx) => (
              <div key={`b-${b.id}-${idx}`} className="inline-flex items-center gap-2">
                <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] border ${style.titleBadge}`}>
                  {b.title}:
                </span>
                <span className="text-white/95 font-medium text-xs">
                  {b.content}
                </span>
                {b.actionUrl && (
                  <Link
                    href={b.actionUrl}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all duration-150 ${style.btn}`}
                  >
                    <span>{b.actionText || 'عرض التفاصيل'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
                <span className="text-amber-500/40 text-xs px-2 select-none">✦</span>
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

