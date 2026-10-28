import {
  JOB_PAYMENT_DEADLINE_EXPIRY,
  JOB_OFFER_EXPIRY_CHECKER,
  JOB_DEMAND_EXPIRY_CHECKER,
  JOB_FAL_LICENSE_EXPIRY,
  JOB_FAL_EXPIRY_WARNINGS,
  JOB_OWNER_FEE_REMINDERS,
  JOB_NOTIFICATION_RETENTION,
  JobName,
  JobExecutionResult
} from '@elmasaif/shared';
import PgBoss from 'pg-boss';

import { paymentDeadlineExpiryHandler } from './payment-deadline-expiry.job';
import { offerExpiryCheckerHandler } from './offer-expiry-checker.job';
import { demandExpiryCheckerHandler } from './demand-expiry-checker.job';
import { falLicenseExpiryHandler } from './fal-license-expiry.job';
import { falExpiryWarningsHandler } from './fal-expiry-warnings.job';
import { ownerFeeRemindersHandler } from './owner-fee-reminders.job';
import { notificationRetentionHandler } from './notification-retention.job';

export * from './job-wrapper';
export * from './payment-deadline-expiry.job';
export * from './offer-expiry-checker.job';
export * from './demand-expiry-checker.job';
export * from './fal-license-expiry.job';
export * from './fal-expiry-warnings.job';
export * from './owner-fee-reminders.job';
export * from './notification-retention.job';

export type JobHandlerFunction = (jobs: PgBoss.Job[] | PgBoss.Job) => Promise<JobExecutionResult>;

export const jobHandlersMap: Record<JobName, JobHandlerFunction> = {
  [JOB_PAYMENT_DEADLINE_EXPIRY]: paymentDeadlineExpiryHandler,
  [JOB_OFFER_EXPIRY_CHECKER]: offerExpiryCheckerHandler,
  [JOB_DEMAND_EXPIRY_CHECKER]: demandExpiryCheckerHandler,
  [JOB_FAL_LICENSE_EXPIRY]: falLicenseExpiryHandler,
  [JOB_FAL_EXPIRY_WARNINGS]: falExpiryWarningsHandler,
  [JOB_OWNER_FEE_REMINDERS]: ownerFeeRemindersHandler,
  [JOB_NOTIFICATION_RETENTION]: notificationRetentionHandler
};
