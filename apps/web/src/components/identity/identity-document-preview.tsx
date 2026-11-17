'use client';

import React, { useState } from 'react';
import { Eye, FileText, ExternalLink } from 'lucide-react';
import { apiClient, normalizeStorageUrl } from '../../lib/api-client';
import { Button } from '../ui/button';

interface IdentityDocumentPreviewProps {
  isUploaded: boolean;
}

interface DocumentUrlResponse {
  data: {
    downloadUrl: string;
    expiresIn: number;
  };
}

export function IdentityDocumentPreview({ isUploaded }: IdentityDocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  if (!isUploaded) {
    return null;
  }

  const openDocument = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setFallbackUrl(null);
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) {
      previewWindow.opener = null;
    }

    try {
      const response = await apiClient.get<DocumentUrlResponse>('/users/identity/document-url');
      const targetUrl = normalizeStorageUrl(response.data.downloadUrl);
      setFallbackUrl(targetUrl);
      if (previewWindow) {
        previewWindow.location.href = targetUrl;
      }
    } catch (error) {
      previewWindow?.close();
      setErrorMessage(error instanceof Error ? error.message : 'تعذر فتح الوثيقة المرفوعة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
              ملف وثيقة الهوية الوطنية المرفوع
            </p>
            <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
              مشفر ومحمي في خوادم سحابية آمنة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openDocument}
            isLoading={isLoading}
            className="text-xs"
          >
            <Eye className="h-3.5 w-3.5 ms-1" aria-hidden="true" />
            معاينة الوثيقة
          </Button>

          {fallbackUrl && (
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              نافذة جديدة
            </a>
          )}
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-status-rejected font-medium">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
