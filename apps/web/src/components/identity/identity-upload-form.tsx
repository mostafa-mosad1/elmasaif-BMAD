'use client';

import React, { FormEvent, useRef, useState } from 'react';
import { FileCheck, UploadCloud } from 'lucide-react';
import { IdentityDocumentType, IDENTITY_FILE_TOO_LARGE, IDENTITY_INVALID_DOCUMENT, IDENTITY_UNSUPPORTED_TYPE } from '@elmasaif/shared';
import { getApiBaseUrl } from '../../lib/api-client';
import { compressImageIfNeeded } from '../../lib/image-compression';
import { Button } from '../ui/button';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;
const ACCEPTED_FORMATS = ACCEPTED_MIME_TYPES.join(',');

interface IdentityUploadFormProps {
  onUploaded: () => void;
  maskedIdNumber?: string | null;
}

type UploadValidationError =
  | typeof IDENTITY_INVALID_DOCUMENT
  | typeof IDENTITY_FILE_TOO_LARGE
  | typeof IDENTITY_UNSUPPORTED_TYPE;

const validationMessages: Record<UploadValidationError, string> = {
  [IDENTITY_INVALID_DOCUMENT]: 'يرجى اختيار ملف غير فارغ.',
  [IDENTITY_FILE_TOO_LARGE]: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت.',
  [IDENTITY_UNSUPPORTED_TYPE]: 'نوع الملف غير مدعوم. اختر PDF أو JPEG أو PNG أو WEBP.'
};

export function validateIdentityUploadFile(
  file: Pick<File, 'size' | 'type'>
): UploadValidationError | null {
  if (file.size <= 0) {
    return IDENTITY_INVALID_DOCUMENT;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return IDENTITY_FILE_TOO_LARGE;
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
    return IDENTITY_UNSUPPORTED_TYPE;
  }
  return null;
}

export function IdentityUploadForm({ onUploaded, maskedIdNumber }: IdentityUploadFormProps) {
  const [documentType, setDocumentType] = useState(IdentityDocumentType.NATIONAL_ID);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = (file: File | undefined) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateIdentityUploadFile(file);
    if (validationError) {
      setSelectedFile(null);
      setErrorMessage(validationMessages[validationError]);
      return;
    }
    setSelectedFile(file);
  };

  const submitUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage('يرجى اختيار وثيقة الهوية أولاً.');
      return;
    }

    // Automatically compress image if needed to remain within Vercel's 4.5MB payload limit
    let fileToUpload = selectedFile;
    try {
      fileToUpload = await compressImageIfNeeded(selectedFile);
    } catch {
      fileToUpload = selectedFile;
    }

    if (fileToUpload.size > 4.2 * 1024 * 1024) {
      setErrorMessage('حجم الملف يتجاوز الحد الأقصى المسموح به (4 ميجابايت). يرجى اختيار ملف أصغر أو ضغط ملف الـ PDF.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('documentType', documentType);

    const request = new XMLHttpRequest();
    request.open('POST', `${getApiBaseUrl()}/users/identity/upload`);
    request.withCredentials = true;
    setIsUploading(true);
    setIsScanning(false);
    setProgress(0);
    setErrorMessage(null);
    setSuccessMessage(null);

    request.upload.onprogress = (uploadEvent) => {
      if (uploadEvent.lengthComputable) {
        const nextProgress = Math.min(100, Math.round((uploadEvent.loaded / uploadEvent.total) * 100));
        setProgress(nextProgress);
        setIsScanning(nextProgress === 100);
      }
    };

    request.onload = () => {
      if (request.status === 413) {
        setErrorMessage('حجم الملف كبير جداً ويتجاوز الحد الأقصى المسموح به على الخادم (4 ميجابايت).');
        setIsUploading(false);
        setIsScanning(false);
        return;
      }

      let payload: { message?: string; data?: unknown } | null = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        setErrorMessage('تعذر قراءة استجابة الخادم. حاول مرة أخرى.');
        setIsUploading(false);
        setIsScanning(false);
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        setProgress(100);
        setSuccessMessage('تم استلام الوثيقة وفحصها بنجاح، وهي الآن بانتظار المراجعة.');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploaded();
      } else {
        setErrorMessage(payload?.message || 'تعذر رفع الوثيقة. حاول مرة أخرى.');
      }
      setIsUploading(false);
      setIsScanning(false);
    };

    request.onerror = () => {
      setErrorMessage('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.');
      setIsUploading(false);
      setIsScanning(false);
    };
    request.onabort = () => {
      setErrorMessage('تم إلغاء رفع الوثيقة.');
      setIsUploading(false);
      setIsScanning(false);
    };
    request.send(formData);
  };

  return (
    <form onSubmit={submitUpload} className="space-y-6" dir="rtl">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">نوع الوثيقة</p>
        <div className="inline-flex rounded-xl border border-surface-border dark:border-dark-surface-border p-1">
          {[
            { type: IdentityDocumentType.NATIONAL_ID, label: 'هوية وطنية' },
            { type: IdentityDocumentType.IQAMA, label: 'إقامة نظامية' }
          ].map((option) => (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={documentType === option.type}
              onClick={() => setDocumentType(option.type)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                documentType === option.type
                  ? 'bg-primary text-primary-foreground'
                  : 'text-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {maskedIdNumber && (
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          رقم الهوية المسجل: <span className="font-mono" dir="ltr">{maskedIdNumber}</span>
        </p>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="اختر ملف وثيقة الهوية"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-surface-border hover:border-primary dark:border-dark-surface-border'
        }`}
      >
        {selectedFile ? (
          <FileCheck className="h-8 w-8 text-primary" aria-hidden="true" />
        ) : (
          <UploadCloud className="h-8 w-8 text-primary" aria-hidden="true" />
        )}
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
          {selectedFile ? selectedFile.name : 'اسحب الوثيقة إلى هنا أو اختر ملفاً'}
        </span>
        <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
          PDF, JPEG, PNG, WEBP (حتى 10 ميجابايت)
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          className="sr-only"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </div>

      {isUploading && (
        <div className="space-y-2" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-dark-surface-sunken">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
            {isScanning ? 'اكتمل الرفع، جارٍ الفحص الأمني...' : `جارٍ رفع الوثيقة... ${progress}%`}
          </p>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-lg border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="rounded-lg border border-status-verified/20 bg-status-verifiedBg p-3 text-sm text-status-verified">
          {successMessage}
        </p>
      )}

      <Button type="submit" disabled={!selectedFile || isUploading} isLoading={isUploading}>
        إرسال وثيقة الهوية
      </Button>
    </form>
  );
}
