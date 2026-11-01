import { JobName, JobScheduleConfig } from '../types/jobs';

export const JOB_PAYMENT_DEADLINE_EXPIRY = 'payment-deadline-expiry' as const;
export const JOB_OFFER_EXPIRY_CHECKER = 'offer-expiry-checker' as const;
export const JOB_DEMAND_EXPIRY_CHECKER = 'demand-expiry-checker' as const;
export const JOB_FAL_LICENSE_EXPIRY = 'fal-license-expiry' as const;
export const JOB_FAL_EXPIRY_WARNINGS = 'fal-expiry-warnings' as const;
export const JOB_OWNER_FEE_REMINDERS = 'owner-fee-reminders' as const;
export const JOB_NOTIFICATION_RETENTION = 'notification-retention' as const;
export const JOB_ACCOUNT_DELETION_EXPIRY = 'account-deletion-expiry' as const;

export const BACKGROUND_JOB_DEFINITIONS: Record<JobName, JobScheduleConfig> = {
  [JOB_PAYMENT_DEADLINE_EXPIRY]: {
    name: JOB_PAYMENT_DEADLINE_EXPIRY,
    cadence: '* * * * *',
    singletonKey: JOB_PAYMENT_DEADLINE_EXPIRY,
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInMinutes: 2,
    description: 'Scans and expires unpaid deals past payment deadline (every 60 seconds)'
  },
  [JOB_OFFER_EXPIRY_CHECKER]: {
    name: JOB_OFFER_EXPIRY_CHECKER,
    cadence: '*/5 * * * *',
    singletonKey: JOB_OFFER_EXPIRY_CHECKER,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInMinutes: 5,
    description: 'Scans and expires offers past 72-hour validity (every 5 minutes)'
  },
  [JOB_DEMAND_EXPIRY_CHECKER]: {
    name: JOB_DEMAND_EXPIRY_CHECKER,
    cadence: '0 * * * *',
    singletonKey: JOB_DEMAND_EXPIRY_CHECKER,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInMinutes: 15,
    description: 'Scans and expires demands past 30-day lifecycle (hourly)'
  },
  [JOB_FAL_LICENSE_EXPIRY]: {
    name: JOB_FAL_LICENSE_EXPIRY,
    cadence: '5 0 * * *',
    singletonKey: JOB_FAL_LICENSE_EXPIRY,
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInMinutes: 30,
    description: 'Scans and restricts profiles with expired Fal licenses (daily at 00:05 UTC)'
  },
  [JOB_FAL_EXPIRY_WARNINGS]: {
    name: JOB_FAL_EXPIRY_WARNINGS,
    cadence: '0 5 * * *',
    singletonKey: JOB_FAL_EXPIRY_WARNINGS,
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInMinutes: 30,
    description: 'Dispatches warnings for Fal licenses expiring within 30, 7, and 1 days (daily at 05:00 UTC / 08:00 KSA)'
  },
  [JOB_OWNER_FEE_REMINDERS]: {
    name: JOB_OWNER_FEE_REMINDERS,
    cadence: '0 6 * * *',
    singletonKey: JOB_OWNER_FEE_REMINDERS,
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInMinutes: 30,
    description: 'Dispatches reminders for pending owner contract fees (daily at 06:00 UTC / 09:00 KSA)'
  },
  [JOB_NOTIFICATION_RETENTION]: {
    name: JOB_NOTIFICATION_RETENTION,
    cadence: '0 2 * * *',
    singletonKey: JOB_NOTIFICATION_RETENTION,
    retryLimit: 3,
    retryDelay: 300,
    retryBackoff: true,
    expireInMinutes: 60,
    description: 'Purges read notifications older than 90 days (daily at 02:00 UTC)'
  },
  [JOB_ACCOUNT_DELETION_EXPIRY]: {
    name: JOB_ACCOUNT_DELETION_EXPIRY,
    cadence: '0 3 * * *',
    singletonKey: JOB_ACCOUNT_DELETION_EXPIRY,
    retryLimit: 3,
    retryDelay: 300,
    retryBackoff: true,
    expireInMinutes: 60,
    description: 'Scans and permanently anonymizes accounts past 14-day cooling-off period (daily at 03:00 UTC / 06:00 KSA)'
  }
};

export const BACKGROUND_JOBS = BACKGROUND_JOB_DEFINITIONS;
