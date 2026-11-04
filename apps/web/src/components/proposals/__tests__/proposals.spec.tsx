import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProposalStatus, PropertyType } from '@elmasaif/shared';
import {
  unwrapMatchingDemandsPayload,
  MatchingDemandsGrid,
} from '../matching-demands-view';
import { unwrapProposalsPayload, BuyerProposalsList } from '../buyer-proposals-list';
import { ProposalStatusBadge } from '../proposal-status-badge';
import { BuyerProposalItem, MatchingDemandItem } from '../proposal-item';

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: Object.assign(
      () => Promise.resolve({}),
      {
        get: vi.fn(() => Promise.resolve({ statusCode: 200, data: { items: [] } })),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
    ),
  };
});

const matchingDemand = (
  demandId: string,
  overrides: Partial<MatchingDemandItem> = {},
): MatchingDemandItem => ({
  demandId,
  propertyType: PropertyType.VILLA,
  status: 'MATCHED',
  cityId: '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11',
  districtId: null,
  cityName: 'الطائف',
  districtName: null,
  minBudget: 800000,
  maxBudget: 1500000,
  minArea: 250,
  maxArea: 450,
  notes: 'فيلا شمال الطائف',
  createdAt: '2026-11-04T12:00:00.000Z',
  matchedListings: [
    { listingId: 'l-1', title: 'فيلا الصفى', askPrice: 1200000, areaSquareMeters: 300 },
  ],
  ...overrides,
});

const buyerProposal = (
  id: string,
  overrides: Partial<BuyerProposalItem> = {},
): BuyerProposalItem => ({
  id,
  demandId: 'd-1',
  listingId: 'l-1',
  providerProfileId: 'p-1',
  status: ProposalStatus.APPROVED_FOR_BUYER,
  proposedPrice: 1150000,
  note: 'جاهز للتسجيل',
  rejectReason: null,
  selectedAt: null,
  createdAt: '2026-11-04T12:00:00.000Z',
  providerName: 'هشام',
  listing: {
    id: 'l-1',
    title: 'فيلا الصفى',
    propertyType: PropertyType.VILLA,
    cityId: '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11',
    districtId: null,
    cityName: 'الطائف',
    districtName: null,
    askPrice: 1200000,
    areaSquareMeters: 300,
  },
  ...overrides,
});

describe('unwrapMatchingDemandsPayload (Story 3.7 / AC#2)', () => {
  it('reads items from the wrapped { statusCode, data: { items } } envelope', () => {
    const items = [matchingDemand('a')];
    expect(unwrapMatchingDemandsPayload({ data: { items } })).toEqual(items);
  });

  it('also accepts the bare { items } shape', () => {
    const items = [matchingDemand('c')];
    expect(unwrapMatchingDemandsPayload({ items })).toEqual(items);
  });

  it('returns [] for null, empty, or malformed payloads', () => {
    expect(unwrapMatchingDemandsPayload(null)).toEqual([]);
    expect(unwrapMatchingDemandsPayload(undefined)).toEqual([]);
    expect(unwrapMatchingDemandsPayload({})).toEqual([]);
    expect(unwrapMatchingDemandsPayload({ data: {} })).toEqual([]);
    expect(unwrapMatchingDemandsPayload({ items: null })).toEqual([]);
  });
});

describe('unwrapProposalsPayload (Story 3.7 / AC#5)', () => {
  it('tolerates bare and enveloped shapes', () => {
    const items = [buyerProposal('p1')];
    expect(unwrapProposalsPayload({ items })).toEqual(items);
    expect(unwrapProposalsPayload({ data: { items } })).toEqual(items);
    expect(unwrapProposalsPayload(null)).toEqual([]);
  });
});

describe('ProposalStatusBadge (Story 3.7 / AC#4)', () => {
  it('renders the Arabic label for every lifecycle status', () => {
    const cases: Array<[ProposalStatus, string]> = [
      [ProposalStatus.PENDING_ADMIN_REVIEW, 'قيد المراجعة'],
      [ProposalStatus.APPROVED_FOR_BUYER, 'متاح للمشترى'],
      [ProposalStatus.REJECTED, 'مرفوض'],
      [ProposalStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, 'مختار بانتظار الاعتماد النهائي'],
      [ProposalStatus.CLOSED, 'مغلق'],
    ];
    for (const [status, label] of cases) {
      const html = renderToString(<ProposalStatusBadge status={status} />);
      expect(html).toContain(`proposal-status-badge-${status}`);
      expect(html).toContain(label);
    }
  });
});

describe('MatchingDemandsGrid (Story 3.7 / AC#1, AC#2)', () => {
  it('renders one card per matching demand with its ranges and a propose affordance', () => {
    const html = renderToString(
      <MatchingDemandsGrid
        items={[matchingDemand('d1'), matchingDemand('d2', { cityName: 'الرياض' })]}
        proposedDemandIds={new Set()}
        onProposed={() => {}}
      />,
    );

    expect(html).toContain('data-testid="matching-demands-grid"');
    expect(html).toContain('data-testid="matching-demand-card-d1"');
    expect(html).toContain('data-testid="matching-demand-propose-btn-d1"');
    expect(html).toContain('الطائف');
    expect(html).toContain('الرياض');
    expect(html).toContain('1,500,000');
  });

  it('shows the "already proposed" marker instead of the affordance for a proposed demand', () => {
    const html = renderToString(
      <MatchingDemandsGrid
        items={[matchingDemand('d1')]}
        proposedDemandIds={new Set(['d1'])}
        onProposed={() => {}}
      />,
    );
    expect(html).toContain('data-testid="matching-demand-proposed-d1"');
    expect(html).not.toContain('data-testid="matching-demand-propose-btn-d1"');
  });

  it('renders no cards for an empty matching list', () => {
    const html = renderToString(
      <MatchingDemandsGrid items={[]} proposedDemandIds={new Set()} onProposed={() => {}} />,
    );
    expect(html).toContain('data-testid="matching-demands-grid"');
    expect(html).not.toContain('data-testid="matching-demand-card-');
  });
});

describe('BuyerProposalsList (Story 3.7 / AC#5)', () => {
  it('renders approved rows with a select affordance and hides it for closed rows', () => {
    const html = renderToString(
      <BuyerProposalsList
        proposals={[
          buyerProposal('approved-1'),
          buyerProposal('closed-1', { status: ProposalStatus.CLOSED }),
        ]}
        onSelect={() => {}}
      />,
    );

    expect(html).toContain('data-testid="buyer-proposals-list"');
    expect(html).toContain('data-testid="buyer-proposal-row-approved-1"');
    expect(html).toContain('data-testid="buyer-proposal-select-approved-1"');
    expect(html).toContain('proposal-status-badge-APPROVED_FOR_BUYER');
    expect(html).toContain('متاح للمشترى');

    // Closed row renders its badge but NOT a select button.
    expect(html).toContain('proposal-status-badge-CLOSED');
    expect(html).toContain('مغلق');
    expect(html).not.toContain('data-testid="buyer-proposal-select-closed-1"');

    // Price + provider broker badge surface.
    expect(html).toContain('1,150,000');
    expect(html).toContain('هشام');
  });
});
