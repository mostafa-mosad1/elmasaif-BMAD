'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  NotificationCategory,
  NotificationDto,
  PaginatedNotificationsDto,
} from '@elmasaif/shared';
import {
  Bell,
  CheckCheck,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { NotificationItem } from '../../../components/notifications/notification-item';
import { WorkspaceShell } from '../../../components/layout/workspace-shell';

const CATEGORIES: { key: NotificationCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'جميع التصنيفات' },
  { key: NotificationCategory.DEAL, label: 'الصفقات' },
  { key: NotificationCategory.CONTRACT, label: 'العقود' },
  { key: NotificationCategory.LICENSING, label: 'التراخيص وفال' },
  { key: NotificationCategory.LISTING, label: 'العقارات المعروضة' },
  { key: NotificationCategory.DEMAND, label: 'طلبات الشراء' },
  { key: NotificationCategory.SUPPORT, label: 'الدعم الفني والشكاوى' },
  { key: NotificationCategory.SECURITY, label: 'تنبيهات الأمان' },
  { key: NotificationCategory.SYSTEM, label: 'إشعارات النظام' },
];

export default function NotificationsCenterPage() {
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'ALL'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);

  const [data, setData] = useState<PaginatedNotificationsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(page));
        queryParams.set('limit', String(limit));
        if (unreadOnly) queryParams.set('unreadOnly', 'true');
        if (selectedCategory !== 'ALL') queryParams.set('category', selectedCategory);

        const res = await apiClient<PaginatedNotificationsDto>(
          `/notifications?${queryParams.toString()}`,
        );
        setData(res);
      } catch (err) {
        console.error('Failed to fetch notifications feed:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, unreadOnly, selectedCategory],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      };
    });

    try {
      await apiClient(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiClient<{ markedCount: number }>('/notifications/mark-all-read', {
        method: 'POST',
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => ({
            ...item,
            isRead: true,
            readAt: new Date().toISOString(),
          })),
          unreadCount: 0,
        };
      });
      setSuccessToast(`تم تحديد ${res.markedCount || 0} إشعار كمقروء بنجاح`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <WorkspaceShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-surface-border dark:border-dark-surface-border">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
                  مركز الإشعارات والتنبيهات
                </h1>
                <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                  متابعة حالة الصفقات، مواعيد السداد، التراخيص، وإجراءات العقود المباشرة
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>

            {data && data.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء ({data.unreadCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Toast */}
        {successToast && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
            {successToast}
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-3 rounded-xl bg-surface-sunken/40 dark:bg-dark-surface/40 border border-surface-border dark:border-dark-surface-border">
          {/* Unread Tabs */}
          <div className="flex items-center gap-1 bg-surface dark:bg-dark-surface-base p-1 rounded-lg border border-surface-border dark:border-dark-surface-border self-start">
            <button
              type="button"
              onClick={() => {
                setUnreadOnly(false);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                !unreadOnly
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
              }`}
            >
              الكل {data ? `(${data.total})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setUnreadOnly(true);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                unreadOnly
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary'
              }`}
            >
              غير المقروءة {data ? `(${data.unreadCount})` : ''}
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-ink-muted shrink-0 ms-1" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.key);
                  setPage(1);
                }}
                className={`whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors shrink-0 ${
                  selectedCategory === cat.key
                    ? 'border-primary bg-primary/10 text-primary dark:border-primary-light dark:bg-primary/20 dark:text-primary-light font-bold'
                    : 'border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Feed Cards */}
        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-ink-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
              <p className="text-xs">جاري تحميل الإشعارات...</p>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-24 px-4 text-center rounded-2xl border-2 border-dashed border-surface-border dark:border-dark-surface-border bg-surface-sunken/20 dark:bg-dark-surface/20">
              <div className="w-14 h-14 mx-auto rounded-full bg-surface-sunken dark:bg-dark-surface flex items-center justify-center text-ink-muted mb-4">
                <Bell className="w-6 h-6 opacity-30" />
              </div>
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary mb-1">
                لا توجد إشعارات مطابقة
              </h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                {unreadOnly
                  ? 'لقد اطلعت على كافة الإشعارات، لا توجد إشعارات غير مقروءة حالياً.'
                  : 'لم يتم العثور على أي إشعارات ضمن التصنيف المختار.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.items.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-raised shadow-xs transition-shadow hover:shadow-sm"
                >
                  <NotificationItem
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {data && data.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-surface-border dark:border-dark-surface-border pt-4">
            <span className="text-xs text-ink-muted">
              صفحة {data.page} من {data.totalPages} (إجمالي {data.total} إشعار)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-sunken transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-border dark:border-dark-surface-border text-ink-secondary dark:text-dark-ink-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-sunken transition-colors"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

