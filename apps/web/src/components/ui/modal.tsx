'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  /** Mounts the dialog only while `true`; the parent owns the open state. */
  open: boolean;
  onClose: () => void;
  /** Accessible name announced for the dialog region. */
  ariaLabel: string;
  /** Visible label of the close affordance (Arabic by house convention). */
  closeLabel?: string;
  testId?: string;
  closeTestId?: string;
  /** Width cap of the panel, e.g. `max-w-2xl`. */
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Overlay dialog used by the listing detail forms (offer + inquiry).
 *
 * Escape and a backdrop click close it, the page behind it stops scrolling, and the panel body
 * scrolls on its own so long forms stay reachable on short screens.
 */
export function Modal({
  open,
  onClose,
  ariaLabel,
  closeLabel = 'إغلاق',
  testId,
  closeTestId,
  panelClassName = 'max-w-2xl',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      dir="rtl"
      data-testid={testId}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`my-auto w-full ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            data-testid={closeTestId}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-base px-3 py-1.5 text-xs font-semibold text-ink-secondary shadow-level1 transition-colors hover:bg-surface-sunken hover:text-ink-primary dark:bg-dark-surface-raised dark:text-dark-ink-secondary dark:hover:bg-dark-surface dark:hover:text-dark-ink-primary"
          >
            <X className="w-3.5 h-3.5" />
            <span>{closeLabel}</span>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto rounded-card shadow-level3">{children}</div>
      </div>
    </div>
  );
}
