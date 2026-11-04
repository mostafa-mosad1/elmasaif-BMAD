import React from 'react';
import { ProposalStatus, PROPOSAL_STATUS_LABELS_AR, StatusBadgeVariant } from '@elmasaif/shared';
import { Badge } from '../ui';

const PROPOSAL_STATUS_VARIANTS: Record<ProposalStatus, StatusBadgeVariant> = {
  [ProposalStatus.PENDING_ADMIN_REVIEW]: 'pending',
  [ProposalStatus.APPROVED_FOR_BUYER]: 'info',
  [ProposalStatus.REJECTED]: 'danger',
  [ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL]: 'verified',
  [ProposalStatus.CLOSED]: 'neutral',
};

export interface ProposalStatusBadgeProps {
  status: ProposalStatus | string;
  className?: string;
}

/**
 * Arabic proposal-lifecycle badge (Story 3.7 / FR-23, FR-24). Every ProposalStatus maps to a
 * label via `PROPOSAL_STATUS_LABELS_AR`, so a new status can never render blank — same idiom
 * as `DemandStatusBadge`.
 */
export function ProposalStatusBadge({ status, className = '' }: ProposalStatusBadgeProps) {
  const variant = PROPOSAL_STATUS_VARIANTS[status as ProposalStatus] ?? 'neutral';
  const label = PROPOSAL_STATUS_LABELS_AR[status as ProposalStatus] ?? String(status);

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
      data-testid={`proposal-status-badge-${status}`}
    >
      {label}
    </Badge>
  );
}
