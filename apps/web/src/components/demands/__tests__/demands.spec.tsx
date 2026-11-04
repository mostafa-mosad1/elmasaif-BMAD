import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DemandStatus, PropertyType } from '@elmasaif/shared';
import {
  DemandsGrid,
  unwrapDemandsPayload,
} from '../demands-view';
import { DemandStatusBadge } from '../demand-status-badge';
import { BuyerDemandItem } from '../demand-item';

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

const demandItem = (
  id: string,
  overrides: Partial<BuyerDemandItem> = {},
): BuyerDemandItem => ({
  id,
  propertyType: PropertyType.VILLA,
  status: DemandStatus.ACTIVE,
  cityId: '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11',
  districtId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  cityName: 'الطائف',
  districtName: 'الشهراء',
  minBudget: 800000,
  maxBudget: 1500000,
  minArea: 250,
  maxArea: 450,
  notes: 'فيلا شمال الطائف',
  expiresAt: '2026-12-04T12:00:00.000Z',
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-11-04T12:00:00.000Z',
  ...overrides,
});

describe('unwrapDemandsPayload (Story 3.6 / AC#3)', () => {
  it('reads items from the wrapped { statusCode, data: { items } } envelope', () => {
    const items = [demandItem('a'), demandItem('b')];
    expect(unwrapDemandsPayload({ data: { items } })).toEqual(items);
  });

  it('also accepts the bare { items } shape so envelope drift never breaks the page', () => {
    const items = [demandItem('c')];
    expect(unwrapDemandsPayload({ items })).toEqual(items);
  });

  it('returns [] for null, empty, or malformed payloads', () => {
    expect(unwrapDemandsPayload(null)).toEqual([]);
    expect(unwrapDemandsPayload(undefined)).toEqual([]);
    expect(unwrapDemandsPayload({})).toEqual([]);
    expect(unwrapDemandsPayload({ data: {} })).toEqual([]);
    expect(unwrapDemandsPayload({ items: null })).toEqual([]);
  });
});

describe('DemandStatusBadge (Story 3.6 / AC#3)', () => {
  it('renders the Arabic label for every lifecycle status', () => {
    const cases: Array<[DemandStatus, string]> = [
      [DemandStatus.ACTIVE, 'نشط'],
      [DemandStatus.MATCHED, 'تمت مطابقته'],
      [DemandStatus.EXPIRED, 'منتهي الصلاحية'],
      [DemandStatus.CANCELLED, 'ملغي'],
      [DemandStatus.CLOSED, 'مغلق'],
    ];
    for (const [status, label] of cases) {
      const html = renderToString(<DemandStatusBadge status={status} />);
      expect(html).toContain(`demand-status-badge-${status}`);
      expect(html).toContain(label);
    }
  });
});

describe('DemandsGrid (Story 3.6 / AC#3, AC#4)', () => {
  it('renders one card per demand with its structured geography and ranges', () => {
    const items = [demandItem('d1'), demandItem('d2', { cityName: 'الرياض' })];
    const html = renderToString(<DemandsGrid items={items} onCancel={() => {}} />);

    expect(html).toContain('data-testid="demands-grid"');
    expect(html).toContain('data-testid="demand-card-d1"');
    expect(html).toContain('data-testid="demand-card-d2"');
    expect(html).toContain('الطائف');
    expect(html).toContain('الرياض');
    expect(html).toContain('800,000');
    expect(html).toContain('1,500,000');
  });

  it('shows the cancel affordance for ACTIVE and MATCHED rows only', () => {
    const active = renderToString(
      <DemandsGrid items={[demandItem('live')]} onCancel={() => {}} />,
    );
    expect(active).toContain('data-testid="demand-cancel-btn-live"');

    const matched = renderToString(
      <DemandsGrid
        items={[demandItem('mat', { status: DemandStatus.MATCHED })]}
        onCancel={() => {}}
      />,
    );
    expect(matched).toContain('data-testid="demand-cancel-btn-mat"');

    for (const status of [DemandStatus.EXPIRED, DemandStatus.CANCELLED, DemandStatus.CLOSED]) {
      const html = renderToString(
        <DemandsGrid items={[demandItem('gone', { status })]} onCancel={() => {}} />,
      );
      expect(html).not.toContain('data-testid="demand-cancel-btn-gone"');
    }
  });

  it('renders the cancelled badge and reason for a CANCELLED row', () => {
    const html = renderToString(
      <DemandsGrid
        items={[
          demandItem('cxl', {
            status: DemandStatus.CANCELLED,
            cancelReason: 'تم الشراء خارج المنصة',
            cancelledAt: '2026-11-05T09:00:00.000Z',
          }),
        ]}
        onCancel={() => {}}
      />,
    );

    expect(html).toContain('demand-status-badge-CANCELLED');
    expect(html).toContain('ملغي');
    expect(html).toContain('تم الشراء خارج المنصة');
    expect(html).not.toContain('data-testid="demand-expiry-window"');
  });

  it('renders no cards for an empty lifecycle list', () => {
    const html = renderToString(<DemandsGrid items={[]} onCancel={() => {}} />);
    expect(html).toContain('data-testid="demands-grid"');
    expect(html).not.toContain('data-testid="demand-card-');
  });
});
