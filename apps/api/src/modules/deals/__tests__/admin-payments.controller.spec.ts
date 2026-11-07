import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminPaymentsController } from '../admin-payments.controller';
import { AdminPaymentsService } from '../admin-payments.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../../auth/guards/admin-permission.guard';
import { ADMIN_PERMISSION_METADATA_KEY } from '../../auth/decorators/require-admin-permission.decorator';

describe('AdminPaymentsController (Story 5.3) (AC: 1, 2, 3, 7, 8, 9)', () => {
  let controller: AdminPaymentsController;
  let service: any;
  let reflector: Reflector;

  const admin = {
    id: 'admin-auditor-1',
    fullName: 'مدقق الإثباتات',
    role: 'FINANCIAL_AUDITOR',
  };

  const paymentId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    service = {
      getQueue: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      getPayment: jest.fn().mockResolvedValue({ id: paymentId }),
      getProofDownloadUrl: jest
        .fn()
        .mockResolvedValue({ downloadUrl: 'https://download.url', expiresInSeconds: 300 }),
      claimPayment: jest.fn().mockResolvedValue({ id: paymentId, status: 'UNDER_REVIEW' }),
      heartbeatPayment: jest.fn().mockResolvedValue({ id: paymentId }),
      releasePayment: jest.fn().mockResolvedValue({ id: paymentId }),
      confirmPayment: jest.fn().mockResolvedValue({ id: paymentId, status: 'CONFIRMED' }),
      rejectPayment: jest.fn().mockResolvedValue({ id: paymentId, status: 'REJECTED' }),
      forceUnlockPayment: jest.fn().mockResolvedValue({ id: paymentId }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPaymentsController],
      providers: [{ provide: AdminPaymentsService, useValue: service }, Reflector],
    })
      .overrideGuard(AdminSessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPaymentsController>(AdminPaymentsController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('guards and permissions', () => {
    it('applies AdminSessionAuthGuard and AdminPermissionGuard at class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AdminPaymentsController);
      expect(guards).toContain(AdminSessionAuthGuard);
      expect(guards).toContain(AdminPermissionGuard);
    });

    it('requires Payments.Review on review operations', () => {
      const queuePerms = reflector.get<string | string[]>(
        ADMIN_PERMISSION_METADATA_KEY,
        AdminPaymentsController.prototype.getQueue,
      );
      expect(queuePerms).toBe('Payments.Review');

      const claimPerms = reflector.get<string | string[]>(
        ADMIN_PERMISSION_METADATA_KEY,
        AdminPaymentsController.prototype.claimPayment,
      );
      expect(claimPerms).toBe('Payments.Review');

      const confirmPerms = reflector.get<string | string[]>(
        ADMIN_PERMISSION_METADATA_KEY,
        AdminPaymentsController.prototype.confirmPayment,
      );
      expect(confirmPerms).toBe('Payments.Review');

      const rejectPerms = reflector.get<string | string[]>(
        ADMIN_PERMISSION_METADATA_KEY,
        AdminPaymentsController.prototype.rejectPayment,
      );
      expect(rejectPerms).toBe('Payments.Review');
    });

    it('requires Tasks.ForceUnlock on forceUnlockPayment', () => {
      const forceUnlockPerms = reflector.get<string | string[]>(
        ADMIN_PERMISSION_METADATA_KEY,
        AdminPaymentsController.prototype.forceUnlockPayment,
      );
      expect(forceUnlockPerms).toBe('Tasks.ForceUnlock');
    });
  });

  describe('response envelopes and messaging', () => {
    const req = { admin };

    it('getQueue wraps data', async () => {
      const res = await controller.getQueue({} as any, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data).toEqual({ items: [], meta: { total: 0 } });
      expect(service.getQueue).toHaveBeenCalledWith({}, admin.id);
    });

    it('getPayment wraps data', async () => {
      const res = await controller.getPayment(paymentId, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data.id).toBe(paymentId);
      expect(service.getPayment).toHaveBeenCalledWith(paymentId, admin.id);
    });

    it('getProofDownloadUrl wraps data', async () => {
      const res = await controller.getProofDownloadUrl(paymentId);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data.downloadUrl).toBe('https://download.url');
    });

    it('claimPayment includes Arabic success message', async () => {
      const res = await controller.claimPayment(paymentId, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم استلام مهمة التدقيق لمدة 15 دقيقة');
      expect(service.claimPayment).toHaveBeenCalledWith(paymentId, admin);
    });

    it('heartbeatPayment includes Arabic success message', async () => {
      const res = await controller.heartbeatPayment(paymentId, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم تمديد قفل التدقيق');
    });

    it('releasePayment includes Arabic success message', async () => {
      const res = await controller.releasePayment(paymentId, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم تحرير قفل التدقيق');
    });

    it('confirmPayment includes Arabic success message', async () => {
      const res = await controller.confirmPayment(paymentId, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم تأكيد إثبات الدفع');
      expect(service.confirmPayment).toHaveBeenCalledWith(paymentId, admin);
    });

    it('rejectPayment includes Arabic success message', async () => {
      const res = await controller.rejectPayment(paymentId, { reason: 'إيصال غير صالح' }, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم رفض إثبات الدفع وتسجيل السبب');
      expect(service.rejectPayment).toHaveBeenCalledWith(paymentId, admin, 'إيصال غير صالح');
    });

    it('forceUnlockPayment includes Arabic success message', async () => {
      const res = await controller.forceUnlockPayment(paymentId, { reason: 'مشرف غائب' }, req);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.message).toBe('تم إلغاء قفل التدقيق وتسجيل السبب');
      expect(service.forceUnlockPayment).toHaveBeenCalledWith(paymentId, admin, 'مشرف غائب');
    });
  });
});
