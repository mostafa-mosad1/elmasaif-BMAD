import React from 'react';
import {
  INQUIRY_STATUS_BADGE_VARIANTS,
  INQUIRY_STATUS_LABELS_AR,
  InquiryStatus,
} from '@elmasaif/shared';
import { Badge } from '../ui';

export interface InquiryStatusBadgeProps {
  status: InquiryStatus | string;
  className?: string;
}

/**
 * Arabic mediated-inquiry lifecycle badge (Story 4.4 / AC-3, AC-5). The label and variant maps
 * are exhaustive `Record<InquiryStatus, …>` in `@elmasaif/shared`, so a new status cannot render
 * blank and the web can never disagree with the API about the wording.
 */
export function InquiryStatusBadge({ status, className = '' }: InquiryStatusBadgeProps) {
  const variant = INQUIRY_STATUS_BADGE_VARIANTS[status as InquiryStatus] ?? 'neutral';
  const label = INQUIRY_STATUS_LABELS_AR[status as InquiryStatus] ?? String(status);

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
      data-testid={`inquiry-status-badge-${status}`}
    >
      {label}
    </Badge>
  );
}
