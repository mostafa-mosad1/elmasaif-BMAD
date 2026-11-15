import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../common/clock/clock.service';
import {
  FinancialIndicatorsDto,
  FinancialTransactionRowDto,
  PaginatedFinancialTransactionsDto,
  FinancialReportQuery,
  SAUDI_VAT_RATE,
  AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED,
  DealStatus,
} from '@elmasaif/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly clockService: ClockService,
  ) {}

  async getIndicators(query: Partial<FinancialReportQuery> = {}): Promise<FinancialIndicatorsDto> {
    const { dealWhere, contractPaymentWhere } = this.buildWhereFilters(query);

    // Only COMPLETED deals represent finalized sales volume & commissions
    dealWhere.status = DealStatus.COMPLETED;
    contractPaymentWhere.status = { in: ['APPROVED', 'CONFIRMED'] };

    const [dealAgg, contractFeeAgg, signedContractsCount] = await Promise.all([
      this.prisma.deal.aggregate({
        where: dealWhere,
        _sum: {
          dealPrice: true,
          platformCommission: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.contractFeePayment.aggregate({
        where: contractPaymentWhere,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.ownerContract.count({
        where: {
          status: { in: ['ACTIVE', 'COMPLETED'] },
          ...(query.startDate || query.endDate
            ? {
                createdAt: {
                  gte: query.startDate ? new Date(query.startDate) : undefined,
                  lte: query.endDate ? new Date(query.endDate) : undefined,
                },
              }
            : {}),
        },
      }),
    ]);

    const grossTransactionVolumeSar = Number(dealAgg._sum.dealPrice ?? 0);
    const confirmedCommissionsSar = Number(dealAgg._sum.platformCommission ?? 0);
    const collectedContractFeesSar = Number(contractFeeAgg._sum.amount ?? 0);
    const totalGrossRevenue = confirmedCommissionsSar + collectedContractFeesSar;

    const totalVatSar = Math.round(totalGrossRevenue * SAUDI_VAT_RATE * 100) / 100;
    const totalNetRevenueSar = Math.round((totalGrossRevenue - totalVatSar) * 100) / 100;
    const completedDealsCount = dealAgg._count.id ?? 0;

    return {
      grossTransactionVolumeSar,
      confirmedCommissionsSar,
      collectedContractFeesSar,
      totalVatSar,
      totalNetRevenueSar,
      completedDealsCount,
      signedContractsCount,
      periodStart: query.startDate,
      periodEnd: query.endDate,
    };
  }

  async getTransactions(
    query: Partial<FinancialReportQuery> = {},
  ): Promise<PaginatedFinancialTransactionsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const rows = await this.fetchAllTransactionRows(query);
    const total = rows.length;
    const skip = (page - 1) * limit;
    const items = rows.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async exportReportCsv(
    adminId: string,
    query: Partial<FinancialReportQuery> = {},
  ): Promise<{ csvContent: string; filename: string; rowCount: number }> {
    const rows = await this.fetchAllTransactionRows(query);
    const now = this.clockService.now();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `financial-report-${dateStr}.csv`;

    const headers = [
      'معرف المعاملة',
      'نوع المعاملة',
      'رقم المرجع',
      'التاريخ',
      'اسم العقار',
      'المدينة',
      'نوع العقار',
      'القيمة الإجمالية (ر.س)',
      'عمولة المنصة (ر.س)',
      'رسوم العقد (ر.س)',
      'ضريبة القيمة المضافة (15%)',
      'الإجمالي بالريال',
      'اسم الطرف المعني',
      'حالة المعاملة',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.map(escapeCsv).join(',')];

    for (const r of rows) {
      csvLines.push(
        [
          r.id,
          r.type === 'DEAL_COMMISSION' ? 'عمولة صفقة بيع' : 'رسوم عقد وساطة مالك',
          r.referenceCode,
          r.date,
          r.propertyTitle,
          r.city,
          r.propertyType,
          r.grossValueSar.toFixed(2),
          r.feeSar.toFixed(2),
          r.type === 'OWNER_CONTRACT_FEE' ? r.feeSar.toFixed(2) : '0.00',
          r.vatSar.toFixed(2),
          r.totalSar.toFixed(2),
          r.counterpartyName,
          r.status,
        ]
          .map(escapeCsv)
          .join(','),
      );
    }

    // UTF-8 BOM (\uFEFF) ensures Excel renders Arabic properly without mojibake
    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    // Audit log
    await this.auditService.record(this.prisma, {
      actorId: adminId,
      actorType: 'ADMIN',
      action: AUDIT_ACTION_FINANCIAL_REPORT_EXPORTED,
      entityType: 'FinancialReport',
      entityId: `EXP-${dateStr}`,
      justificationReason: 'تصدير تقرير المعاملات المالية والمحاسبية',
      metadata: {
        query,
        rowCount: rows.length,
        filename,
      },
    });

    this.logger.log(`Financial report exported by admin ${adminId} (${rows.length} rows)`);

    return {
      csvContent,
      filename,
      rowCount: rows.length,
    };
  }

  private async fetchAllTransactionRows(
    query: Partial<FinancialReportQuery> = {},
  ): Promise<FinancialTransactionRowDto[]> {
    const { dealWhere, contractPaymentWhere } = this.buildWhereFilters(query);

    const [deals, contractPayments] = await Promise.all([
      this.prisma.deal.findMany({
        where: dealWhere,
        include: {
          listing: {
            include: {
              city: true,
            },
          },
          buyerProfile: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contractFeePayment.findMany({
        where: contractPaymentWhere,
        include: {
          ownerContract: {
            include: {
              listing: {
                include: {
                  city: true,
                },
              },
              ownerProfile: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rows: FinancialTransactionRowDto[] = [];

    for (const d of deals) {
      const gross = Number(d.dealPrice);
      const commission = Number(d.platformCommission);
      const vat = Math.round(commission * SAUDI_VAT_RATE * 100) / 100;
      rows.push({
        id: d.id,
        type: 'DEAL_COMMISSION',
        referenceCode: d.dealNumber,
        date: d.createdAt.toISOString().split('T')[0],
        propertyTitle: d.listing?.title || 'عقار غير محدد',
        city: d.listing?.city?.nameAr || 'غير محدد',
        propertyType: d.listing?.propertyType || 'غير محدد',
        grossValueSar: gross,
        feeSar: commission,
        vatSar: vat,
        totalSar: commission,
        counterpartyName: d.buyerProfile?.user?.fullName || 'مشتري غير محدد',
        status: d.status,
      });
    }

    for (const p of contractPayments) {
      const fee = Number(p.amount);
      const vat = Math.round(fee * SAUDI_VAT_RATE * 100) / 100;
      rows.push({
        id: p.id,
        type: 'OWNER_CONTRACT_FEE',
        referenceCode: p.bankReferenceCode || p.id.substring(0, 8),
        date: p.createdAt.toISOString().split('T')[0],
        propertyTitle: p.ownerContract?.listing?.title || 'عقد وساطة مالك',
        city: p.ownerContract?.listing?.city?.nameAr || 'غير محدد',
        propertyType: p.ownerContract?.listing?.propertyType || 'غير محدد',
        grossValueSar: fee,
        feeSar: fee,
        vatSar: vat,
        totalSar: fee,
        counterpartyName: p.ownerContract?.ownerProfile?.user?.fullName || 'مالك العقار',
        status: p.status,
      });
    }

    // Sort combined rows by date descending
    rows.sort((a, b) => b.date.localeCompare(a.date));

    return rows;
  }

  private buildWhereFilters(query: Partial<FinancialReportQuery> = {}) {
    const dealWhere: Prisma.DealWhereInput = {};
    const contractPaymentWhere: Prisma.ContractFeePaymentWhereInput = {};

    if (query.startDate || query.endDate) {
      dealWhere.createdAt = {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined,
      };
      contractPaymentWhere.createdAt = {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined,
      };
    }

    if (query.propertyType) {
      dealWhere.listing = {
        propertyType: query.propertyType,
      };
      contractPaymentWhere.ownerContract = {
        listing: {
          propertyType: query.propertyType,
        },
      };
    }

    if (query.cityId) {
      dealWhere.listing = {
        ...(dealWhere.listing as any),
        cityId: query.cityId,
      };
      contractPaymentWhere.ownerContract = {
        listing: {
          ...((contractPaymentWhere.ownerContract as any)?.listing || {}),
          cityId: query.cityId,
        },
      };
    }

    return { dealWhere, contractPaymentWhere };
  }
}
