import { ListingStatus } from '../enums';
import { COMPLIANCE_CATEGORY_FAL_EXPIRED } from '../constants/licensing';

/**
 * Evaluates whether a Fal license is expired relative to the given reference time.
 * Enforces strict non-unmockable clock evaluation.
 */
export function isFalLicenseExpired(
  license: { expiryDate: Date | string },
  currentTime: Date,
): boolean {
  const expiry = new Date(license.expiryDate);
  return expiry.getTime() <= currentTime.getTime();
}

/**
 * Calculates remaining calendar days in UTC between currentTime and expiryDate.
 * Returns negative if expiryDate is on a past calendar day, 0 if on the same day.
 */
export function calculateCalendarDaysRemaining(
  expiryDate: Date | string,
  currentTime: Date,
): number {
  const exp = new Date(expiryDate);
  const cur = new Date(currentTime);

  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  const curUtc = Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate());
  const msPerDay = 24 * 60 * 60 * 1000;

  return Math.round((expUtc - curUtc) / msPerDay);
}

/**
 * Determines if a Fal license qualifies for a warning window (30, 7, or 1 days).
 * Returns null if outside specified warning windows.
 */
export function getFalLicenseWarningWindow(
  expiryDate: Date | string,
  currentTime: Date,
): 30 | 7 | 1 | null {
  const days = calculateCalendarDaysRemaining(expiryDate, currentTime);
  if (days === 30) return 30;
  if (days === 7) return 7;
  if (days === 1) return 1;
  return null;
}

/**
 * Evaluates whether a listing is eligible for automatic compliance suspension
 * upon broker's Fal license expiration.
 *
 * Rule (FR-7 / BR-14):
 * ONLY ACTIVE listings are suspended into UNDER_COMPLIANCE_REVIEW.
 * In-flight deals (RESERVED) are strictly protected to continue uninterrupted.
 * Non-active listings (DRAFT, PENDING_REVIEW, SOLD, ARCHIVED, etc.) are untouched.
 */
export function isListingEligibleForComplianceSuspension(listing: {
  status: ListingStatus;
}): boolean {
  return listing.status === ListingStatus.ACTIVE;
}

/**
 * Evaluates whether a listing is eligible for automatic compliance reinstatement
 * upon broker's Fal license renewal approval.
 *
 * Rule (FR-8 / BR-14 / UC-43):
 * Returns true strictly if:
 *   listing.status === ListingStatus.UNDER_COMPLIANCE_REVIEW AND
 *   listing.complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED
 * All other listings (other statuses or other compliance reasons) return false.
 */
export function isListingEligibleForReinstatement(listing: {
  status: ListingStatus;
  complianceCategory?: string | null;
}): boolean {
  return (
    listing.status === ListingStatus.UNDER_COMPLIANCE_REVIEW &&
    listing.complianceCategory === COMPLIANCE_CATEGORY_FAL_EXPIRED
  );
}


