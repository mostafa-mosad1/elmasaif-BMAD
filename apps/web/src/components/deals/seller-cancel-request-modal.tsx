'use client';

import React, { useState } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

export interface SellerCancelRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealNumber?: string;
  onSuccess: () => void;
}

export function SellerCancelRequestModal({
  isOpen,
  onClose,
  dealId,
  dealNumber,
  onSuccess,
}: SellerCancelRequestModalProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 10 && trimmedReason.length <= 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/v1/deals/${dealId}/seller-cancel-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason: trimmedReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل تقديم طلب إلغاء الصفقة');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء محاولة تقديم طلب الإلغاء');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-cancel-modal-title"
      data-testid="seller-cancel-request-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="إغلاق النافذة"
          className="absolute left-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="seller-cancel-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              طلب إلغاء الصفقة من قِبل البائع
            </h2>
            {dealNumber ? (
              <p className="text-xs text-slate-500 font-mono mt-0.5">{dealNumber}</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            سيتم إرسال طلب الإلغاء إلى إدارة المنصة لمراجعته والبت فيه. يُرجى توضيح أسباب تعذر المضي في الصفقة قبل رفع إثباتات السداد من المشتري.
          </p>

          <div>
            <label htmlFor="seller-cancel-reason" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              سبب طلب الإلغاء <span className="text-red-500">*</span>
            </label>
            <textarea
              id="seller-cancel-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب طلب الإلغاء (10 أحرف على الأقل)..."
              disabled={isLoading}
              required
              minLength={10}
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>الحد الأدنى: 10 أحرف</span>
              <span>{trimmedReason.length} / 500</span>
            </div>
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
              type="submit"
              variant="danger"
              disabled={isLoading || !isReasonValid}
              data-testid="submit-seller-cancel-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جارٍ الإرسال...
                </>
              ) : (
                'إرسال طلب الإلغاء للإدارة'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

