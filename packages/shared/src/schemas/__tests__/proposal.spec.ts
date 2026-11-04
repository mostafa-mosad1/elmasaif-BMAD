import { describe, it, expect } from 'vitest';
import {
  createProposalSchema,
  rejectProposalSchema,
  proposalQueueQuerySchema,
  ProposalStatus,
  MAX_LISTING_PRICE_SAR,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from '../../../src';

const DEMAND_UUID = '11111111-1111-1111-1111-111111111111';
const LISTING_UUID = '22222222-2222-2222-2222-222222222222';

const validProposal = {
  demandId: DEMAND_UUID,
  listingId: LISTING_UUID,
  proposedPrice: 1150000,
};

describe('createProposalSchema — binding SAR price (Story 3.7 / FR-23)', () => {
  it('accepts valid UUIDs plus a numeric price', () => {
    expect(createProposalSchema.safeParse(validProposal).success).toBe(true);
  });

  it('coerces a SAR price string through the listing askPrice idiom', () => {
    const parsed = createProposalSchema.parse({
      ...validProposal,
      proposedPrice: '1150000.00',
    });
    expect(parsed.proposedPrice).toBe(1150000);
  });

  it('rejects a non-UUID demandId or listingId', () => {
    expect(
      createProposalSchema.safeParse({ ...validProposal, demandId: 'not-a-uuid' }).success,
    ).toBe(false);
    expect(
      createProposalSchema.safeParse({ ...validProposal, listingId: 'villa-1' }).success,
    ).toBe(false);
  });

  it('rejects a price above MAX_LISTING_PRICE_SAR', () => {
    expect(
      createProposalSchema.safeParse({
        ...validProposal,
        proposedPrice: MAX_LISTING_PRICE_SAR + 1,
      }).success,
    ).toBe(false);
  });

  it('rejects a non-numeric price', () => {
    expect(
      createProposalSchema.safeParse({ ...validProposal, proposedPrice: 'غالي' }).success,
    ).toBe(false);
  });

  it('treats note as optional and caps it at 1000 chars', () => {
    expect(createProposalSchema.safeParse(validProposal).success).toBe(true);
    expect(
      createProposalSchema.safeParse({ ...validProposal, note: 'م'.repeat(1001) }).success,
    ).toBe(false);
  });
});

describe('rejectProposalSchema — mandatory reason (Story 3.7 / FR-23)', () => {
  it('requires a reason of at least 5 characters', () => {
    expect(rejectProposalSchema.safeParse({ reason: 'لا' }).success).toBe(false);
    expect(rejectProposalSchema.safeParse({}).success).toBe(false);
    expect(
      rejectProposalSchema.safeParse({ reason: 'العقار خارج النطاق المطلوب' }).success,
    ).toBe(true);
  });

  it('caps the reason at 500 characters', () => {
    expect(rejectProposalSchema.safeParse({ reason: 'س'.repeat(501) }).success).toBe(false);
  });
});

describe('proposalQueueQuerySchema — admin queue pagination (Story 3.7 / FR-23)', () => {
  it('defaults page/limit when nothing is supplied', () => {
    const parsed = proposalQueueQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsed.status).toBeUndefined();
  });

  it('caps the limit at MAX_PAGE_SIZE', () => {
    expect(proposalQueueQuerySchema.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it('coerces string page/limit query params', () => {
    const parsed = proposalQueueQuerySchema.parse({ page: '2', limit: '50' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it('accepts a valid status filter and rejects an unknown one', () => {
    expect(
      proposalQueueQuerySchema.safeParse({ status: ProposalStatus.PENDING_ADMIN_REVIEW }).success,
    ).toBe(true);
    expect(proposalQueueQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });
});

describe('Proposal lifecycle contract (Story 3.7)', () => {
  it('exposes the five canonical statuses with matching string values', () => {
    expect(ProposalStatus.PENDING_ADMIN_REVIEW).toBe('PENDING_ADMIN_REVIEW');
    expect(ProposalStatus.APPROVED_FOR_BUYER).toBe('APPROVED_FOR_BUYER');
    expect(ProposalStatus.REJECTED).toBe('REJECTED');
    expect(ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL).toBe(
      'SELECTED_PENDING_FINAL_ADMIN_APPROVAL',
    );
    expect(ProposalStatus.CLOSED).toBe('CLOSED');
  });
});
