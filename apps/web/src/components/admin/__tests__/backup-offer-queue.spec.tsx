import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ListingStatus,
  OfferStatus,
  PropertyType,
  type BackupOfferQueueGroup,
  type BackupOfferQueueItem,
  type OfferListingSummary,
  type OfferLockInfo,
} from '@elmasaif/shared';
import {
  BackupOfferQueue,
  describeBackupQueueError,
  resolveBackupQueueActions,
} from '../backup-offer-queue';

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

const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const lockInfo = (overrides: Partial<OfferLockInfo> = {}): OfferLockInfo => ({
  isLocked: false,
  isLockedByCurrentAdmin: false,
  lockedByAdminId: null,
  lockedByAdminName: null,
  lockedAt: null,
  lockExpiresAt: null,
  remainingSeconds: 0,
  ...overrides,
});

const heldByMe = (): OfferLockInfo =>
  lockInfo({
    isLocked: true,
    isLockedByCurrentAdmin: true,
    lockedByAdminId: 'admin-1',
    lockedByAdminName: 'مشرف الوساطة الأول',
    lockedAt: new Date().toISOString(),
    lockExpiresAt: inDays(0),
    remainingSeconds: 600,
  });

const heldByOther = (): OfferLockInfo =>
  lockInfo({
    isLocked: true,
    lockedByAdminId: 'admin-2',
    lockedByAdminName: 'مشرف الوساطة الثاني',
    remainingSeconds: 600,
  });

const listingSummary = (overrides: Partial<OfferListingSummary> = {}): OfferListingSummary => ({
  id: 'listing-1',
  title: 'فيلا شمال الطائف',
  propertyType: PropertyType.VILLA,
  cityName: 'الطائف',
  districtName: 'الشهداء الشمالية',
  askPrice: 1200000,
  areaSquareMeters: 300,
  status: ListingStatus.ACTIVE,
  ...overrides,
});

const queueItem = (
  overrides: Partial<BackupOfferQueueItem> = {},
): BackupOfferQueueItem => ({
  id: 'offer-1',
  status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
  offerPrice: 1150000,
  askPrice: 1200000,
  isBackup: true,
  isLowPrice: false,
  negotiationRound: 1,
  maxCounterRounds: 5,
  awaitingParty: null,
  expiresAt: inDays(3),
  createdAt: new Date().toISOString(),
  buyerName: 'مشتري العرض',
  sellerName: 'وسيط معتمد',
  rejectionReason: null,
  rejectionNote: null,
  activatedAt: null,
  listing: listingSummary(),
  queuePosition: 1,
  queueState: 'SURFACED',
  lockInfo: lockInfo(),
  ...overrides,
});

const queueGroup = (
  overrides: Partial<BackupOfferQueueGroup> = {},
): BackupOfferQueueGroup => ({
  listing: listingSummary(),
  queueState: 'SURFACED',
  items: [queueItem()],
  ...overrides,
});

describe('resolveBackupQueueActions (Story 4.3 / AC#3)', () => {
  it('offers only the claim while the row is unlocked and surfaced', () => {
    expect(resolveBackupQueueActions(queueGroup(), queueItem())).toEqual({
      canClaim: true,
      canActivate: false,
    });
  });

  it('offers activation once the caller holds the lease on a surfaced listing', () => {
    expect(
      resolveBackupQueueActions(queueGroup(), queueItem({ lockInfo: heldByMe() })),
    ).toEqual({ canClaim: true, canActivate: true });
  });

  it('lets a second administrator claim only once the lease lapses', () => {
    const lockedByOther = queueItem({ lockInfo: heldByOther() });
    expect(resolveBackupQueueActions(queueGroup(), lockedByOther)).toEqual({
      canClaim: false,
      canActivate: false,
    });

    // Lazy expiry: the API reads an expired lease as unlocked, and so must the UI.
    const expired = queueItem({ lockInfo: lockInfo() });
    expect(resolveBackupQueueActions(queueGroup(), expired).canClaim).toBe(true);
  });

  it('never activates a queue whose primary deal is still live or already closed', () => {
    for (const queueState of ['QUEUED', 'FROZEN', 'CLOSABLE'] as const) {
      expect(
        resolveBackupQueueActions(
          { queueState },
          queueItem({ lockInfo: heldByMe(), queueState }),
        ).canActivate,
      ).toBe(false);
    }
  });

  it('is nullish-safe for a missing group or item', () => {
    expect(resolveBackupQueueActions(null, null)).toEqual({
      canClaim: true,
      canActivate: false,
    });
    expect(resolveBackupQueueActions(undefined, undefined)).toEqual({
      canClaim: true,
      canActivate: false,
    });
  });

  it('prefers the explicitly projected lock over the row lock', () => {
    expect(
      resolveBackupQueueActions(queueGroup(), queueItem(), heldByMe()),
    ).toEqual({ canClaim: true, canActivate: true });
  });
});

