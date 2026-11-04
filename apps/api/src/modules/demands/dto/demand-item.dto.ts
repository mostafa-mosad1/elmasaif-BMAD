import { DemandStatus, PropertyType } from '@elmasaif/shared';

/**
 * Buyer-facing demand projection (Story 3.6 / FR-58). Deliberately API-local: the
 * shared contract surface stays limited to the demand schemas + constants.
 * Budget/area Decimal ranges are emitted as numbers (Consistency Conventions).
 */
export interface DemandItem {
  id: string;
  propertyType: PropertyType;
  status: DemandStatus;
  cityId: string;
  districtId: string | null;
  cityName: string | null;
  districtName: string | null;
  minBudget: number;
  maxBudget: number;
  minArea: number;
  maxArea: number;
  notes: string | null;
  expiresAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}
