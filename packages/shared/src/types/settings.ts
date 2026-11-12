/**
 * Platform settings data transfer objects & input types
 * (Story 8.6 / AC1).
 */

export interface PlatformSettingsDto {
  id: string;
  commissionRate: number; // e.g. 0.025
  commissionRatePercentage: number; // e.g. 2.5
  fixedFeeAmountSar: number; // e.g. 0.00
  ownerContractFeeSar: number; // e.g. 1000.00
  vatRatePercentage: number; // e.g. 15.00
  platformCollectionIban?: string | null;
  platformAccountHolderName?: string | null;
  platformBankName?: string | null;
  paymentWindowHours: number;
  paymentCorrectionHours: number;
  contractFeeDeadlineDays: number;
  coolingOffPeriodDays: number;
  dealReviewSlaAlertHours: number;
  dealReviewSlaEscalationHours: number;
  dealReviewSlaSuperAdminHours: number;
  ticketSlaFirstResponseHours: number;
  ticketSlaResolutionHours: number;
  taskClaimLeaseMinutes: number;
  taskClaimHeartbeatMinutes: number;
  fraudRejectedProofThreshold: number;
  fraudWindowHours: number;
  updatedByAdminId?: string | null;
  updatedByAdminName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPlatformSettingsDto {
  commissionRate: number;
  commissionRatePercentage: number;
  fixedFeeAmountSar: number;
  ownerContractFeeSar: number;
  vatRatePercentage: number;
  paymentWindowHours: number;
}

export interface UpdatePlatformSettingsInput {
  commissionRatePercentage?: number;
  fixedFeeAmountSar?: number;
  ownerContractFeeSar?: number;
  vatRatePercentage?: number;
  paymentWindowHours?: number;
  paymentCorrectionHours?: number;
  contractFeeDeadlineDays?: number;
  coolingOffPeriodDays?: number;
  dealReviewSlaAlertHours?: number;
  dealReviewSlaEscalationHours?: number;
  dealReviewSlaSuperAdminHours?: number;
  ticketSlaFirstResponseHours?: number;
  ticketSlaResolutionHours?: number;
  taskClaimLeaseMinutes?: number;
  taskClaimHeartbeatMinutes?: number;
  fraudRejectedProofThreshold?: number;
  fraudWindowHours?: number;
  platformCollectionIban?: string | null;
  platformAccountHolderName?: string | null;
  platformBankName?: string | null;
  justificationReason: string;
}

export interface PlatformSettingsAuditEntryDto {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  timestamp: string;
  justificationReason: string;
  ipAddress?: string | null;
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  changedKeys: string[];
}

