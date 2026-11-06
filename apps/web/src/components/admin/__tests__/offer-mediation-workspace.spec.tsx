import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OfferStatus, computeDealAmounts, type OfferLockInfo } from '@elmasaif/shared';
import {
  DealBindingPreview,
  FINAL_APPROVE_DEAL_ENDPOINT,
  FinalApproveSection,
  buildDealPreview,
  buildFinalApprovePayload,
  canFinalApprove,
  postFinalApprove,
  shouldShowDealPreview,
} from '../offer-mediation-workspace';

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: Object.assign(() => Promise.resolve({}), {
      get: vi.fn(() => Promise.resolve({ statusCode: 200, data: null })),
      post: vi.fn(() =>
        Promise.resolve({
          statusCode: 200,
          message: 'تم إنشاء الصفقة وحجز الإعلان بنجاح',
          data: { dealReferenceCode: 'ELM-ABCDEF1234-C' },
        }),
      ),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

const OFFER_ID = '11111111-1111-1111-1111-111111111111';

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
    lockedByAdminName: 'المشرف العام',
    lockedAt: '2026-11-06T09:00:00.000Z',
    lockExpiresAt: '2026-11-06T09:15:00.000Z',
    remainingSeconds: 900,
  });

const heldByOther = (): OfferLockInfo =>
  lockInfo({
    isLocked: true,
    isLockedByCurrentAdmin: false,
    lockedByAdminId: 'admin-2',
    lockedByAdminName: 'مشرف آخر',
    lockExpiresAt: '2026-11-06T09:15:00.000Z',
    remainingSeconds: 900,
  });

const renderSection = (
  status: OfferStatus,
  lock: OfferLockInfo | null,
  pending = false,
): string =>
  renderToString(
    <FinalApproveSection
      status={status}
      lockInfo={lock}
      pending={pending}
      onApprove={() => undefined}
    />,
  );

describe('OfferMediationWorkspace — final approval gate (Story 5.1) (AC: 11)', () => {
  describe('canFinalApprove', () => {
    it('needs both the approved state and the caller’s own live lease', () => {
      expect(canFinalApprove(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, heldByMe())).toBe(
        true,
      );
      expect(
        canFinalApprove(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, null),
      ).toBe(false);
      expect(
        canFinalApprove(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, undefined),
      ).toBe(false);
      expect(
        canFinalApprove(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, heldByOther()),
      ).toBe(false);
    });

    it('is never offered in any other offer state', () => {
      for (const status of [
        OfferStatus.PENDING_ADMIN_REVIEW,
        OfferStatus.RELAYED_TO_SELLER,
        OfferStatus.RELAYED_TO_BUYER,
        OfferStatus.COUNTER_OFFERED,
        OfferStatus.REJECTED_BY_ADMIN,
        OfferStatus.CONVERTED_TO_DEAL,
        OfferStatus.CLOSED_BACKUP,
      ]) {
        expect(canFinalApprove(status, heldByMe())).toBe(false);
      }
    });

    it('is never offered to an expired or foreign lease', () => {
      expect(canFinalApprove(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, lockInfo())).toBe(
        false,
      );
    });
  });

  describe('FinalApproveSection', () => {
    it('renders nothing without the lease', () => {
      const html = renderSection(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, null);

      expect(html).not.toContain('data-testid="mediation-final-approve"');
    });

    it('renders nothing while another administrator holds the lease', () => {
      const html = renderSection(
        OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
        heldByOther(),
      );

      expect(html).not.toContain('data-testid="mediation-final-approve"');
    });

    it('renders nothing in a state that is not awaiting final approval', () => {
      const html = renderSection(OfferStatus.PENDING_ADMIN_REVIEW, heldByMe());

      expect(html).not.toContain('data-testid="mediation-final-approve"');
    });

    it('offers the confirmation gate when the lease and the state both allow it', () => {
      const html = renderSection(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL, heldByMe());

      expect(html).toContain('data-testid="mediation-final-approve"');
      expect(html).toContain('الاعتماد النهائي وإنشاء الصفقة');
      // The submit button only appears after the explicit confirmation step.
      expect(html).not.toContain('data-testid="mediation-final-approve-submit"');
    });

    it('disables the action while a call is in flight', () => {
      const html = renderSection(
        OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
        heldByMe(),
        true,
      );

      expect(html).toContain('disabled');
    });
  });

  describe('frozen financial preview (FR-29)', () => {
    it('shows the UX-journey figures: 3,000,000 + 75,000 = 3,075,000 with the 48-hour window', () => {
      const html = renderToString(<DealBindingPreview offerPrice={3000000} />);

      expect(html).toContain('mediation-deal-preview');
      expect(html).toContain('3,000,000 ر.س');
      expect(html).toContain('75,000 ر.س');
      expect(html).toContain('3,075,000 ر.س');
      expect(html).toContain('2.5%');
      expect(html).toContain('48 ساعة');
    });

    it('uses the shared fixed-point helper, not a local percentage', () => {
      expect(buildDealPreview(3000000)).toEqual(
        computeDealAmounts({
          dealPrice: '3000000',
          commissionRate: 0.025,
          fixedCommission: '0.00',
        }),
      );
      expect(buildDealPreview('1234.56').finalCommission).toBe('30.86');
    });

    it('is shown from the final-approval stage onwards and not before', () => {
      expect(shouldShowDealPreview(OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL)).toBe(true);
      expect(shouldShowDealPreview(OfferStatus.CONVERTED_TO_DEAL)).toBe(true);
      expect(shouldShowDealPreview(OfferStatus.PENDING_ADMIN_REVIEW)).toBe(false);
      expect(shouldShowDealPreview(OfferStatus.CLOSED_BACKUP)).toBe(false);
    });
  });

  describe('request payload (AC-11)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('posts { offerId } to /admin/deals/final-approve', async () => {
      const { apiClient } = await import('../../../lib/api-client');

      await postFinalApprove(OFFER_ID);

      expect(apiClient.post).toHaveBeenCalledWith(FINAL_APPROVE_DEAL_ENDPOINT, {
        offerId: OFFER_ID,
      });
      expect(FINAL_APPROVE_DEAL_ENDPOINT).toBe('/admin/deals/final-approve');
      expect(buildFinalApprovePayload(OFFER_ID)).toEqual({ offerId: OFFER_ID });
    });

    it('surfaces the returned dealReferenceCode for the success banner', async () => {
      const response = await postFinalApprove(OFFER_ID);

      expect(response.data.dealReferenceCode).toBe('ELM-ABCDEF1234-C');
    });
  });
});
