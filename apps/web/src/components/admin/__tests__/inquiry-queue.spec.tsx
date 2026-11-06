import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  INQUIRY_LOCK_CONFLICT,
  INQUIRY_LOCK_EXPIRED,
  INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS,
  INQUIRY_LOCK_REQUIRED,
  InquiryStatus,
} from '@elmasaif/shared';
import type { InquiryThreadSummary } from '@elmasaif/shared';
import { InquiryQueue, describeQueueClaimError, unwrapInquiryQueuePayload } from '../inquiry-queue';
import {
  CONVERSATION_HEARTBEAT_INTERVAL_MS,
  InquiryWorkspace,
  resolveConversationActions,
  resolveInquiryErrorHint,
} from '../inquiry-workspace';

// `useRouter()` needs a mounted App Router, which an SSR render does not provide.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: Object.assign(() => Promise.resolve({}), {
      get: vi.fn(() => Promise.resolve({ statusCode: 200, data: { items: [], meta: {} } })),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

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
  messageCount: 2,
  closedAt: null,
  closeReason: null,
  listing: {
    id: 'listing-1',
    title: 'فيلا شمال الطائف',
    propertyType: 'VILLA',
    cityName: 'الطائف',
    districtName: 'الشهداء الشمالية',
    askPrice: 1200000,
    areaSquareMeters: 300,
    status: 'ACTIVE',
  } as InquiryThreadSummary['listing'],
  ...overrides,
});

describe('unwrapInquiryQueuePayload (Story 4.4 / AC-3)', () => {
  it('reads the enveloped `{ data: { items, meta } }` shape and its total', () => {
    const parsed = unwrapInquiryQueuePayload({
      statusCode: 200,
      data: { items: [summary()], meta: { total: 7, page: 1, limit: 50, totalPages: 1 } },
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.total).toBe(7);
  });

  it('reads a bare `{ items }` body and falls back to the row count', () => {
    const parsed = unwrapInquiryQueuePayload({ items: [summary(), summary({ id: 'inquiry-2' })] });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.total).toBe(2);
  });

  it('is nullish-safe and never throws on junk', () => {
    expect(unwrapInquiryQueuePayload(null)).toEqual({ items: [], total: 0 });
    expect(unwrapInquiryQueuePayload(undefined)).toEqual({ items: [], total: 0 });
    expect(unwrapInquiryQueuePayload({})).toEqual({ items: [], total: 0 });
    expect(unwrapInquiryQueuePayload('not-an-object')).toEqual({ items: [], total: 0 });
  });
});

describe('describeQueueClaimError (Story 4.4 / AC-3 holder banner)', () => {
  it('names the administrator holding the lease', () => {
    const message = describeQueueClaimError({
      details: { lockInfo: { lockedByAdminName: 'مشرف الوساطة الأول' } },
    });
    expect(message).toContain('مشرف الوساطة الأول');
    expect(message).toContain('مقفولة');
  });

  it('falls back to the server message when no holder is projected', () => {
    expect(describeQueueClaimError({ message: 'تعذر استلام المحادثة' })).toBe(
      'تعذر استلام المحادثة',
    );
  });

  it('falls back to a generic Arabic message for a bare failure', () => {
    expect(describeQueueClaimError({})).toBe('تعذر استلام المحادثة');
    expect(describeQueueClaimError({ details: { lockInfo: { lockedByAdminName: '' } } })).toBe(
      'تعذر استلام المحادثة',
    );
  });
});

describe('resolveConversationActions (Story 4.4 / AC-5 state machine)', () => {
  it('relays a fresh inquiry to the seller and refuses the reverse relay', () => {
    const actions = resolveConversationActions(InquiryStatus.PENDING_ADMIN_REVIEW);
    expect(actions.canRelayToSeller).toBe(true);
    expect(actions.canRelayToBuyer).toBe(false);
    expect(actions.canClose).toBe(true);
    expect(actions.isClosed).toBe(false);
  });

  it('relays the seller reply to the buyer only once the seller responded', () => {
    const actions = resolveConversationActions(InquiryStatus.SELLER_RESPONDED);
    expect(actions.canRelayToBuyer).toBe(true);
    expect(actions.canRelayToSeller).toBe(false);
    expect(actions.canClose).toBe(true);
  });

  it('offers no relay while a message is in the counterparty’s hands, but still allows closing', () => {
    for (const status of [InquiryStatus.RELAYED_TO_SELLER, InquiryStatus.RELAYED_TO_BUYER]) {
      const actions = resolveConversationActions(status);
      expect(actions.canRelayToSeller).toBe(false);
      expect(actions.canRelayToBuyer).toBe(false);
      expect(actions.canClose).toBe(true);
    }
  });

  it('treats CLOSED as terminal — no relay and no second close', () => {
    const actions = resolveConversationActions(InquiryStatus.CLOSED);
    expect(actions.isClosed).toBe(true);
    expect(actions.canClose).toBe(false);
    expect(actions.canRelayToSeller).toBe(false);
    expect(actions.canRelayToBuyer).toBe(false);
  });
});

describe('resolveInquiryErrorHint (AD-8 stable codes)', () => {
  it('maps every lock code to an actionable Arabic hint', () => {
    expect(resolveInquiryErrorHint(INQUIRY_LOCK_REQUIRED, 'x')).toContain('استلم المحادثة');
    expect(resolveInquiryErrorHint(INQUIRY_LOCK_EXPIRED, 'x')).toContain('انتهت مدة القفل');
    expect(resolveInquiryErrorHint(INQUIRY_LOCK_CONFLICT, 'x')).toContain('مشرف آخر');
  });

  it('passes the server message through for unknown codes', () => {
    expect(resolveInquiryErrorHint('SOMETHING_ELSE', 'رسالة الخادم')).toBe('رسالة الخادم');
    expect(resolveInquiryErrorHint(undefined, 'رسالة الخادم')).toBe('رسالة الخادم');
  });
});

describe('CONVERSATION_HEARTBEAT_INTERVAL_MS (AD-10)', () => {
  it('renews the lease at the shared 5-minute cadence', () => {
    expect(CONVERSATION_HEARTBEAT_INTERVAL_MS).toBe(INQUIRY_LOCK_HEARTBEAT_INTERVAL_MS);
    expect(CONVERSATION_HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe('InquiryQueue (Story 4.4 / AC-3)', () => {
  it('renders the queue shell and never claims on read', () => {
    const html = renderToString(<InquiryQueue />);
    expect(html).toContain('طابور المحادثات');
    expect(html).toContain('AD-10');
    expect(html).toContain('جاري تحميل طابور المحادثات');
    // Reading the queue must not take the task: no claim URL is emitted by the initial paint.
    expect(html).not.toContain('/claim');
  });
});

describe('InquiryWorkspace (Story 4.4 / AC-3, AC-5)', () => {
  it('renders the loading shell before the thread arrives', () => {
    const html = renderToString(<InquiryWorkspace inquiryId="inquiry-1" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('conversation-timeline');
    expect(html).not.toContain('conversation-lock-banner');
  });
});
