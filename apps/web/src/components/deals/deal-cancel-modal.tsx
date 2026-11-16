'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

export interface DealCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealNumber?: string;
  onSuccess: () => void;
}

export function DealCancelModal({
  isOpen,
  onClose,
  dealId,
  dealNumber,
  onSuccess,
}: DealCancelModalProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/v1/deals/${dealId}/cancel-by-buyer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل إلغاء الصفقة');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء محاولة إلغاء الصفقة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-deal-modal-title"
      data-testid="deal-cancel-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-base p-6 shadow-2xl dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="إغلاق النافذة"
          className="absolute left-4 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink-primary dark:hover:bg-dark-surface-raised dark:hover:text-dark-ink-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="cancel-deal-modal-title" className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
              إلغاء الصفقة
            </h2>
            {dealNumber ? (
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-mono mt-0.5">{dealNumber}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
            هل أنت متأكد من رغبتك في إلغاء هذه الصفقة؟ سيؤدي الإلغاء إلى فك حجز العقار وإعادته فوراً للعرض والتداول النشط في السوق.
          </p>

          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5">
              سبب الإلغاء (اختياري)
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب إلغاء الصفقة إن وُجد..."
              disabled={isLoading}
              className="w-full rounded-xl border border-surface-border bg-surface-sunken p-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-dark-surface-border dark:bg-dark-surface-sunken dark:text-dark-ink-primary"
            />
          </div>

          {error ? (
            <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirm}
              disabled={isLoading}
              data-testid="confirm-cancel-deal-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جارٍ الإلغاء...
                </>
              ) : (
                'تأكيد إلغاء الصفقة'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

