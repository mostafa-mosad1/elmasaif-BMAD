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
          container:
            'bg-rose-950/90 text-rose-100 border-b border-rose-800/40 dark:bg-rose-950/80 dark:border-rose-900/60',
          titleBadge: 'text-rose-300 bg-rose-500/15 border-rose-500/30 font-bold',
          btn: 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border-rose-500/30',
          divider: 'text-rose-400/40',
        };
      case AnnouncementBannerType.WARNING:
        return {
          container:
            'bg-amber-950/90 text-amber-100 border-b border-amber-800/40 dark:bg-amber-950/80 dark:border-amber-900/60',
          titleBadge: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold',
          btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-500/30',
          divider: 'text-amber-400/40',
        };
      case AnnouncementBannerType.SUCCESS:
      case AnnouncementBannerType.INFO:
      default:
        return {
          container:
            'bg-surface-sunken/90 dark:bg-dark-surface-sunken/95 text-ink-primary dark:text-dark-ink-primary border-b border-surface-border dark:border-dark-surface-border backdrop-blur-md',
          titleBadge:
            'text-accent dark:text-accent bg-accent/10 dark:bg-accent/15 border-accent/25 dark:border-accent/30 font-bold',
          btn: 'bg-surface dark:bg-dark-surface-base hover:bg-surface-sunken dark:hover:bg-dark-surface-raised text-ink-primary dark:text-white border-surface-border dark:border-dark-surface-border shadow-xs',
          divider: 'text-accent/60',
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
                <span className={`px-2 py-0.5 rounded text-[11px] border ${style.titleBadge}`}>
                  {b.title}:
                </span>
                <span className="font-medium text-xs text-ink-primary dark:text-dark-ink-primary">
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
                <span className={`text-xs px-2 select-none ${style.divider}`}>✦</span>
              </div>
            ))}

            {/* Chunk 2 (Seamless loop pair) */}
            {tickerItems.chunkB.map((b, idx) => (
              <div key={`b-${b.id}-${idx}`} className="inline-flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] border ${style.titleBadge}`}>
                  {b.title}:
                </span>
                <span className="font-medium text-xs text-ink-primary dark:text-dark-ink-primary">
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
                <span className={`text-xs px-2 select-none ${style.divider}`}>✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned Dismiss Button */}
        <div className="shrink-0 flex items-center z-10">
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
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

