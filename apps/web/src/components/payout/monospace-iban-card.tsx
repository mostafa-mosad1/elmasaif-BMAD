'use client';

import React, { useState } from 'react';
import {
  Building2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Star,
  Trash2,
  Edit3
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface PayoutAccountItem {
  id: string;
  profileId?: string;
  accountHolderName: string;
  bankName?: string | null;
  ibanMasked: string;
  ibanLast4?: string;
  ibanFormatted?: string | null;
  isDefault?: boolean;
  hasCommercialNameMismatch?: boolean;
  isBoundToActiveDeal?: boolean;
  createdAt?: string | Date;
}

export interface MonospaceIbanCardProps {
  account: PayoutAccountItem;
  onEdit?: (account: PayoutAccountItem) => void;
  onDelete?: (account: PayoutAccountItem) => void;
}

export function MonospaceIbanCard({
  account,
  onEdit,
  onDelete
}: MonospaceIbanCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Raw string for clipboard: unspaced 24 characters
  const rawIbanToCopy = (
    account.ibanFormatted ||
    account.ibanMasked
  ).replace(/\s+/g, '');

  const displayIban = isRevealed && account.ibanFormatted
    ? account.ibanFormatted
    : account.ibanMasked;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(rawIbanToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-200 ${
        account.isDefault
          ? 'border-accent/40 bg-gradient-to-br from-accent/5 via-surface-base to-accent/10 dark:from-accent/10 dark:via-dark-surface-base dark:to-accent/5 dark:border-accent/50 shadow-level1'
          : 'border-surface-border bg-surface-base dark:border-dark-surface-border dark:bg-dark-surface-base'
      }`}
    >
      <div className="p-5 flex flex-col gap-4">
        {/* Top Meta Header: Bank Badge + Default Badge + Status Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-3 dark:border-dark-surface-border">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent-dark dark:bg-amber-950/60 dark:text-accent">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
              {account.bankName || 'حساب مصرفي سعودي'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {account.isDefault && (
              <Badge variant="verified" size="sm" icon={<Star className="h-3 w-3 fill-current" />}>
                الحساب الافتراضي
              </Badge>
            )}

            {account.isBoundToActiveDeal && (
              <Badge
                variant="danger"
                size="sm"
                icon={<Lock className="h-3 w-3" />}
                className="bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
              >
                مرتبط بصفقة نشطة - غير قابل للتعديل حالياً
              </Badge>
            )}
          </div>
        </div>

        {/* Account Holder Name */}
        <div>
          <span className="block text-xs font-medium text-ink-secondary dark:text-dark-ink-secondary">
            اسم صاحب الحساب
          </span>
          <span className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            {account.accountHolderName}
          </span>
        </div>

        {/* Commercial Name Mismatch Warning Banner */}
        {account.hasCommercialNameMismatch && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50/80 p-2.5 text-xs text-amber-900 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              <strong>تنبيه:</strong> اسم صاحب الحساب يختلف عن الاسم المسجل بالمنصة. سيتم التحقق الإضافي أثناء تدقيق الصفقات.
            </span>
          </div>
        )}

        {/* Monospace Grouped IBAN Display */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken p-3.5 border border-surface-border dark:bg-dark-surface-sunken dark:border-dark-surface-border">
          <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <span className="font-medium">رقم الآيبان (IBAN)</span>
            {account.ibanFormatted && (
              <button
                type="button"
                onClick={() => setIsRevealed(!isRevealed)}
                className="inline-flex items-center gap-1 text-accent hover:text-accent-dark dark:text-accent text-xs font-medium focus:outline-none transition-colors"
                title={isRevealed ? 'إخفاء رقم الآيبان' : 'إظهار رقم الآيبان'}
              >
                {isRevealed ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>إخفاء رقم الآيبان</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>إظهار رقم الآيبان</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div
              dir="ltr"
              className="font-mono text-base md:text-lg font-bold tracking-widest text-ink-primary dark:text-dark-ink-primary select-all"
            >
              {displayIban}
            </div>

            {/* Dedicated One-Click Copy Button */}
            <div className="relative shrink-0">
              <Button
                type="button"
                size="sm"
                variant={copied ? 'primary' : 'outline'}
                onClick={handleCopy}
                className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                title="نسخ رقم الآيبان"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-white" />
                    <span className="text-white">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>نسخ</span>
                  </>
                )}
              </Button>

              {/* Toast / Tooltip Feedback confirming copy */}
              {copied && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white shadow-level2 animate-in fade-in slide-in-from-bottom-1 dark:bg-dark-surface-raised dark:text-dark-ink-primary border border-surface-border dark:border-dark-surface-border"
                >
                  تم نسخ رقم الآيبان بنجاح
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3 dark:border-dark-surface-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(account)}
            disabled={account.isBoundToActiveDeal}
            className="h-8 gap-1 text-xs text-ink-secondary hover:text-ink-primary dark:text-dark-ink-secondary dark:hover:text-dark-ink-primary disabled:opacity-50"
            title={account.isBoundToActiveDeal ? 'غير قابل للتعديل لوجود صفقات نشطة' : 'تعديل الحساب'}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>تعديل</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete?.(account)}
            disabled={account.isBoundToActiveDeal}
            className="h-8 gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
            title={account.isBoundToActiveDeal ? 'غير قابل للحذف لوجود صفقات نشطة' : 'حذف الحساب'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>حذف</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

