'use client';

import React, { useEffect, useState } from 'react';
import { AnnouncementBannerDto, AnnouncementBannerType } from '@elmasaif/shared';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X, ExternalLink } from 'lucide-react';
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

  const handleDismiss = (id: string) => {
    const updated = [...dismissedBannerIds, id];
    setDismissedBannerIds(updated);
    try {
      sessionStorage.setItem('elmasaif_dismissed_banners', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const activeVisibleBanners = banners.filter((b) => !dismissedBannerIds.includes(b.id));

  if (isLoading || activeVisibleBanners.length === 0) {
    return null;
  }

  // Render the first active visible banner
  const banner = activeVisibleBanners[0];

  const getStyleForType = (type: AnnouncementBannerType) => {
    switch (type) {
      case AnnouncementBannerType.ALERT:
        return {
          container: 'bg-rose-700 text-white border-b border-rose-800',
          icon: <AlertCircle className="w-4 h-4 shrink-0 text-white" />,
          btn: 'bg-white text-rose-800 hover:bg-rose-50',
        };
      case AnnouncementBannerType.WARNING:
        return {
          container: 'bg-amber-500 text-amber-950 border-b border-amber-600',
          icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-950" />,
          btn: 'bg-amber-950 text-amber-100 hover:bg-amber-900',
        };
      case AnnouncementBannerType.SUCCESS:
        return {
          container: 'bg-emerald-700 text-white border-b border-emerald-800',
          icon: <CheckCircle className="w-4 h-4 shrink-0 text-white" />,
          btn: 'bg-white text-emerald-800 hover:bg-emerald-50',
        };
      case AnnouncementBannerType.INFO:
      default:
        return {
          container: 'bg-indigo-700 text-white border-b border-indigo-800',
          icon: <Info className="w-4 h-4 shrink-0 text-white" />,
          btn: 'bg-white text-indigo-800 hover:bg-indigo-50',
        };
    }
  };

  const style = getStyleForType(banner.bannerType);

  return (
    <aside
      aria-label="تنبيهات المنصة"
      className={`relative z-40 px-4 py-2 text-xs transition-all duration-200 ${style.container}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {style.icon}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span className="font-bold underline decoration-white/40">{banner.title}:</span>
            <span className="truncate max-w-xl text-white/95">{banner.content}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {banner.actionUrl && (
            <Link
              href={banner.actionUrl}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xs transition-colors ${style.btn}`}
            >
              <span>{banner.actionText || 'عرض التفاصيل'}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}

          <button
            onClick={() => handleDismiss(banner.id)}
            className="p-1 rounded-md hover:bg-black/15 transition-colors"
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

