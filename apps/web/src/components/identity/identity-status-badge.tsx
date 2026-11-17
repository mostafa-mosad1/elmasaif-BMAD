import React from 'react';
import { Check } from 'lucide-react';
import { VerificationStatus } from '@elmasaif/shared';

interface IdentityStatusBadgeProps {
  status: VerificationStatus;
}

const statusPresentation: Record<VerificationStatus, { label: string; className: string }> = {
  [VerificationStatus.NOT_UPLOADED]: {
    label: 'الهوية غير موثقة',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
  },
  [VerificationStatus.PENDING_REVIEW]: {
    label: 'قيد المراجعة والتدقيق',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  },
  [VerificationStatus.VERIFIED]: {
    label: 'الهوية موثقة ومعتمدة',
    className: 'bg-accent/10 text-accent border-accent/20'
  },
  [VerificationStatus.REJECTED]: {
    label: 'تم رفض وثيقة الهوية',
    className: 'bg-status-rejected/10 text-status-rejected border-status-rejected/20'
  }
};

export function IdentityStatusBadge({ status }: IdentityStatusBadgeProps) {
  const presentation = statusPresentation[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${presentation.className}`}>
      {status === VerificationStatus.VERIFIED && <Check className="h-4 w-4" aria-hidden="true" />}
      {presentation.label}
    </span>
  );
}
