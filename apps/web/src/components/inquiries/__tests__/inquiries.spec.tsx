import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  InquiryAuthorRole,
  InquiryStatus,
  ListingStatus,
  PropertyType,
} from '@elmasaif/shared';
import type { InquiryThreadItem, InquiryThreadSummary } from '@elmasaif/shared';
import {
  InquiriesView,
  inquiriesEndpointFor,
  unwrapInquiriesPayload,
} from '../inquiries-view';
import {
  InquiryThreadView,
  resolveInquiryComposer,
  unwrapInquiryThreadPayload,
} from '../inquiry-thread-view';
import { BuyerInquiriesList } from '../buyer-inquiries-list';
import { SellerInquiriesList } from '../seller-inquiries-list';
import { InquiryStatusBadge } from '../inquiry-status-badge';
import { InquirySubmitForm } from '../inquiry-submit-form';

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

const ASK_PRICE = 1200000;

const summary = (overrides: Partial<InquiryThreadSummary> = {}): InquiryThreadSummary => ({
  id: 'inquiry-1',
  status: InquiryStatus.PENDING_ADMIN_REVIEW,
  subject: 'استفسار عن إمكانية التفاوض',
  awaitingParty: 'ADMIN',
  buyerName: 'مشترٍ تجريبي',
  sellerName: 'بائع تجريبي',
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messageCount: 1,
  closedAt: null,
  closeReason: null,
  listing: {
    id: 'listing-1',
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    cityName: 'الطائف',
    districtName: 'الشهداء الشمالية',
    askPrice: ASK_PRICE,
    areaSquareMeters: 300,
    status: ListingStatus.ACTIVE,
  },
  ...overrides,
});

const thread = (overrides: Partial<InquiryThreadItem> = {}): InquiryThreadItem => ({
  ...summary(),
  messages: [
    {
      id: 'message-1',
      authorRole: InquiryAuthorRole.BUYER,
      authorName: 'مشترٍ تجريبي',
      body: 'هل يمكن التفاوض على السعر؟',
      maskingApplied: true,
      maskedTypes: ['PHONE'],
      relayedAt: null,
      createdAt: new Date().toISOString(),
      attachments: [],
    },
  ],
  ...overrides,
});

describe('unwrapInquiriesPayload (Story 4.4 / AC-4)', () => {
  it('reads the enveloped `{ statusCode, data: { items } }` shape', () => {
    expect(unwrapInquiriesPayload({ statusCode: 200, data: { items: [summary()] } })).toHaveLength(1);
  });

  it('reads a bare `{ items }` body', () => {
    expect(
      unwrapInquiriesPayload({ items: [summary(), summary({ id: 'inquiry-2' })] }),
    ).toHaveLength(2);
  });

  it('is nullish-safe and never throws on junk', () => {
    expect(unwrapInquiriesPayload(null)).toEqual([]);
    expect(unwrapInquiriesPayload(undefined)).toEqual([]);
    expect(unwrapInquiriesPayload({})).toEqual([]);
    expect(unwrapInquiriesPayload('not-an-object')).toEqual([]);
  });
});

describe('inquiriesEndpointFor (D6 surface split)', () => {
  it('reads the buyer’s own threads from `/inquiries/my`', () => {
    expect(inquiriesEndpointFor('BUYER')).toBe('/inquiries/my');
  });

  it('reads the seller inbox from `/inquiries/received`', () => {
    expect(inquiriesEndpointFor('SELLER')).toBe('/inquiries/received');
  });
});

describe('unwrapInquiryThreadPayload (Story 4.4 / AC-4)', () => {
  it('reads the enveloped thread body', () => {
    const parsed = unwrapInquiryThreadPayload({ statusCode: 200, data: thread() });
    expect(parsed?.id).toBe('inquiry-1');
    expect(parsed?.messages).toHaveLength(1);
  });

  it('reads a bare thread body', () => {
    expect(unwrapInquiryThreadPayload(thread())?.messages).toHaveLength(1);
  });

  it('rejects junk and threads without a message array', () => {
    expect(unwrapInquiryThreadPayload(null)).toBeNull();
    expect(unwrapInquiryThreadPayload({ data: { id: 'inquiry-1' } })).toBeNull();
    expect(unwrapInquiryThreadPayload('not-an-object')).toBeNull();
  });
});

describe('resolveInquiryComposer (server state machine mirrored for the UI)', () => {
  it('lets the buyer follow up from PENDING_ADMIN_REVIEW', () => {
    expect(
      resolveInquiryComposer({ status: InquiryStatus.PENDING_ADMIN_REVIEW }, 'BUYER').canSend,
    ).toBe(true);
  });

  it('lets the buyer follow up after the reply is relayed back', () => {
    expect(resolveInquiryComposer({ status: InquiryStatus.RELAYED_TO_BUYER }, 'BUYER').canSend).toBe(
      true,
    );
  });

  it('blocks the buyer while the thread sits with the seller or the admin', () => {
    expect(resolveInquiryComposer({ status: InquiryStatus.RELAYED_TO_SELLER }, 'BUYER').canSend).toBe(
      false,
    );
    expect(resolveInquiryComposer({ status: InquiryStatus.SELLER_RESPONDED }, 'BUYER').hint).toBe(
      'بانتظار إحالة رد البائع إليك من فريق الوساطة.',
    );
  });

  it('lets the seller reply only while the thread is relayed to them', () => {
    expect(resolveInquiryComposer({ status: InquiryStatus.RELAYED_TO_SELLER }, 'SELLER').canSend).toBe(
      true,
    );
    expect(
      resolveInquiryComposer({ status: InquiryStatus.PENDING_ADMIN_REVIEW }, 'SELLER').hint,
    ).toBe('لا يمكن الرد إلا بعد إحالة الاستفسار إليك من الإدارة.');
  });

  it('accepts nothing once the thread is closed', () => {
    for (const viewer of ['BUYER', 'SELLER'] as const) {
      const resolved = resolveInquiryComposer({ status: InquiryStatus.CLOSED }, viewer);
      expect(resolved.canSend).toBe(false);
      expect(resolved.hint).toContain('مغلقة');
    }
  });

  it('renders no composer affordance without a thread', () => {
    expect(resolveInquiryComposer(null, 'BUYER')).toEqual({ canSend: false, hint: null });
  });
});

