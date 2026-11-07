import { describe, expect, it, vi } from 'vitest';
import {
  DEAL_BUYER_PROFILE_REQUIRED,
  DEAL_IDENTITY_REQUIRED,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DEAL_TERMINAL,
} from '@elmasaif/shared';
import {
  DEAL_IDENTITY_NOTICE_AR,
  DEAL_PAYMENT_ERROR_HINTS_AR,
  DEAL_PAYMENT_POLL_INTERVAL_MS,
  DEAL_PAYMENT_UPLOAD_SUCCESS_AR,
  buildDealPaymentSummaryRows,
  formatCommissionRatePercent,
  resolveDealPaymentErrorHint,
  unwrapDealPaymentPayload,
  unwrapDealProofDownloadPayload,
} from '../deal-payment-view';

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn() },
  };
});

const DEAL_PAYMENT_PAYLOAD = {
  id: 'deal-1',
  dealNumber: 'DL-20261107-DEMO000001',
  dealReferenceCode: 'ELM-DEMO000001-C',
  status: 'AWAITING_PAYMENT_PROOF',
  listingId: 'listing-1',
  propertyTitle: 'فيلا في حي النرجس',
  dealPrice: '1450000.00',
  platformCommission: '36250.00',
  totalAmount: '1486250.00',
  commissionRateSnapshot: '0.025',
  paymentWindowHoursSnapshot: 48,
  paymentDeadline: '2026-11-09T00:00:00.000Z',
  createdAt: '2026-11-07T00:00:00.000Z',
  serverNow: '2026-11-07T00:00:00.000Z',
  platformAccount: {
    iban: 'SA0380000000608010167519',
    ibanFormatted: 'SA03 8000 0000 6080 1016 7519',
    accountHolderName: 'شركة المصايف للاستثمار',
    bankName: 'بنك الراجحي',
  },
  sellerPayout: {
    accountHolderName: 'مالك العقار',
    bankName: 'بنك الأهلي',
    iban: 'SA4420000001234567891234',
    ibanFormatted: 'SA44 2000 0001 2345 6789 1234',
    ibanMasked: 'SA44 **** **** **** 1234',
  },
  payments: [],
};

const NEW_REFUSAL_CODES = [
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_BUYER_PROFILE_REQUIRED,
  DEAL_TERMINAL,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_IDENTITY_REQUIRED,
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
];

describe('unwrapDealPaymentPayload (AC: 1)', () => {
  it('accepts the { statusCode, data } envelope', () => {
    const view = unwrapDealPaymentPayload({ statusCode: 200, data: DEAL_PAYMENT_PAYLOAD });

    expect(view?.id).toBe('deal-1');
    expect(view?.payments).toEqual([]);
  });

  it('accepts a bare view body', () => {
    expect(unwrapDealPaymentPayload(DEAL_PAYMENT_PAYLOAD)?.dealReferenceCode).toBe(
      'ELM-DEMO000001-C',
    );
  });

  it('rejects junk and bodies without a payments array', () => {
    expect(unwrapDealPaymentPayload(null)).toBeNull();
    expect(unwrapDealPaymentPayload('deal-1')).toBeNull();
    expect(unwrapDealPaymentPayload({ statusCode: 200, data: { id: 'deal-1' } })).toBeNull();
  });
});

describe('unwrapDealProofDownloadPayload (AC: 12)', () => {
  it('reads the enveloped and the bare download body', () => {
    const download = { downloadUrl: 'https://files.example/x', expiresInSeconds: 300 };

    expect(unwrapDealProofDownloadPayload({ statusCode: 200, data: download })).toEqual(download);
    expect(unwrapDealProofDownloadPayload(download)).toEqual(download);
  });

  it('returns null when there is no usable URL', () => {
    expect(unwrapDealProofDownloadPayload(null)).toBeNull();
    expect(unwrapDealProofDownloadPayload({ data: {} })).toBeNull();
  });
});

describe('buildDealPaymentSummaryRows (AC: 4)', () => {
  const view = unwrapDealPaymentPayload({ data: DEAL_PAYMENT_PAYLOAD });

  it('reads the frozen amounts back without recomputing anything', () => {
    const rows = buildDealPaymentSummaryRows(view!);

    expect(rows.map((row) => row.key)).toEqual([
      'dealPrice',
      'commissionRate',
      'platformCommission',
      'totalAmount',
    ]);
    expect(rows.map((row) => row.value)).toEqual([
      '1,450,000 ر.س',
      '2.5%',
      '36,250 ر.س',
      '1,486,250 ر.س',
    ]);
  });

  it('renders the frozen rate as a percentage and tolerates a missing snapshot', () => {
    expect(formatCommissionRatePercent('0.025')).toBe('2.5%');
    expect(formatCommissionRatePercent('0.0250')).toBe('2.5%');
    expect(formatCommissionRatePercent(null)).toBe('—');
    expect(formatCommissionRatePercent('not-a-rate')).toBe('—');
  });
});

describe('resolveDealPaymentErrorHint (AC: 13)', () => {
  it('has an Arabic hint for every refusal code this screen can receive', () => {
    NEW_REFUSAL_CODES.forEach((code) => {
      expect(DEAL_PAYMENT_ERROR_HINTS_AR[code]).toBeTruthy();
    });
  });

  it('maps a known code and falls back for an unknown one', () => {
    expect(resolveDealPaymentErrorHint(DEAL_PAYMENT_DEADLINE_PASSED)).toBe(
      DEAL_PAYMENT_ERROR_HINTS_AR[DEAL_PAYMENT_DEADLINE_PASSED],
    );
    expect(resolveDealPaymentErrorHint('SOMETHING_ELSE')).toBe(
      'تعذر تنفيذ الإجراء. أعد المحاولة بعد قليل.',
    );
    expect(resolveDealPaymentErrorHint(null, 'تعذر تحميل بيانات الصفقة.')).toBe(
      'تعذر تحميل بيانات الصفقة.',
    );
  });

  it('pins the shared cadence and the verbatim success / identity copy', () => {
    expect(DEAL_PAYMENT_POLL_INTERVAL_MS).toBe(20_000);
    expect(DEAL_PAYMENT_UPLOAD_SUCCESS_AR).toBe(
      'تم استلام إيصال التحويل وهو قيد المراجعة الإدارية',
    );
    expect(DEAL_IDENTITY_NOTICE_AR).toBe('أكمل توثيق هويتك لتفعيل إثباتات الدفع');
  });
});
