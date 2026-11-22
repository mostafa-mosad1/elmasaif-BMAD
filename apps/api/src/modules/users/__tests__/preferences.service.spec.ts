import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PreferencesService } from '../preferences.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  USER_PREFERENCES_UPDATED,
  PREFERENCES_CRITICAL_ALERTS_IMMUTABLE,
  UserRole
} from '@elmasaif/shared';

describe('PreferencesService (Story 1.10) (AC: 1, 2, 3, 4, 5)', () => {
  let service: PreferencesService;
  let prisma: any;

  const mockDate = new Date('2026-11-02T09:30:00.000Z');

  beforeEach(async () => {
    prisma = {
      userPreference: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
  });

  describe('getPreferences', () => {
    it('returns existing preferences when found', async () => {
      const existing = {
        id: 'pref-1',
        userId: 'usr-123',
        preferredLanguage: 'en',
        themeMode: 'dark',
        emailNotifications: false,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        createdAt: mockDate,
        updatedAt: mockDate
      };

      prisma.userPreference.findUnique.mockResolvedValue(existing);

      const result = await service.getPreferences('usr-123');

      expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
        where: { userId: 'usr-123' }
      });
      expect(result).toEqual({
        preferredLanguage: 'en',
        themeMode: 'dark',
        defaultRole: UserRole.BUYER,
        emailNotifications: false,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        criticalAlertsMandatory: true,
        updatedAt: mockDate
      });
    });

    it('creates and returns default preferences if none exist', async () => {
      prisma.userPreference.findUnique.mockResolvedValue(null);

      const createdDefault = {
        id: 'pref-2',
        userId: 'usr-456',
        preferredLanguage: 'ar',
        themeMode: 'light',
        emailNotifications: true,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        createdAt: mockDate,
        updatedAt: mockDate
      };

      prisma.userPreference.create.mockResolvedValue(createdDefault);

      const result = await service.getPreferences('usr-456');

      expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
        where: { userId: 'usr-456' }
      });
      expect(prisma.userPreference.create).toHaveBeenCalledWith({
        data: {
          userId: 'usr-456',
          preferredLanguage: 'ar',
          themeMode: 'light',
          defaultRole: UserRole.BUYER,
          emailNotifications: true,
          smsNotifications: true,
          marketingAlerts: false,
          inquiryAlerts: true
        }
      });
      expect(result).toEqual({
        preferredLanguage: 'ar',
        themeMode: 'light',
        defaultRole: UserRole.BUYER,
        emailNotifications: true,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        criticalAlertsMandatory: true,
        updatedAt: mockDate
      });
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences and records an immutable audit log entry', async () => {
      const updatedRecord = {
        id: 'pref-1',
        userId: 'usr-123',
        preferredLanguage: 'en',
        themeMode: 'dark',
        emailNotifications: true,
        smsNotifications: false,
        marketingAlerts: false,
        inquiryAlerts: true,
        createdAt: mockDate,
        updatedAt: mockDate
      };

      prisma.userPreference.upsert.mockResolvedValue(updatedRecord);
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const dto = {
        preferredLanguage: 'en' as const,
        themeMode: 'dark' as const,
        smsNotifications: false
      };

      const result = await service.updatePreferences('usr-123', dto, '192.168.1.50', 'TestAgent/1.0');

      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'usr-123' },
        update: dto,
        create: {
          userId: 'usr-123',
          preferredLanguage: 'en',
          themeMode: 'dark',
          defaultRole: UserRole.BUYER,
          smsNotifications: false,
          emailNotifications: true,
          marketingAlerts: false,
          inquiryAlerts: true
        }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: USER_PREFERENCES_UPDATED,
          actorId: 'usr-123',
          actorType: 'USER',
          entityType: 'UserPreference',
          entityId: 'usr-123',
          ipAddress: '192.168.1.50',
          payload: {
            updatedFields: dto,
            userAgent: 'TestAgent/1.0'
          }
        }
      });

      expect(result).toEqual({
        preferredLanguage: 'en',
        themeMode: 'dark',
        defaultRole: UserRole.BUYER,
        emailNotifications: true,
        smsNotifications: false,
        marketingAlerts: false,
        inquiryAlerts: true,
        criticalAlertsMandatory: true,
        updatedAt: mockDate
      });
    });

    it('updates defaultRole preference successfully', async () => {
      const updatedRecord = {
        id: 'pref-1',
        userId: 'usr-123',
        preferredLanguage: 'ar',
        themeMode: 'light',
        defaultRole: UserRole.MARKETER,
        emailNotifications: true,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        createdAt: mockDate,
        updatedAt: mockDate
      };

      prisma.userPreference.upsert.mockResolvedValue(updatedRecord);
      prisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      const dto = {
        defaultRole: UserRole.MARKETER
      };

      const result = await service.updatePreferences('usr-123', dto, '127.0.0.1');

      expect(result.defaultRole).toBe(UserRole.MARKETER);
    });

    it('rejects any attempt to set criticalAlertsMandatory to false', async () => {
      const dto: any = {
        criticalAlertsMandatory: false
      };

      await expect(
        service.updatePreferences('usr-123', dto, '127.0.0.1', 'Mozilla/5.0')
      ).rejects.toThrow(new BadRequestException(PREFERENCES_CRITICAL_ALERTS_IMMUTABLE));
    });
  });
});
