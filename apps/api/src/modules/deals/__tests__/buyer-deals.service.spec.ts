import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DEAL_BUYER_PROFILE_REQUIRED,
  DEAL_IDENTITY_REQUIRED,
  DEAL_NOT_FOUND,
  DEAL_NOT_PARTY,
  DEAL_PAYMENT_DEADLINE_PASSED,
  DEAL_PAYMENT_PROOF_INFECTED,
  DEAL_PAYMENT_PROOF_NOT_FOUND,
  DEAL_PAYMENT_PROOF_REQUIRED,
  DEAL_PAYMENT_PROOF_SCAN_FAILED,
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE,
  DEAL_PAYMENT_REVIEW_COMPLETE,
  DEAL_PAYMENT_STATUS,
  DEAL_PAYMENT_TYPE_INVALID,
  DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
  DEAL_TERMINAL,
  DealStatus,
  ERROR_FILE_QUARANTINED,
  MAX_FILE_SIZE_BYTES,
  PaymentType,
  ProfileStatus,
  UserRole,
} from '@elmasaif/shared';
import { BuyerDealsService } from '../buyer-deals.service';

/**
 * Story 5.2 / Task 5.4 — the upload transaction, the two read paths and the download mint.
 *
 * The fake `prisma` doubles as its own `tx`, exactly like `deals.service.spec.ts`: every helper is
 * required to take the caller's transaction (trap T-3), and a nested `$transaction` would call the
 * jest mock with a function instead of a callback and fail loudly.
 */
