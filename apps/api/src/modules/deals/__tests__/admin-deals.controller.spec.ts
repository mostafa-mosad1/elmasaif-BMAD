import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminRole,
  AUTH_NOT_AUTHORIZED,
  DealStatus,
  finalApproveDealSchema,
} from '@elmasaif/shared';
import { AdminDealsController } from '../admin-deals.controller';
import { DealsService } from '../deals.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import {
  ADMIN_PERMISSION_METADATA_KEY,
} from '../../auth/decorators/require-admin-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';

describe('AdminDealsController (Story 5.1) (AC: 1, 8)', () => {
  let controller: AdminDealsController;
  let service: any;
  let permissionGuard: AdminPermissionGuard;

  const superAdmin = {
    id: 'super-admin-1',
    username: 'super1',
    email: 'super1@elmasaif.sa',
    fullName: 'المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    permissions: ['Deals.FinalApprove'],
  };

  const moderator = {
    id: 'admin-mod-1',
    username: 'mod1',
    email: 'mod1@elmasaif.sa',
    fullName: 'أحمد المراجع',
    role: AdminRole.MODERATOR,
    isActive: true,
    permissions: ['Offers.Review'],
  };

  const offerId = '11111111-1111-1111-1111-111111111111';

  const binding = {
    id: '33333333-3333-3333-3333-333333333333',
    dealNumber: 'DL-20261106-ABCDEF1234',
    dealReferenceCode: 'ELM-ABCDEF1234-C',
    status: DealStatus.AWAITING_PAYMENT_PROOF,
    offerId,
    listingId: '22222222-2222-2222-2222-222222222222',
    buyerProfileId: 'buyer-profile-1',
    sellerProfileId: 'seller-profile-1',
    dealPrice: '3000000.00',
    platformCommission: '75000.00',
    totalAmount: '3075000.00',
    commissionRateSnapshot: '0.0250',
    fixedCommissionSnapshot: '0.00',
    paymentWindowHoursSnapshot: 48,
    paymentDeadline: '2026-11-08T09:00:00.000Z',
    createdAt: '2026-11-06T09:00:00.000Z',
    approvedByAdminId: superAdmin.id,
    sellerPayout: {
      accountId: 'payout-1',
      accountHolderName: 'بائع العقار',
      bankName: 'البنك الأهلي السعودي',
      ibanMasked: 'SA03 **** **** **** 7519',
    },
  };

  beforeEach(async () => {
    service = { finalApprove: jest.fn().mockResolvedValue(binding) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDealsController],
      providers: [
        { provide: DealsService, useValue: service },
        AdminPermissionGuard,
        Reflector,
      ],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminDealsController>(AdminDealsController);
    permissionGuard = module.get<AdminPermissionGuard>(AdminPermissionGuard);
  });

  const createMockContext = (
    admin: any,
    handler: (...args: any[]) => any,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ admin }) }),
      getHandler: () => handler,
      getClass: () => AdminDealsController,
    }) as unknown as ExecutionContext;

  describe('authorization (AC-1, AD-12)', () => {
    it('requires exactly Deals.FinalApprove', () => {
      expect(
        Reflect.getMetadata(ADMIN_PERMISSION_METADATA_KEY, controller.finalApprove),
      ).toBe('Deals.FinalApprove');
    });

    it('allows SUPER_ADMIN to approve', () => {
      const ctx = createMockContext(superAdmin, controller.finalApprove);
      expect(permissionGuard.canActivate(ctx)).toBe(true);
    });

    it('rejects a MODERATOR holding only Offers.Review with 403 AUTH_NOT_AUTHORIZED', () => {
      const ctx = createMockContext(moderator, controller.finalApprove);

      expect(() => permissionGuard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        permissionGuard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(AUTH_NOT_AUTHORIZED);
      }
      expect(service.finalApprove).not.toHaveBeenCalled();
    });
  });

  describe('body validation (AC-1)', () => {
    it('rejects a body without a UUID offerId', () => {
      const pipe = new ZodValidationPipe(finalApproveDealSchema);

      expect(() => pipe.transform({})).toThrow(BadRequestException);
      expect(() => pipe.transform({ offerId: 'offer-1' })).toThrow(BadRequestException);
      expect(pipe.transform({ offerId })).toEqual({ offerId });
    });
  });

  describe('envelope (AC-1)', () => {
    it('delegates to the service and returns the standard admin envelope', async () => {
      const res = await controller.finalApprove({ offerId }, { admin: superAdmin });

      expect(service.finalApprove).toHaveBeenCalledWith(offerId, superAdmin);
      expect(res).toEqual({
        statusCode: 200,
        message: 'تم إنشاء الصفقة وحجز الإعلان بنجاح',
        data: binding,
      });
    });

    it('surfaces the frozen reference code the UI shows on success', async () => {
      const res = await controller.finalApprove({ offerId }, { admin: superAdmin });

      expect(res.data.dealReferenceCode).toBe('ELM-ABCDEF1234-C');
    });
  });
});