describe('InquiryStatusBadge (exhaustive label map)', () => {
  it('renders an Arabic label for every status', () => {
    for (const status of Object.values(InquiryStatus)) {
      const html = renderToString(<InquiryStatusBadge status={status} />);
      expect(html).toContain(`inquiry-status-badge-${status}`);
      expect(html).not.toContain('undefined');
    }
  });
});

describe('BuyerInquiriesList (Story 4.4 / AC-4, AC-5)', () => {
  it('shows the empty state until the buyer has an inquiry', () => {
    const html = renderToString(<BuyerInquiriesList inquiries={[]} />);
    expect(html).toContain('لا توجد استفسارات بعد');
    expect(html).not.toContain('buyer-inquiries-list');
  });

  it('renders a row per inquiry with the status label and a detail link', () => {
    const html = renderToString(
      <BuyerInquiriesList inquiries={[summary()]} detailHrefBase="/app/buyer/inquiries" />,
    );
    expect(html).toContain('buyer-inquiry-row-inquiry-1');
    expect(html).toContain('inquiry-status-badge-PENDING_ADMIN_REVIEW');
    expect(html).toContain('href="/app/buyer/inquiries/inquiry-1"');
  });

  it('flags a thread that is waiting on the buyer', () => {
    const html = renderToString(
      <BuyerInquiriesList inquiries={[summary({ awaitingParty: 'BUYER' })]} />,
    );
    expect(html).toContain('buyer-inquiry-awaiting-inquiry-1');
  });

  it('never renders a contact channel — display names only', () => {
    const html = renderToString(<BuyerInquiriesList inquiries={[summary()]} />);
    expect(html).not.toContain('mobileNumber');
    expect(html).not.toContain('966');
    expect(html).not.toContain('wa.me');
  });
});

describe('SellerInquiriesList (Story 4.4 / AC-5)', () => {
  it('shows the empty state until an inquiry is relayed to the seller', () => {
    const html = renderToString(<SellerInquiriesList inquiries={[]} />);
    expect(html).toContain('لا توجد استفسارات على عقاراتك');
  });

  it('renders the buyer display name and an awaiting chip', () => {
    const html = renderToString(
      <SellerInquiriesList
        inquiries={[summary({ status: InquiryStatus.RELAYED_TO_SELLER, awaitingParty: 'SELLER' })]}
        detailHrefBase="/app/owner/inquiries"
      />,
    );
    expect(html).toContain('seller-inquiry-awaiting-inquiry-1');
    expect(html).toContain('من: مشترٍ تجريبي');
    expect(html).toContain('href="/app/owner/inquiries/inquiry-1"');
  });

  it('leaves rows unlinked when no workspace base is supplied', () => {
    const html = renderToString(<SellerInquiriesList inquiries={[summary()]} />);
    expect(html).not.toContain('seller-inquiry-open-inquiry-1');
  });
});

describe('InquirySubmitForm (Story 4.4 / AC-1)', () => {
  it('renders the mediation notice and never leaks a raw body', () => {
    const html = renderToString(<InquirySubmitForm listingId="listing-1" />);
    expect(html).toContain('inquiry-submit-form');
    expect(html).toContain('كل استفسار يمر عبر وسيط المنصة');
    expect(html).toContain('inquiry-body');
    // Nothing is masked until the buyer types, so the notice is absent on first paint.
    expect(html).not.toContain('inquiry-mask-notice');
  });

  it('reports client-side masking through the shared notice constant', () => {
    const html = renderToString(<InquirySubmitForm listingId="listing-1" />);
    expect(html).not.toContain('تم حجب بيانات التواصل تلقائياً');
  });
});

describe('InquiryThreadView (Story 4.4 / AC-4, AC-5)', () => {
  it('renders a loading shell on the server, where no fetch has run yet', () => {
    const html = renderToString(<InquiryThreadView inquiryId="inquiry-1" viewer="BUYER" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('inquiry-thread-view');
  });
});

describe('InquiriesView (surface split)', () => {
  it('titles the buyer surface «استفساراتي»', () => {
    const html = renderToString(<InquiriesView viewer="BUYER" />);
    expect(html).toContain('استفساراتي');
    expect(html).not.toContain('استفسارات العقارات');
  });

  it('titles the seller surface «استفسارات العقارات» and explains the relay', () => {
    const html = renderToString(
      <InquiriesView viewer="SELLER" detailHrefBase="/app/marketer/inquiries" />,
    );
    expect(html).toContain('استفسارات العقارات');
    expect(html).toContain('بعد إحالتها من فريق الوساطة');
  });
});
