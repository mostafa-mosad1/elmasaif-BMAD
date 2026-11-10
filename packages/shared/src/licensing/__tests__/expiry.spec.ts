import { describe, it, expect } from 'vitest';
import { ListingStatus } from '../../enums';
import { COMPLIANCE_CATEGORY_FAL_EXPIRED } from '../../constants/licensing';
import {
  isFalLicenseExpired,
  calculateCalendarDaysRemaining,
  getFalLicenseWarningWindow,
  isListingEligibleForComplianceSuspension,
  isListingEligibleForReinstatement,
} from '../expiry';

describe('Fal License Expiry Pure Helpers', () => {
  const baseTime = new Date('2026-11-10T05:00:00.000Z');

  describe('isFalLicenseExpired', () => {
    it('returns true if expiryDate equals currentTime', () => {
      const license = { expiryDate: new Date('2026-11-10T05:00:00.000Z') };
      expect(isFalLicenseExpired(license, baseTime)).toBe(true);
    });

    it('returns true if expiryDate is in the past', () => {
      const license = { expiryDate: new Date('2026-11-09T23:59:59.000Z') };
      expect(isFalLicenseExpired(license, baseTime)).toBe(true);
    });

    it('returns false if expiryDate is in the future', () => {
      const license = { expiryDate: new Date('2026-11-10T05:00:01.000Z') };
      expect(isFalLicenseExpired(license, baseTime)).toBe(false);
    });

    it('supports ISO string dates', () => {
      const license = { expiryDate: '2026-11-01T00:00:00.000Z' };
      expect(isFalLicenseExpired(license, baseTime)).toBe(true);
    });
  });

  describe('calculateCalendarDaysRemaining', () => {
    it('calculates exact 30 days remaining in UTC calendar', () => {
      const expiry = new Date('2026-12-10T12:00:00.000Z');
      expect(calculateCalendarDaysRemaining(expiry, baseTime)).toBe(30);
    });

    it('calculates exact 7 days remaining', () => {
      const expiry = new Date('2026-11-17T00:00:00.000Z');
      expect(calculateCalendarDaysRemaining(expiry, baseTime)).toBe(7);
    });

    it('calculates exact 1 day remaining', () => {
      const expiry = new Date('2026-11-11T23:59:59.000Z');
      expect(calculateCalendarDaysRemaining(expiry, baseTime)).toBe(1);
    });

    it('returns 0 if on the same calendar day', () => {
      const expiry = new Date('2026-11-10T23:59:59.000Z');
      expect(calculateCalendarDaysRemaining(expiry, baseTime)).toBe(0);
    });

    it('returns negative number if past calendar day', () => {
      const expiry = new Date('2026-11-09T00:00:00.000Z');
      expect(calculateCalendarDaysRemaining(expiry, baseTime)).toBe(-1);
    });

    it('handles leap years correctly', () => {
      const leapBase = new Date('2028-02-28T05:00:00.000Z');
      const leapExpiry = new Date('2028-03-01T05:00:00.000Z');
      // 2028 is a leap year, so Feb 29 exists: 28 -> 29 -> March 1 = 2 days
      expect(calculateCalendarDaysRemaining(leapExpiry, leapBase)).toBe(2);
    });
  });

  describe('getFalLicenseWarningWindow', () => {
    it('returns 30 when 30 days remaining', () => {
      const expiry = new Date('2026-12-10T00:00:00.000Z');
      expect(getFalLicenseWarningWindow(expiry, baseTime)).toBe(30);
    });

    it('returns 7 when 7 days remaining', () => {
      const expiry = new Date('2026-11-17T00:00:00.000Z');
      expect(getFalLicenseWarningWindow(expiry, baseTime)).toBe(7);
    });

    it('returns 1 when 1 day remaining', () => {
      const expiry = new Date('2026-11-11T00:00:00.000Z');
      expect(getFalLicenseWarningWindow(expiry, baseTime)).toBe(1);
    });

    it('returns null for non-warning windows (e.g. 29, 15, 0 days)', () => {
      expect(getFalLicenseWarningWindow(new Date('2026-12-09T00:00:00.000Z'), baseTime)).toBeNull();
      expect(getFalLicenseWarningWindow(new Date('2026-11-25T00:00:00.000Z'), baseTime)).toBeNull();
      expect(getFalLicenseWarningWindow(new Date('2026-11-10T00:00:00.000Z'), baseTime)).toBeNull();
    });
  });

  describe('isListingEligibleForComplianceSuspension', () => {
    it('returns true ONLY for ACTIVE listings', () => {
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.ACTIVE })).toBe(true);
    });

    it('returns false for RESERVED listings (in-flight deals protected)', () => {
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.RESERVED })).toBe(false);
    });

    it('returns false for DRAFT, PENDING_REVIEW, SOLD, ARCHIVED, etc.', () => {
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.DRAFT })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.PENDING_REVIEW })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.PENDING_FEE })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.SOLD })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.ARCHIVED })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.SUSPENDED })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.BLOCKED })).toBe(false);
      expect(isListingEligibleForComplianceSuspension({ status: ListingStatus.UNDER_COMPLIANCE_REVIEW })).toBe(false);
    });
  });

  describe('isListingEligibleForReinstatement', () => {
    it('returns true strictly if status is UNDER_COMPLIANCE_REVIEW and complianceCategory is FAL_LICENSE_EXPIRED', () => {
      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(true);
    });

    it('returns false if status is UNDER_COMPLIANCE_REVIEW but complianceCategory is different (e.g. FRAUD, MISLEADING)', () => {
      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          complianceCategory: 'TITLE_DEED_MISMATCH',
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
          complianceCategory: null,
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
        }),
      ).toBe(false);
    });

    it('returns false for listings in any other status even if complianceCategory matches', () => {
      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.ACTIVE,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.RESERVED,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.BLOCKED,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.ARCHIVED,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(false);

      expect(
        isListingEligibleForReinstatement({
          status: ListingStatus.DRAFT,
          complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
        }),
      ).toBe(false);
    });
  });
});
