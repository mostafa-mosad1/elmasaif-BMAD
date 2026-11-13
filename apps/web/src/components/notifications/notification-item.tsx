'use client';

import React from 'react';
import Link from 'next/link';
import {
  NotificationCategory,
  NotificationDto,
} from '@elmasaif/shared';
import {
  Handshake,
  Building,
  FileCheck,
  ShieldCheck,
  FileQuestion,
  LifeBuoy,
  ShieldAlert,
  Bell,
  ExternalLink,
  Check,
} from 'lucide-react';

export interface NotificationItemProps {
  notification: NotificationDto;
  onMarkAsRead?: (id: string) => void;
  onClick?: () => void;
  compact?: boolean;
}

export function formatRelativeArabicTime(isoDate: string): string {
  try {
    const now = Date.now();
    const created = new Date(isoDate).getTime();
    const diffSec = Math.floor((now - created) / 1000);

    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return new Date(isoDate).toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export function getCategoryStyle(category: NotificationCategory, isCritical?: boolean) {
  if (isCritical) {
    return {
      icon: ShieldAlert,
      bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
      border: 'border-rose-500/30',
      badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    };
  }

  switch (category) {
    case NotificationCategory.DEAL:
      return {
        icon: Handshake,
        bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      };
    case NotificationCategory.CONTRACT:
      return {
        icon: FileCheck,
        bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
        border: 'border-indigo-500/30',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
      };
    case NotificationCategory.LICENSING:
      return {
        icon: ShieldCheck,
        bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
        border: 'border-amber-500/30',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
      };
    case NotificationCategory.LISTING:
      return {
        icon: Building,
        bg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
        border: 'border-sky-500/30',
        badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
      };
    case NotificationCategory.DEMAND:
      return {
        icon: FileQuestion,
        bg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
        border: 'border-blue-500/30',
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
      };
    case NotificationCategory.SUPPORT:
      return {
        icon: LifeBuoy,
        bg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
        border: 'border-purple-500/30',
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
      };
    case NotificationCategory.SECURITY:
      return {
        icon: ShieldAlert,
        bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
        border: 'border-rose-500/30',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
      };
    default:
      return {
        icon: Bell,
        bg: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light',
        border: 'border-surface-border',
        badge: 'bg-surface-sunken text-ink-secondary',
      };
  }
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const { icon: CategoryIcon, bg, badge } = getCategoryStyle(
    notification.category,
    notification.isCritical,
  );

  const relativeTime = formatRelativeArabicTime(notification.createdAt);

  const handleCardClick = () => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onClick) {
      onClick();
    }
  };

  const content = (
    <div
      onClick={handleCardClick}
      className={`group relative flex items-start gap-3 p-3.5 rounded-lg transition-colors cursor-pointer text-start ${
        notification.isRead
          ? 'bg-transparent hover:bg-surface-sunken/60 dark:hover:bg-dark-surface-sunken/40'
          : 'bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-primary/[0.08] dark:hover:bg-primary/[0.12]'
      }`}
    >
      {/* Category Icon */}
      <div
        className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 ${bg}`}
      >
        <CategoryIcon className="w-4 h-4" />
      </div>

      {/* Main text area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {!notification.isRead && (
              <span
                className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"
                aria-label="غير مقروء"
              />
            )}
            <h4
              className={`text-xs sm:text-sm font-semibold truncate ${
                notification.isRead
                  ? 'text-ink-secondary dark:text-dark-ink-secondary'
                  : 'text-ink-primary dark:text-dark-ink-primary font-bold'
              }`}
            >
              {notification.title}
            </h4>
          </div>
          <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted shrink-0">
            {relativeTime}
          </span>
        </div>

        <p
          className={`text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed ${
            compact ? 'line-clamp-2' : 'line-clamp-4'
          }`}
        >
          {notification.message}
        </p>

        {/* Action footer */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {notification.deepLink ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover dark:text-primary-light">
              <span>عرض التفاصيل</span>
              <ExternalLink className="w-3 h-3 rtl:rotate-180" />
            </span>
          ) : (
            <span />
          )}

          {!notification.isRead && onMarkAsRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              title="تحديد كمقروء"
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink-primary dark:text-dark-ink-muted dark:hover:text-dark-ink-primary transition-colors px-1.5 py-0.5 rounded hover:bg-surface-sunken"
            >
              <Check className="w-3 h-3" />
              <span>كمقروء</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (notification.deepLink) {
    return (
      <Link href={notification.deepLink} className="block focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}

