import { DemandStatus } from '../enums';

// Buyer Demand Lifecycle Constants (Story 3.6 / FR-21 / FR-58)
export const DEMAND_NOT_FOUND = 'DEMAND_NOT_FOUND';
export const DEMAND_NOT_CANCELLABLE = 'DEMAND_NOT_CANCELLABLE';
export const DEMAND_FORBIDDEN = 'DEMAND_FORBIDDEN';

export const DEMAND_STATUS_LABELS_AR: Record<DemandStatus, string> = {
  [DemandStatus.ACTIVE]: 'نشط',
  [DemandStatus.MATCHED]: 'تمت مطابقته',
  [DemandStatus.EXPIRED]: 'منتهي الصلاحية',
  [DemandStatus.CANCELLED]: 'ملغي',
  [DemandStatus.CLOSED]: 'مغلق',
};
