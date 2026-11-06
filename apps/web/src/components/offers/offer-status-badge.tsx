import React from 'react';
import { OFFER_STATUS_LABELS_AR, OfferStatus, StatusBadgeVariant } from '@elmasaif/shared';
import { Badge } from '../ui';

const OFFER_STATUS_VARIANTS: Record<OfferStatus, StatusBadgeVariant> = {
  [OfferStatus.PENDING_ADMIN_REVIEW]: 'pending',
  [OfferStatus.SUBMITTED]: 'pending',
  [OfferStatus.IN_REVIEW]: 'pending',
  [OfferStatus.RELAYED_TO_SELLER]: 'info',
  [OfferStatus.ACCEPTED_BY_SELLER]: 'info',
  [OfferStatus.REJECTED_BY_SELLER]: 'danger',
  [OfferStatus.COUNTER_OFFERED]: 'info',
  [OfferStatus.ACCEPTED_BY_BUYER]: 'verified',
  [OfferStatus.EXPIRED]: 'neutral',
  [OfferStatus.WITHDRAWN]: 'neutral',
};

export interface OfferStatusBadgeProps {
  status: OfferStatus | string;
  className?: string;
}

/**
 * Arabic offer lifecycle badge (Story 4.1 / FR-25). Every `OfferStatus` maps to a label via
 * `OFFER_STATUS_LABELS_AR`, so a new status can never render blank.
 */
export function OfferStatusBadge({ status, className = '' }: OfferStatusBadgeProps) {
  const variant = OFFER_STATUS_VARIANTS[status as OfferStatus] ?? 'neutral';
  const label = OFFER_STATUS_LABELS_AR[status as OfferStatus] ?? String(status);

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
      data-testid={`offer-status-badge-${status}`}
    >
      {label}
    </Badge>
  );
}
