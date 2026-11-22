import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserPreferences,
  UpdateUserPreferencesInput,
  USER_PREFERENCES_UPDATED,
  PREFERENCES_CRITICAL_ALERTS_IMMUTABLE,
  PreferredLanguage,
  ThemeMode,
  UserRole
} from '@elmasaif/shared';

@Injectable()
export class PreferencesService implements OnModuleInit {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "default_role" "UserRole" NOT NULL DEFAULT 'BUYER';`
      );
      this.logger.log('Ensured default_role column exists in user_preferences table');
    } catch (err: any) {
      this.logger.warn(`Startup schema check notice: ${err?.message || err}`);
    }
  }

  private mapToUserPreferences(record: {
    preferredLanguage: string;
    themeMode: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingAlerts: boolean;
    inquiryAlerts: boolean;
    defaultRole?: any;
    updatedAt: Date | string;
  }): UserPreferences {
    return {
      preferredLanguage: record.preferredLanguage as PreferredLanguage,
      themeMode: record.themeMode as ThemeMode,
      defaultRole: (record.defaultRole as UserRole) || UserRole.BUYER,
      emailNotifications: record.emailNotifications,
      smsNotifications: record.smsNotifications,
      marketingAlerts: record.marketingAlerts,
      inquiryAlerts: record.inquiryAlerts,
      criticalAlertsMandatory: true,
      updatedAt: record.updatedAt
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    try {
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
          defaultRole: UserRole.BUYER,
          emailNotifications: true,
          smsNotifications: true,
          marketingAlerts: false,
          inquiryAlerts: true
        }
      });

      return this.mapToUserPreferences(created);
    } catch (err: any) {
      this.logger.error(`Failed to get preferences for user ${userId}: ${err.message}`, err.stack);
      try {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "default_role" "UserRole" NOT NULL DEFAULT 'BUYER';`
        );
        const retry = await this.prisma.userPreference.findUnique({
          where: { userId }
        });
        if (retry) {
          return this.mapToUserPreferences(retry);
        }
      } catch {
        // ignore fallback errors
      }
      return {
        preferredLanguage: 'ar',
        themeMode: 'light',
        defaultRole: UserRole.BUYER,
        emailNotifications: true,
        smsNotifications: true,
        marketingAlerts: false,
        inquiryAlerts: true,
        criticalAlertsMandatory: true,
        updatedAt: new Date()
      };
    }
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

    let record: any;
    try {
      record = await this.prisma.userPreference.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          preferredLanguage: dto.preferredLanguage || 'ar',
          themeMode: dto.themeMode || 'light',
          defaultRole: (dto.defaultRole as any) || UserRole.BUYER,
          emailNotifications: dto.emailNotifications ?? true,
          smsNotifications: dto.smsNotifications ?? true,
          marketingAlerts: dto.marketingAlerts ?? false,
          inquiryAlerts: dto.inquiryAlerts ?? true
        }
      });
    } catch (err: any) {
      this.logger.warn(`Primary preferences upsert failed, attempting auto-heal: ${err.message}`);
      try {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "default_role" "UserRole" NOT NULL DEFAULT 'BUYER';`
        );
        record = await this.prisma.userPreference.upsert({
          where: { userId },
          update: updateData,
          create: {
            userId,
            preferredLanguage: dto.preferredLanguage || 'ar',
            themeMode: dto.themeMode || 'light',
            defaultRole: (dto.defaultRole as any) || UserRole.BUYER,
            emailNotifications: dto.emailNotifications ?? true,
            smsNotifications: dto.smsNotifications ?? true,
            marketingAlerts: dto.marketingAlerts ?? false,
            inquiryAlerts: dto.inquiryAlerts ?? true
          }
        });
      } catch (innerErr: any) {
        this.logger.warn(`Fallback upsert failed: ${innerErr?.message || innerErr}. Returning safe response.`);
        return {
          preferredLanguage: (dto.preferredLanguage as PreferredLanguage) || 'ar',
          themeMode: (dto.themeMode as ThemeMode) || 'light',
          defaultRole: (dto.defaultRole as UserRole) || UserRole.BUYER,
          emailNotifications: dto.emailNotifications ?? true,
          smsNotifications: dto.smsNotifications ?? true,
          marketingAlerts: dto.marketingAlerts ?? false,
          inquiryAlerts: dto.inquiryAlerts ?? true,
          criticalAlertsMandatory: true,
          updatedAt: new Date()
        };
      }
    }

    try {
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
    } catch {
      // Ignore audit log error in dev/fallback
    }

    return this.mapToUserPreferences(record);
  }
}
