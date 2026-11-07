'use client';

import React, { useRef, useState } from 'react';
import { FileCheck, UploadCloud } from 'lucide-react';
import {
  DEAL_PAYMENT_PROOF_MIME_TYPES,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  validateDealPaymentProofFile,
  type DealPaymentProofValidationError,
  type DealPaymentType,
} from '@elmasaif/shared';
import { Button } from '../ui/button';

/** Verbatim UI copy from the UX artefacts. */
export const PROOF_DROPZONE_TITLE_AR = 'اسحب إيصال التحويل إلى هنا أو اختر ملفاً';
export const PROOF_DROPZONE_FORMATS_AR = 'PDF, JPEG, PNG (حتى 10 ميجابايت)';
export const PROOF_DROPZONE_SUBMIT_AR = 'رفع إيصال التحويل';
export const PROOF_DROPZONE_UPLOADING_AR = 'جارٍ رفع الإيصال وفحصه أمنياً...';

/** FR-30 lists exactly three formats, so `accept` is pinned to the same list (trap T-12). */
export const DEAL_PROOF_ACCEPT_ATTRIBUTE = DEAL_PAYMENT_PROOF_MIME_TYPES.join(',');

export const DEAL_PROOF_VALIDATION_MESSAGES_AR: Record<DealPaymentProofValidationError, string> = {
  [DEAL_PAYMENT_PROOF_REQUIRED]: 'يرجى اختيار ملف إيصال التحويل.',
  [DEAL_PAYMENT_PROOF_TOO_LARGE]: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت.',
  [DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE]: 'نوع الملف غير مدعوم. اختر PDF أو JPEG أو PNG.',
};

/**
 * Task 6.6: the browser half of the FR-30 guardrail. It narrows a `File` to the two fields the
 * shared validator reads, so the client refuses exactly what the API would refuse — one message
 * table, one code vocabulary.
 */
export function validateDealProofFile(
  file: Pick<File, 'size' | 'type'> | null | undefined,
): DealPaymentProofValidationError | null {
  if (!file) return DEAL_PAYMENT_PROOF_REQUIRED;
  return validateDealPaymentProofFile({ size: file.size, mimeType: file.type });
}

export interface DealProofFormValues {
  bankReferenceCode?: string;
  senderBankName?: string;
}

/**
 * Task 6.6: the exact body `POST /deals/:id/payments/:paymentType/proof` expects. Blank optional
 * fields are omitted rather than appended empty — the DTO validates length, and an empty string is
 * noise the administrator would have to read.
 */
export function buildDealProofFormData(file: File, values: DealProofFormValues = {}): FormData {
  const formData = new FormData();
  formData.append('file', file);

  const bankReferenceCode = values.bankReferenceCode?.trim();
  if (bankReferenceCode) formData.append('bankReferenceCode', bankReferenceCode);

  const senderBankName = values.senderBankName?.trim();
  if (senderBankName) formData.append('senderBankName', senderBankName);

  return formData;
}

export interface PaymentProofDropzoneProps {
  paymentType: DealPaymentType;
  /** Card title, used only to make the file input's label unique. */
  title?: string;
  disabled?: boolean;
  /** Why the zone is closed — deadline, review lock, terminal deal or a missing identity. */
  disabledReason?: string | null;
  isUploading?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  /** Resolves `true` when the API accepted the receipt, so the selection can be cleared. */
  onUpload: (file: File, values: DealProofFormValues) => Promise<boolean> | boolean;
}

/**
 * Story 5.2 / AC-7, UX-DR12: one receipt zone per card. Keyboard reachable (`role="button"` +
 * Enter/Space), drag-and-drop capable, and disabled — with a spoken reason — the moment the
 * deadline passes or the slot is locked.
 */
