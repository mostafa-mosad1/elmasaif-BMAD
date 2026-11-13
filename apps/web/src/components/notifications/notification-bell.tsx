'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NotificationDto,
  PaginatedNotificationsDto,
  UnreadNotificationCountDto,
} from '@elmasaif/shared';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { NotificationItem } from './notification-item';

export interface NotificationBellProps {
  className?: string;
  pollIntervalMs?: number;
}

export function NotificationBell({
  className = '',
  pollIntervalMs = 45000,
}: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiClient<UnreadNotificationCountDto>('/notifications/unread-count');
      if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Silently ignore auth/network failures during polling
    }
  }, []);

  // 2. Fetch recent notifications when dropdown opens
  const fetchRecentNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<PaginatedNotificationsDto>('/notifications?page=1&limit=5');
      if (data?.items) {
        setNotifications(data.items);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up initial fetch & periodic polling
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, pollIntervalMs]);

  // When opening dropdown, fetch recent items
  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [isOpen, fetchRecentNotifications]);

  // Click outside & Escape key listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // Rollback on failure by refetching count
      fetchUnreadCount();
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await apiClient('/notifications/mark-all-read', { method: 'POST' });
    } catch {
      fetchUnreadCount();
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="الإشعارات والتنبيهات"
        aria-expanded={isOpen}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-DEFAULT text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <Bell className="w-4 h-4" />

        {/* Dynamic Unread Badge */}
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1 -end-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full shadow-sm ring-2 ring-surface dark:ring-dark-surface animate-in fade-in zoom-in-75 duration-200"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Feed */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute end-0 mt-2 w-80 sm:w-96 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                الإشعارات
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light rounded-full">
                  {unreadCount} جديدة
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-border/50 dark:divide-dark-surface-border/50 p-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-ink-muted">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-surface-sunken dark:bg-dark-surface flex items-center justify-center text-ink-muted mb-3">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-medium text-ink-secondary dark:text-dark-ink-secondary">
                  لا توجد إشعارات جديدة حالياً
                </p>
                <p className="text-[11px] text-ink-muted mt-1">
                  ستظهر هنا إشعارات الصفقات والعقود والتنبيهات التشغيلية فور صدورها
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  compact
                  onMarkAsRead={handleMarkAsRead}
                  onClick={() => setIsOpen(false)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-surface-border dark:border-dark-surface-border p-2 bg-surface-sunken/40 dark:bg-dark-surface/40 text-center">
            <Link
              href="/app/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center w-full py-2 text-xs font-semibold text-primary hover:text-primary-hover dark:text-primary-light transition-colors"
            >
              عرض جميع الإشعارات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

