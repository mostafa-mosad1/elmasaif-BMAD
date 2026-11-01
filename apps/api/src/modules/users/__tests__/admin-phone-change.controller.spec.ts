import { Test, TestingModule } from '@nestjs/testing';
import { AdminPhoneChangeController } from '../admin-phone-change.controller';
import { PhoneChangeService } from '../phone-change.service';
import { AdminSessionAuthGuard } from '../../auth/guards/admin-session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { AdminRole } from '@elmasaif/shared';

describe('AdminPhoneChangeController (Story 1.7 Support-Assisted Phone Change) (AC: 5)', () => {
  let controller: AdminPhoneChangeController;
  let service: any;
  let mockPrisma: any;
  let mockClock: any;

  const mockAdmin = {
    id: 'admin-super-id',
    username: 'superadmin',
    email: 'admin@elmasaif.sa',
    fullName: 'المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    isActive: true
  };

  const mockReq = {
    admin: mockAdmin,
    ip: '10.0.0.5',
    headers: {
      'x-request-id': 'req-admin-123'
    }
  };

  beforeEach(async () => {
    service = {
      adminPhoneChange: jest.fn()
    };

    mockPrisma = {
      adminSession: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-11-01T12:00:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPhoneChangeController],
      providers: [
        { provide: PhoneChangeService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        AdminSessionAuthGuard
      ]
    }).compile();

    controller = module.get<AdminPhoneChangeController>(AdminPhoneChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /admin/users/:userId/phone-change (AC: 5)', () => {
    it('delegates to phoneChangeService.adminPhoneChange with admin details and returns envelope', async () => {
      service.adminPhoneChange.mockResolvedValueOnce({
        code: 'ADMIN_PHONE_CHANGE_SUCCESS',
        message: 'تم تحديث رقم جوال المستخدم بنجاح عبر الدعم الفني وتوثيق سجل الرقابة',
        data: {
          mobileNumber: '+966598765432',
          isCompleted: true
        }
      });

      const body = {
        newMobileNumber: '+966598765432',
        officialIdVerified: true as const,
        reason: 'تم التحقق من بطاقة الهوية الوطنية والمستندات الرسمية بالفرع'
      };

      const res = await controller.adminPhoneChange('target-user-1', body, mockReq);

      expect(service.adminPhoneChange).toHaveBeenCalledWith(
        mockAdmin.id,
        mockAdmin.role,
        'target-user-1',
        body,
        mockReq.ip
      );
      expect(res.code).toBe('ADMIN_PHONE_CHANGE_SUCCESS');
      expect(res.data.isCompleted).toBe(true);
      expect(res.data.mobileNumber).toBe('+966598765432');
      expect(res.requestId).toBe('req-admin-123');
    });
  });
});

