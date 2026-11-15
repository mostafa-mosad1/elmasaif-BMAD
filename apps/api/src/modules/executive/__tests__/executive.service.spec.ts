import { Test, TestingModule } from '@nestjs/testing';
import { ExecutiveService } from '../executive.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { Prisma } from '@prisma/client';

describe('ExecutiveService', () => {
  let service: ExecutiveService;
  let prisma: any;
  let clockService: any;

  beforeEach(async () => {
    prisma = {
      deal: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { dealPrice: new Prisma.Decimal(0) } }),
      },
      payment: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
      },
      contractFeePayment: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
      },
      listing: {
        count: jest.fn().mockResolvedValue(0),
      },
      falLicense: {
        count: jest.fn().mockResolvedValue(0),
      },
      supportTicket: {
        count: jest.fn().mockResolvedValue(0),
      },
      violationReport: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date('2026-11-15T12:00:00.000Z')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutiveService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    service = module.get<ExecutiveService>(ExecutiveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate 48h deals, pending queues, SLA warnings, and financial throughput', async () => {
      prisma.deal.count
        .mockResolvedValueOnce(3) // activeInPaymentWindow
        .mockResolvedValueOnce(2) // completedLast48h
        .mockResolvedValueOnce(1) // pendingReviewLast48h
        .mockResolvedValueOnce(0) // unassignedDisputes
        .mockResolvedValueOnce(1); // dealsExpiringSoon12h

      prisma.deal.aggregate
        .mockResolvedValueOnce({ _sum: { dealPrice: new Prisma.Decimal(1500000) } }) // 48h total volume
        .mockResolvedValueOnce({ _sum: { dealPrice: new Prisma.Decimal(5000000), platformCommission: new Prisma.Decimal(125000) } }); // 30d deal throughput

      prisma.listing.count
        .mockResolvedValueOnce(4) // listingsModeration
        .mockResolvedValueOnce(2) // listings locked
        .mockResolvedValueOnce(1); // listingsPendingOver24h

      prisma.falLicense.count.mockResolvedValueOnce(2); // falVerifications
      prisma.payment.count
        .mockResolvedValueOnce(3) // paymentProofReviews
        .mockResolvedValueOnce(1); // payments locked

      prisma.contractFeePayment.count.mockResolvedValueOnce(2); // contractFeeReviews
      prisma.contractFeePayment.aggregate.mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal(10000) },
      }); // 30d contract fee throughput

      prisma.supportTicket.count
        .mockResolvedValueOnce(5) // openTickets
        .mockResolvedValueOnce(1); // ticketsSlaBreached

      prisma.violationReport.count.mockResolvedValueOnce(3); // pendingViolationReports

      const metrics = await service.getDashboardMetrics();

      expect(metrics.dealCounts48h.activeInPaymentWindow).toBe(3);
      expect(metrics.dealCounts48h.completedLast48h).toBe(2);
      expect(metrics.dealCounts48h.totalVolumeLast48hSar).toBe(1500000);

      expect(metrics.pendingQueues.listingsModeration).toBe(4);
      expect(metrics.pendingQueues.falVerifications).toBe(2);
      expect(metrics.pendingQueues.openTickets).toBe(5);

      expect(metrics.slaWarnings.dealsExpiringSoon12h).toBe(1);
      expect(metrics.slaWarnings.listingsPendingOver24h).toBe(1);
      expect(metrics.slaWarnings.ticketsSlaBreached).toBe(1);

      expect(metrics.financialThroughput30d.grossVolumeSar).toBe(5000000);
      expect(metrics.financialThroughput30d.commissionsSar).toBe(125000);
      expect(metrics.financialThroughput30d.contractFeesSar).toBe(10000);
    });
  });
});
