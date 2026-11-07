import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  type AdminPaymentDetail,
  type ClaimLockInfo,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  PaymentType,
} from '@elmasaif/shared';
import {
  PaymentReviewWorkspace,
  buildGracePeriodNotice,
  resolvePaymentReviewActions,
  validateRejectionNote,
} from '../payment-review-workspace';

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
            id: 'payment-1',
            dealId: 'deal-1',
            dealNumber: 'D-001',
            propertyTitle: 'فيلا تجريبية',
            paymentType: PaymentType.PLATFORM_COMMISSION,
            amount: '25000',
            status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
            uploadedAt: '2026-11-07T10:00:00.000Z',
            bankReferenceCode: 'REF-999',
            senderBankName: 'الراجحي',
            rejectionReason: null,
            proofFileObjectId: 'file-1',
            correctionWindowExpiresAt: null,
            dealStatus: DealStatus.UNDER_ADMIN_AUDIT,
            paymentDeadline: '2026-11-08T12:00:00.000Z',
            approvedByAdminId: 'super-admin-1',
            verifiedByAdminId: null,
            verifiedByAdminName: null,
            verifiedAt: null,
            serverNow: '2026-11-07T12:00:00.000Z',
            lockInfo: {
              isLocked: true,
              isLockedByCurrentAdmin: true,
              lockedByAdminId: 'admin-1',
              lockedByAdminName: 'مشرف أول',
              lockedAt: '2026-11-07T12:00:00.000Z',
              lockExpiresAt: '2026-11-07T12:15:00.000Z',
              remainingSeconds: 900,
            },
          },
        }),
      ),
      post: vi.fn(() => Promise.resolve({ statusCode: 200 })),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

describe('PaymentReviewWorkspace (Story 5.3) (AC: 1, 2, 3, 5, 8)', () => {
  describe('resolvePaymentReviewActions', () => {
    it('enables confirm and reject when caller holds lease on UNDER_REVIEW row', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: true,
        isLockedByCurrentAdmin: true,
        lockedByAdminId: 'admin-1',
        lockedByAdminName: 'مشرف',
        lockedAt: '2026-11-07T12:00:00.000Z',
        lockExpiresAt: '2026-11-07T12:15:00.000Z',
        remainingSeconds: 850,
      };

      const actions = resolvePaymentReviewActions(
        { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW } as any,
        lockInfo,
      );

      expect(actions.isMine).toBe(true);
      expect(actions.isOther).toBe(false);
      expect(actions.canConfirm).toBe(true);
      expect(actions.canReject).toBe(true);
      expect(actions.canRelease).toBe(true);
      expect(actions.canHeartbeat).toBe(true);
      expect(actions.canClaim).toBe(false);
    });

    it('sets read-only and force-unlock when another admin holds the lease', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: true,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: 'admin-2',
        lockedByAdminName: 'مشرف آخر',
        lockedAt: '2026-11-07T12:00:00.000Z',
        lockExpiresAt: '2026-11-07T12:15:00.000Z',
        remainingSeconds: 850,
      };

      const actions = resolvePaymentReviewActions(
        { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW } as any,
        lockInfo,
      );

      expect(actions.isMine).toBe(false);
      expect(actions.isOther).toBe(true);
      expect(actions.isReadOnly).toBe(true);
      expect(actions.canConfirm).toBe(false);
      expect(actions.canReject).toBe(false);
      expect(actions.canForceUnlock).toBe(true);
    });

    it('allows claiming when payment is unheld and in claimable status', () => {
      const lockInfo: ClaimLockInfo = {
        isLocked: false,
        isLockedByCurrentAdmin: false,
        lockedByAdminId: null,
        lockedByAdminName: null,
        lockedAt: null,
        lockExpiresAt: null,
        remainingSeconds: 0,
      };

      const actions = resolvePaymentReviewActions(
        { status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED } as any,
        lockInfo,
      );

      expect(actions.canClaim).toBe(true);
      expect(actions.canConfirm).toBe(false);
      expect(actions.canReject).toBe(false);
    });
  });

  describe('buildGracePeriodNotice (AC-5)', () => {
    it('returns notice with 12-hour message for rejected payment with correctionWindowExpiresAt', () => {
      const notice = buildGracePeriodNotice({
        status: DEAL_PAYMENT_STATUS.REJECTED,
        correctionWindowExpiresAt: '2026-11-08T22:00:00.000Z',
      });

      expect(notice).not.toBeNull();
      expect(notice?.inGracePeriod).toBe(true);
      expect(notice?.expiresAt).toBe('2026-11-08T22:00:00.000Z');
      expect(notice?.message).toContain('12 ساعة');
    });

    it('returns null when payment is not rejected or has no correction window', () => {
      expect(
        buildGracePeriodNotice({
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
          correctionWindowExpiresAt: '2026-11-08T22:00:00.000Z',
        }),
      ).toBeNull();

      expect(
        buildGracePeriodNotice({
          status: DEAL_PAYMENT_STATUS.REJECTED,
          correctionWindowExpiresAt: null,
        }),
      ).toBeNull();
    });
  });

  describe('validateRejectionNote (AC-3)', () => {
    it('accepts notes with length between 5 and 500 characters', () => {
      expect(validateRejectionNote('سبب الرفض المعتمد').valid).toBe(true);
      expect(validateRejectionNote('12345').valid).toBe(true);
      expect(validateRejectionNote('a'.repeat(500)).valid).toBe(true);
    });

    it('refuses notes shorter than 5 characters or whitespace only', () => {
      expect(validateRejectionNote('').valid).toBe(false);
      expect(validateRejectionNote('   ').valid).toBe(false);
      expect(validateRejectionNote('رفض').valid).toBe(false);
    });

    it('refuses notes longer than 500 characters', () => {
      expect(validateRejectionNote('a'.repeat(501)).valid).toBe(false);
    });
  });

  describe('SSR Render', () => {
    it('renders workspace skeleton without runtime errors', () => {
      const html = renderToString(<PaymentReviewWorkspace paymentId="payment-1" />);
      expect(html).toContain('جارٍ تحميل مساحة تدقيق الدفعة...');
    });
  });
});
