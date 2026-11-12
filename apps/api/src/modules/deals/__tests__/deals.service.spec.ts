import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ACTIVE_DEAL_STATUSES,
  DEAL_ALREADY_ACTIVE_FOR_LISTING,
  DEAL_LISTING_UNAVAILABLE,
  DEAL_SELLER_PAYOUT_REQUIRED,
  DealStatus,
  ListingStatus,
  OFFER_ALREADY_EXPIRED,
  OFFER_HISTORY_ACTIONS,
  OFFER_INVALID_STATE_TRANSITION,
  OFFER_LOCK_CONFLICT,
  OFFER_LOCK_EXPIRED,
  OFFER_LOCK_REQUIRED,
  OFFER_NOT_FOUND,
  OfferStatus,
  buildDealNumber,
  buildDealReferenceCode,
  getSaudiBankName,
} from '@elmasaif/shared';
import { DealsService } from '../deals.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { CryptoService } from '../../../common/crypto/crypto.service';

describe('DealsService — final approval binding (Story 5.1) (AC: 2, 4, 5, 6, 7, 8, 9, 10)', () => {
  let service: DealsService;
  let prisma: any;
  let clockService: any;
  let cryptoService: any;

  const admin = {
    id: 'admin-1',
    username: 'super.admin',
    email: 'super.admin@elmasaif.sa',
    fullName: 'المشرف العام',
    role: 'SUPER_ADMIN',
    isActive: true,
    permissions: ['Deals.FinalApprove', 'Offers.Review'],
  };
  const otherAdminId = 'admin-2';

  const offerId = '11111111-1111-1111-1111-111111111111';
  const listingId = '22222222-2222-2222-2222-222222222222';
  const buyerProfileId = 'buyer-profile-1';
  const sellerProfileId = 'seller-profile-1';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const liveLockExpiry = new Date(mockNow.getTime() + 10 * 60 * 1000);
  const futureExpiry = new Date(mockNow.getTime() + 7 * 24 * 3_600_000);

  const ibanPlain = 'SA0380000000608010167519';
  const ibanCiphertext = 'aabbccddeeff:00112233445566778899aabbccddeeff:deadbeef';

  const offerRow = (overrides: Partial<any> = {}) => ({
    id: offerId,
    listingId,
    buyerProfileId,
    offerPrice: '3000000.00',
    status: OfferStatus.SELECTED_PENDING_FINAL_ADMIN_APPROVAL,
    negotiationRound: 2,
    lockedByAdminId: admin.id,
    lockedAt: mockNow,
    lockExpiresAt: liveLockExpiry,
    expiresAt: futureExpiry,
    listing: { id: listingId, status: ListingStatus.ACTIVE, sellerProfileId },
    ...overrides,
  });

  const listingRow = (overrides: Partial<any> = {}) => ({
    id: listingId,
    status: ListingStatus.ACTIVE,
    sellerProfileId,
    ...overrides,
  });

  const payoutRow = (overrides: Partial<any> = {}) => ({
    id: 'payout-1',
    accountHolderName: 'بائع العقار',
    bankName: 'البنك الأهلي السعودي',
    ibanEncrypted: ibanCiphertext,
    ibanMasked: 'SA03 **** **** **** 7519',
    ...overrides,
  });

  /** The row Prisma would hand back: the same object it was given, with ids/dates intact. */
  const createdDeal = () => prisma.deal.create.mock.calls[0][0].data;

  const rawSql = (index: number) =>
    (prisma.$queryRaw.mock.calls[index][0] as TemplateStringsArray).join('?');

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockNow) };
    cryptoService = {
      encrypt: jest.fn((value: string) => `enc(${value})`),
      decrypt: jest.fn(() => ibanPlain),
    };

    prisma = {
      offer: {
        findUnique: jest.fn().mockResolvedValue(offerRow()),
        update: jest.fn().mockResolvedValue({ id: offerId }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      listing: {
        findUnique: jest.fn().mockResolvedValue(listingRow()),
        update: jest.fn().mockResolvedValue({ id: listingId }),
      },
      deal: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ ...data })),
      },
      payoutAccount: { findFirst: jest.fn().mockResolvedValue(payoutRow()) },
      offerHistory: { create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: offerId }]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: CryptoService, useValue: cryptoService },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  describe('happy path (AC-2, AC-4, AC-5, AC-6, AC-7)', () => {
    it('freezes the UX-journey amounts: 3,000,000 + 2.5 % = 75,000 → 3,075,000', async () => {
      const binding = await service.finalApprove(offerId, admin);

      const data = createdDeal();
      expect(data.dealPrice).toBe('3000000.00');
      expect(data.platformCommission).toBe('75000.00');
      expect(data.totalAmount).toBe('3075000.00');
      expect(data.commissionRateSnapshot).toBe('0.0250');
      expect(data.fixedCommissionSnapshot).toBe('0.00');
      expect(data.paymentWindowHoursSnapshot).toBe(48);

      expect(binding.dealPrice).toBe('3000000.00');
      expect(binding.platformCommission).toBe('75000.00');
      expect(binding.totalAmount).toBe('3075000.00');
      expect(binding.status).toBe(DealStatus.AWAITING_PAYMENT_PROOF);
    });

    it('rounds the commission half-up at 2 dp instead of truncating', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ offerPrice: '1234.56' }));

      const binding = await service.finalApprove(offerId, admin);

      // 1234.56 × 0.025 = 30.864 → 30.86, total 1265.42.
      expect(binding.platformCommission).toBe('30.86');
      expect(binding.totalAmount).toBe('1265.42');
    });

    it('derives both identifiers from the id and the ClockService date in one insert', async () => {
      const binding = await service.finalApprove(offerId, admin);

      const data = createdDeal();
      expect(data.id).toEqual(binding.id);
      expect(data.dealNumber).toBe(buildDealNumber(binding.id, mockNow));
      expect(data.dealNumber).toMatch(/^DL-20261106-[0-9A-F]{10}$/);
      expect(data.dealReferenceCode).toBe(buildDealReferenceCode(binding.id));
      expect(data.dealReferenceCode).toMatch(/^ELM-[0-9A-F]{10}-C$/);
      expect(binding.dealNumber).toBe(data.dealNumber);
      expect(binding.dealReferenceCode).toBe(data.dealReferenceCode);
    });

    it('writes createdAt from the clock so the deadline is exactly 48 hours later (AD-11)', async () => {
      const binding = await service.finalApprove(offerId, admin);

      expect(createdDeal().createdAt).toBe(mockNow);
      expect(binding.createdAt).toBe(mockNow.toISOString());

      const elapsedHours =
        (new Date(binding.paymentDeadline).getTime() - mockNow.getTime()) / 3_600_000;
      expect(elapsedHours).toBe(48);
    });

    it('binds the offer, the listing and the seller payout into the frozen snapshot', async () => {
      const binding = await service.finalApprove(offerId, admin);

      const data = createdDeal();
      expect(data.offerId).toBe(offerId);
      expect(data.listingId).toBe(listingId);
      expect(data.buyerProfileId).toBe(buyerProfileId);
      expect(data.sellerProfileId).toBe(sellerProfileId);
      expect(data.approvedByAdminId).toBe(admin.id);
      expect(data.status).toBe(DealStatus.AWAITING_PAYMENT_PROOF);

      expect(data.sellerPayoutAccountId).toBe('payout-1');
      expect(data.sellerPayoutHolderName).toBe('بائع العقار');
      expect(data.sellerPayoutBankName).toBe('البنك الأهلي السعودي');
      expect(data.sellerPayoutIbanMasked).toBe('SA03 **** **** **** 7519');
      expect(binding.sellerPayout).toEqual({
        accountId: 'payout-1',
        accountHolderName: 'بائع العقار',
        bankName: 'البنك الأهلي السعودي',
        ibanMasked: 'SA03 **** **** **** 7519',
      });
    });

    it('copies the IBAN ciphertext verbatim rather than re-encrypting plaintext (D4)', async () => {
      await service.finalApprove(offerId, admin);

      expect(createdDeal().sellerPayoutIbanEncrypted).toBe(ibanCiphertext);
      expect(createdDeal().sellerPayoutIbanMasked).toBe('SA03 **** **** **** 7519');
      expect(cryptoService.encrypt).not.toHaveBeenCalled();
    });

    it('picks the default payout account first, newest second (trap T-9)', async () => {
      await service.finalApprove(offerId, admin);

      const args = prisma.payoutAccount.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ profileId: sellerProfileId });
      expect(args.orderBy).toEqual([{ isDefault: 'desc' }, { createdAt: 'desc' }]);
    });

    it('derives the bank name from the encrypted IBAN when the account has none', async () => {
      prisma.payoutAccount.findFirst.mockResolvedValue(
        payoutRow({ bankName: null }),
      );

      const binding = await service.finalApprove(offerId, admin);

      expect(cryptoService.decrypt).toHaveBeenCalledWith(ibanCiphertext);
      expect(createdDeal().sellerPayoutBankName).toBe(getSaudiBankName(ibanPlain));
      expect(binding.sellerPayout.bankName).toBe(getSaudiBankName(ibanPlain));
    });

    it('does not fail the binding when the ciphertext cannot be decrypted', async () => {
      prisma.payoutAccount.findFirst.mockResolvedValue(
        payoutRow({ bankName: null }),
      );
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('Invalid encrypted data format');
      });

      const binding = await service.finalApprove(offerId, admin);

      expect(binding.sellerPayout.bankName).toBeNull();
      expect(binding.status).toBe(DealStatus.AWAITING_PAYMENT_PROOF);
    });

    it('reserves the listing and converts the offer, releasing its lease (AC-2, AD-10)', async () => {
      await service.finalApprove(offerId, admin);

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: { status: ListingStatus.RESERVED, version: { increment: 1 } },
      });
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: offerId },
        data: {
          status: OfferStatus.CONVERTED_TO_DEAL,
          version: { increment: 1 },
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });
    });

    it('writes one offer-history row and one audit row referencing the deal', async () => {
      const binding = await service.finalApprove(offerId, admin);

      const history = prisma.offerHistory.create.mock.calls[0][0].data;
      expect(history).toEqual({
        offerId,
        actorAdminId: admin.id,
        action: OFFER_HISTORY_ACTIONS.CONVERTED_TO_DEAL,
        priceSnapshot: '3000000.00',
        notes: `dealReferenceCode=${binding.dealReferenceCode}`,
        roundNumber: 2,
      });

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit).toMatchObject({
        actorId: admin.id,
        actorType: 'ADMIN',
        action: 'DEAL_CREATED',
        entityType: 'Deal',
        entityId: binding.id,
        payload: {
          offerId,
          listingId,
          dealNumber: binding.dealNumber,
          dealReferenceCode: binding.dealReferenceCode,
          dealPrice: '3000000.00',
          commission: '75000.00',
          total: '3075000.00',
          paymentDeadline: binding.paymentDeadline,
          adminName: admin.fullName,
        },
      });
    });

    it('locks the offer before the listing and casts to text, never uuid (traps T-1, T-12)', async () => {
      await service.finalApprove(offerId, admin);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(rawSql(0)).toContain('FROM "offers"');
      expect(rawSql(0)).toContain('::text');
      expect(rawSql(1)).toContain('FROM "listings"');
      expect(rawSql(1)).toContain('::text');
      expect(`${rawSql(0)}${rawSql(1)}`).not.toContain('::uuid');
    });

    it('leaves the reserve backup offers queued for Story 5.4 (trap T-6)', async () => {
      await service.finalApprove(offerId, admin);

      expect(prisma.offer.updateMany).not.toHaveBeenCalled();
      expect(prisma.offer.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('preconditions in transaction order (AC-9)', () => {
    it('404 OFFER_NOT_FOUND before any other check', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_NOT_FOUND },
      });
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('404 when the offer row does not exist', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.finalApprove(offerId, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409 OFFER_LOCK_REQUIRED when the caller holds no lease', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: null, lockedAt: null, lockExpiresAt: null }),
      );

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_REQUIRED },
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('409 OFFER_LOCK_CONFLICT when another administrator holds the lease', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockedByAdminId: otherAdminId }),
      );

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_CONFLICT },
      });
    });

    it('409 OFFER_LOCK_EXPIRED when the lease lapsed', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ lockExpiresAt: new Date(mockNow.getTime() - 1) }),
      );

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_LOCK_EXPIRED },
      });
    });

    it('409 OFFER_INVALID_STATE_TRANSITION for every status but the approved one', async () => {
      for (const status of [
        OfferStatus.PENDING_ADMIN_REVIEW,
        OfferStatus.RELAYED_TO_SELLER,
        OfferStatus.RELAYED_TO_BUYER,
        OfferStatus.COUNTER_OFFERED,
        OfferStatus.CONVERTED_TO_DEAL,
        OfferStatus.CLOSED_BACKUP,
      ]) {
        prisma.offer.findUnique.mockResolvedValue(offerRow({ status }));

        await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
          response: { code: OFFER_INVALID_STATE_TRANSITION },
        });
      }
      expect(prisma.deal.create).not.toHaveBeenCalled();
      expect(prisma.listing.findUnique).not.toHaveBeenCalled();
    });

    it('409 OFFER_ALREADY_EXPIRED when the approval lands after expiresAt', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        offerRow({ expiresAt: new Date(mockNow.getTime() - 1) }),
      );

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_ALREADY_EXPIRED },
      });
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('treats expiresAt exactly equal to now as expired', async () => {
      prisma.offer.findUnique.mockResolvedValue(offerRow({ expiresAt: mockNow }));

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: OFFER_ALREADY_EXPIRED },
      });
    });

    it('409 DEAL_LISTING_UNAVAILABLE when the listing is no longer ACTIVE', async () => {
      for (const status of [
        ListingStatus.RESERVED,
        ListingStatus.SOLD,
        ListingStatus.ARCHIVED,
        ListingStatus.PENDING_REVIEW,
      ]) {
        prisma.listing.findUnique.mockResolvedValue(listingRow({ status }));

        await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
          response: { code: DEAL_LISTING_UNAVAILABLE },
        });
      }
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('409 DEAL_LISTING_UNAVAILABLE when the listing row vanished', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: DEAL_LISTING_UNAVAILABLE },
      });
    });

    it('409 DEAL_ALREADY_ACTIVE_FOR_LISTING with the blocking deal number', async () => {
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-existing',
        dealNumber: 'DL-20261101-ABCDEF1234',
      });

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: {
          code: DEAL_ALREADY_ACTIVE_FOR_LISTING,
          details: { dealNumber: 'DL-20261101-ABCDEF1234' },
        },
      });
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('asks the pre-check only about the non-terminal deal statuses (BR-07)', async () => {
      await service.finalApprove(offerId, admin);

      const where = prisma.deal.findFirst.mock.calls[0][0].where;
      expect(where).toEqual({
        listingId,
        status: { in: [...ACTIVE_DEAL_STATUSES] },
      });
      expect(where.status.in).not.toContain(DealStatus.COMPLETED);
    });

    it('409 DEAL_SELLER_PAYOUT_REQUIRED when the seller has no payout account', async () => {
      prisma.payoutAccount.findFirst.mockResolvedValue(null);

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: DEAL_SELLER_PAYOUT_REQUIRED },
      });
      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('every refusal is a 409 Conflict, not a 500', async () => {
      prisma.deal.findFirst.mockResolvedValue({ id: 'deal-existing', dealNumber: 'DL-1' });

      await expect(service.finalApprove(offerId, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('concurrent approval (AC-3, trap T-11)', () => {
    it('maps a P2002 on the deal insert to DEAL_ALREADY_ACTIVE_FOR_LISTING', async () => {
      prisma.deal.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.finalApprove(offerId, admin)).rejects.toMatchObject({
        response: { code: DEAL_ALREADY_ACTIVE_FOR_LISTING },
      });
      // The loser's transaction aborts before reserving anything.
      expect(prisma.listing.update).not.toHaveBeenCalled();
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('re-throws any other database error untouched', async () => {
      const failure = Object.assign(new Error('connection reset'), { code: 'P1001' });
      prisma.deal.create.mockRejectedValue(failure);

      await expect(service.finalApprove(offerId, admin)).rejects.toBe(failure);
    });
  });

  describe('dynamic settings adoption & in-flight immutability (Story 8.6 / AC4, AD-3)', () => {
    it('applies updated dynamic commission rate (3%) and payment window (72h) to new deals', async () => {
      const mockSettingsService = {
        getSettings: jest.fn().mockResolvedValue({
          commissionRate: 0.03,
          commissionRatePercentage: 3.0,
          fixedFeeAmountSar: 0,
          paymentWindowHours: 72,
        }),
      };

      const dynamicService = new DealsService(
        prisma,
        clockService,
        cryptoService,
        mockSettingsService as any,
      );

      await dynamicService.finalApprove(offerId, admin);

      const data = createdDeal();
      // 3,000,000 * 0.03 = 90,000 SAR commission
      expect(data.commissionRateSnapshot).toBe('0.0300');
      expect(data.paymentWindowHoursSnapshot).toBe(72);
      expect(data.dealPrice).toBe('3000000.00');
      expect(data.platformCommission).toBe('90000.00');
      expect(data.totalAmount).toBe('3090000.00');

      // Payment deadline is exactly 72 hours from now
      const expectedDeadline = new Date(mockNow.getTime() + 72 * 3_600_000);
      expect(data.paymentDeadline).toEqual(expectedDeadline);
    });

    it('guarantees existing in-flight deals retain their frozen snapshots', async () => {
      const inFlightDeal = {
        id: 'deal-inflight-uuid',
        dealNumber: 'DL-20261106-0001',
        commissionRateSnapshot: '0.0250',
        fixedCommissionSnapshot: '0.00',
        paymentWindowHoursSnapshot: 48,
        platformCommission: '75000.00',
        totalAmount: '3075000.00',
        paymentDeadline: new Date(mockNow.getTime() + 48 * 3_600_000),
      };

      // Altering dynamic settings
      const mockSettingsService = {
        getSettings: jest.fn().mockResolvedValue({
          commissionRate: 0.035,
          commissionRatePercentage: 3.5,
          fixedFeeAmountSar: 500,
          paymentWindowHours: 96,
        }),
      };

      // Assert in-flight deal's frozen state was not mutated by setting change
      expect(inFlightDeal.commissionRateSnapshot).toBe('0.0250');
      expect(inFlightDeal.paymentWindowHoursSnapshot).toBe(48);
      expect(inFlightDeal.platformCommission).toBe('75000.00');
      expect(inFlightDeal.totalAmount).toBe('3075000.00');
    });
  });
});