describe('BuyerDealsService (Story 5.2) (AC: 1, 2, 6, 8, 9, 10, 11, 12)', () => {
  let service: BuyerDealsService;
  let prisma: any;
  let clockService: any;
  let cryptoService: any;
  let platformAccount: any;
  let identityService: any;
  let quarantineService: any;
  let storageService: any;

  const userId = 'user-buyer-1';
  const buyerProfileId = 'buyer-profile-1';
  const dealId = '33333333-3333-3333-3333-333333333333';
  const mockNow = new Date('2026-11-06T09:00:00.000Z');
  const deadline = new Date(mockNow.getTime() + 48 * 3_600_000);
  const sellerIbanPlain = 'SA0380000000608010167519';
  const fileObjectId = 'file-object-1';

  const platformAccountRow = {
    iban: 'SA4210000001234567890123',
    ibanFormatted: 'SA42 1000 0001 2345 6789 0123',
    accountHolderName: 'شركة المصيف العقارية',
    bankName: 'البنك الأهلي السعودي',
  };

  const dealRow = (overrides: Partial<any> = {}) => ({
    id: dealId,
    dealNumber: 'DL-20261106-ABCDEF1234',
    dealReferenceCode: 'ELM-DEMO000001-C',
    listingId: 'listing-1',
    buyerProfileId,
    sellerProfileId: 'seller-profile-1',
    dealPrice: '3000000.00',
    platformCommission: '75000.00',
    totalAmount: '3075000.00',
    commissionRateSnapshot: '0.0250',
    paymentWindowHoursSnapshot: 48,
    sellerPayoutHolderName: 'بائع العقار',
    sellerPayoutBankName: 'مصرف الراجحي',
    sellerPayoutIbanEncrypted: 'ciphertext',
    sellerPayoutIbanMasked: 'SA03 **** **** **** 7519',
    status: DealStatus.AWAITING_PAYMENT_PROOF,
    paymentDeadline: deadline,
    createdAt: mockNow,
    listing: { id: 'listing-1', title: 'فيلا في الرياض' },
    payments: [],
    ...overrides,
  });

  const paymentRow = (paymentType: PaymentType, overrides: Partial<any> = {}) => ({
    id: `${paymentType}-payment-id`,
    dealId,
    paymentType,
    amount: paymentType === PaymentType.PLATFORM_COMMISSION ? '75000.00' : '3000000.00',
    status: DEAL_PAYMENT_STATUS.PENDING,
    proofFileUrl: null,
    bankReferenceCode: null,
    senderBankName: null,
    uploadedAt: null,
    rejectionReason: null,
    ...overrides,
  });

  const proofFile = {
    originalname: 'receipt.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('pdf'),
  };

  /** `ensureDealPayments` returns whatever the store holds for `(dealId, paymentType)`. */
  let slotStore: Record<string, any>;

  const rawSql = (index: number) =>
    (prisma.$queryRaw.mock.calls[index][0] as TemplateStringsArray).join('?');

  const expectCode = (error: any, code: string) => {
    expect(error.getResponse().code).toBe(code);
  };

  beforeEach(() => {
    slotStore = {};
    clockService = { now: jest.fn(() => mockNow) };
    cryptoService = { decrypt: jest.fn(() => sellerIbanPlain) };
    platformAccount = { getAccount: jest.fn(() => platformAccountRow) };
    identityService = {
      getIdentityStatus: jest.fn().mockResolvedValue({ canUploadDealPaymentProof: true }),
    };
    quarantineService = {
      stageFileForQuarantine: jest.fn().mockResolvedValue({ fileObjectId }),
      scanAndProcess: jest.fn().mockResolvedValue({ fileObject: { id: fileObjectId }, isClean: true }),
    };
    storageService = {
      getVerifiedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/receipt'),
    };

    prisma = {
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: buyerProfileId,
          status: ProfileStatus.ACTIVE,
          role: UserRole.BUYER,
        }),
      },
      deal: {
        findMany: jest.fn().mockResolvedValue([dealRow()]),
        findUnique: jest.fn().mockResolvedValue(dealRow()),
        update: jest.fn().mockResolvedValue({ id: dealId }),
      },
      payment: {
        // Returns *copies*, like Prisma does: a service that kept a live reference would see its
        // own writes and mis-report `replaced`.
        upsert: jest.fn(async ({ where, create }: any) => {
          const key = create.paymentType;
          if (!slotStore[key]) {
            slotStore[key] = paymentRow(create.paymentType, {
              amount: create.amount,
              status: create.status,
            });
          }
          expect(where.dealId_paymentType.dealId).toBe(dealId);
          return { ...slotStore[key] };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const existing = Object.values(slotStore).find((row) => row.id === where.id) as any;
          Object.assign(existing, data);
          return { ...existing };
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };

    service = new BuyerDealsService(
      prisma,
      clockService,
      cryptoService,
      platformAccount,
      identityService,
      quarantineService,
      storageService,
    );
  });

  const upload = (overrides: Partial<{ paymentType: string; file: any; body: any }> = {}) =>
    service.uploadProof(
      userId,
      UserRole.BUYER,
      dealId,
      overrides.paymentType ?? PaymentType.PLATFORM_COMMISSION,
      overrides.file === undefined ? proofFile : overrides.file,
      overrides.body ?? {},
    );

  describe('buyer profile resolution (AC-2)', () => {
    it('refuses a caller with no ACTIVE buyer profile in this workspace', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({ id: buyerProfileId, status: 'PENDING' });

      await expect(service.listMyDeals(userId, UserRole.BUYER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      try {
        await service.listMyDeals(userId, UserRole.BUYER);
      } catch (error: any) {
        expectCode(error, DEAL_BUYER_PROFILE_REQUIRED);
      }
    });

    it('refuses a caller whose active workspace is not BUYER', async () => {
      try {
        await service.getDealPayment(userId, UserRole.MARKETER, dealId);
      } catch (error: any) {
        expectCode(error, DEAL_BUYER_PROFILE_REQUIRED);
      }
      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('listMyDeals (AC-2, D8)', () => {
    it('projects the frozen amounts as strings and never calls Number()', async () => {
      const summaries = await service.listMyDeals(userId, UserRole.BUYER);

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        id: dealId,
        propertyTitle: 'فيلا في الرياض',
        dealPrice: '3000000.00',
        platformCommission: '75000.00',
        totalAmount: '3075000.00',
        paymentDeadline: deadline.toISOString(),
        platformFeeProofUploaded: false,
        sellerPriceProofUploaded: false,
      });
    });

    it('reports a leg as uploaded only when its proof landed', async () => {
      prisma.deal.findMany.mockResolvedValue([
        dealRow({
          payments: [
            paymentRow(PaymentType.PLATFORM_COMMISSION, {
              status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
              proofFileUrl: fileObjectId,
            }),
          ],
        }),
      ]);

      const [summary] = await service.listMyDeals(userId, UserRole.BUYER);
      expect(summary.platformFeeProofUploaded).toBe(true);
      expect(summary.sellerPriceProofUploaded).toBe(false);
    });

    it('is a pure read: it never materializes Payment rows', async () => {
      await service.listMyDeals(userId, UserRole.BUYER);
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getDealPayment (AC-1, AC-3, AC-4, AC-5)', () => {
    it('returns both slots in RTL order with the API clock as the countdown authority', async () => {
      const view = await service.getDealPayment(userId, UserRole.BUYER, dealId);

      expect(view.serverNow).toBe(mockNow.toISOString());
      expect(view.createdAt).toBe(mockNow.toISOString());
      expect(view.paymentDeadline).toBe(deadline.toISOString());
      expect(view.payments.map((slot) => slot.paymentType)).toEqual([
        PaymentType.PLATFORM_COMMISSION,
        PaymentType.SELLER_PURCHASE_PRICE,
      ]);
      expect(view.payments.map((slot) => slot.amount)).toEqual(['75000.00', '3000000.00']);
      expect(view.commissionRateSnapshot).toBe('0.0250');
    });

    it('carries the platform collection account and the seller payout snapshot', async () => {
      const view = await service.getDealPayment(userId, UserRole.BUYER, dealId);

      expect(view.platformAccount).toEqual(platformAccountRow);
      expect(view.sellerPayout).toEqual({
        accountHolderName: 'بائع العقار',
        bankName: 'مصرف الراجحي',
        iban: sellerIbanPlain,
        ibanFormatted: 'SA03 8000 0000 6080 1016 7519',
        ibanMasked: 'SA03 **** **** **** 7519',
      });
      // Trap T-11: the ciphertext never leaves the server.
      expect(JSON.stringify(view)).not.toContain('ciphertext');
    });

    it('materializes the two slots idempotently on the first read (D1, D2)', async () => {
      await service.getDealPayment(userId, UserRole.BUYER, dealId);
      await service.getDealPayment(userId, UserRole.BUYER, dealId);

      expect(prisma.payment.upsert).toHaveBeenCalledTimes(4);
      // `update: {}` is what makes a read unable to rewrite an existing row.
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
      expect(Object.keys(slotStore)).toHaveLength(2);
    });

    it('404 DEAL_NOT_FOUND for an unknown deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      try {
        await service.getDealPayment(userId, UserRole.BUYER, dealId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundException);
        expectCode(error, DEAL_NOT_FOUND);
      }
    });

    it('403 DEAL_NOT_PARTY when the deal belongs to another buyer', async () => {
      prisma.deal.findUnique.mockResolvedValue(dealRow({ buyerProfileId: 'someone-else' }));

      try {
        await service.getDealPayment(userId, UserRole.BUYER, dealId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expectCode(error, DEAL_NOT_PARTY);
      }
    });

    it('503 DEAL_PLATFORM_ACCOUNT_UNAVAILABLE before any database work (AC-4, D5)', async () => {
      platformAccount.getAccount.mockImplementation(() => {
        throw new ServiceUnavailableException({
          code: DEAL_PLATFORM_ACCOUNT_UNAVAILABLE,
          message: 'تعذر تحميل حساب المنصة المعتمد للتحصيل. يرجى التواصل مع الدعم الفني.',
        });
      });

      try {
        await service.getDealPayment(userId, UserRole.BUYER, dealId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expectCode(error, DEAL_PLATFORM_ACCOUNT_UNAVAILABLE);
      }
      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });

    it('does not break the screen when the payout ciphertext is corrupt', async () => {
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('bad ciphertext');
      });

      const view = await service.getDealPayment(userId, UserRole.BUYER, dealId);
      expect(view.sellerPayout.iban).toBe('SA03 **** **** **** 7519');
    });
  });

  describe('uploadProof — the happy path (AC-6, AC-7, AC-9, AC-11)', () => {
    it('locks the deal with a ::text cast, never ::uuid (trap T-1)', async () => {
      await upload();

      const sql = rawSql(0);
      expect(sql).toContain('FROM "deals"');
      expect(sql).toContain('::text FOR UPDATE');
      expect(sql).not.toContain('::uuid');
    });

    it('materializes both slots with the frozen amounts', async () => {
      await upload();

      expect(prisma.payment.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.payment.upsert.mock.calls[0][0].create).toMatchObject({
        paymentType: PaymentType.PLATFORM_COMMISSION,
        amount: '75000.00',
        status: DEAL_PAYMENT_STATUS.PENDING,
      });
      expect(prisma.payment.upsert.mock.calls[1][0].create).toMatchObject({
        paymentType: PaymentType.SELLER_PURCHASE_PRICE,
        amount: '3000000.00',
      });
    });

    it('writes PROOF_UPLOADED with the FileObject id, never a URL (D3)', async () => {
      const slot = await upload({
        body: { bankReferenceCode: 'REF-991', senderBankName: 'مصرف الراجحي' },
      });

      const data = prisma.payment.update.mock.calls[0][0].data;
      expect(data.status).toBe(DEAL_PAYMENT_STATUS.PROOF_UPLOADED);
      expect(data.proofFileUrl).toBe(fileObjectId);
      expect(data.proofFileUrl).not.toContain('http');
      expect(data.uploadedAt).toBe(mockNow);
      expect(data.bankReferenceCode).toBe('REF-991');
      expect(data.senderBankName).toBe('مصرف الراجحي');
      expect(data.rejectionReason).toBeNull();

      expect(slot).toMatchObject({
        paymentType: PaymentType.PLATFORM_COMMISSION,
        status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
        hasProof: true,
        proofFileObjectId: fileObjectId,
      });
    });

    it('stages into quarantine and promotes on the payments partition with both ids (AD-6)', async () => {
      await upload();

      expect(quarantineService.stageFileForQuarantine).toHaveBeenCalledWith({
        filename: 'receipt.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        buffer: proofFile.buffer,
        userId,
      });
      expect(quarantineService.scanAndProcess).toHaveBeenCalledWith(
        fileObjectId,
        'payments',
        { dealId, paymentId: `${PaymentType.PLATFORM_COMMISSION}-payment-id` },
        userId,
      );
    });

    it('moves the deal into UNDER_ADMIN_AUDIT and writes one audit row (D4)', async () => {
      await upload();

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: { status: DealStatus.UNDER_ADMIN_AUDIT, version: { increment: 1 } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        actorId: userId,
        actorType: 'USER',
        action: 'DEAL_PAYMENT_PROOF_UPLOADED',
        entityType: 'Payment',
        entityId: `${PaymentType.PLATFORM_COMMISSION}-payment-id`,
      });
      expect(prisma.auditLog.create.mock.calls[0][0].data.payload).toMatchObject({
        dealId,
        paymentType: PaymentType.PLATFORM_COMMISSION,
        fileObjectId,
        amount: '75000.00',
        replaced: false,
      });
    });

    it('re-upload replaces the same row instead of creating a second slot (D2)', async () => {
      const first = await upload();
      const second = await upload();

      expect(second.id).toBe(first.id);
      expect(Object.keys(slotStore)).toHaveLength(2);
      expect(prisma.payment.update).toHaveBeenCalledTimes(2);
      expect(prisma.payment.update.mock.calls[1][0].where).toEqual({ id: first.id });
      expect(prisma.auditLog.create.mock.calls[1][0].data.payload.replaced).toBe(true);
    });

    it('re-enters the audit when the previous proof had been rejected', async () => {
      prisma.deal.findUnique.mockResolvedValue(dealRow({ status: DealStatus.PAYMENT_REJECTED }));

      await upload();
      expect(prisma.deal.update).toHaveBeenCalledTimes(1);
    });

    it('does not touch the deal status once the audit already started (D4)', async () => {
      prisma.deal.findUnique.mockResolvedValue(dealRow({ status: DealStatus.UNDER_ADMIN_AUDIT }));

      await upload();
      expect(prisma.deal.update).not.toHaveBeenCalled();
    });
  });

  describe('uploadProof — refusals', () => {
    it('400 DEAL_PAYMENT_TYPE_INVALID for OWNER_CONTRACT_FEE (AC-7)', async () => {
      await expect(upload({ paymentType: 'OWNER_CONTRACT_FEE' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      try {
        await upload({ paymentType: 'OWNER_CONTRACT_FEE' });
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_TYPE_INVALID);
      }
      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });

    it('400 DEAL_PAYMENT_PROOF_REQUIRED without a file', async () => {
      try {
        await upload({ file: undefined });
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_PROOF_REQUIRED);
      }
    });

    it('400 DEAL_PAYMENT_PROOF_TOO_LARGE above 10 MB', async () => {
      try {
        await upload({ file: { ...proofFile, size: MAX_FILE_SIZE_BYTES + 1 } });
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_PROOF_TOO_LARGE);
      }
    });

    it('400 DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE for WebP (trap T-12)', async () => {
      try {
        await upload({ file: { ...proofFile, mimetype: 'image/webp' } });
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_PROOF_UNSUPPORTED_TYPE);
      }
      expect(quarantineService.stageFileForQuarantine).not.toHaveBeenCalled();
    });

    it('400 VALIDATION_ERROR for an over-long bank reference', async () => {
      try {
        await upload({ body: { bankReferenceCode: 'x'.repeat(65) } });
      } catch (error: any) {
        expectCode(error, 'VALIDATION_ERROR');
      }
    });

    it('409 DEAL_TERMINAL for a completed or cancelled deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(dealRow({ status: DealStatus.CANCELLED }));

      try {
        await upload();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConflictException);
        expectCode(error, DEAL_TERMINAL);
      }
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('409 DEAL_PAYMENT_DEADLINE_PASSED one millisecond past the deadline (AC-6)', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        dealRow({ paymentDeadline: new Date(mockNow.getTime() - 1) }),
      );

      try {
        await upload();
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_DEADLINE_PASSED);
      }
      expect(quarantineService.stageFileForQuarantine).not.toHaveBeenCalled();
    });

    it.each([DEAL_PAYMENT_STATUS.UNDER_REVIEW, DEAL_PAYMENT_STATUS.CONFIRMED, DEAL_PAYMENT_STATUS.EXPIRED])(
      '409 DEAL_PAYMENT_REVIEW_COMPLETE when the slot is %s (AC-8)',
      async (status) => {
        slotStore[PaymentType.PLATFORM_COMMISSION] = paymentRow(
          PaymentType.PLATFORM_COMMISSION,
          { status },
        );

        try {
          await upload();
        } catch (error: any) {
          expectCode(error, DEAL_PAYMENT_REVIEW_COMPLETE);
        }
        expect(quarantineService.stageFileForQuarantine).not.toHaveBeenCalled();
      },
    );

    it('409 DEAL_IDENTITY_REQUIRED without a clean identity document (FR-30)', async () => {
      identityService.getIdentityStatus.mockResolvedValue({ canUploadDealPaymentProof: false });

      try {
        await upload();
      } catch (error: any) {
        expectCode(error, DEAL_IDENTITY_REQUIRED);
      }
      expect(quarantineService.stageFileForQuarantine).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('400 DEAL_PAYMENT_PROOF_INFECTED and writes nothing when the scan fails clean', async () => {
      quarantineService.scanAndProcess.mockResolvedValue({
        fileObject: { id: fileObjectId },
        isClean: false,
        threatName: 'EICAR',
      });

      try {
        await upload();
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_PROOF_INFECTED);
      }
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('503 DEAL_PAYMENT_PROOF_SCAN_FAILED when the scanner is down (T-14)', async () => {
      quarantineService.scanAndProcess.mockRejectedValue(
        new ForbiddenException('Malware scan failed or scanner service unavailable'),
      );

      try {
        await upload();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expectCode(error, DEAL_PAYMENT_PROOF_SCAN_FAILED);
      }
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('403 DEAL_NOT_PARTY when another buyer tries to upload', async () => {
      prisma.deal.findUnique.mockResolvedValue(dealRow({ buyerProfileId: 'someone-else' }));

      try {
        await upload();
      } catch (error: any) {
        expectCode(error, DEAL_NOT_PARTY);
      }
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getProofDownloadUrl (AC-12)', () => {
    const withProof = () =>
      prisma.deal.findUnique.mockResolvedValue(
        dealRow({
          payments: [
            paymentRow(PaymentType.PLATFORM_COMMISSION, {
              status: DEAL_PAYMENT_STATUS.PROOF_UPLOADED,
              proofFileUrl: fileObjectId,
            }),
          ],
        }),
      );

    it('mints a 300-second link from the stored FileObject id', async () => {
      withProof();

      const result = await service.getProofDownloadUrl(
        userId,
        UserRole.BUYER,
        dealId,
        PaymentType.PLATFORM_COMMISSION,
      );

      expect(storageService.getVerifiedDownloadUrl).toHaveBeenCalledWith(fileObjectId, 300);
      expect(result).toEqual({
        downloadUrl: 'https://signed.example/receipt',
        expiresInSeconds: 300,
      });
    });

    it('404 DEAL_PAYMENT_PROOF_NOT_FOUND when the slot has no receipt', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        dealRow({ payments: [paymentRow(PaymentType.PLATFORM_COMMISSION)] }),
      );

      try {
        await service.getProofDownloadUrl(
          userId,
          UserRole.BUYER,
          dealId,
          PaymentType.PLATFORM_COMMISSION,
        );
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundException);
        expectCode(error, DEAL_PAYMENT_PROOF_NOT_FOUND);
      }
    });

    it('re-throws a quarantined file as 403 FILE_QUARANTINED so ApiError.code survives (T-14)', async () => {
      withProof();
      storageService.getVerifiedDownloadUrl.mockRejectedValue(
        new ForbiddenException('File is quarantined or has not passed malware scan verification'),
      );

      try {
        await service.getProofDownloadUrl(
          userId,
          UserRole.BUYER,
          dealId,
          PaymentType.PLATFORM_COMMISSION,
        );
      } catch (error: any) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expectCode(error, ERROR_FILE_QUARANTINED);
      }
    });

    it('404 DEAL_PAYMENT_PROOF_NOT_FOUND when the FileObject row has vanished', async () => {
      withProof();
      storageService.getVerifiedDownloadUrl.mockRejectedValue(
        new NotFoundException('File record not found for ID'),
      );

      try {
        await service.getProofDownloadUrl(
          userId,
          UserRole.BUYER,
          dealId,
          PaymentType.PLATFORM_COMMISSION,
        );
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_PROOF_NOT_FOUND);
      }
    });

    it('400 DEAL_PAYMENT_TYPE_INVALID for a legacy OWNER_CONTRACT_FEE link', async () => {
      try {
        await service.getProofDownloadUrl(
          userId,
          UserRole.BUYER,
          dealId,
          'OWNER_CONTRACT_FEE',
        );
      } catch (error: any) {
        expectCode(error, DEAL_PAYMENT_TYPE_INVALID);
      }
      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });
  });
});
