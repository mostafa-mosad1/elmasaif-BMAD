import { ThemeMode } from '../enums/ui';
import { UserRole } from '../enums';
import { UpdateUserPreferencesInput } from '../schemas/preferences.schema';

export type PreferredLanguage = 'ar' | 'en';

export interface UserPreferences {
  preferredLanguage: PreferredLanguage;
  themeMode: ThemeMode | 'light' | 'dark' | 'system';
  defaultRole?: UserRole | 'BUYER' | 'OWNER' | 'MARKETER';
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingAlerts: boolean;
  inquiryAlerts: boolean;
  criticalAlertsMandatory: boolean;
  updatedAt: string | Date;
}

export type { UpdateUserPreferencesInput };

export interface UserPreferencesResponse {
  code: string;
  message: string;
  data: UserPreferences;
  requestId?: string;
}
