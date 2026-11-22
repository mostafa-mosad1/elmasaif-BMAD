import { z } from 'zod';
import { PREFERENCES_CRITICAL_ALERTS_IMMUTABLE } from '../constants/auth';
import { UserRole } from '../enums';

export const updateUserPreferencesSchema = z
  .object({
    preferredLanguage: z.enum(['ar', 'en']).optional(),
    themeMode: z.enum(['light', 'dark', 'system']).optional(),
    defaultRole: z.nativeEnum(UserRole).optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    marketingAlerts: z.boolean().optional(),
    inquiryAlerts: z.boolean().optional(),
    criticalAlertsMandatory: z.boolean().optional()
  })
  .refine(
    (data) =>
      data.criticalAlertsMandatory === undefined || data.criticalAlertsMandatory === true,
    {
      message: PREFERENCES_CRITICAL_ALERTS_IMMUTABLE,
      path: ['criticalAlertsMandatory']
    }
  );

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

