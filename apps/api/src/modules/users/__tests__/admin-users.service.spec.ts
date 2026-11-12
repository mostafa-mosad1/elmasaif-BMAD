import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ProfileStatus,
  USER_HARD_DELETE_HISTORY_EXISTS,
  USER_NOT_FOUND,
  UserRole,
  VerificationStatus,
} from '@elmasaif/shared';
import { AdminUsersService } from '../admin-users.service';
import { AccountDeletionService } from '../account-deletion.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';

describe('AdminUsersService (Story 8.2 Platform User Governance) (AC: 5)', () => {
  const fixedNow = new Date('2026-11-12T10:00:00.000Z');
  let service: AdminUsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    userProfile: {
      findMany: jest.Mock;
    };
    session: {
      deleteMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    contractFeePayment: {
      count: jest.Mock;
    };
    listingInquiry: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let clockService: { now: jest.Mock };
  let accountDeletionService: { countUserTransactionHistory: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userProfile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'profile-1' }]),
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      contractFeePayment: {
        count: jest.fn().mockResolvedValue(0),
      },
      listingInquiry: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
        cb(prisma)
      ),
    };

    clockService = {
      now: jest.fn(() => new Date(fixedNow.getTime())),
    };

    accountDeletionService = {
      countUserTransactionHistory: jest.fn().mockResolvedValue(0),
    };

    service = new AdminUsersService(
      prisma as unknown as PrismaService,
      clockService as unknown as ClockService,
      accountDeletionService as unknown as AccountDeletionService
    );
  });

  it('lists platform users with role, verificationStatus, isActive, deletedAt, and transactionHistoryCount', async () => {
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'user-1',
        username: 'buyer_1',
        fullName: 'سعد القحطاني',
        mobileNumber: '+966500000001',
        status: ProfileStatus.ACTIVE,
        isActive: true,
        deletedAt: null,
        createdAt: fixedNow,
        profiles: [{ id: 'profile-1', role: UserRole.BUYER }],
        identityDocuments: [{ status: VerificationStatus.VERIFIED }],
      },
    ]);
    accountDeletionService.countUserTransactionHistory.mockResolvedValueOnce(4);

    const list = await service.listUsers();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'user-1',
      phone: '+966500000001',
      fullName: 'سعد القحطاني',
      role: UserRole.BUYER,
      verificationStatus: VerificationStatus.VERIFIED,
      isActive: true,
      deletedAt: null,
      transactionHistoryCount: 4,
    });
  });

  it('disables, soft-deletes, and re-enables a platform user account, revoking sessions and logging ADMIN_USER_STATUS_CHANGED', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateUserStatus(
        'admin-1',
        'missing-user',
        { action: 'DISABLE', reason: 'تحقق أمني' },
        '10.0.0.1'
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: USER_NOT_FOUND }),
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-user' },
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'buyer_1',
      fullName: 'سعد القحطاني',
      mobileNumber: '+966500000001',
      status: ProfileStatus.ACTIVE,
      isActive: true,
      deletedAt: null,
      createdAt: fixedNow,
    });
    prisma.user.update.mockImplementation(async ({ data }) => ({
      id: 'user-1',
      username: 'buyer_1',
      fullName: 'سعد القحطاني',
      mobileNumber: '+966500000001',
      status: data.status,
      isActive: data.isActive,
      deletedAt: data.deletedAt,
      createdAt: fixedNow,
    }));

    const softDeleted = await service.updateUserStatus(
      'admin-1',
      'user-1',
      {
        action: 'SOFT_DELETE',
        reason: 'طلب إيقاف الحساب مع الاحتفاظ بالسجلات النظامية',
      },
      '10.0.0.1'
    );

    expect(softDeleted.isActive).toBe(false);
    expect(softDeleted.deletedAt).toEqual(fixedNow);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'ADMIN_USER_STATUS_CHANGED',
          entityId: 'user-1',
        }),
      })
    );

    const reEnabled = await service.updateUserStatus(
      'admin-1',
      'user-1',
      {
        action: 'ENABLE',
        reason: 'إعادة تفعيل الحساب بعد المراجعة',
      },
      '10.0.0.1'
    );
    expect(reEnabled.isActive).toBe(true);
    expect(reEnabled.deletedAt).toBeNull();
  });

  it('strictly blocks hard-delete with 409 USER_HARD_DELETE_HISTORY_EXISTS when transaction history > 0 and deletes when 0', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-with-tx',
      username: 'buyer_tx',
      fullName: 'مشتري له معاملات',
      mobileNumber: '+966500000002',
      status: ProfileStatus.DISABLED,
      isActive: false,
    });
    accountDeletionService.countUserTransactionHistory.mockResolvedValueOnce(2);

    await expect(
      service.hardDeleteUser(
        'admin-super-1',
        'user-with-tx',
        { reason: 'محاولة حذف نهائي لحساب له صفقات وعروض' },
        '10.0.0.1'
      )
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_USER_HARD_DELETE_BLOCKED',
          payload: expect.objectContaining({
            code: USER_HARD_DELETE_HISTORY_EXISTS,
            historyCount: 2,
          }),
        }),
      })
    );

    // Zero transaction history -> allows permanent hard-delete
    accountDeletionService.countUserTransactionHistory.mockResolvedValueOnce(0);
    prisma.user.delete.mockResolvedValueOnce({ id: 'user-with-tx' });

    const deleted = await service.hardDeleteUser(
      'admin-super-1',
      'user-with-tx',
      { reason: 'حساب مكرر بدون أي معاملات' },
      '10.0.0.1'
    );

    expect(deleted.deleted).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-with-tx' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_USER_HARD_DELETED',
        }),
      })
    );
  });
});

