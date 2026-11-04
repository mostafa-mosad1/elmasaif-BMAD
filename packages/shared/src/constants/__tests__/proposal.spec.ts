import { describe, it, expect } from 'vitest';
import {
  PROPOSAL_NOT_FOUND,
  PROPOSAL_FORBIDDEN,
  PROPOSAL_DUPLICATE,
  PROPOSAL_NOT_APPROVABLE,
  PROPOSAL_NOT_SELECTABLE,
  PROPOSAL_REJECT_REASON_REQUIRED,
  PROPOSAL_DEMAND_NOT_MINE,
  PROPOSAL_STATUS_LABELS_AR,
  MATCH_AREA_TOLERANCE_PERCENT,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  ProposalStatus,
} from '../../index';

describe('Provider Proposal Constants (Story 3.7 / FR-22, FR-23, FR-24)', () => {
  it('exposes the structured error codes consumed by the API and the web', () => {
    expect(PROPOSAL_NOT_FOUND).toBe('PROPOSAL_NOT_FOUND');
    expect(PROPOSAL_FORBIDDEN).toBe('PROPOSAL_FORBIDDEN');
    expect(PROPOSAL_DUPLICATE).toBe('PROPOSAL_DUPLICATE');
    expect(PROPOSAL_NOT_APPROVABLE).toBe('PROPOSAL_NOT_APPROVABLE');
    expect(PROPOSAL_NOT_SELECTABLE).toBe('PROPOSAL_NOT_SELECTABLE');
    expect(PROPOSAL_REJECT_REASON_REQUIRED).toBe('PROPOSAL_REJECT_REASON_REQUIRED');
    expect(PROPOSAL_DEMAND_NOT_MINE).toBe('PROPOSAL_DEMAND_NOT_MINE');
  });

  it('labels every ProposalStatus in Arabic with no gaps', () => {
    const statuses = Object.values(ProposalStatus);
    expect(statuses).toHaveLength(5);
    for (const status of statuses) {
      expect(PROPOSAL_STATUS_LABELS_AR[status]).toBeTruthy();
    }
    expect(PROPOSAL_STATUS_LABELS_AR[ProposalStatus.PENDING_ADMIN_REVIEW]).toBe('قيد المراجعة');
    expect(PROPOSAL_STATUS_LABELS_AR[ProposalStatus.APPROVED_FOR_BUYER]).toBe('متاح للمشترى');
    expect(PROPOSAL_STATUS_LABELS_AR[ProposalStatus.REJECTED]).toBe('مرفوض');
    expect(PROPOSAL_STATUS_LABELS_AR[ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL]).toBe(
      'مختار بانتظار الاعتماد النهائي',
    );
    expect(PROPOSAL_STATUS_LABELS_AR[ProposalStatus.CLOSED]).toBe('مغلق');
  });

  it('pins the ±20% FR-22 area tolerance', () => {
    expect(MATCH_AREA_TOLERANCE_PERCENT).toBe(0.2);
  });

  it('reuses (does not redefine) the listing price envelope', () => {
    expect(MIN_LISTING_PRICE_SAR).toBe(1);
    expect(MAX_LISTING_PRICE_SAR).toBe(50_000_000);
  });
});