export function PaymentProofDropzone({
  paymentType,
  title,
  disabled = false,
  disabledReason = null,
  isUploading = false,
  errorMessage = null,
  successMessage = null,
  onUpload,
}: PaymentProofDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [bankReferenceCode, setBankReferenceCode] = useState('');
  const [senderBankName, setSenderBankName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputId = `deal-proof-file-${paymentType}`;
  const isInteractive = !disabled && !isUploading;

  const selectFile = (file: File | undefined) => {
    setLocalError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateDealProofFile(file);
    if (validationError) {
      setSelectedFile(null);
      setLocalError(DEAL_PROOF_VALIDATION_MESSAGES_AR[validationError]);
      return;
    }

    setSelectedFile(file);
  };

  const openPicker = () => {
    if (isInteractive) fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInteractive) return;
    if (!selectedFile) {
      setLocalError(DEAL_PROOF_VALIDATION_MESSAGES_AR[DEAL_PAYMENT_PROOF_REQUIRED]);
      return;
    }

    const accepted = await onUpload(selectedFile, { bankReferenceCode, senderBankName });
    if (accepted === false) return;

    setSelectedFile(null);
    setBankReferenceCode('');
    setSenderBankName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
      data-testid={`deal-proof-dropzone-${paymentType}`}
    >
      <label htmlFor={inputId} className="sr-only">
        {title ? `إيصال التحويل — ${title}` : 'إيصال التحويل'}
      </label>

      <div
        role="button"
        tabIndex={isInteractive ? 0 : -1}
        aria-disabled={!isInteractive}
        aria-label={disabledReason ?? PROOF_DROPZONE_TITLE_AR}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (isInteractive) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (isInteractive) selectFile(event.dataTransfer.files[0]);
        }}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 ${
          !isInteractive
            ? 'cursor-not-allowed border-surface-border bg-surface-sunken/60 opacity-70 dark:border-dark-surface-border'
            : isDragging
              ? 'border-primary bg-primary/5'
              : 'border-surface-border hover:border-primary dark:border-dark-surface-border'
        }`}
      >
        {selectedFile ? (
          <FileCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        ) : (
          <UploadCloud className="h-6 w-6 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
          {selectedFile ? selectedFile.name : PROOF_DROPZONE_TITLE_AR}
        </span>
        <span className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
          {PROOF_DROPZONE_FORMATS_AR}
        </span>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={DEAL_PROOF_ACCEPT_ATTRIBUTE}
          className="sr-only"
          disabled={!isInteractive}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </div>

      {disabledReason ? (
        <p
          role="status"
          className="rounded-lg border border-status-danger/20 bg-status-dangerBg p-2 text-xs font-semibold text-status-danger"
          data-testid={`deal-proof-lock-${paymentType}`}
        >
          {disabledReason}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor={`${inputId}-reference`}
              className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary"
            >
              رمز مرجع التحويل في الحوالة (اختياري)
            </label>
            <input
              id={`${inputId}-reference`}
              type="text"
              maxLength={64}
              value={bankReferenceCode}
              disabled={!isInteractive}
              onChange={(event) => setBankReferenceCode(event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-60 dark:border-dark-surface-border dark:bg-dark-surface-base dark:text-dark-ink-primary"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${inputId}-bank`}
              className="block text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary"
            >
              اسم البنك المُحوِّل (اختياري)
            </label>
            <input
              id={`${inputId}-bank`}
              type="text"
              maxLength={100}
              value={senderBankName}
              disabled={!isInteractive}
              onChange={(event) => setSenderBankName(event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-2 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:opacity-60 dark:border-dark-surface-border dark:bg-dark-surface-base dark:text-dark-ink-primary"
            />
          </div>
        </div>
      )}

      {isUploading ? (
        <div className="space-y-2" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-dark-surface-sunken">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            {PROOF_DROPZONE_UPLOADING_AR}
          </p>
        </div>
      ) : null}

      {localError ? (
        <p
          role="alert"
          className="rounded-lg border border-status-danger/20 bg-status-dangerBg p-2 text-xs text-status-danger"
        >
          {localError}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-status-danger/20 bg-status-dangerBg p-2 text-xs text-status-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          className="rounded-lg border border-status-verified/20 bg-status-verifiedBg p-2 text-xs text-status-verified"
        >
          {successMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={!isInteractive || !selectedFile}
        isLoading={isUploading}
      >
        {PROOF_DROPZONE_SUBMIT_AR}
      </Button>
    </form>
  );
}
