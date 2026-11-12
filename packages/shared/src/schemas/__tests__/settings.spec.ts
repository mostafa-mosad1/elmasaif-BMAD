import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_PLATFORM_COMMISSION_PERCENTAGE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
  DEFAULT_VAT_RATE_PERCENTAGE,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  DEFAULT_PAYMENT_CORRECTION_HOURS,
  DEFAULT_CONTRACT_FEE_DEADLINE_DAYS,
  DEFAULT_COOLING_OFF_PERIOD_DAYS,
  DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS,
  DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS,
  DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS,
  DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS,
  DEFAULT_TICKET_SLA_RESOLUTION_HOURS,
  DEFAULT_TASK_CLAIM_LEASE_MINUTES,
  DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES,
  DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD,
  DEFAULT_FRAUD_WINDOW_HOURS,
  PLATFORM_SETTINGS_UPDATED,
  SETTINGS_NOT_FOUND,
} from '../../constants/settings';
import {
  updatePlatformSettingsSchema,
  publicPlatformSettingsSchema,
} from '../settings.schema';

describe('Story 8.6 / Platform Settings Constants & Schemas (AC1)', () => {
  describe('Canonical Default Platform Parameter Constants', () => {
    it('defines correct canonical values matching requirements', () => {
      expect(DEFAULT_PLATFORM_COMMISSION_RATE).toBe(0.025);
      expect(DEFAULT_PLATFORM_COMMISSION_PERCENTAGE).toBe(2.5);
      expect(DEFAULT_FIXED_COMMISSION_SAR).toBe('0.00');
      expect(DEFAULT_OWNER_CONTRACT_FEE_SAR).toBe(1000);
      expect(DEFAULT_VAT_RATE_PERCENTAGE).toBe(15.0);
      expect(DEFAULT_PAYMENT_WINDOW_HOURS).toBe(48);
      expect(DEFAULT_PAYMENT_CORRECTION_HOURS).toBe(12);
      expect(DEFAULT_CONTRACT_FEE_DEADLINE_DAYS).toBe(7);
      expect(DEFAULT_COOLING_OFF_PERIOD_DAYS).toBe(14);
      expect(DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS).toBe(4);
      expect(DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS).toBe(12);
      expect(DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS).toBe(24);
      expect(DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS).toBe(4);
      expect(DEFAULT_TICKET_SLA_RESOLUTION_HOURS).toBe(48);
      expect(DEFAULT_TASK_CLAIM_LEASE_MINUTES).toBe(15);
      expect(DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES).toBe(5);
      expect(DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD).toBe(3);
      expect(DEFAULT_FRAUD_WINDOW_HOURS).toBe(72);
      expect(PLATFORM_SETTINGS_UPDATED).toBe('PLATFORM_SETTINGS_UPDATED');
      expect(SETTINGS_NOT_FOUND).toBe('SETTINGS_NOT_FOUND');
    });
  });

  describe('updatePlatformSettingsSchema', () => {
    const validPayload = {
      commissionRatePercentage: 2.5,
      fixedFeeAmountSar: 0.0,
      ownerContractFeeSar: 1000.0,
      vatRatePercentage: 15.0,
      paymentWindowHours: 48,
      paymentCorrectionHours: 12,
      contractFeeDeadlineDays: 7,
      coolingOffPeriodDays: 14,
      dealReviewSlaAlertHours: 4,
      dealReviewSlaEscalationHours: 12,
      dealReviewSlaSuperAdminHours: 24,
      ticketSlaFirstResponseHours: 4,
      ticketSlaResolutionHours: 48,
      taskClaimLeaseMinutes: 15,
      taskClaimHeartbeatMinutes: 5,
      fraudRejectedProofThreshold: 3,
      fraudWindowHours: 72,
      platformCollectionIban: 'SA0380000000608010167519',
      platformAccountHolderName: 'شركة المصايف العقارية المحدودة',
      platformBankName: 'البنك الأهلي السعودي',
      justificationReason: 'تحديث هوامش العمليات المالية للربع السنوي الجديد وفق موافقة الإدارة',
    };

    it('accepts valid complete configuration payload', () => {
      const parsed = updatePlatformSettingsSchema.parse(validPayload);
      expect(parsed.commissionRatePercentage).toBe(2.5);
      expect(parsed.justificationReason).toBe(validPayload.justificationReason);
    });

    it('requires justificationReason of at least 5 chars', () => {
      const invalid = { ...validPayload, justificationReason: 'تعديل' }; // only 5 characters or less check
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, justificationReason: '   ' }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, justificationReason: 'قصير' }),
      ).toThrow();
    });

    it('validates commissionRatePercentage range [0.00, 25.00]', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, commissionRatePercentage: -0.1 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, commissionRatePercentage: 25.01 }),
      ).toThrow();
      expect(
        updatePlatformSettingsSchema.parse({ ...validPayload, commissionRatePercentage: 0 }).commissionRatePercentage,
      ).toBe(0);
      expect(
        updatePlatformSettingsSchema.parse({ ...validPayload, commissionRatePercentage: 25.0 }).commissionRatePercentage,
      ).toBe(25);
    });

    it('validates fee amounts are non-negative within caps', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, fixedFeeAmountSar: -1 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, fixedFeeAmountSar: 50000.01 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, ownerContractFeeSar: -1 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, ownerContractFeeSar: 20000.01 }),
      ).toThrow();
    });

    it('validates VAT rate percentage range [0.00, 50.00]', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, vatRatePercentage: -1 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, vatRatePercentage: 50.01 }),
      ).toThrow();
    });

    it('validates payment and SLA window ranges', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, paymentWindowHours: 0 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, paymentWindowHours: 169 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, paymentCorrectionHours: 0 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, contractFeeDeadlineDays: 0 }),
      ).toThrow();
      expect(() =>
        updatePlatformSettingsSchema.parse({ ...validPayload, coolingOffPeriodDays: 91 }),
      ).toThrow();
    });

    it('enforces SLA hierarchy: alert < escalation < superadmin', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          dealReviewSlaAlertHours: 12,
          dealReviewSlaEscalationHours: 10,
        }),
      ).toThrow();

      expect(() =>
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          dealReviewSlaEscalationHours: 24,
          dealReviewSlaSuperAdminHours: 20,
        }),
      ).toThrow();
    });

    it('enforces task claim heartbeat < lease duration', () => {
      expect(() =>
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          taskClaimLeaseMinutes: 10,
          taskClaimHeartbeatMinutes: 15,
        }),
      ).toThrow();
    });

    it('validates Saudi IBAN mod-97 check if provided', () => {
      // Valid mod-97 IBAN
      expect(
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          platformCollectionIban: 'SA0380000000608010167519',
        }).platformCollectionIban,
      ).toBe('SA0380000000608010167519');

      // Invalid mod-97 IBAN
      expect(() =>
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          platformCollectionIban: 'SA9980000000608010167519',
        }),
      ).toThrow();

      // Null or empty string allows clearing IBAN
      expect(
        updatePlatformSettingsSchema.parse({
          ...validPayload,
          platformCollectionIban: null,
        }).platformCollectionIban,
      ).toBeNull();
    });
  });

  describe('publicPlatformSettingsSchema', () => {
    it('validates public projection correctly', () => {
      const publicData = {
        commissionRate: 0.025,
        commissionRatePercentage: 2.5,
        fixedFeeAmountSar: 0,
        ownerContractFeeSar: 1000,
        vatRatePercentage: 15,
        paymentWindowHours: 48,
      };

      const parsed = publicPlatformSettingsSchema.parse(publicData);
      expect(parsed.commissionRatePercentage).toBe(2.5);
      expect(parsed.paymentWindowHours).toBe(48);
    });
  });
});

