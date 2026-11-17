'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
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
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={openDocument} isLoading={isLoading}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        عرض الوثيقة المرفوعة
      </Button>
      {errorMessage && <p role="alert" className="text-sm text-status-rejected">{errorMessage}</p>}
      {fallbackUrl && (
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline">
          فتح الوثيقة في نافذة جديدة
        </a>
      )}
    </div>
  );
}
