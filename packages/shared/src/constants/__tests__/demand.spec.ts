import { describe, it, expect } from 'vitest';
import {
  DEMAND_NOT_FOUND,
  DEMAND_NOT_CANCELLABLE,
  DEMAND_FORBIDDEN,
  DEMAND_STATUS_LABELS_AR,
  DEMAND_EXPIRY_DAYS,
  DemandStatus,
} from '../../index';

describe('Buyer Demand Constants (Story 3.6 / FR-21 / FR-58)', () => {
  it('exposes the structured error codes consumed by the API and the web', () => {
    expect(DEMAND_NOT_FOUND).toBe('DEMAND_NOT_FOUND');
    expect(DEMAND_NOT_CANCELLABLE).toBe('DEMAND_NOT_CANCELLABLE');
    expect(DEMAND_FORBIDDEN).toBe('DEMAND_FORBIDDEN');
  });

  it('keeps the 30-day demand expiry window', () => {
    expect(DEMAND_EXPIRY_DAYS).toBe(30);
  });

  it('labels every DemandStatus in Arabic with no gaps', () => {
    const statuses = Object.values(DemandStatus);
    expect(statuses).toContain(DemandStatus.CANCELLED);
    expect(statuses).toHaveLength(5);
    for (const status of statuses) {
      expect(DEMAND_STATUS_LABELS_AR[status]).toBeTruthy();
    }
    expect(DEMAND_STATUS_LABELS_AR[DemandStatus.ACTIVE]).toBe('نشط');
    expect(DEMAND_STATUS_LABELS_AR[DemandStatus.CANCELLED]).toBe('ملغي');
    expect(DEMAND_STATUS_LABELS_AR[DemandStatus.EXPIRED]).toBe('منتهي الصلاحية');
  });
});
