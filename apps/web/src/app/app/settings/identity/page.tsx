'use client';

import React, { useEffect, useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { VerificationStatus } from '@elmasaif/shared';
import { useAuth } from '../../../../components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { IdentityDocumentPreview } from '../../../../components/identity/identity-document-preview';
import { IdentityStatusBadge } from '../../../../components/identity/identity-status-badge';
import { IdentityUploadForm } from '../../../../components/identity/identity-upload-form';

export default function IdentitySettingsPage() {
  const { identityStatus, refreshIdentityStatus } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    refreshIdentityStatus().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحميل حالة الهوية.');
    });
  }, [refreshIdentityStatus]);

  const refreshAfterUpload = async () => {
    try {
      await refreshIdentityStatus();
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحديث حالة الهوية.');
    }
  };

  const canUpload = !identityStatus ||
    identityStatus.status === VerificationStatus.NOT_UPLOADED ||
    identityStatus.status === VerificationStatus.REJECTED;

  return (
    <div dir="rtl" lang="ar" className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted dark:text-dark-ink-muted">المصايف</p>
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              توثيق الهوية الوطنية / الإقامة
            </h1>
          </div>
        </div>
        <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-ink-secondary dark:text-dark-ink-secondary">
          وفقاً للأنظمة واللوائح العقارية في المملكة العربية السعودية، يلزم التحقق من الهوية الوطنية للمواطنين أو الإقامة النظامية للمقيمين قبل إتمام أي تعاملات مالية أو تقديم عروض شراء ملزمة.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            حالة التوثيق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <IdentityStatusBadge
            status={identityStatus?.status || VerificationStatus.NOT_UPLOADED}
          />
          {identityStatus?.status === VerificationStatus.PENDING_REVIEW && (
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              تم استلام وثيقة الهوية وهي قيد الفحص الأمني والمراجعة الإدارية.
            </p>
          )}
          {identityStatus?.status === VerificationStatus.REJECTED && (
            <p role="alert" className="rounded-lg border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected">
              سبب الرفض: {identityStatus.rejectionReason || 'يرجى إعادة رفع وثيقة واضحة.'}
            </p>
          )}
          {identityStatus?.uploadedAt && (
            <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
              تاريخ الإرسال: {new Date(identityStatus.uploadedAt).toLocaleDateString('ar-SA')}
            </p>
          )}
          <IdentityDocumentPreview isUploaded={identityStatus?.isUploaded ?? false} />
        </CardContent>
      </Card>

      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle>
              {identityStatus?.status === VerificationStatus.REJECTED
                ? 'إعادة رفع الوثيقة'
                : 'رفع وثيقة الهوية'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IdentityUploadForm
              onUploaded={refreshAfterUpload}
              maskedIdNumber={identityStatus?.maskedIdNumber}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
