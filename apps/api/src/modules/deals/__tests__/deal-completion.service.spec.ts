import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DEAL_COMPLETED,
  DEAL_PAYMENT_STATUS,
  DealStatus,
  INVOICE_GENERATED,
  ListingStatus,
  OwnerContractStatus,
} from '@elmasaif/shared';
import { DealCompletionService } from '../deal-completion.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { BackupOffersService } from '../../offers/backup-offers.service';

describe('DealCompletionService (Story 5.4) (AC: 1, 2, 3, 7)', () => {
  let service: DealCompletionService;
  let prisma: any;
  let clockService: any;
  let backupOffersService: any;

  const mockNow = new Date('2026-11-07T12:00:00.000Z');
  const adminActor = {
    id: 'admin-123',
    fullName: 'مشرف النظام',
    role: 'SUPER_ADMIN',
  };

  const dealId = 'deal-uuid-1';
  const listingId = 'listing-uuid-1';
  const buyerProfileId = 'buyer-prof-uuid-1';
  const sellerProfileId = 'seller-prof-uuid-1';

  const makeMockDeal = (overrides: Record<string, any> = {}) => ({
    id: dealId,
    dealNumber: 'DL-20261107-0001',
    dealReferenceCode: 'MSF-DEAL-0001',
    listingId,
    buyerProfileId,
    sellerProfileId,
    status: DealStatus.UNDER_ADMIN_AUDIT,
    dealPrice: '2000000.00',
    platformCommission: '50000.00',
    totalAmount: '2050000.00',
    commissionRateSnapshot: '0.0250',
    version: 1,
    payments: [
      {
        id: 'pay-1',
        paymentType: 'PLATFORM_COMMISSION',
        status: DEAL_PAYMENT_STATUS.CONFIRMED,
        amount: '50000.00',
      },
      {
        id: 'pay-2',
        paymentType: 'SELLER_PURCHASE_PRICE',
        status: DEAL_PAYMENT_STATUS.CONFIRMED,
        amount: '2000000.00',
      },
    ],
    listing: {
      id: listingId,
      status: ListingStatus.RESERVED,
      version: 1,
    },
    buyerProfile: {
      id: buyerProfileId,
      userId: 'buyer-user-1',
      user: {
        id: 'buyer-user-1',
        fullName: 'طارق المشتري',
        mobileNumber: '+966501234567',
        nationalId: '1012345678',
        email: 'tariq@example.com',
      },
    },
    sellerProfile: {
      id: sellerProfileId,
      userId: 'seller-user-1',
      user: {
        id: 'seller-user-1',
        fullName: 'سارة البائعة',
        mobileNumber: '+966559876543',
        nationalId: '1087654321',
        email: 'sara@example.com',
      },
      falLicense: {
        crNumber: '1010999999',
        commercialName: 'مؤسسة الأفق العقارية',
      },
    },
    ...overrides,
  });

  let mockTx: any;

  beforeEach(async () => {
    clockService = {
      now: jest.fn(() => mockNow),
    };

    backupOffersService = {
      closeRemainingBackupOffersForListing: jest.fn().mockResolvedValue({
        closedCount: 2,
        offerIds: ['offer-backup-1', 'offer-backup-2'],
      }),
    };

    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      deal: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...makeMockDeal(),
          ...data,
        })),
      },
      listing: {
        update: jest.fn().mockResolvedValue({ id: listingId, status: ListingStatus.SOLD }),
      },
      ownerContract: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      invoiceRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'inv-uuid-1', ...data })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
      },
    };

    prisma = {
      $transaction: jest.fn((callback) => callback(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealCompletionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: BackupOffersService, useValue: backupOffersService },
      ],
    }).compile();

    service = module.get<DealCompletionService>(DealCompletionService);
  });

  it('atomically executes all completion steps in single transaction (AC-1, AC-2)', async () => {
    const deal = makeMockDeal();
    mockTx.deal.findUnique.mockResolvedValue(deal);

    const result = await service.completeDeal(dealId, adminActor as any);

    // 1. Row locks acquired with ::text casting
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);

    // 2. Deal transitioned to COMPLETED with completedAt
    expect(mockTx.deal.update).toHaveBeenCalledWith({
      where: { id: dealId },
      data: {
        status: DealStatus.COMPLETED,
        completedAt: mockNow,
        version: { increment: 1 },
      },
    });

    // 3. Listing transitioned to SOLD
    expect(mockTx.listing.update).toHaveBeenCalledWith({
      where: { id: listingId },
      data: {
        status: ListingStatus.SOLD,
        version: { increment: 1 },
      },
    });

    // 4. Linked OwnerContract transitioned to COMPLETED
    expect(mockTx.ownerContract.updateMany).toHaveBeenCalledWith({
      where: { listingId },
      data: {
        status: OwnerContractStatus.COMPLETED,
        updatedAt: mockNow,
      },
    });

    // 5. Queued backup offers closed via BackupOffersService
    expect(backupOffersService.closeRemainingBackupOffersForListing).toHaveBeenCalledWith(
      listingId,
      {
        reason: 'PRIMARY_DEAL_COMPLETED',
        actorAdminId: adminActor.id,
        closedAt: mockNow,
      },
      mockTx,
    );

    // 6. Immutable InvoiceRecord generated with 15% VAT and party details
    expect(mockTx.invoiceRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invoiceNumber: 'INV-20261107-DL-20261107-0001',
        dealId,
        sellerId: sellerProfileId,
        buyerId: buyerProfileId,
        vatRate: 0.15,
        totalAmount: '50000.00',
        subtotalAmount: '43478.26',
        vatAmount: '6521.74',
        vatTreatment: 'STANDARD_RATE_15',
        partyDetails: expect.objectContaining({
          buyer: expect.objectContaining({
            fullName: 'طارق المشتري',
            mobileNumber: '+966501234567',
          }),
          seller: expect.objectContaining({
            fullName: 'سارة البائعة',
            crNumber: '1010999999',
            commercialName: 'مؤسسة الأفق العقارية',
          }),
        }),
        createdAt: mockNow,
      }),
    });

    // 7. AuditLog entries for DEAL_COMPLETED and INVOICE_GENERATED
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: INVOICE_GENERATED,
          entityType: 'InvoiceRecord',
        }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: DEAL_COMPLETED,
          entityType: 'Deal',
        }),
      }),
    );

    expect(result.status).toBe(DealStatus.COMPLETED);
  });

  it('is idempotent if deal is already completed (AC-1)', async () => {
    const completedDeal = makeMockDeal({ status: DealStatus.COMPLETED });
    mockTx.deal.findUnique.mockResolvedValue(completedDeal);

    const result = await service.completeDeal(dealId, adminActor as any);

    expect(result.status).toBe(DealStatus.COMPLETED);
    expect(mockTx.deal.update).not.toHaveBeenCalled();
    expect(mockTx.listing.update).not.toHaveBeenCalled();
    expect(mockTx.invoiceRecord.create).not.toHaveBeenCalled();
  });

  it('rejects completion if required payments are not confirmed (AC-1)', async () => {
    const unconfirmedDeal = makeMockDeal({
      payments: [
        {
          id: 'pay-1',
          paymentType: 'PLATFORM_COMMISSION',
          status: DEAL_PAYMENT_STATUS.UNDER_REVIEW,
        },
        {
          id: 'pay-2',
          paymentType: 'SELLER_PURCHASE_PRICE',
          status: DEAL_PAYMENT_STATUS.CONFIRMED,
        },
      ],
    });
    mockTx.deal.findUnique.mockResolvedValue(unconfirmedDeal);

    await expect(service.completeDeal(dealId, adminActor as any)).rejects.toThrow(
      ConflictException,
    );
    expect(mockTx.deal.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException if deal does not exist', async () => {
    mockTx.deal.findUnique.mockResolvedValue(null);

    await expect(service.completeDeal('non-existent', adminActor as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rolls back cleanly if any step fails in transaction', async () => {
    const deal = makeMockDeal();
    mockTx.deal.findUnique.mockResolvedValue(deal);
    mockTx.listing.update.mockRejectedValue(new Error('DB connection failure'));

    await expect(service.completeDeal(dealId, adminActor as any)).rejects.toThrow(
      'DB connection failure',
    );
  });
});

