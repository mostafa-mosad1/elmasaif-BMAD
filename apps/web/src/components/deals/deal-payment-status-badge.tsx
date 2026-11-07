import React from 'react';
import {
  DEAL_PAYMENT_STATUS_LABELS_AR,
  DEAL_PAYMENT_STATUS_VARIANTS,
  type DealPaymentStatus,
} from '@elmasaif/shared';
import { Badge } from '../ui/badge';

/**
 * One slot's lifecycle chip. `DEAL_PAYMENT_STATUS_VARIANTS` is exhaustive in shared, so this
 * component never needs a local colour table (trap T-8).
 */
export interface DealPaymentStatusBadgeProps {
  status: DealPaymentStatus | string;
  className?: string;
}

export function DealPaymentStatusBadge({ status, className }: DealPaymentStatusBadgeProps) {
  const variant = DEAL_PAYMENT_STATUS_VARIANTS[status as DealPaymentStatus] ?? 'neutral';
  const label = DEAL_PAYMENT_STATUS_LABELS_AR[status as DealPaymentStatus] ?? String(status);

  return (
    <Badge
      variant={variant}
      className={className}
      data-testid={`deal-payment-status-${status}`}
    >
      {label}
    </Badge>
  );
}
