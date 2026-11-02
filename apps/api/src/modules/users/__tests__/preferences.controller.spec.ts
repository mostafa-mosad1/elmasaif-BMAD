import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesController } from '../preferences.controller';
import { PreferencesService } from '../preferences.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  USER_PREFERENCES_RETRIEVED,
  USER_PREFERENCES_UPDATED,
  UserPreferences
} from '@elmasaif/shared';

describe('PreferencesController (Story 1.10 Endpoints) (AC: 4, 5)', () => {
  let controller: PreferencesController;
  let service: any;
  let mockPrisma: any;
  let mockClock: any;

  const mockUser = {
    id: 'usr-controller-99',
    mobileNumber: '+966509998877'
  };

  const mockReq = {
    user: mockUser,
    ip: '192.168.1.105',
    headers: {
      'x-request-id': 'req-pref-1234',
      'user-agent': 'PreferencesTestRunner/1.0'
    }
  };

  const samplePreferences: UserPreferences = {
    preferredLanguage: 'ar',
    themeMode: 'light',
    emailNotifications: true,
    smsNotifications: true,
    marketingAlerts: false,
    inquiryAlerts: true,
    criticalAlertsMandatory: true,
    updatedAt: new Date('2026-11-02T09:30:00.000Z')
  };

  beforeEach(async () => {
    service = {
      getPreferences: jest.fn(),
      updatePreferences: jest.fn()
    };

    mockPrisma = {
      session: { findUnique: jest.fn() }
    };

    mockClock = {
      now: jest.fn(() => new Date('2026-11-02T09:30:00Z'))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [
        { provide: PreferencesService, useValue: service },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClockService, useValue: mockClock },
        SessionAuthGuard
      ]
    }).compile();

    controller = module.get<PreferencesController>(PreferencesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/preferences', () => {
    it('retrieves user preferences and envelopes with requestId', async () => {
      service.getPreferences.mockResolvedValue(samplePreferences);

      const response = await controller.getPreferences(mockReq);

      expect(service.getPreferences).toHaveBeenCalledWith('usr-controller-99');
      expect(response).toEqual({
        code: USER_PREFERENCES_RETRIEVED,
        message: 'تم استرجاع تفضيلات المستخدم بنجاح',
        data: samplePreferences,
        requestId: 'req-pref-1234'
      });
    });
  });

  describe('PATCH /users/preferences', () => {
    it('updates user preferences and returns updated data with requestId', async () => {
      const updatedPrefs: UserPreferences = {
        ...samplePreferences,
        preferredLanguage: 'en',
        themeMode: 'dark',
        smsNotifications: false
      };

      service.updatePreferences.mockResolvedValue(updatedPrefs);

      const dto = {
        preferredLanguage: 'en' as const,
        themeMode: 'dark' as const,
        smsNotifications: false
      };

      const response = await controller.updatePreferences(dto, mockReq);

      expect(service.updatePreferences).toHaveBeenCalledWith(
        'usr-controller-99',
        dto,
        '192.168.1.105',
        'PreferencesTestRunner/1.0'
      );
      expect(response).toEqual({
        code: USER_PREFERENCES_UPDATED,
        message: 'تم تحديث تفضيلات المستخدم بنجاح',
        data: updatedPrefs,
        requestId: 'req-pref-1234'
      });
    });
  });
});

