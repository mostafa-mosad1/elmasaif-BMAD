import React from 'react';
import { DealStatus, DEAL_STATUS_LABELS_AR, type StatusBadgeVariant } from '@elmasaif/shared';
import { Badge } from '../ui/badge';

/**
 * Story 5.2 / AC-13: an exhaustive map, not `Record<string, …>` — a new `DealStatus` member
 * breaks `tsc` here until it is given a colour. The labels themselves live in shared so the API
 * refusals and the screen cannot drift apart.
 */
export const DEAL_STATUS_VARIANTS: Record<DealStatus, StatusBadgeVariant> = {
  [DealStatus.AWAITING_PAYMENT_PROOF]: 'pending',
  [DealStatus.UNDER_ADMIN_AUDIT]: 'info',
  [DealStatus.PAYMENT_REJECTED]: 'danger',
  [DealStatus.DISPUTED]: 'warning',
  [DealStatus.COMPLETED]: 'verified',
  [DealStatus.CANCELLED]: 'neutral',
  [DealStatus.TERMINATED]: 'neutral',
};

export interface DealStatusBadgeProps {
  status: DealStatus | string;
  className?: string;
}

export function DealStatusBadge({ status, className }: DealStatusBadgeProps) {
  const variant = DEAL_STATUS_VARIANTS[status as DealStatus] ?? 'neutral';
  const label = DEAL_STATUS_LABELS_AR[status as DealStatus] ?? String(status);

  return (
    <Badge variant={variant} className={className} data-testid={`deal-status-badge-${status}`}>
      {label}
    </Badge>
  );
}
