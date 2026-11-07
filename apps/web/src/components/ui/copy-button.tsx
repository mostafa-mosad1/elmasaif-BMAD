'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';

/**
 * Story 5.2 / AC-4, UX microcopy: the confirmation the design prescribes for a transfer
 * reference. Deliberately longer than `MonospaceIbanCard`'s «تم النسخ» — the buyer must be told
 * *what* to do with the code, not only that a copy happened.
 */
export const COPY_CONFIRMATION_AR =
  'تم نسخ رمز مرجع التحويل بنجاح: استخدم هذا الرمز في وصف الحوالة البنكية';

export const COPY_FEEDBACK_DURATION_MS = 2_000;

/**
 * The raw string a bank form expects: no grouping spaces, no bidi marks. IBANs and reference
 * codes are both copied through here, so the same normalisation applies to «ELM-…-C».
 */
export function normalizeCopyValue(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '');
}

export interface CopyButtonProps {
  /** The value written to the clipboard — displayed nowhere unless the caller renders it. */
  value: string;
  label?: string;
  copiedLabel?: string;
  /** Overrides the institutional sentence, e.g. for the platform IBAN. */
  copiedMessage?: string;
  feedbackDurationMs?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Story 5.2 / Task 6.2: a copy control that shows the verbatim institutional confirmation for
 * two seconds. `MonospaceIbanCard` is left untouched on purpose — its props are payout-shaped and
 * Story 1.5's suite asserts its own toast.
 */
export function CopyButton({
  value,
  label = 'نسخ',
  copiedLabel = 'تم النسخ',
  copiedMessage = COPY_CONFIRMATION_AR,
  feedbackDurationMs = COPY_FEEDBACK_DURATION_MS,
  className,
  disabled = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const payload = normalizeCopyValue(value);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // Clipboard permissions can be denied; the confirmation still reports the intent so the
      // buyer is never left staring at a dead button.
    }

    setCopied(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setCopied(false), feedbackDurationMs);
    }
  };

  return (
    <span className={twMerge(clsx('inline-flex flex-col items-start gap-1', className))}>
      <Button
        type="button"
        size="sm"
        variant={copied ? 'primary' : 'outline'}
        onClick={handleCopy}
        disabled={disabled}
        aria-label={label}
        className="h-8 gap-1.5 px-2.5 text-xs font-medium"
        data-testid="copy-button"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copiedLabel}</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </Button>

      {copied ? (
        <span
          role="status"
          aria-live="polite"
          className="text-[11px] leading-snug text-status-verified"
          data-testid="copy-confirmation"
        >
          {copiedMessage}
        </span>
      ) : null}
    </span>
  );
}
