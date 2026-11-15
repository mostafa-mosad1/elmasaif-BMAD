import { z } from 'zod';
import { financialReportQuerySchema } from '../schemas/finance.schema';

export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>;

export interface FinancialIndicatorsDto {
  grossTransactionVolumeSar: number;
  confirmedCommissionsSar: number;
  collectedContractFeesSar: number;
  totalVatSar: number;
  totalNetRevenueSar: number;
  completedDealsCount: number;
  signedContractsCount: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface FinancialTransactionRowDto {
  id: string;
  type: 'DEAL_COMMISSION' | 'OWNER_CONTRACT_FEE';
  referenceCode: string;
  date: string;
  propertyTitle: string;
  city: string;
  propertyType: string;
  grossValueSar: number;
  feeSar: number;
  vatSar: number;
  totalSar: number;
  counterpartyName: string;
  status: string;
}

export interface PaginatedFinancialTransactionsDto {
  items: FinancialTransactionRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

