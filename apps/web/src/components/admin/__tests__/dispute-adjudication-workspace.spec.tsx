import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DealStatus, type ClaimLockInfo } from '@elmasaif/shared';
import {
  DisputeAdjudicationWorkspace,
  resolveDisputeWorkspaceActions,
} from '../dispute-adjudication-workspace';
import { DisputeAdjudicationQueue } from '../dispute-adjudication-queue';

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
      get: vi.fn(() =>
        Promise.resolve({
          statusCode: 200,
          data: {
            id: 'dispute-1',
            dealId: 'deal-1',
            dealNumber: 'DL-20261108-0001',
            dealStatus: DealStatus.DISPUTED,
            filedByRole: 'BUYER',
            filedByName: 'فهد المشتري',
            reason: 'لم يتم استلام صك العقار بعد السداد الكامل',
            status: 'OPEN',
            resolutionAction: null,
            resolutionNotes: null,
            resolvedByAdminName: null,
            resolvedAt: null,
            createdAt: '2026-11-08T10:00:00.000Z',
            lockInfo: {
              isLocked: true,
              isLockedByCurrentAdmin: true,
              lockedByAdminId: 'admin-1',
              lockedByAdminName: 'مشرف أول',
              lockedAt: '2026-11-08T10:00:00.000Z',
              lockExpiresAt: '2026-11-08T10:15:00.000Z',
              remainingSeconds: 900,
            },
            deal: {
              id: 'deal-1',
              dealNumber: 'DL-20261108-0001',
              status: DealStatus.DISPUTED,
              createdAt: '2026-11-08T08:00:00.000Z',
              paymentDeadline: '2026-11-09T08:00:00.000Z',
              buyer: { id: 'buyer-1', name: 'فهد المشتري', phone: '0501112233', nationalId: '1010101010' },
              seller: { id: 'seller-1', name: 'سعد البائع', phone: '0559998877', iban: 'SA0000000000000000000000' },
              listing: {
                id: 'listing-1',
                title: 'فيلا فاخرة للبيع',
                propertyType: 'VILLA',
                cityName: 'الطائف',
                districtName: 'الوسام',
                askPrice: 1500000,
                finalPrice: 1450000,
              },
              payments: [
                {
                  id: 'pay-1',
                  paymentType: 'PLATFORM_COMMISSION',
                  amount: 36250,
                  status: 'CONFIRMED',
                  hasProof: true,
                  proofFileObjectId: 'file-comm',
                  bankReferenceCode: 'REF-COMM',
                  senderBankName: 'الراجحي',
                  uploadedAt: '2026-11-08T09:00:00.000Z',
                },
                {
                  id: 'pay-2',
                  paymentType: 'SELLER_PAYOUT',
                  amount: 1450000,
                  status: 'PROOF_UPLOADED',
                  hasProof: true,
                  proofFileObjectId: 'file-payout',
                  bankReferenceCode: 'REF-PAYOUT',
                  senderBankName: 'الأهلي',
                  uploadedAt: '2026-11-08T09:30:00.000Z',
                },
              ],
              auditLogs: [],
            },
          },
        }),
      ),
      post: vi.fn(() => Promise.resolve({ statusCode: 200 })),
    }),
  };
});

describe('DisputeAdjudicationWorkspace (Story 5.6 / AC: 7, 8, 11)', () => {
  describe('resolveDisputeWorkspaceActions', () => {
    it('enables adjudication and lease controls when caller holds lease on OPEN dispute', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: true,
        isLockedByCurrentAdmin: true,
        lockedByAdminId: 'admin-1',
        lockedByAdminName: 'مشرف أول',
        lockedAt: '2026-11-08T10:00:00.000Z',
        lockExpiresAt: '2026-11-08T10:15:00.000Z',
        remainingSeconds: 850,
      };

      const actions = resolveDisputeWorkspaceActions({ status: 'OPEN' }, lockInfo);

      expect(actions.isMine).toBe(true);
      expect(actions.isOther).toBe(false);
      expect(actions.canAdjudicate).toBe(true);
      expect(actions.canRelease).toBe(true);
      expect(actions.canHeartbeat).toBe(true);
      expect(actions.canClaim).toBe(false);
      expect(actions.canForceUnlock).toBe(false);
      expect(actions.isReadOnly).toBe(false);
    });

    it('sets read-only and force-unlock when another admin holds the lease', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: true,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: 'admin-2',
        lockedByAdminName: 'مشرف آخر',
        lockedAt: '2026-11-08T10:00:00.000Z',
        lockExpiresAt: '2026-11-08T10:15:00.000Z',
        remainingSeconds: 850,
      };

      const actions = resolveDisputeWorkspaceActions({ status: 'OPEN' }, lockInfo);

      expect(actions.isMine).toBe(false);
      expect(actions.isOther).toBe(true);
      expect(actions.canAdjudicate).toBe(false);
      expect(actions.canForceUnlock).toBe(true);
      expect(actions.isReadOnly).toBe(true);
    });

    it('allows claiming when dispute is OPEN and unlocked', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: false,
        isLockedByCurrentAdmin: false,
      };

      const actions = resolveDisputeWorkspaceActions({ status: 'OPEN' }, lockInfo);

      expect(actions.canClaim).toBe(true);
      expect(actions.canAdjudicate).toBe(false);
      expect(actions.isReadOnly).toBe(false);
    });

    it('sets read-only and forbids actions when dispute is RESOLVED', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: false,
        isLockedByCurrentAdmin: false,
      };

      const actions = resolveDisputeWorkspaceActions({ status: 'RESOLVED' }, lockInfo);

      expect(actions.canClaim).toBe(false);
      expect(actions.canAdjudicate).toBe(false);
      expect(actions.isReadOnly).toBe(true);
    });
  });

  describe('Component SSR rendering', () => {
    it('renders workspace skeleton when mounting', () => {
      const html = renderToString(
        React.createElement(DisputeAdjudicationWorkspace, {
          disputeId: 'dispute-1',
        }),
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('animate-pulse');
    });

    it('renders queue header and filter buttons', () => {
      const html = renderToString(React.createElement(DisputeAdjudicationQueue));

      expect(html).toContain('طابور فض النزاعات والتحكيم الإداري');
      expect(html).toContain('الكل');
      expect(html).toContain('نزاعات مفتوحة');
      expect(html).toContain('نزاعات مفضولة ومحسومة');
    });
  });
});

