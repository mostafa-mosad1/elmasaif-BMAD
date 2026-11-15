import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from '../finance.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ClockService } from '../../../common/clock/clock.service';
import { DealStatus, AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED } from '@elmasaif/shared';
import { Prisma } from '@prisma/client';

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: any;
  let auditService: any;
  let clockService: any;

  const mockAdminId = 'adm-00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      deal: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      contractFeePayment: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      ownerContract: {
        count: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date('2026-11-15T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getIndicators', () => {
    it('should calculate gross volume, commissions, contract fees, 15% VAT and net revenue', async () => {
      prisma.deal.aggregate.mockResolvedValueOnce({
        _sum: {
          dealPrice: new Prisma.Decimal(1000000),
          platformCommission: new Prisma.Decimal(25000),
        },
        _count: { id: 2 },
      });

      prisma.contractFeePayment.aggregate.mockResolvedValueOnce({
        _sum: {
          amount: new Prisma.Decimal(5000), // 5 contracts * 1000 SAR
        },
        _count: { id: 5 },
      });

      prisma.ownerContract.count.mockResolvedValueOnce(5);

      const indicators = await service.getIndicators({});

      expect(indicators.grossTransactionVolumeSar).toBe(1000000);
      expect(indicators.confirmedCommissionsSar).toBe(25000);
      expect(indicators.collectedContractFeesSar).toBe(5000);
      // Total fees = 25000 + 5000 = 30000 SAR
      // 15% VAT = 4500 SAR
      expect(indicators.totalVatSar).toBe(4500);
      // Net revenue = 30000 - 4500 = 25500 SAR
      expect(indicators.totalNetRevenueSar).toBe(25500);
      expect(indicators.completedDealsCount).toBe(2);
      expect(indicators.signedContractsCount).toBe(5);
    });
  });

  describe('exportReportCsv', () => {
    it('should export UTF-8 BOM formatted CSV and record immutable audit log', async () => {
      prisma.deal.findMany.mockResolvedValueOnce([
        {
          id: 'deal-1',
          dealNumber: 'DL-2026-0001',
          createdAt: new Date('2026-11-10T10:00:00.000Z'),
          dealPrice: new Prisma.Decimal(500000),
          platformCommission: new Prisma.Decimal(12500),
          status: DealStatus.COMPLETED,
          listing: {
            title: 'فيلا فاخرة في حطين',
            propertyType: 'VILLA',
            city: { nameAr: 'الرياض' },
          },
          buyerProfile: {
            user: { fullName: 'محمد القحطاني' },
          },
        },
      ]);

      prisma.contractFeePayment.findMany.mockResolvedValueOnce([]);

      const result = await service.exportReportCsv(mockAdminId, {});

      expect(result.csvContent.startsWith('\uFEFF')).toBe(true);
      expect(result.csvContent).toContain('معرف المعاملة');
      expect(result.csvContent).toContain('فيلا فاخرة في حطين');
      expect(result.csvContent).toContain('محمد القحطاني');
      expect(result.rowCount).toBe(1);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED,
        }),
      );
    });
  });
});

