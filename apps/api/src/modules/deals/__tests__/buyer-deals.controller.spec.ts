import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  DEAL_PAYMENT_PROOF_TOO_LARGE,
  DEAL_PAYMENT_TYPE_INVALID,
  UserRole,
} from '@elmasaif/shared';
import { BuyerDealsController, DealProofTooLargeFilter } from '../buyer-deals.controller';
import { BuyerDealsService } from '../buyer-deals.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../../users/guards/active-role.guard';
import { ROLES_KEY } from '../../users/decorators/require-role.decorator';

/**
 * Story 5.2 / Task 5 — the route surface, the guards and the envelope.
 *
 * The service is fully stubbed: this spec is about the contract the web client sees, and about
 * trap T-6 (a literal `my` route declared after `:id` is swallowed by it and no test notices).
 */
describe('BuyerDealsController (Story 5.2) (AC: 1, 2, 7, 12)', () => {
  let controller: BuyerDealsController;
  let service: any;

  const buyer = {
    id: 'user-buyer-1',
    role: UserRole.BUYER,
    activeRole: UserRole.BUYER,
    fullName: 'مشتري',
  };

  const dealId = '33333333-3333-3333-3333-333333333333';
  const paymentType = 'PLATFORM_COMMISSION';

  beforeEach(async () => {
    service = {
      listMyDeals: jest.fn().mockResolvedValue([{ id: dealId }]),
      getDealPayment: jest.fn().mockResolvedValue({ id: dealId, serverNow: 'now' }),
      uploadProof: jest.fn().mockResolvedValue({ id: 'payment-1', status: 'PROOF_UPLOADED' }),
      getProofDownloadUrl: jest
        .fn()
        .mockResolvedValue({ downloadUrl: 'https://signed.example', expiresInSeconds: 300 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuyerDealsController],
      providers: [{ provide: BuyerDealsService, useValue: service }, Reflector],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ActiveRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BuyerDealsController>(BuyerDealsController);
  });

  describe('routing (trap T-6)', () => {
    it('declares the literal `my` route before the `:id` route', () => {
      const methods = Object.getOwnPropertyNames(BuyerDealsController.prototype);

      expect(methods.indexOf('listMyDeals')).toBeGreaterThan(-1);
      expect(methods.indexOf('listMyDeals')).toBeLessThan(methods.indexOf('getDealPayment'));
    });

    it('declares the routes in the order the story pins: my → proof-url → :id → proof', () => {
      const methods = Object.getOwnPropertyNames(BuyerDealsController.prototype);
      const order = ['listMyDeals', 'getProofDownloadUrl', 'getDealPayment', 'uploadProof'].map(
        (name) => methods.indexOf(name),
      );

      expect(order).not.toContain(-1);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      // A GET `:id` declared before `my` would swallow it (trap T-6); the POST is a different
      // verb, so it is declared last for readability only.
      expect(order[0]).toBeLessThan(order[2]);
    });
  });

  describe('authorization (AC-1)', () => {
    it('guards the whole controller with SessionAuthGuard + ActiveRoleGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, BuyerDealsController);

      expect(guards).toEqual([SessionAuthGuard, ActiveRoleGuard]);
    });

    it('requires the BUYER active role at class level', () => {
      expect(Reflect.getMetadata(ROLES_KEY, BuyerDealsController)).toEqual([UserRole.BUYER]);
    });
  });

  describe('envelope (AC-2, AC-7, AC-12)', () => {
    it('GET /deals/my → 200 { statusCode, data } and reads the actor from req.user', async () => {
      const res = await controller.listMyDeals({ user: buyer });

      expect(service.listMyDeals).toHaveBeenCalledWith(buyer.id, buyer.activeRole);
      expect(res).toEqual({ statusCode: HttpStatus.OK, data: [{ id: dealId }] });
    });

    it('falls back to `role` when the session carries no `activeRole`', async () => {
      await controller.listMyDeals({ user: { id: buyer.id, role: UserRole.BUYER } });

      expect(service.listMyDeals).toHaveBeenCalledWith(buyer.id, UserRole.BUYER);
    });

    it('GET /deals/:id → 200 { statusCode, data }', async () => {
      const res = await controller.getDealPayment(dealId, { user: buyer });

      expect(service.getDealPayment).toHaveBeenCalledWith(buyer.id, UserRole.BUYER, dealId);
      expect(res).toEqual({
        statusCode: HttpStatus.OK,
        data: { id: dealId, serverNow: 'now' },
      });
    });

    it('POST …/proof → 200 with the verbatim receipt acknowledgement', async () => {
      const body = { bankReferenceCode: 'REF-1' };
      const file = { originalname: 'r.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') };

      const res = await controller.uploadProof(dealId, paymentType, file, body, { user: buyer });

      expect(service.uploadProof).toHaveBeenCalledWith(
        buyer.id,
        UserRole.BUYER,
        dealId,
        paymentType,
        file,
        body,
      );
      expect(res).toEqual({
        statusCode: HttpStatus.OK,
        message: 'تم استلام إيصال التحويل وهو قيد المراجعة الإدارية',
        data: { id: 'payment-1', status: 'PROOF_UPLOADED' },
      });
    });

    it('GET …/proof-url → 200 { statusCode, data } and never the slot itself', async () => {
      const res = await controller.getProofDownloadUrl(dealId, paymentType, { user: buyer });

      expect(service.getProofDownloadUrl).toHaveBeenCalledWith(
        buyer.id,
        UserRole.BUYER,
        dealId,
        paymentType,
      );
      expect(res).toEqual({
        statusCode: HttpStatus.OK,
        data: { downloadUrl: 'https://signed.example', expiresInSeconds: 300 },
      });
    });
  });

  describe('DealProofTooLargeFilter (T-12)', () => {
    it('turns multer’s PayloadTooLargeException into a 400 with a code the web can match', () => {
      const json = jest.fn();
      const status = jest.fn(() => ({ json }));
      const host = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-request-id': 'req-1' } }),
          getResponse: () => ({ status }),
        }),
      } as unknown as ExecutionContext;

      new DealProofTooLargeFilter().catch({} as any, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        code: DEAL_PAYMENT_PROOF_TOO_LARGE,
        message: 'يجب ألا يتجاوز حجم الملف 10 ميجابايت',
        requestId: 'req-1',
      });
    });

    it('uses a distinct code from the invalid-payment-type refusal', () => {
      expect(DEAL_PAYMENT_PROOF_TOO_LARGE).not.toBe(DEAL_PAYMENT_TYPE_INVALID);
    });
  });
});