describe('describeBackupQueueError (Story 4.3 / AC#4)', () => {
  it('maps every activation refusal code to institutional Arabic copy', () => {
    expect(describeBackupQueueError({ code: 'OFFER_BACKUP_NOT_QUEUED' })).toBe(
      'هذا العرض ليس عرضاً احتياطياً معتمداً في طابور الانتظار',
    );
    expect(describeBackupQueueError({ code: 'OFFER_BACKUP_ALREADY_ACTIVATED' })).toBe(
      'سبق تفعيل عرض احتياطي على هذا العقار',
    );
    expect(describeBackupQueueError({ code: 'OFFER_BACKUP_PRIMARY_DEAL_ACTIVE' })).toBe(
      'لا يمكن تفعيل العرض الاحتياطي قبل إقفال الصفقة الأساسية',
    );
    expect(describeBackupQueueError({ code: 'OFFER_BACKUP_LISTING_UNAVAILABLE' })).toBe(
      'العقار غير متاح حالياً لتفعيل العرض الاحتياطي',
    );
  });

  it('names the lease holder on a lock conflict instead of a generic failure', () => {
    const message = describeBackupQueueError({
      code: 'OFFER_LOCK_CONFLICT',
      details: { lockInfo: { lockedByAdminName: 'خالد المشرف المناوب' } },
    });
    expect(message).toContain('خالد المشرف المناوب');
    expect(message).not.toContain('العقار غير متاح');
  });

  it('falls back to the envelope message and then to a neutral refusal', () => {
    expect(describeBackupQueueError({ code: 'SOMETHING_ELSE', message: 'رفض إداري' })).toBe(
      'رفض إداري',
    );
    expect(describeBackupQueueError(null)).toBe('تعذر تنفيذ الإجراء على العرض الاحتياطي');
    expect(describeBackupQueueError({})).toBe('تعذر تنفيذ الإجراء على العرض الاحتياطي');
  });
});

describe('BackupOfferQueue (Story 4.3 / AC#1, AC#2, AC#3)', () => {
  it('renders one card per listing with its derived state badge', () => {
    const html = renderToString(
      <BackupOfferQueue
        initialGroups={[
          queueGroup(),
          queueGroup({
            listing: listingSummary({ id: 'listing-2', title: 'شقة في الشاطئ' }),
            queueState: 'CLOSABLE',
            items: [
              queueItem({ id: 'offer-9', listing: listingSummary({ id: 'listing-2' }) }),
            ],
          }),
        ]}
        initialTotal={2}
      />,
    );

    expect(html).toContain('data-testid="backup-offer-queue"');
    expect(html).toContain('فيلا شمال الطائف');
    expect(html).toContain('شقة في الشاطئ');
    expect(html).toContain('فيلا'); // PROPERTY_TYPE_LABELS_AR
    expect(html).toContain('300');
    expect(html).toContain('1,200,000');
    expect(html).toContain('جاهز للتفعيل');
    expect(html).toContain('جاهز للإغلاق');
    expect(html).toContain('data-testid="backup-group-state-listing-1"');
    expect(html).toContain('إجمالي العقارات في الطابور: 2');
  });

  it('numbers the queue and marks the first position as next in line (OQ-04)', () => {
    const html = renderToString(
      <BackupOfferQueue
        initialGroups={[
          queueGroup({
            items: [
              queueItem({ id: 'offer-1', queuePosition: 1 }),
              queueItem({ id: 'offer-2', queuePosition: 2, buyerName: 'مشتري ثانٍ' }),
            ],
          }),
        ]}
      />,
    );

    expect(html).toContain('data-testid="backup-offer-position-offer-1"');
    expect(html).toContain('data-testid="backup-offer-position-offer-2"');
    expect(html).toContain('data-testid="backup-offer-next-offer-1"');
    expect(html).not.toContain('data-testid="backup-offer-next-offer-2"');
    expect(html).toContain('التالي في الانتظار');
    expect(html).toContain('جولة 1 من 5');
    expect(html).toContain('مشتري ثانٍ');
  });

  it('shows the activation action only for a surfaced row the caller holds', () => {
    const held = renderToString(
      <BackupOfferQueue
        initialGroups={[
          queueGroup({
            items: [
              queueItem({ id: 'offer-held', lockInfo: heldByMe() }),
              queueItem({ id: 'offer-free', lockInfo: lockInfo() }),
            ],
          }),
        ]}
      />,
    );

    expect(held).toContain('data-testid="backup-offer-activate-offer-held"');
    expect(held).not.toContain('data-testid="backup-offer-activate-offer-free"');
    expect(held).toContain('قيد المعالجة بواسطتك');
    expect(held).toContain('متاح للاستلام');
  });

  it('never shows the activation action on a queued (primary-deal) group', () => {
    const html = renderToString(
      <BackupOfferQueue
        initialGroups={[
          queueGroup({
            queueState: 'QUEUED',
            items: [queueItem({ queueState: 'QUEUED', lockInfo: heldByMe() })],
          }),
        ]}
      />,
    );

    expect(html).toContain('في الانتظار');
    expect(html).not.toContain('data-testid="backup-offer-activate-');
  });

  it('renders the empty state when no listing holds a queue', () => {
    const html = renderToString(<BackupOfferQueue initialGroups={[]} initialTotal={0} />);
    expect(html).toContain('لا توجد عروض احتياطية في الانتظار');
    expect(html).not.toContain('data-testid="backup-offer-queue"');
  });

  it('renders the loading placeholder before the first fetch resolves', () => {
    const html = renderToString(<BackupOfferQueue />);
    expect(html).toContain('جاري تحميل طابور العروض الاحتياطية');
  });
});
