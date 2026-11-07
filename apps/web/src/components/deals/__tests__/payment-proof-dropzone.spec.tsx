import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  PaymentType,
} from '@elmasaif/shared';
import {
  DEAL_PROOF_ACCEPT_ATTRIBUTE,
  DEAL_PROOF_VALIDATION_MESSAGES_AR,
  PROOF_DROPZONE_FORMATS_AR,
  PROOF_DROPZONE_TITLE_AR,
  PaymentProofDropzone,
  buildDealProofFormData,
  validateDealProofFile,
} from '../payment-proof-dropzone';
import { DEAL_COUNTDOWN_EXPIRED_AR } from '../deal-countdown-banner';

const TEN_MB = 10 * 1024 * 1024;

function fileOf(size: number, type: string): Pick<File, 'size' | 'type'> {
  return { size, type };
}

function receiptBlob(): File {
  return new Blob(['receipt'], { type: 'application/pdf' }) as unknown as File;
}

describe('validateDealProofFile (FR-30, trap T-12)', () => {
  it('requires a file when nothing was selected or the file is empty', () => {
    expect(validateDealProofFile(null)).toBe(DEAL_PAYMENT_PROOF_REQUIRED);
    expect(validateDealProofFile(fileOf(0, 'application/pdf'))).toBe(
      DEAL_PAYMENT_PROOF_REQUIRED,
    );
    expect(DEAL_PROOF_VALIDATION_MESSAGES_AR[DEAL_PAYMENT_PROOF_REQUIRED]).toBe(
      'يرجى اختيار ملف إيصال التحويل.',
    );
  });

  it('refuses anything above 10 MB', () => {
    expect(validateDealProofFile(fileOf(TEN_MB + 1, 'application/pdf'))).toBe(
      DEAL_PAYMENT_PROOF_TOO_LARGE,
    );
    expect(validateDealProofFile(fileOf(TEN_MB, 'application/pdf'))).toBeNull();
  });

  it('accepts exactly PDF, JPEG and PNG — WebP is rejected here even though storage allows it', () => {
    expect(validateDealProofFile(fileOf(1024, 'application/pdf'))).toBeNull();
    expect(validateDealProofFile(fileOf(1024, 'image/jpeg'))).toBeNull();
    expect(validateDealProofFile(fileOf(1024, 'image/png'))).toBeNull();
    expect(validateDealProofFile(fileOf(1024, 'image/webp'))).toBe(
      DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
    );
  });

  it('pins the accept attribute to the same three MIME types', () => {
    expect(DEAL_PROOF_ACCEPT_ATTRIBUTE).toBe('application/pdf,image/jpeg,image/png');
  });
});

describe('buildDealProofFormData (AC: 7)', () => {
  it('appends the file and trims the optional bank fields', () => {
    const formData = buildDealProofFormData(receiptBlob(), {
      bankReferenceCode: '  ELM-DEMO000001-C  ',
      senderBankName: '  بنك الراجحي ',
    });

    expect(formData.get('file')).toBeTruthy();
    expect(formData.get('bankReferenceCode')).toBe('ELM-DEMO000001-C');
    expect(formData.get('senderBankName')).toBe('بنك الراجحي');
  });

  it('omits blank optional fields instead of sending empty strings', () => {
    const formData = buildDealProofFormData(receiptBlob(), {
      bankReferenceCode: '   ',
      senderBankName: '',
    });

    expect(formData.get('file')).toBeTruthy();
    expect(formData.get('bankReferenceCode')).toBeNull();
    expect(formData.get('senderBankName')).toBeNull();
  });
});

describe('PaymentProofDropzone (AC: 7, UX-DR12)', () => {
  it('renders the verbatim copy, a keyboard-reachable zone and the file input label', () => {
    const html = renderToString(
      React.createElement(PaymentProofDropzone, {
        paymentType: PaymentType.PLATFORM_COMMISSION,
        title: 'سعي المنصة',
        onUpload: () => true,
      }),
    );

    expect(html).toContain(PROOF_DROPZONE_TITLE_AR);
    expect(html).toContain(PROOF_DROPZONE_FORMATS_AR);
    expect(html).toContain(`accept="${DEAL_PROOF_ACCEPT_ATTRIBUTE}"`);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('deal-proof-file-PLATFORM_COMMISSION');
    expect(html).toContain('رمز مرجع التحويل في الحوالة (اختياري)');
  });

  it('removes the optional inputs and states the reason once the zone is closed', () => {
    const html = renderToString(
      React.createElement(PaymentProofDropzone, {
        paymentType: PaymentType.SELLER_PURCHASE_PRICE,
        disabled: true,
        disabledReason: DEAL_COUNTDOWN_EXPIRED_AR,
        onUpload: () => true,
      }),
    );

    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(DEAL_COUNTDOWN_EXPIRED_AR);
    expect(html).not.toContain('اسم البنك المُحوِّل (اختياري)');
  });
});
