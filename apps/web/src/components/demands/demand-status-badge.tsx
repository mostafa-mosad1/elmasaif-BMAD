import React from 'react';
import { DemandStatus, DEMAND_STATUS_LABELS_AR, StatusBadgeVariant } from '@elmasaif/shared';
import { Badge } from '../ui';

const DEMAND_STATUS_VARIANTS: Record<DemandStatus, StatusBadgeVariant> = {
  [DemandStatus.ACTIVE]: 'verified',
  [DemandStatus.MATCHED]: 'info',
  [DemandStatus.EXPIRED]: 'neutral',
  [DemandStatus.CANCELLED]: 'danger',
  [DemandStatus.CLOSED]: 'neutral',
};

export interface DemandStatusBadgeProps {
  status: DemandStatus | string;
  className?: string;
}

/**
 * Arabic lifecycle badge (Story 3.6 / FR-58). Every DemandStatus maps to a label via
 * `DEMAND_STATUS_LABELS_AR`, so a new status can never render blank.
 */
export function DemandStatusBadge({ status, className = '' }: DemandStatusBadgeProps) {
  const variant =
    DEMAND_STATUS_VARIANTS[status as DemandStatus] ?? 'neutral';
  const label =
    DEMAND_STATUS_LABELS_AR[status as DemandStatus] ?? String(status);

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
      data-testid={`demand-status-badge-${status}`}
    >
      {label}
    </Badge>
  );
}
