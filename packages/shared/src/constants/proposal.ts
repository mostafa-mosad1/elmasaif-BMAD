import { ProposalStatus } from '../enums';

// Provider Proposal & Demand Matching constants (Story 3.7 / FR-22, FR-23, FR-24)
export const PROPOSAL_NOT_FOUND = 'PROPOSAL_NOT_FOUND';
export const PROPOSAL_FORBIDDEN = 'PROPOSAL_FORBIDDEN';
export const PROPOSAL_DUPLICATE = 'PROPOSAL_DUPLICATE';
export const PROPOSAL_NOT_APPROVABLE = 'PROPOSAL_NOT_APPROVABLE';
export const PROPOSAL_NOT_SELECTABLE = 'PROPOSAL_NOT_SELECTABLE';
export const PROPOSAL_REJECT_REASON_REQUIRED = 'PROPOSAL_REJECT_REASON_REQUIRED';
export const PROPOSAL_DEMAND_NOT_MINE = 'PROPOSAL_DEMAND_NOT_MINE';

export const PROPOSAL_STATUS_LABELS_AR: Record<ProposalStatus, string> = {
  [ProposalStatus.PENDING_ADMIN_REVIEW]: 'قيد المراجعة',
  [ProposalStatus.APPROVED_FOR_BUYER]: 'متاح للمشترى',
  [ProposalStatus.REJECTED]: 'مرفوض',
  [ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL]: 'مختار بانتظار الاعتماد النهائي',
  [ProposalStatus.CLOSED]: 'مغلق',
};

// FR-22: a listing qualifies when its area is within ±20% of the demand's min/max range.
export const MATCH_AREA_TOLERANCE_PERCENT = 0.2;
