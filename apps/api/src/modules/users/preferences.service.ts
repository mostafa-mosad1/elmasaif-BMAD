import {
  Injectable,
  Logger,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserPreferences,
  UpdateUserPreferencesInput,
  USER_PREFERENCES_UPDATED,
  PREFERENCES_CRITICAL_ALERTS_IMMUTABLE,
  PreferredLanguage,
  ThemeMode
} from '@elmasaif/shared';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapToUserPreferences(record: {
    preferredLanguage: string;
    themeMode: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingAlerts: boolean;
    inquiryAlerts: boolean;
    updatedAt: Date | string;
  }): UserPreferences {
    return {
      preferredLanguage: record.preferredLanguage as PreferredLanguage,
      themeMode: record.themeMode as ThemeMode,
      emailNotifications: record.emailNotifications,
      smsNotifications: record.smsNotifications,
      marketingAlerts: record.marketingAlerts,
      inquiryAlerts: record.inquiryAlerts,
      criticalAlertsMandatory: true,
      updatedAt: record.updatedAt
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId }
    });

    if (existing) {
      return this.mapToUserPreferences(existing);
    }

    // Default preferences creation per AC-5 & FR-60
    const created = await this.prisma.userPreference.create({
      data: {
        userId,
        preferredLanguage: 'ar',
        themeMode: 'light',
        emailNotifications: true,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true
      }
    });

    return this.mapToUserPreferences(created);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesInput,
    ip?: string,
    userAgent?: string
  ): Promise<UserPreferences> {
    if (dto.criticalAlertsMandatory === false) {
      throw new BadRequestException(PREFERENCES_CRITICAL_ALERTS_IMMUTABLE);
    }

    // Strip virtual invariant before persisting to DB
    const updateData = { ...dto };
    delete (updateData as { criticalAlertsMandatory?: boolean }).criticalAlertsMandatory;

    const record = await this.prisma.userPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        preferredLanguage: dto.preferredLanguage || 'ar',
        themeMode: dto.themeMode || 'light',
        emailNotifications: dto.emailNotifications ?? true,
        smsNotifications: dto.smsNotifications ?? true,
        marketingAlerts: dto.marketingAlerts ?? false,
        inquiryAlerts: dto.inquiryAlerts ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        action: USER_PREFERENCES_UPDATED,
        actorId: userId,
        actorType: 'USER',
        entityType: 'UserPreference',
        entityId: userId,
        ipAddress: ip || null,
        payload: {
          updatedFields: dto,
          userAgent: userAgent || null
        }
      }
    });

    return this.mapToUserPreferences(record);
  }
}
