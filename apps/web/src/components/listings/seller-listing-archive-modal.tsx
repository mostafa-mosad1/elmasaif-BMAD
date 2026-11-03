'use client';

import React, { useState } from 'react';
import {
  Archive,
  RefreshCw,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ListingStatus } from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';

export interface SellerListingArchiveActionsProps {
  listingId: string;
  status: ListingStatus;
  archiveReason?: string | null;
  onStatusChanged?: (newStatus: ListingStatus, data?: any) => void;
}

export function SellerListingArchiveActions({
  listingId,
  status,
  archiveReason,
  onStatusChanged,
}: SellerListingArchiveActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        statusCode: number;
        message: string;
        data: any;
      }>(`/listings/${listingId}/archive`, {
        reason: reason.trim() || undefined,
      });

      setIsModalOpen(false);
      setReason('');
      onStatusChanged?.(ListingStatus.ARCHIVED, res.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'حدث خطأ أثناء أرشفة الإعلان';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        statusCode: number;
        message: string;
        data: any;
      }>(`/listings/${listingId}/unarchive`);

      onStatusChanged?.(ListingStatus.ACTIVE, res.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'حدث خطأ أثناء إعادة تنشيط الإعلان';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === ListingStatus.ACTIVE && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 text-xs text-ink-secondary hover:text-ink-primary hover:border-surface-border dark:text-dark-ink-secondary"
          data-testid="archive-listing-btn"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>أرشفة الإعلان</span>
        </Button>
      )}

      {status === ListingStatus.ARCHIVED && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleUnarchive}
          disabled={loading}
          className="gap-1.5 text-xs"
          data-testid="unarchive-listing-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'جاري إعادة النشر...' : 'إعادة النشر (تنشيط)'}</span>
        </Button>
      )}

      {/* Archiving Confirmation Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          data-testid="archive-modal"
        >
          <div className="w-full max-w-lg bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-surface-border dark:border-dark-surface-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                  تأكيد أرشفة الإعلان العقاري
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                }}
                className="text-ink-muted hover:text-ink-primary p-1"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">تنبيهات هامة قبل الأرشفة:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-ink-secondary dark:text-dark-ink-secondary">
                    <li>سيتم إخفاء هذا الإعلان فوراً من البحث العام في المنصة.</li>
                    <li>
                      سيتم إلغاء أي عروض شراء معلقة لم تتحول إلى صفقات مؤكدة تلقائياً.
                    </li>
                    <li>
                      لا يمكن أرشفة العقار إذا كان محجوزاً أو مرتبطاً بصفقة بيع جارية.
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <label
                  htmlFor="archive-reason"
                  className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1.5"
                >
                  سبب الأرشفة (اختياري، بحد أقصى 500 حرف):
                </label>
                <textarea
                  id="archive-reason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: رغبة المالك في تأجيل البيع، تم تأجير العقار، إلخ..."
                  className="w-full p-3 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-ground dark:bg-dark-surface-ground text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  data-testid="archive-reason-input"
                />
                <div className="flex justify-end text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
                  <span>{reason.length}/500</span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-200 text-xs">
                  {error}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-ground dark:bg-dark-surface-ground border-t border-surface-border dark:border-dark-surface-border flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                }}
                disabled={loading}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleArchive}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="confirm-archive-btn"
              >
                {loading ? 'جاري الأرشفة...' : 'تأكيد الأرشفة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

