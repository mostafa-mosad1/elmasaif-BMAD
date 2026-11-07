import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_PAYMENT_STATUS,
  DealStatus,
  PaymentType,
  type DealPaymentSlot,
} from '@elmasaif/shared';
import {
  DealPaymentCard,
  SLOT_LOCK_REASONS_AR,
  formatDealAmount,
  resolvePaymentSlotActions,
} from '../dual-wire-transfer-cards';
import { DEAL_COUNTDOWN_EXPIRED_AR } from '../deal-countdown-banner';

function buildSlot(overrides: Partial<DealPaymentSlot> = {}): DealPaymentSlot {
  return {
    id: 'payment-1',
    paymentType: PaymentType.PLATFORM_COMMISSION,
    amount: '36250.00',
    status: DEAL_PAYMENT_STATUS.PENDING,
    hasProof: false,
    proofFileObjectId: null,
    bankReferenceCode: null,
    senderBankName: null,
    uploadedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

const ACTIVE_DEAL = { status: DealStatus.AWAITING_PAYMENT_PROOF, isExpired: false };

describe('resolvePaymentSlotActions (AC: 3, AC: 8)', () => {
  it('allows an upload while the slot is pending and the window is open', () => {
    expect(resolvePaymentSlotActions(buildSlot(), ACTIVE_DEAL)).toEqual({
      canUpload: true,
      canDownload: false,
      lockReasonAr: null,
    });
  });

  it('allows replacing an uploaded receipt before review completes', () => {
    const slot = buildSlot({
      status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
      hasProof: true,
      proofFileObjectId: 'file-1',
      uploadedAt: '2026-11-07T10:00:00.000Z',
    });

    expect(resolvePaymentSlotActions(slot, ACTIVE_DEAL)).toEqual({
      canUpload: true,
      canDownload: true,
      lockReasonAr: null,
    });
  });

  it('closes the zone with the expiry copy when the countdown reached zero', () => {
    const actions = resolvePaymentSlotActions(buildSlot(), {
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      isExpired: true,
    });

    expect(actions.canUpload).toBe(false);
    expect(actions.lockReasonAr).toBe(DEAL_COUNTDOWN_EXPIRED_AR);
  });

  it('closes the zone once the deal is terminal, before looking at the slot', () => {
    const actions = resolvePaymentSlotActions(buildSlot(), {
      status: DealStatus.CANCELLED,
      isExpired: false,
    });

    expect(actions.canUpload).toBe(false);
    expect(actions.lockReasonAr).toBe(SLOT_LOCK_REASONS_AR.dealClosed);
  });

  it('locks each reviewed status with its own Arabic reason', () => {
    const cases = [
      { status: DEAL_PAYMENT_STATUS.UNDER_REVIEW, reason: SLOT_LOCK_REASONS_AR.underReview },
      { status: DEAL_PAYMENT_STATUS.CONFIRMED, reason: SLOT_LOCK_REASONS_AR.confirmed },
      { status: DEAL_PAYMENT_STATUS.EXPIRED, reason: SLOT_LOCK_REASONS_AR.expired },
    ] as const;

    cases.forEach(({ status, reason }) => {
      const actions = resolvePaymentSlotActions(buildSlot({ status }), ACTIVE_DEAL);
      expect(actions.canUpload).toBe(false);
      expect(actions.lockReasonAr).toBe(reason);
    });
  });

  it('keeps the download available for a locked slot that already has a receipt', () => {
    const slot = buildSlot({
      status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
      hasProof: true,
      proofFileObjectId: 'file-2',
      uploadedAt: '2026-11-07T10:00:00.000Z',
    });

    expect(resolvePaymentSlotActions(slot, ACTIVE_DEAL).canDownload).toBe(true);
  });
});

describe('DealPaymentCard (AC: 4, AC: 5)', () => {
  const baseProps = {
    slot: buildSlot(),
    amount: '36250.00',
    accountHolderName: 'شركة المصايف للاستثمار',
    bankName: 'بنك الراجحي',
    iban: 'SA0380000000608010167519',
    ibanFormatted: 'SA03 8000 0000 6080 1016 7519',
    deal: ACTIVE_DEAL,
    onUploadProof: () => true,
  };

  it('renders the frozen commission, the platform IBAN and the frozen reference code', () => {
    const html = renderToString(
      React.createElement(DealPaymentCard, {
        ...baseProps,
        accent: 'platform',
        title: 'سعي المنصة',
        referenceCode: 'ELM-DEMO000001-C',
      }),
    );

    expect(html).toContain('سعي المنصة');
    expect(html).toContain(formatDealAmount('36250.00'));
    expect(html).toContain('36,250 ر.س');
    expect(html).toContain('SA03 8000 0000 6080 1016 7519');
    expect(html).toContain('ELM-DEMO000001-C');
    expect(html).toContain('اسحب إيصال التحويل إلى هنا أو اختر ملفاً');
    expect(html).toContain('deal-platform-fee');
  });

  it('renders the seller price card without a reference code and with the seller IBAN', () => {
    const html = renderToString(
      React.createElement(DealPaymentCard, {
        ...baseProps,
        accent: 'seller',
        title: 'قيمة العقار للبائع',
        amount: '1450000.00',
      }),
    );

    expect(html).toContain('قيمة العقار للبائع');
    expect(html).toContain('1,450,000 ر.س');
    expect(html).toContain('بنك الراجحي');
    expect(html).not.toContain('deal-reference-code');
    expect(html).toContain('deal-seller-price-bg');
  });

  it('disables the dropzone and explains why once the window expired', () => {
    const html = renderToString(
      React.createElement(DealPaymentCard, {
        ...baseProps,
        accent: 'platform',
        title: 'سعي المنصة',
        deal: { status: DealStatus.AWAITING_PAYMENT_PROOF, isExpired: true },
      }),
    );

    expect(html).toContain(DEAL_COUNTDOWN_EXPIRED_AR);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('disabled=""');
  });

  it('repeats the rejection reason with the re-upload instruction', () => {
    const html = renderToString(
      React.createElement(DealPaymentCard, {
        ...baseProps,
        accent: 'seller',
        title: 'قيمة العقار للبائع',
        slot: buildSlot({
          paymentType: PaymentType.SELLER_PURCHASE_PRICE,
          status: DEAL_PAYMENT_STATUS.REJECTED,
          rejectionReason: 'المبلغ في الإيصال لا يطابق قيمة العقار.',
        }),
      }),
    );

    expect(html).toContain('المبلغ في الإيصال لا يطابق قيمة العقار.');
    expect(html).toContain('أعد رفع إيصال التحويل قبل انتهاء المهلة');
  });
});
