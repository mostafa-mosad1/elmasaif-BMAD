import { DemandStatus, PropertyType } from '@elmasaif/shared';

/**
 * Buyer demand projection returned by `POST /demands`, `GET /demands/my` and
 * `POST /demands/:id/cancel` (Story 3.6 / FR-58). Mirrors the API `DemandItem`.
 */
export interface BuyerDemandItem {
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
